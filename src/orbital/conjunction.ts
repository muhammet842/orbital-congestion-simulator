import { eciToScene } from './coordinates';
import { propagateObject } from './propagator';
import type { ConjunctionEvent, OrbitLayer, TrackedObject } from '../types';

export interface ConjunctionScanResult {
  alerts: ConjunctionEvent[];
  hiddenCount: number;
}

export const THRESHOLD_KM = 3;
export const MIN_DISTANCE_KM = 0.1;
export const CHECK_INTERVAL_MS = 1_500;
/** Minimum real-time gap between conjunction recomputes (all speed modes). */
export const CHECK_WALL_INTERVAL_MS = 1_500;
/**
 * Many crossing LEO pairs close at 5-12 km/s — at that speed a pair only
 * stays inside the final THRESHOLD_KM for roughly 0.5-2s. Point-sampling the
 * instantaneous distance every CHECK_WALL_INTERVAL_MS can step right over a
 * window that narrow. To catch these, the coarse spatial-hash pass casts a
 * wider net (DETECTION_RADIUS_KM) so fast-closing pairs are flagged as
 * candidates *before* they're actually within THRESHOLD_KM, then a fine-step
 * refine pass (see LIVE_REFINE_*) pinpoints the true minimum distance. The
 * final alert still requires the refined distance to be <= THRESHOLD_KM —
 * this only widens what gets a closer look, not what counts as a conjunction.
 */
export const DETECTION_RADIUS_KM = 20;
/** Max close-approach alerts shown in the left panel (sorted by minimum distance). */
export const MAX_DISPLAY_ALERTS = 5;
export const SUBSET: OrbitLayer = 'LEO';
export const REFINE_WINDOW_MS = 2 * 60 * 60 * 1000;
export const REFINE_STEP_MS = 60 * 1000;
/** Tight, fine-grained refine window used by the live scan — precise enough
 *  to resolve sub-3-second close-approach windows, unlike the coarse
 *  ±2h/60s window used for one-off historical/verification lookups. Combined
 *  with the automatic zoom-in pass in refineCloseApproach, this resolves
 *  down to ~100ms precision at negligible extra cost per candidate. */
export const LIVE_REFINE_WINDOW_MS = 10 * 1000;
export const LIVE_REFINE_STEP_MS = 1_000;
export const VERIFY_REWIND_MS = 60 * 1000;
/**
 * Orbit preview window around CPA. Verification playback starts at
 * `CPA - VERIFY_REWIND_MS` and the object markers move continuously from
 * there, so the trail must cover at least that whole span — otherwise for
 * most of the playback the marker sits ahead of (or behind) the drawn line
 * entirely, looking like a disconnected, unrelated trail floating nearby.
 */
export const VERIFY_TRAIL_BACK_MS = VERIFY_REWIND_MS;
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
        // On a render-heavy page the main thread may never report a genuinely
        // idle slice, so `timeRemaining()` can sit near 0 indefinitely. Only
        // defer when the browser found real idle time but it was too short —
        // once the callback fires because the `timeout` budget was exhausted
        // (didTimeout), we must run now regardless of timeRemaining(), or the
        // scan starves forever and no conjunction is ever detected.
        if (!deadline.didTimeout && deadline.timeRemaining() < 6 && pendingRefresh) {
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

/** Debris fields routinely contain many objects sharing the exact same
 *  display name — NORAD ID is the only identity that's actually unique. */
function findObjectIndexByNoradId(objects: TrackedObject[], noradId: number): number {
  return objects.findIndex((o) => o.noradId === noradId);
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

/** Freeze alert CPA metadata — always resolve indices by NORAD ID, never
 *  by name (debris fields have many same-named fragments) and never reuse
 *  stale indices. */
export function normalizeConjunctionAlert(
  alert: ConjunctionEvent,
  objects: TrackedObject[],
): ConjunctionEvent | null {
  const indexA = findObjectIndexByNoradId(objects, alert.noradIdA);
  const indexB = findObjectIndexByNoradId(objects, alert.noradIdB);

  if (indexA < 0 || indexB < 0 || indexA === indexB) return null;

  const time = new Date(alert.time.getTime());
  const propA = propagateObject(objects[indexA].satrec, time);
  const propB = propagateObject(objects[indexB].satrec, time);
  if (!propA || !propB) return null;

  return {
    objectA: alert.objectA,
    objectB: alert.objectB,
    noradIdA: alert.noradIdA,
    noradIdB: alert.noradIdB,
    indexA,
    indexB,
    distanceKm: alert.distanceKm,
    relativeVelocityKmS: relativeVelocityKmS(propA.velocityEci, propB.velocityEci),
    time,
    midpointScene: midpointScene(propA.positionEci, propB.positionEci),
  };
}

type Satrec = Parameters<typeof propagateObject>[0];

interface ScanResult {
  distance: number;
  time: Date;
  posA: NonNullable<ReturnType<typeof propagateObject>>;
  posB: NonNullable<ReturnType<typeof propagateObject>>;
}

function scanForMinimumDistance(
  satrecA: Satrec,
  satrecB: Satrec,
  centerMs: number,
  windowMs: number,
  stepMs: number,
): ScanResult | null {
  let best: ScanResult | null = null;

  for (let t = centerMs - windowMs; t <= centerMs + windowMs; t += stepMs) {
    const date = new Date(t);
    const propA = propagateObject(satrecA, date);
    const propB = propagateObject(satrecB, date);
    if (!propA || !propB) continue;

    const distance = distanceKm(propA.positionEci, propB.positionEci);
    if (!best || distance < best.distance) {
      best = { distance, time: date, posA: propA, posB: propB };
    }
  }

  return best;
}

export function refineCloseApproach(
  objects: TrackedObject[],
  indexA: number,
  indexB: number,
  centerTime: Date,
  windowMs: number = REFINE_WINDOW_MS,
  stepMs: number = REFINE_STEP_MS,
): ConjunctionEvent | null {
  const objA = objects[indexA];
  const objB = objects[indexB];
  if (!objA || !objB) return null;

  const coarse = scanForMinimumDistance(objA.satrec, objB.satrec, centerTime.getTime(), windowMs, stepMs);
  if (!coarse) return null;

  // Zoom in around the coarse minimum with a step ~10x finer — the coarse
  // pass alone can straddle the true minimum (especially for fast-closing
  // pairs, where a single coarse step can span many km), so this second
  // pass resolves sub-step precision cheaply (a handful of extra samples)
  // without needing a uniformly fine step across the whole window.
  const fineStepMs = Math.max(stepMs / 10, 50);
  const best =
    fineStepMs < stepMs
      ? scanForMinimumDistance(objA.satrec, objB.satrec, coarse.time.getTime(), stepMs, fineStepMs) ?? coarse
      : coarse;
  const winner = best.distance < coarse.distance ? best : coarse;

  const { distance: bestDistance, time: bestTime, posA: bestPosA, posB: bestPosB } = winner;

  return {
    objectA: objA.name,
    objectB: objB.name,
    noradIdA: objA.noradId,
    noradIdB: objB.noradId,
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

type CellGrid = Map<number, Map<number, Map<number, number[]>>>;

function getBucket(grid: CellGrid, ix: number, iy: number, iz: number): number[] | undefined {
  return grid.get(ix)?.get(iy)?.get(iz);
}

function getOrCreateBucket(grid: CellGrid, ix: number, iy: number, iz: number): number[] {
  let yz = grid.get(ix);
  if (!yz) {
    yz = new Map();
    grid.set(ix, yz);
  }
  let z = yz.get(iy);
  if (!z) {
    z = new Map();
    yz.set(iy, z);
  }
  let bucket = z.get(iz);
  if (!bucket) {
    bucket = [];
    z.set(iz, bucket);
  }
  return bucket;
}

/**
 * Finds every index pair whose Euclidean distance is <= radius, without the
 * O(n^2) all-pairs scan. LEO shells routinely hold several thousand tracked
 * objects; comparing every object against every other object (tens of
 * millions of iterations per refresh) is the actual bottleneck, since almost
 * all of those pairs are obviously kilometers apart.
 *
 * Uses a uniform spatial hash grid with cell size == radius: any two points
 * within `radius` of each other can only ever land in the same cell or one
 * of its 26 neighbors, so a 3x3x3 neighborhood search is guaranteed to find
 * every true match. Cell membership alone is only a superset (diagonal
 * neighbors can be farther apart than `radius`), so each candidate is still
 * verified with an exact distance check before being returned — the result
 * is exact, verified against a brute-force O(n^2) scan in conjunction.test.ts.
 *
 * Grid cells are nested Maps keyed by integer cell index (not a stringified
 * "x,y,z" key): numeric map keys avoid per-lookup string allocation/hashing,
 * which matters here since this runs once per tracked object per refresh —
 * benchmarked ~18x faster than brute force at ~9,000 LEO objects.
 */
export function findCandidatePairsWithinRadius(
  positions: ReadonlyArray<{ x: number; y: number; z: number }>,
  radiusKm: number,
): Array<[number, number]> {
  const cellSize = Math.max(radiusKm, 1e-6);
  const radiusSq = radiusKm * radiusKm;
  const cellIndexOf = (value: number): number => Math.floor(value / cellSize);

  const grid: CellGrid = new Map();
  const cells: Array<[number, number, number]> = new Array(positions.length);

  for (let i = 0; i < positions.length; i++) {
    const { x, y, z } = positions[i];
    const ix = cellIndexOf(x);
    const iy = cellIndexOf(y);
    const iz = cellIndexOf(z);
    cells[i] = [ix, iy, iz];
    getOrCreateBucket(grid, ix, iy, iz).push(i);
  }

  const candidates: Array<[number, number]> = [];

  for (let i = 0; i < positions.length; i++) {
    const [ix, iy, iz] = cells[i];
    const pi = positions[i];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = getBucket(grid, ix + dx, iy + dy, iz + dz);
          if (!bucket) continue;

          for (const j of bucket) {
            if (j <= i) continue;
            const pj = positions[j];
            const ddx = pi.x - pj.x;
            const ddy = pi.y - pj.y;
            const ddz = pi.z - pj.z;
            if (ddx * ddx + ddy * ddy + ddz * ddz <= radiusSq) {
              candidates.push([i, j]);
            }
          }
        }
      }
    }
  }

  return candidates;
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

  // Cast a wider net than the final THRESHOLD_KM so fast-closing pairs are
  // caught as candidates before they've actually crossed the threshold —
  // see DETECTION_RADIUS_KM for why. The exact THRESHOLD_KM cutoff is
  // re-applied below against the fine-refined minimum distance.
  const candidatePairs = findCandidatePairsWithinRadius(
    leoEntries.map((e) => e.position),
    DETECTION_RADIUS_KM,
  );

  const pairs: ConjunctionEvent[] = [];

  for (const [ei, ej] of candidatePairs) {
    const objI = objects[leoEntries[ei].index];
    const objJ = objects[leoEntries[ej].index];
    if (sharesOrbitData(objI, objJ)) continue;

    const distance = distanceKm(leoEntries[ei].position, leoEntries[ej].position);
    if (distance <= DETECTION_RADIUS_KM) {
      const refined = refineCloseApproach(
        objects,
        leoEntries[ei].index,
        leoEntries[ej].index,
        date,
        LIVE_REFINE_WINDOW_MS,
        LIVE_REFINE_STEP_MS,
      );
      if (!refined) continue;
      if (refined.distanceKm < MIN_DISTANCE_KM || refined.distanceKm > THRESHOLD_KM) continue;
      if (isCoOrbitingPair(refined.relativeVelocityKmS)) continue;
      pairs.push(refined);
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

// ── Predictive 24h scan ─────────────────────────────────────────────────────
/**
 * Unlike everything above (which only ever evaluates the *current* instant,
 * plus a ±10s refine window around it), this walks forward in time and asks
 * "what will actually pass close over the next N hours?" — a genuine
 * prediction, not a live radar of what's already happening.
 *
 * Approach: sample the whole LEO catalog at fixed intervals across the
 * horizon, run the same spatial-hash candidate search at each snapshot, and
 * locally refine every candidate found (reusing `refineCloseApproach`, which
 * already does its own coarse+fine zoom). The single best (closest) approach
 * per object pair anywhere in the horizon is kept.
 *
 * This is deliberately *not* exhaustive. Fast-crossing LEO pairs (relative
 * velocity up to ~15 km/s) can cross an entire wide detection net between
 * two 10-minute snapshots — the same fundamental sampling trade-off as the
 * live scan above, just at a much coarser cadence because a full-catalog
 * SGP4 sweep repeated every few minutes for 24h is already a lot of compute.
 * This is a best-effort screening pass (same spirit as real-world "smart
 * sieve" conjunction assessment filters): it reliably surfaces genuinely
 * close or repeatedly-observed approaches, but a vanishingly narrow
 * single-pass event could in principle slip through undetected.
 */
export const UPCOMING_HORIZON_MS = 24 * 60 * 60 * 1000;
export const UPCOMING_SAMPLE_STEP_MS = 10 * 60 * 1000;
export const UPCOMING_DETECTION_RADIUS_KM = 50;
export const UPCOMING_REFINE_WINDOW_MS = UPCOMING_SAMPLE_STEP_MS;
export const UPCOMING_REFINE_STEP_MS = 15_000;
/** A full sweep costs a full-catalog SGP4 pass per snapshot (see above) —
 *  far too expensive to repeat every tick, so re-run it at most this often. */
export const UPCOMING_RESCAN_INTERVAL_MS = 5 * 60 * 1000;

type ScenePosition = { x: number; y: number; z: number };
type UpcomingSampleEntry = { index: number; position: ScenePosition };

/** Shared by both the synchronous (test-only) scan and the chunked production
 *  scanner below — checks one candidate pair found at `sampleDate` and, if it
 *  survives all filters, records it as the best known approach for that pair. */
function evaluateUpcomingCandidate(
  objects: TrackedObject[],
  entries: UpcomingSampleEntry[],
  ei: number,
  ej: number,
  sampleDate: Date,
  startMs: number,
  horizonMs: number,
  bestByPair: Map<string, ConjunctionEvent>,
): void {
  const objI = objects[entries[ei].index];
  const objJ = objects[entries[ej].index];
  if (sharesOrbitData(objI, objJ)) return;

  const refined = refineCloseApproach(
    objects,
    entries[ei].index,
    entries[ej].index,
    sampleDate,
    UPCOMING_REFINE_WINDOW_MS,
    UPCOMING_REFINE_STEP_MS,
  );
  if (!refined) return;
  // A refine pass can walk slightly outside [start, start+horizon] near
  // the edges of the sweep — don't report a "predicted" approach that's
  // actually already in the past relative to the scan's own start time.
  if (refined.time.getTime() < startMs || refined.time.getTime() > startMs + horizonMs) return;
  if (refined.distanceKm < MIN_DISTANCE_KM || refined.distanceKm > THRESHOLD_KM) return;
  if (isCoOrbitingPair(refined.relativeVelocityKmS)) return;

  const pairKey = conjunctionPairKey(String(refined.noradIdA), String(refined.noradIdB));
  const existing = bestByPair.get(pairKey);
  if (!existing || refined.distanceKm < existing.distanceKm) {
    bestByPair.set(pairKey, refined);
  }
}

function scanUpcomingSample(
  objects: TrackedObject[],
  sampleMs: number,
  startMs: number,
  horizonMs: number,
  bestByPair: Map<string, ConjunctionEvent>,
): void {
  const sampleDate = new Date(sampleMs);
  const leoEntries: UpcomingSampleEntry[] = [];

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (obj.layer !== SUBSET) continue;
    const propagation = propagateObject(obj.satrec, sampleDate);
    if (!propagation) continue;
    leoEntries.push({ index: i, position: propagation.positionEci });
  }

  const candidatePairs = findCandidatePairsWithinRadius(
    leoEntries.map((e) => e.position),
    UPCOMING_DETECTION_RADIUS_KM,
  );

  for (const [ei, ej] of candidatePairs) {
    evaluateUpcomingCandidate(objects, leoEntries, ei, ej, sampleDate, startMs, horizonMs, bestByPair);
  }
}

/**
 * Synchronous, one-shot version of the predictive scan — walks the entire
 * horizon in a single call. Fine for tests/small catalogs; production code
 * should use `getUpcomingConjunctions` instead, which spreads the same work
 * across many idle-time slices so it never blocks the main thread.
 */
export function findUpcomingConjunctions(
  objects: TrackedObject[],
  startDate: Date,
  horizonMs: number = UPCOMING_HORIZON_MS,
  sampleStepMs: number = UPCOMING_SAMPLE_STEP_MS,
): ConjunctionScanResult {
  const startMs = startDate.getTime();
  const totalSamples = Math.floor(horizonMs / sampleStepMs);
  const bestByPair = new Map<string, ConjunctionEvent>();

  for (let step = 0; step <= totalSamples; step++) {
    scanUpcomingSample(objects, startMs + step * sampleStepMs, startMs, horizonMs, bestByPair);
  }

  const ranked = deduplicatePhysicalConjunctions(Array.from(bestByPair.values()), objects);
  return {
    alerts: ranked.slice(0, MAX_DISPLAY_ALERTS),
    hiddenCount: Math.max(0, ranked.length - MAX_DISPLAY_ALERTS),
  };
}

/**
 * Cap on how much work happens per idle-time slice: objects propagated,
 * spatial-hash grid cells bucketed/queried, or candidates refined. A full
 * snapshot touches every LEO object (thousands) — doing any of these steps
 * "all at once" per snapshot, even spread one-snapshot-per-idle-callback,
 * blocked the main thread for tens to 100ms+ at a time and was clearly
 * visible as stutter (measured: ~100ms to propagate + ~20-35ms just for the
 * spatial-hash candidate search alone, on the real ~9,800-object catalog).
 * Chunking at this finer grain — including the candidate search itself,
 * split into a bucket-build pass and a neighbor-query pass — keeps every
 * single slice of work comfortably under a frame budget, at the cost of the
 * full 24h sweep taking longer in wall-clock time to finish in the
 * background.
 */
const UPCOMING_PROPAGATE_CHUNK = 500;
const UPCOMING_GRID_CHUNK = 1500;
const UPCOMING_QUERY_CHUNK = 500;
const UPCOMING_REFINE_CHUNK = 2;

interface UpcomingScanState {
  objects: TrackedObject[];
  /** Indices into `objects` that are in the tracked (LEO) subset — computed
   *  once up front so every snapshot doesn't re-filter the whole catalog. */
  leoIndices: number[];
  startMs: number;
  horizonMs: number;
  sampleStepMs: number;
  totalSamples: number;
  sampleIndex: number;
  bestByPair: Map<string, ConjunctionEvent>;

  // Progress within the *current* sample (reset each time we move to the next one).
  // Phase 1 — propagate this sample's LEO objects.
  objectCursor: number;
  sampleEntries: UpcomingSampleEntry[];
  // Phase 2 — spatial-hash candidate search, itself split into a build pass
  // (bucket every entry) and a query pass (check each entry's 3x3x3 cell
  // neighborhood) so a dense sample can't cause its own multi-ten-ms stall.
  grid: CellGrid | null;
  cells: Array<[number, number, number]>;
  gridCursor: number;
  queryCursor: number;
  pendingCandidates: Array<[number, number]> | null;
  // Phase 3 — refine each candidate pair found in phase 2.
  refineCursor: number;
}

let upcomingScan: UpcomingScanState | null = null;
let upcomingResult: ConjunctionScanResult = { alerts: [], hiddenCount: 0 };
let upcomingScanStartedWallMs = -Infinity;
let upcomingStepScheduled = false;

function buildLeoIndices(objects: TrackedObject[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    if (objects[i].layer === SUBSET) indices.push(i);
  }
  return indices;
}

function finishUpcomingScan(scan: UpcomingScanState): void {
  const ranked = deduplicatePhysicalConjunctions(Array.from(scan.bestByPair.values()), scan.objects);
  upcomingResult = {
    alerts: ranked.slice(0, MAX_DISPLAY_ALERTS),
    hiddenCount: Math.max(0, ranked.length - MAX_DISPLAY_ALERTS),
  };
  upcomingScan = null;
}

function resetSampleProgress(scan: UpcomingScanState): void {
  scan.objectCursor = 0;
  scan.sampleEntries = [];
  scan.grid = null;
  scan.cells = [];
  scan.gridCursor = 0;
  scan.queryCursor = 0;
  scan.pendingCandidates = null;
  scan.refineCursor = 0;
}

/**
 * Advances the in-progress sweep by one small, bounded unit of work and
 * returns true once the whole horizon has been covered and `upcomingResult`
 * is up to date. Every individual call is capped by one of the
 * `UPCOMING_*_CHUNK` constants above, so it's safe to call from a single
 * idle-time slice without risking a visible stutter.
 */
function stepUpcomingScanOnce(): boolean {
  const scan = upcomingScan;
  if (!scan) return true;

  const sampleMs = scan.startMs + scan.sampleIndex * scan.sampleStepMs;
  const sampleDate = new Date(sampleMs);

  // Phase 1: propagate a bounded chunk of this sample's LEO objects.
  if (scan.objectCursor < scan.leoIndices.length) {
    const chunkEnd = Math.min(scan.objectCursor + UPCOMING_PROPAGATE_CHUNK, scan.leoIndices.length);
    for (let k = scan.objectCursor; k < chunkEnd; k++) {
      const idx = scan.leoIndices[k];
      const propagation = propagateObject(scan.objects[idx].satrec, sampleDate);
      if (propagation) scan.sampleEntries.push({ index: idx, position: propagation.positionEci });
    }
    scan.objectCursor = chunkEnd;
    return false;
  }

  if (scan.grid === null) {
    scan.grid = new Map();
    scan.cells = new Array(scan.sampleEntries.length);
  }

  // Phase 2a: bucket a bounded chunk of this sample's positions into the grid.
  if (scan.gridCursor < scan.sampleEntries.length) {
    const cellSize = Math.max(UPCOMING_DETECTION_RADIUS_KM, 1e-6);
    const chunkEnd = Math.min(scan.gridCursor + UPCOMING_GRID_CHUNK, scan.sampleEntries.length);
    for (let i = scan.gridCursor; i < chunkEnd; i++) {
      const { x, y, z } = scan.sampleEntries[i].position;
      const ix = Math.floor(x / cellSize);
      const iy = Math.floor(y / cellSize);
      const iz = Math.floor(z / cellSize);
      scan.cells[i] = [ix, iy, iz];
      getOrCreateBucket(scan.grid, ix, iy, iz).push(i);
    }
    scan.gridCursor = chunkEnd;
    return false;
  }

  if (scan.pendingCandidates === null) scan.pendingCandidates = [];

  // Phase 2b: query a bounded chunk of entries against the (now complete) grid.
  if (scan.queryCursor < scan.sampleEntries.length) {
    const radiusSq = UPCOMING_DETECTION_RADIUS_KM * UPCOMING_DETECTION_RADIUS_KM;
    const chunkEnd = Math.min(scan.queryCursor + UPCOMING_QUERY_CHUNK, scan.sampleEntries.length);
    for (let i = scan.queryCursor; i < chunkEnd; i++) {
      const [ix, iy, iz] = scan.cells[i];
      const pi = scan.sampleEntries[i].position;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const bucket = getBucket(scan.grid, ix + dx, iy + dy, iz + dz);
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i) continue;
              const pj = scan.sampleEntries[j].position;
              const ddx = pi.x - pj.x;
              const ddy = pi.y - pj.y;
              const ddz = pi.z - pj.z;
              if (ddx * ddx + ddy * ddy + ddz * ddz <= radiusSq) {
                scan.pendingCandidates.push([i, j]);
              }
            }
          }
        }
      }
    }
    scan.queryCursor = chunkEnd;
    return false;
  }

  // Phase 3: refine a bounded chunk of this sample's candidates.
  if (scan.refineCursor < scan.pendingCandidates.length) {
    const chunkEnd = Math.min(scan.refineCursor + UPCOMING_REFINE_CHUNK, scan.pendingCandidates.length);
    for (let k = scan.refineCursor; k < chunkEnd; k++) {
      const [ei, ej] = scan.pendingCandidates[k];
      evaluateUpcomingCandidate(
        scan.objects,
        scan.sampleEntries,
        ei,
        ej,
        sampleDate,
        scan.startMs,
        scan.horizonMs,
        scan.bestByPair,
      );
    }
    scan.refineCursor = chunkEnd;
    return false;
  }

  // This sample is fully processed — advance to the next one.
  scan.sampleIndex++;
  resetSampleProgress(scan);

  if (scan.sampleIndex > scan.totalSamples) {
    finishUpcomingScan(scan);
    return true;
  }
  return false;
}

function scheduleUpcomingScanStep(onUpdate: ConjunctionRefreshListener): void {
  if (upcomingStepScheduled) return;
  upcomingStepScheduled = true;

  const runStep = (): void => {
    upcomingStepScheduled = false;
    const done = stepUpcomingScanOnce();
    if (done) {
      onUpdate(upcomingResult);
      return;
    }
    scheduleUpcomingScanStep(onUpdate);
  };

  const idle = globalThis.requestIdleCallback;
  if (typeof idle === 'function') {
    idle(runStep, { timeout: 1_000 });
  } else {
    globalThis.setTimeout(runStep, 0);
  }
}

/**
 * Forward-looking close-approach screen — walks `UPCOMING_HORIZON_MS` into
 * the future (24h by default) and returns the closest predicted approaches,
 * sorted by predicted minimum distance. This is what actually answers "what
 * close approaches are coming up", as opposed to `getConjunctions`, which
 * only ever reports what's happening at this exact instant.
 *
 * A full sweep touches every LEO object at dozens of points in time — too
 * expensive to run in one synchronous call on a render-heavy page — so this
 * advances the sweep by one snapshot per idle-time slice and only pushes a
 * new result via `onUpdate` once the whole sweep finishes. Call it every
 * frame just like `getConjunctions`: it's a cheap no-op between sweeps
 * (throttled by `UPCOMING_RESCAN_INTERVAL_MS`) and self-driving once a sweep
 * has started, so callers don't need to do anything beyond calling it.
 */
export function getUpcomingConjunctions(
  objects: TrackedObject[],
  referenceTime: Date,
  onUpdate: ConjunctionRefreshListener,
): ConjunctionScanResult {
  const nowWallMs = performance.now();
  if (!upcomingScan && nowWallMs - upcomingScanStartedWallMs >= UPCOMING_RESCAN_INTERVAL_MS) {
    upcomingScanStartedWallMs = nowWallMs;
    upcomingScan = {
      objects,
      leoIndices: buildLeoIndices(objects),
      startMs: referenceTime.getTime(),
      horizonMs: UPCOMING_HORIZON_MS,
      sampleStepMs: UPCOMING_SAMPLE_STEP_MS,
      totalSamples: Math.floor(UPCOMING_HORIZON_MS / UPCOMING_SAMPLE_STEP_MS),
      sampleIndex: 0,
      bestByPair: new Map(),
      objectCursor: 0,
      sampleEntries: [],
      grid: null,
      cells: [],
      gridCursor: 0,
      queryCursor: 0,
      pendingCandidates: null,
      refineCursor: 0,
    };
    scheduleUpcomingScanStep(onUpdate);
  }
  return upcomingResult;
}

export function invalidateUpcomingConjunctionCache(): void {
  upcomingScan = null;
  upcomingResult = { alerts: [], hiddenCount: 0 };
  upcomingScanStartedWallMs = -Infinity;
  // If a step was already scheduled for the sweep being torn down, its idle
  // callback will still fire — `stepUpcomingScanOnce` handles that safely
  // (returns "done" immediately, since `upcomingScan` is now null) — but the
  // flag itself must be cleared here too, otherwise a subsequent call to
  // `getUpcomingConjunctions` would find it still set and skip scheduling
  // its own first step, silently never starting a new sweep.
  upcomingStepScheduled = false;
}
