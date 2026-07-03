import { eciToScene } from './coordinates';
import { propagateObject } from './propagator';
import type { ConjunctionEvent, OrbitLayer, TrackedObject } from '../types';

export interface ConjunctionScanResult {
  alerts: ConjunctionEvent[];
  hiddenCount: number;
}

export const THRESHOLD_KM = 3;
export const MIN_DISTANCE_KM = 0.1;
export const CHECK_INTERVAL_MS = 5_000;
/** Minimum real-time gap between conjunction recomputes (all speed modes). */
export const CHECK_WALL_INTERVAL_MS = 5_000;
/** Max close-approach alerts shown in the left panel (sorted by minimum distance). */
export const MAX_DISPLAY_ALERTS = 5;
export const SUBSET: OrbitLayer = 'LEO';
export const REFINE_WINDOW_MS = 2 * 60 * 60 * 1000;
export const REFINE_STEP_MS = 60 * 1000;
export const VERIFY_REWIND_MS = 60 * 1000;
/** Orbit preview window around CPA — 15 s before + 15 s after = 30 s total. */
export const VERIFY_TRAIL_BACK_MS = 15 * 1000;
export const VERIFY_TRAIL_FORWARD_MS = 15 * 1000;
export const VERIFY_TRAIL_STEP_MS = 2_000;
export const COLLISION_THRESHOLD_KM = 0.1;
/** Crossing-orbit pairs below this relative speed are co-orbiting, not collision flybys. */
export const CROSSING_MIN_REL_VELOCITY_KM_S = 0.05;
export const RISK_NO_KM = 5;
export const RISK_LOW_KM = 3;
export const RISK_CRITICAL_KM = 1;

export type VerificationStatus =
  | 'PENDING'
  | 'APPROACHING'
  | 'COLLISION CONFIRMED'
  | 'COLLISION AVERTED';

export function conjunctionPairKey(objectA: string, objectB: string): string {
  return [objectA, objectB].sort().join('|');
}

/** Unique key per verification session — pair, CPA instant, and object indices. */
export function conjunctionSessionKey(event: ConjunctionEvent): string {
  return `${conjunctionPairKey(event.objectA, event.objectB)}|${event.time.getTime()}|${event.indexA}|${event.indexB}`;
}

export function formatCloseApproachAlert(objectA: string, objectB: string, distanceKm: number): string {
  return `${objectA} vs ${objectB} - ${distanceKm.toFixed(2)} km close approach!`;
}

export function getRiskAssessment(
  distanceKm: number,
): 'NO RISK' | 'LOW RISK' | 'MONITORING' | 'CRITICAL RISK' {
  if (distanceKm >= RISK_NO_KM) return 'NO RISK';
  if (distanceKm >= RISK_LOW_KM) return 'LOW RISK';
  if (distanceKm >= RISK_CRITICAL_KM) return 'MONITORING';
  return 'CRITICAL RISK';
}

export function formatRelativeVelocityKmS(kmS: number): string {
  if (kmS < 0.01) return `${(kmS * 1000).toFixed(1)} m/s`;
  if (kmS < 1) return `${kmS.toFixed(3)} km/s`;
  return `${kmS.toFixed(2)} km/s`;
}

export function isCoOrbitingPair(relativeVelocityKmS: number): boolean {
  return relativeVelocityKmS < CROSSING_MIN_REL_VELOCITY_KM_S;
}

export function getDistanceAtTime(
  objects: TrackedObject[],
  indexA: number,
  indexB: number,
  date: Date,
): number | null {
  const objA = objects[indexA];
  const objB = objects[indexB];
  if (!objA || !objB) return null;

  const propA = propagateObject(objA.satrec, date);
  const propB = propagateObject(objB.satrec, date);
  if (!propA || !propB) return null;

  return distanceKm(propA.positionEci, propB.positionEci);
}

export function getRelativeVelocityAtTime(
  objects: TrackedObject[],
  indexA: number,
  indexB: number,
  date: Date,
): number | null {
  const objA = objects[indexA];
  const objB = objects[indexB];
  if (!objA || !objB) return null;

  const propA = propagateObject(objA.satrec, date);
  const propB = propagateObject(objB.satrec, date);
  if (!propA || !propB) return null;

  return relativeVelocityKmS(propA.velocityEci, propB.velocityEci);
}

export function getVerificationAssessment(
  liveDistanceKm: number | null,
  simTimeMs: number,
  cpaTimeMs: number,
  cpaDistanceKm: number,
  playing: boolean,
): {
  status: VerificationStatus;
  riskLabel: string;
  hint: string;
} {
  const msToCpa = cpaTimeMs - simTimeMs;
  const atOrPastCpa = msToCpa <= 500;

  if (liveDistanceKm == null) {
    return {
      status: 'PENDING',
      riskLabel: 'UNAVAILABLE',
      hint: 'Propagation unavailable at current simulation time.',
    };
  }

  if (atOrPastCpa) {
    const confirmed = liveDistanceKm < COLLISION_THRESHOLD_KM;
    return {
      status: confirmed ? 'COLLISION CONFIRMED' : 'COLLISION AVERTED',
      riskLabel: confirmed ? 'COLLISION CONFIRMED' : 'COLLISION AVERTED',
      hint: confirmed
        ? `Closest approach ${liveDistanceKm.toFixed(3)} km — within collision threshold.`
        : `Closest approach ${liveDistanceKm.toFixed(3)} km — collision avoided.`,
    };
  }

  if (playing || msToCpa < VERIFY_REWIND_MS) {
    const risk = getRiskAssessment(liveDistanceKm);
    return {
      status: 'APPROACHING',
      riskLabel: risk,
      hint: 'Simulation ongoing… Tracking live separation and relative velocity.',
    };
  }

  return {
    status: 'PENDING',
    riskLabel: getRiskAssessment(cpaDistanceKm),
    hint: 'Simulation paused. Press Play or LIVE to run verification.',
  };
}

interface CachedConjunctions {
  simTimeMs: number;
  wallTimeMs: number;
  scan: ConjunctionScanResult;
}

let cache: CachedConjunctions | null = null;

type ConjunctionRefreshListener = (result: ConjunctionScanResult) => void;

let pendingRefresh: {
  objects: TrackedObject[];
  simTimeMs: number;
  listener: ConjunctionRefreshListener;
} | null = null;
let refreshScheduled = false;
let refreshInFlight = false;

function runConjunctionRefresh(): void {
  if (refreshInFlight || !pendingRefresh) return;

  refreshInFlight = true;
  refreshScheduled = false;

  const { objects, simTimeMs, listener } = pendingRefresh;
  pendingRefresh = null;

  const scan = findConjunctions(objects, new Date(simTimeMs));
  cache = { simTimeMs, wallTimeMs: performance.now(), scan };
  refreshInFlight = false;
  listener(scan);

  if (pendingRefresh) {
    scheduleConjunctionRefresh();
  }
}

function scheduleConjunctionRefresh(): void {
  if (refreshScheduled || refreshInFlight) return;
  refreshScheduled = true;

  const idle = globalThis.requestIdleCallback;
  if (typeof idle === 'function') {
    idle(
      (deadline) => {
        refreshScheduled = false;
        if (deadline.timeRemaining() < 6 && pendingRefresh) {
          scheduleConjunctionRefresh();
          return;
        }
        runConjunctionRefresh();
      },
      { timeout: 6_000 },
    );
    return;
  }

  globalThis.setTimeout(() => {
    refreshScheduled = false;
    runConjunctionRefresh();
  }, 0);
}

function queueConjunctionRefresh(
  objects: TrackedObject[],
  simTimeMs: number,
  listener: ConjunctionRefreshListener,
): void {
  pendingRefresh = { objects, simTimeMs, listener };
  scheduleConjunctionRefresh();
}

function distanceKm(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function relativeVelocityKmS(
  va: { x: number; y: number; z: number },
  vb: { x: number; y: number; z: number },
): number {
  const dx = va.x - vb.x;
  const dy = va.y - vb.y;
  const dz = va.z - vb.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function midpointScene(
  posA: { x: number; y: number; z: number },
  posB: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const sceneA = eciToScene(posA.x, posA.y, posA.z);
  const sceneB = eciToScene(posB.x, posB.y, posB.z);
  return {
    x: (sceneA.x + sceneB.x) / 2,
    y: (sceneA.y + sceneB.y) / 2,
    z: (sceneA.z + sceneB.z) / 2,
  };
}

function findObjectIndex(objects: TrackedObject[], name: string): number {
  const exact = objects.findIndex((o) => o.name === name);
  if (exact >= 0) return exact;
  const upper = name.toUpperCase();
  return objects.findIndex((o) => o.name.toUpperCase() === upper);
}

/** TLE identity — ISS modules often share identical ephemeris lines. */
export function orbitFingerprint(obj: TrackedObject): string {
  return `${obj.line1}|${obj.line2}`;
}

export function sharesOrbitData(a: TrackedObject, b: TrackedObject): boolean {
  return orbitFingerprint(a) === orbitFingerprint(b);
}

export function getColocatedObjectNames(objects: TrackedObject[], index: number): string[] {
  const ref = objects[index];
  if (!ref) return [];
  const fp = orbitFingerprint(ref);
  return objects
    .filter((o) => orbitFingerprint(o) === fp)
    .map((o) => o.name)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

function quantizeEciKm(value: number): number {
  return Math.round(value * 10) / 10;
}

function positionFingerprint(x: number, y: number, z: number): string {
  return `${quantizeEciKm(x)},${quantizeEciKm(y)},${quantizeEciKm(z)}`;
}

/** Same real-world encounter even if catalog lists different co-located modules. */
export function physicalConjunctionKey(event: ConjunctionEvent, objects: TrackedObject[]): string {
  const propA = propagateObject(objects[event.indexA]?.satrec, event.time);
  const propB = propagateObject(objects[event.indexB]?.satrec, event.time);
  if (!propA || !propB) return conjunctionSessionKey(event);

  const fpA = positionFingerprint(
    propA.positionEci.x,
    propA.positionEci.y,
    propA.positionEci.z,
  );
  const fpB = positionFingerprint(
    propB.positionEci.x,
    propB.positionEci.y,
    propB.positionEci.z,
  );
  const [f1, f2] = [fpA, fpB].sort();
  const tSec = Math.floor(event.time.getTime() / 1000);
  return `${f1}|${f2}|${tSec}`;
}

function preferConjunctionEvent(
  a: ConjunctionEvent,
  b: ConjunctionEvent,
  objects: TrackedObject[],
): ConjunctionEvent {
  const objA = objects[a.indexA];
  const objB = objects[b.indexA];
  if (!objA || !objB) return a;

  if (objA.category === 'stations' && objB.category !== 'stations') return a;
  if (objB.category === 'stations' && objA.category !== 'stations') return b;
  if (objA.noradId !== objB.noradId) return objA.noradId < objB.noradId ? a : b;
  return a.objectA.localeCompare(b.objectA, 'en', { sensitivity: 'base' }) <= 0 ? a : b;
}

function deduplicatePhysicalConjunctions(
  events: ConjunctionEvent[],
  objects: TrackedObject[],
): ConjunctionEvent[] {
  const seen = new Map<string, ConjunctionEvent>();

  for (const event of events) {
    const key = physicalConjunctionKey(event, objects);
    const existing = seen.get(key);
    seen.set(key, existing ? preferConjunctionEvent(existing, event, objects) : event);
  }

  return Array.from(seen.values()).sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Freeze alert CPA metadata — always resolve indices by name, never reuse stale indices. */
export function normalizeConjunctionAlert(
  alert: ConjunctionEvent,
  objects: TrackedObject[],
): ConjunctionEvent | null {
  const indexA = findObjectIndex(objects, alert.objectA);
  const indexB = findObjectIndex(objects, alert.objectB);

  if (indexA < 0 || indexB < 0) return null;

  const time = new Date(alert.time.getTime());
  const propA = propagateObject(objects[indexA].satrec, time);
  const propB = propagateObject(objects[indexB].satrec, time);
  if (!propA || !propB) return null;

  return {
    objectA: alert.objectA,
    objectB: alert.objectB,
    indexA,
    indexB,
    distanceKm: alert.distanceKm,
    relativeVelocityKmS: relativeVelocityKmS(propA.velocityEci, propB.velocityEci),
    time,
    midpointScene: midpointScene(propA.positionEci, propB.positionEci),
  };
}

export function refineCloseApproach(
  objects: TrackedObject[],
  indexA: number,
  indexB: number,
  centerTime: Date,
): ConjunctionEvent | null {
  const objA = objects[indexA];
  const objB = objects[indexB];
  if (!objA || !objB) return null;

  const centerMs = centerTime.getTime();
  let bestDistance = Infinity;
  let bestTime = centerTime;
  let bestPosA = null as ReturnType<typeof propagateObject> | null;
  let bestPosB = null as ReturnType<typeof propagateObject> | null;

  for (let t = centerMs - REFINE_WINDOW_MS; t <= centerMs + REFINE_WINDOW_MS; t += REFINE_STEP_MS) {
    const date = new Date(t);
    const propA = propagateObject(objA.satrec, date);
    const propB = propagateObject(objB.satrec, date);
    if (!propA || !propB) continue;

    const distance = distanceKm(propA.positionEci, propB.positionEci);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestTime = date;
      bestPosA = propA;
      bestPosB = propB;
    }
  }

  if (!bestPosA || !bestPosB || bestDistance === Infinity) return null;

  return {
    objectA: objA.name,
    objectB: objB.name,
    indexA,
    indexB,
    distanceKm: bestDistance,
    relativeVelocityKmS: relativeVelocityKmS(bestPosA.velocityEci, bestPosB.velocityEci),
    time: bestTime,
    midpointScene: midpointScene(bestPosA.positionEci, bestPosB.positionEci),
  };
}

export function resolveConjunctionEvent(
  objects: TrackedObject[],
  objectA: string,
  objectB: string,
  referenceTime: Date,
): ConjunctionEvent | null {
  const indexA = findObjectIndex(objects, objectA);
  const indexB = findObjectIndex(objects, objectB);
  if (indexA < 0 || indexB < 0) return null;
  return refineCloseApproach(objects, indexA, indexB, referenceTime);
}

export function findConjunctions(objects: TrackedObject[], date: Date): ConjunctionScanResult {
  const leoEntries: { index: number; name: string; position: { x: number; y: number; z: number } }[] = [];

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (obj.layer !== SUBSET) continue;
    const propagation = propagateObject(obj.satrec, date);
    if (!propagation) continue;
    leoEntries.push({ index: i, name: obj.name, position: propagation.positionEci });
  }

  const pairs: ConjunctionEvent[] = [];

  for (let i = 0; i < leoEntries.length; i++) {
    for (let j = i + 1; j < leoEntries.length; j++) {
      const objI = objects[leoEntries[i].index];
      const objJ = objects[leoEntries[j].index];
      if (sharesOrbitData(objI, objJ)) continue;

      const distance = distanceKm(leoEntries[i].position, leoEntries[j].position);
      if (distance >= MIN_DISTANCE_KM && distance <= THRESHOLD_KM) {
        const refined = refineCloseApproach(
          objects,
          leoEntries[i].index,
          leoEntries[j].index,
          date,
        );
        if (!refined) continue;
        if (isCoOrbitingPair(refined.relativeVelocityKmS)) continue;
        pairs.push(refined);
      }
    }
  }

  pairs.sort((a, b) => a.distanceKm - b.distanceKm);
  const ranked = deduplicatePhysicalConjunctions(pairs, objects);
  return {
    alerts: ranked.slice(0, MAX_DISPLAY_ALERTS),
    hiddenCount: Math.max(0, ranked.length - MAX_DISPLAY_ALERTS),
  };
}

export function getConjunctions(
  objects: TrackedObject[],
  simTime: Date,
  _speed = 1,
  onRefresh?: ConjunctionRefreshListener,
): ConjunctionScanResult {
  const simTimeMs = simTime.getTime();
  const now = performance.now();
  const empty: ConjunctionScanResult = { alerts: [], hiddenCount: 0 };

  if (cache && simTimeMs < cache.simTimeMs) {
    cache = null;
  }

  if (cache && Math.abs(simTimeMs - cache.simTimeMs) < CHECK_INTERVAL_MS) {
    return cache.scan;
  }

  if (cache && now - cache.wallTimeMs < CHECK_WALL_INTERVAL_MS) {
    return cache.scan;
  }

  if (onRefresh) {
    queueConjunctionRefresh(objects, simTimeMs, onRefresh);
    return cache?.scan ?? empty;
  }

  const scan = findConjunctions(objects, simTime);
  cache = { simTimeMs, wallTimeMs: now, scan };
  return scan;
}

export function invalidateConjunctionCache(): void {
  cache = null;
  pendingRefresh = null;
}
