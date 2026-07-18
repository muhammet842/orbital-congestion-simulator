import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { eciToScene } from '../orbital/coordinates';
import { getGmstRad } from './dayNight';
import type { HistoricalEvent } from '../ui/EventCards';
import { EVENT_REPLAY_REWIND_MS } from '../state/appState';

/** Glow sphere radius in scene units (same scale as Earth radius = 1). */
const DOT_RADIUS = 0.005;

/**
 * All data captured once in setup() and used read-only in tick().
 *
 * The core motion model is a PURE LINEAR LERP:
 *   pos(t) = lerp(initialPos, collisionScene, progress)
 *   where progress = (currentMs - startMs) / (collisionMs - startMs)
 *
 * This guarantees both dots meet exactly at the collision point at T=0,
 * regardless of TLE propagation drift (TLEs from 2009/2021 are unusable
 * for back-propagation by the SGP4 model).
 */
interface ParsedObjects {
  nameA: string;
  nameB: string | null;
  /** Satellite A scene position at T−5 min (start of replay). */
  initialPosA: Vector3;
  /**
   * Satellite B (or ASAT missile) scene position at the start of replay.
   * For missiles this is the surface nadir of the impact point.
   */
  initialPosB: Vector3 | null;
  /** Known ECI scene position of the collision/impact point. */
  collisionScene: Vector3;
  /** Timestamp of the replay start (collisionTimeMs − EVENT_REPLAY_REWIND_MS). */
  startTimeMs: number;
  /**
   * 3-D distance between A and B at T−5 min in km.
   * Used to drive the separation counter in the right panel.
   */
  initialSeparationKm: number;
}

/**
 * Convert geographic coordinates + altitude to a scene-space Vector3.
 * Uses GMST to rotate from geographic (ECEF) to ECI, then eciToScene.
 */
function geoToScene(
  latDeg: number,
  lonDeg: number,
  altKm: number,
  date: Date,
): Vector3 {
  const DEG = Math.PI / 180;
  const r = 6371 + altKm;
  const gmst = getGmstRad(date);
  const eciLonRad = lonDeg * DEG + gmst;
  const latRad = latDeg * DEG;
  const eciX = r * Math.cos(latRad) * Math.cos(eciLonRad);
  const eciY = r * Math.cos(latRad) * Math.sin(eciLonRad);
  const eciZ = r * Math.sin(latRad);
  const scene = eciToScene(eciX, eciY, eciZ);
  return new Vector3(scene.x, scene.y, scene.z);
}

/**
 * Compute where a satellite was `rewindMs` milliseconds BEFORE the collision
 * by back-tracking along its great-circle orbital arc.
 *
 * Inputs:
 *   collisionGeo  – verified collision location (lat/lon/alt in km)
 *   inclinationDeg – orbital inclination (0°=equatorial, 90°=polar, >90°=retrograde)
 *   ascending     – true if the satellite was heading south→north at collision
 *   rewindMs      – how far back to trace (default = EVENT_REPLAY_REWIND_MS = 5 min)
 *   startDate     – Date object at T-5min (used for GMST → ECI conversion)
 *
 * Algorithm:
 *   1. Compute orbital speed v = √(GM/(R+h)) and arc length in `rewindMs`.
 *   2. From the inclination, derive the heading azimuth at the collision latitude
 *      using sin(az) = cos(I)/cos(lat).
 *   3. Reverse the heading to get the back-track bearing.
 *   4. Apply the spherical haversine formula to get the start lat/lon.
 *   5. Convert to ECI scene coordinates at `startDate`.
 *
 * This produces a physically reasonable starting position that lies on the
 * real orbital great-circle, ~5 min of flight behind the collision point.
 */
function orbitalBacktrack(
  collisionGeo: { latDeg: number; lonDeg: number; altKm: number },
  inclinationDeg: number,
  ascending: boolean,
  rewindMs: number,
  startDate: Date,
): Vector3 {
  const DEG = Math.PI / 180;
  const GM = 398600; // km³/s²
  const R = 6371 + collisionGeo.altKm;
  const v = Math.sqrt(GM / R);          // km/s
  const arcRad = (v * rewindMs / 1000) / R; // arc in radians on the orbit

  const lat1 = collisionGeo.latDeg * DEG;
  const lon1 = collisionGeo.lonDeg * DEG;
  const I    = inclinationDeg * DEG;

  // Azimuth of travel at this latitude for the given inclination.
  // sin(az) = cos(I) / cos(lat)  — derived from spherical triangle of the orbit.
  const sinAz = Math.min(1, Math.abs(Math.cos(I) / Math.cos(lat1)));
  const azimuth = Math.asin(sinAz); // positive = eastward component

  // For a retrograde orbit (I > 90°), cos(I) < 0 → satellite moves westward.
  // `ascending` = latitude is increasing (heading toward higher latitudes).
  // Bearing (from North, clockwise):
  //   Ascending  + prograde  (I<90°): NE  → bearing = +azimuth
  //   Ascending  + retrograde(I>90°): NW  → bearing = -azimuth (= 360-azimuth)
  //   Descending + prograde  (I<90°): SE  → bearing = π - azimuth
  //   Descending + retrograde(I>90°): SW  → bearing = π + azimuth
  const prograde = inclinationDeg <= 90;
  let bearing: number;
  if (ascending) {
    bearing = prograde ? azimuth : -azimuth;
  } else {
    bearing = prograde ? Math.PI - azimuth : Math.PI + azimuth;
  }
  // Back-track: reverse the bearing
  const backBearing = bearing + Math.PI;

  // Haversine great-circle displacement
  const sinLat2 = Math.sin(lat1) * Math.cos(arcRad) +
                  Math.cos(lat1) * Math.sin(arcRad) * Math.cos(backBearing);
  // Clamp to ±sin(inclination) — a satellite can't exceed its orbital inclination.
  const clampedSinLat2 = Math.max(-Math.sin(I), Math.min(Math.sin(I), sinLat2));
  const lat2 = Math.asin(clampedSinLat2);

  // When the start position is very close to the orbital peak (lat ≈ inclination),
  // the atan2 denominator can be near-zero. Use a stable fallback.
  const atan2Num = Math.sin(backBearing) * Math.sin(arcRad) * Math.cos(lat1);
  const atan2Den = Math.cos(arcRad) - Math.sin(lat1) * Math.sin(lat2);
  const lon2 = Math.abs(atan2Den) < 1e-9 && Math.abs(atan2Num) < 1e-9
    ? lon1  // satellite at/near the pole — keep the collision longitude
    : lon1 + Math.atan2(atan2Num, atan2Den);

  return geoToScene(lat2 / DEG, lon2 / DEG, collisionGeo.altKm, startDate);
}

/**
 * Spherical linear interpolation between two scene-space vectors.
 *
 * Unlike `lerp`, this keeps the interpolated point on the surface of an
 * ellipsoid (sphere in this case) so the satellite travels along a curved
 * arc above Earth rather than a chord that passes through the planet.
 *
 * The radius (altitude) is also linearly interpolated from |from| to |to|
 * so the object smoothly climbs or descends if the start/end altitudes differ.
 */
function slerp(from: Vector3, to: Vector3, t: number): Vector3 {
  const rFrom = from.length();
  const rTo   = to.length();
  if (rFrom < 1e-10 || rTo < 1e-10) return from.clone().lerp(to, t);

  const fromDir = from.clone().normalize();
  const toDir   = to.clone().normalize();

  const cosTheta = Math.max(-1, Math.min(1, fromDir.dot(toDir)));
  const theta = Math.acos(cosTheta);

  // Interpolated radius (altitude) — linear between |from| and |to|
  const radius = rFrom + (rTo - rFrom) * t;

  // When the angle is very small, fall back to linear interpolation of
  // the direction to avoid division by near-zero.
  if (theta < 1e-6) {
    return fromDir.lerp(toDir, t).normalize().multiplyScalar(radius);
  }

  const sinTheta = Math.sin(theta);
  const scale0   = Math.sin((1 - t) * theta) / sinTheta;
  const scale1   = Math.sin(t       * theta) / sinTheta;

  return fromDir.clone().multiplyScalar(scale0)
    .add(toDir.clone().multiplyScalar(scale1))
    .normalize()
    .multiplyScalar(radius);
}

/**
 * Build a multi-segment arc geometry following the great-circle path from
 * `from` to `to` (using slerp), so the trail hugs the sphere surface and
 * never clips through the Earth.
 */
function buildApproachArc(from: Vector3, to: Vector3, segments = 48): BufferGeometry {
  const pts: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = slerp(from, to, t);
    pts.push(p.x, p.y, p.z);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  return geo;
}

export class EventReplayVisuals {
  readonly group: Group;

  private readonly trailA: Line;
  private readonly trailB: Line;
  private readonly dotA: Mesh;
  private readonly dotB: Mesh;
  private readonly dotImpact: Mesh;

  private parsed: ParsedObjects | null = null;
  private activeEventId = '';

  constructor() {
    this.group = new Group();
    this.group.renderOrder = 3;

    this.trailA = new Line(
      new BufferGeometry(),
      new LineDashedMaterial({
        color: 0x66ccff,
        transparent: true,
        opacity: 0.7,
        dashSize: 0.0006,
        gapSize: 0.0003,
        toneMapped: false,
        depthWrite: false,
      }),
    );

    this.trailB = new Line(
      new BufferGeometry(),
      new LineDashedMaterial({
        color: 0xffaa22,
        transparent: true,
        opacity: 0.7,
        dashSize: 0.0006,
        gapSize: 0.0003,
        toneMapped: false,
        depthWrite: false,
      }),
    );

    const dotGeo = new SphereGeometry(DOT_RADIUS, 12, 8);

    this.dotA = new Mesh(
      dotGeo,
      new MeshBasicMaterial({
        color: 0x66ccff,
        transparent: true,
        opacity: 1.0,
        blending: AdditiveBlending,
        toneMapped: false,
        depthWrite: false,
      }),
    );

    this.dotB = new Mesh(
      dotGeo,
      new MeshBasicMaterial({
        color: 0xffaa22,
        transparent: true,
        opacity: 1.0,
        blending: AdditiveBlending,
        toneMapped: false,
        depthWrite: false,
      }),
    );

    /** Expanding ring that marks the collision flash at T=0 */
    this.dotImpact = new Mesh(
      new SphereGeometry(DOT_RADIUS * 1.4, 12, 8),
      new MeshBasicMaterial({
        color: 0xff4422,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        toneMapped: false,
        depthWrite: false,
      }),
    );

    this.group.add(this.trailA, this.trailB, this.dotA, this.dotB, this.dotImpact);
    this.group.visible = false;
  }

  /**
   * Initialise visuals for the given historical event.
   *
   * Initial positions are computed by orbital back-tracking (not TLE propagation)
   * so the starting dots are always physically reasonable and near the correct
   * geographic region — 5 minutes of flight before the verified collision point.
   *
   * Call once per event selection.
   */
  setup(
    event: HistoricalEvent,
    collisionTimeMs: number,
  ): void {
    const eventId = event.id;
    if (this.activeEventId === eventId) return;
    this.dispose();

    const { collisionGeo, approachA, approachB, objectB } = event;

    // ── Collision scene position (ECI at impact time) ─────────────────────
    const collisionDate = new Date(collisionTimeMs);
    const collisionScene = geoToScene(
      collisionGeo.latDeg,
      collisionGeo.lonDeg,
      collisionGeo.altKm,
      collisionDate,
    );

    // ── Initial positions via orbital back-tracking ───────────────────────
    // We trace back EVENT_REPLAY_REWIND_MS milliseconds along the great-circle
    // orbital path from the collision point. This gives a realistic starting
    // position without TLE propagation drift.
    const startTimeMs = collisionTimeMs - EVENT_REPLAY_REWIND_MS;
    const startDate   = new Date(startTimeMs);

    const initialPosA = orbitalBacktrack(
      collisionGeo,
      approachA.inclinationDeg,
      approachA.ascending,
      EVENT_REPLAY_REWIND_MS,
      startDate,
    );

    let initialPosB: Vector3 | null = null;
    let initialSeparationKm = 0;

    if (approachB && objectB) {
      // Two-satellite event — back-track the second object
      initialPosB = orbitalBacktrack(
        collisionGeo,
        approachB.inclinationDeg,
        approachB.ascending,
        EVENT_REPLAY_REWIND_MS,
        startDate,
      );

      // 3-D separation in km at T-5min from scene-space distance
      // (1 scene unit = Earth radius = 6371 km)
      initialSeparationKm = initialPosA.distanceTo(initialPosB) * 6371;
    } else {
      // ASAT event: missile starts at the Earth-surface nadir of impact point
      initialPosB = collisionScene.clone().normalize(); // unit vector = surface
      initialSeparationKm = 0;
    }

    this.parsed = {
      nameA: event.objectA.name,
      nameB: event.objectB?.name ?? null,
      initialPosA,
      initialPosB,
      collisionScene,
      startTimeMs,
      initialSeparationKm,
    };

    // ── Build curved arc approach geometry ───────────────────────────────
    // The trail follows the great-circle (slerp) path from the initial
    // position to the collision point, matching the curved motion used in
    // tick() — the dot always sits ON the arc, never inside the Earth.
    this.trailA.geometry.dispose();
    this.trailA.geometry = buildApproachArc(initialPosA, collisionScene);
    this.trailA.computeLineDistances();
    (this.trailA.material as LineDashedMaterial).opacity = 0.6;
    this.trailA.visible = true;

    if (initialPosB) {
      this.trailB.geometry.dispose();
      this.trailB.geometry = buildApproachArc(initialPosB, collisionScene);
      this.trailB.computeLineDistances();
      (this.trailB.material as LineDashedMaterial).opacity = 0.6;
      this.trailB.visible = true;
    } else {
      this.trailB.visible = false;
    }

    this.activeEventId = eventId;
    this.group.visible = true;
  }

  /**
   * Move the dots to their linearly-interpolated positions.
   *
   * Motion model — pure linear lerp over the full 5-minute window:
   *   progress = clamp((currentMs - startMs) / (collisionMs - startMs), 0, 1)
   *   posA = lerp(initialPosA, collisionScene, progress)
   *   posB = lerp(initialPosB, collisionScene, progress)
   *
   * This guarantees both dots meet at EXACTLY the same collision point at
   * T=0, regardless of TLE propagation drift. No SGP4 is called in this
   * method — positions are fully deterministic from setup() data.
   */
  tick(
    simTime: Date,
    collisionTimeMs: number,
  ): { posA: Vector3; posB: Vector3 | null; impactFlash: number } | null {
    if (!this.parsed) return null;

    const { initialPosA, initialPosB, collisionScene, startTimeMs } = this.parsed;

    // ── Linear progress [0, 1] over the 5-minute replay window ───────────
    const totalMs = collisionTimeMs - startTimeMs; // = EVENT_REPLAY_REWIND_MS
    const elapsed = simTime.getTime() - startTimeMs;
    const progress = Math.max(0, Math.min(1, elapsed / totalMs));

    // ── Object A: slerp along curved arc to collision point ───────────────
    // slerp preserves altitude — the dot travels on a great-circle arc
    // above Earth's surface instead of a straight chord through the planet.
    const posA = slerp(initialPosA, collisionScene, progress);
    this.dotA.position.copy(posA);
    this.dotA.visible = true;

    // ── Object B: same slerp (satellite or ASAT missile) ─────────────────
    let posB: Vector3 | null = null;
    if (initialPosB) {
      posB = slerp(initialPosB, collisionScene, progress);
      this.dotB.position.copy(posB);
      this.dotB.visible = true;
    } else {
      this.dotB.visible = false;
    }

    // ── Trail opacity: full at the start, fades as dots converge ─────────
    // At progress=0.7 the trail is at 50% opacity; fully gone at progress=1.
    const trailOpacity = Math.max(0, 1 - progress * 1.4) * 0.6;
    (this.trailA.material as LineDashedMaterial).opacity = trailOpacity;
    this.trailA.visible = trailOpacity > 0.01;
    (this.trailB.material as LineDashedMaterial).opacity = trailOpacity;
    this.trailB.visible = trailOpacity > 0.01 && initialPosB !== null;

    // ── Impact flash at T=0 ───────────────────────────────────────────────
    // SceneManager freezes the clock at T=0 so progress stays ≈ 1 here.
    const msAfterCollision = -(collisionTimeMs - simTime.getTime());
    const FLASH_WINDOW_MS = 30_000;
    let impactFlash = 0;
    if (progress >= 1 || (msAfterCollision >= 0 && msAfterCollision < FLASH_WINDOW_MS)) {
      impactFlash = 1 - Math.min(1, msAfterCollision / FLASH_WINDOW_MS);
      const mat = this.dotImpact.material as MeshBasicMaterial;
      mat.opacity = impactFlash;
      this.dotImpact.position.copy(posA);
      this.dotImpact.visible = true;
    } else {
      this.dotImpact.visible = false;
    }

    return { posA, posB, impactFlash };
  }

  getNames(): { nameA: string; nameB: string | null } | null {
    if (!this.parsed) return null;
    return { nameA: this.parsed.nameA, nameB: this.parsed.nameB };
  }

  /** Initial separation in km between the two objects at T-5min. */
  getInitialSeparationKm(): number {
    return this.parsed?.initialSeparationKm ?? 0;
  }

  /** Returns the known collision scene position, or null if not available. */
  getCollisionScene(): Vector3 | null {
    return this.parsed?.collisionScene ?? null;
  }

  dispose(): void {
    this.trailA.geometry.dispose();
    this.trailA.geometry = new BufferGeometry();
    this.trailB.geometry.dispose();
    this.trailB.geometry = new BufferGeometry();
    this.parsed = null;
    this.activeEventId = '';
    this.group.visible = false;
    this.dotImpact.visible = false;
  }
}
