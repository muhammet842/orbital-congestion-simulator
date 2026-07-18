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
import type { SatRec } from 'satellite.js';
import { twoline2satrec } from 'satellite.js';
import { eciToScene } from '../orbital/coordinates';
import { propagateObject } from '../orbital/propagator';
import { getGmstRad } from './dayNight';
import type { HistoricalEventTLE } from '../ui/EventCards';
import { EVENT_REPLAY_REWIND_MS } from '../state/appState';

/** How far past the collision to draw the trail (ms). */
const TRAIL_FORWARD_MS = 90 * 1000;
/** Trail sampling interval (ms) — coarser = faster setup, still smooth visually. */
const TRAIL_STEP_MS = 10_000;

/** Glow sphere radius in scene units (same scale as Earth radius = 1). */
const DOT_RADIUS = 0.005;

interface ParsedObjects {
  satrecA: SatRec;
  satrecB: SatRec | null;
  nameA: string;
  nameB: string | null;
  /** For ASAT events: Earth-surface launch point of the missile (unit vector). */
  missileOrigin: Vector3 | null;
  /** For ASAT events: satellite scene position at the moment of impact. */
  impactPos: Vector3 | null;
  /**
   * Known collision/impact ECI scene position, if geographic coords were provided.
   * Used to blend the animated dots toward this point in the final 2 minutes so
   * the satellites visually converge regardless of TLE propagation error.
   */
  collisionScene: Vector3 | null;
}

/**
 * Convert geographic coordinates + altitude to a scene-space Vector3.
 * Uses GMST to rotate from geographic (ECEF) to ECI, then eciToScene.
 */
function geoToScene(
  latDeg: number,
  lonDeg: number,
  altKm: number,
  collisionDate: Date,
): Vector3 {
  const DEG = Math.PI / 180;
  const r = 6371 + altKm; // km from Earth centre
  const gmst = getGmstRad(collisionDate);
  // Geographic → ECI: add GMST to geographic longitude
  const eciLonRad = lonDeg * DEG + gmst;
  const latRad = latDeg * DEG;
  const eciX = r * Math.cos(latRad) * Math.cos(eciLonRad);
  const eciY = r * Math.cos(latRad) * Math.sin(eciLonRad);
  const eciZ = r * Math.sin(latRad);
  const scene = eciToScene(eciX, eciY, eciZ);
  return new Vector3(scene.x, scene.y, scene.z);
}

function buildTrailGeometry(
  satrec: SatRec,
  collisionTimeMs: number,
): BufferGeometry {
  const startMs = collisionTimeMs - EVENT_REPLAY_REWIND_MS;
  const endMs = collisionTimeMs + TRAIL_FORWARD_MS;
  const points: number[] = [];

  for (let t = startMs; t <= endMs; t += TRAIL_STEP_MS) {
    const prop = propagateObject(satrec, new Date(t));
    if (!prop) continue;
    const p = eciToScene(prop.positionEci.x, prop.positionEci.y, prop.positionEci.z);
    points.push(p.x, p.y, p.z);
  }

  const geo = new BufferGeometry();
  if (points.length >= 6) {
    geo.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
  }
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

  /** Parse TLEs and build orbital trail geometry. Call once per event selection. */
  setup(
    eventId: string,
    tleA: HistoricalEventTLE,
    tleB: HistoricalEventTLE | null,
    collisionTimeMs: number,
    collisionGeo: { latDeg: number; lonDeg: number; altKm: number } | null,
  ): void {
    if (this.activeEventId === eventId) return;
    this.dispose();

    const satrecA = twoline2satrec(tleA.line1, tleA.line2);
    const satrecB = tleB ? twoline2satrec(tleB.line1, tleB.line2) : null;

    // Compute the ECI scene position of the collision/impact point
    const collisionDate = new Date(collisionTimeMs);
    const collisionScene: Vector3 | null = collisionGeo
      ? geoToScene(collisionGeo.latDeg, collisionGeo.lonDeg, collisionGeo.altKm, collisionDate)
      : null;

    // For ASAT events compute missile approach geometry from Earth surface
    let missileOrigin: Vector3 | null = null;
    let impactPos: Vector3 | null = null;
    if (!satrecB) {
      // Use the known collision point if available, else fall back to SGP4 position
      if (collisionScene) {
        impactPos = collisionScene.clone();
      } else {
        const propImpact = propagateObject(satrecA, collisionDate);
        if (propImpact) {
          const sc = eciToScene(propImpact.positionEci.x, propImpact.positionEci.y, propImpact.positionEci.z);
          impactPos = new Vector3(sc.x, sc.y, sc.z);
        }
      }
      if (impactPos) {
        // Launch point = point on Earth surface directly below the impact (nadir)
        missileOrigin = impactPos.clone().normalize(); // magnitude 1 = Earth surface
      }
    }

    this.parsed = {
      satrecA,
      satrecB,
      nameA: tleA.name,
      nameB: tleB?.name ?? null,
      missileOrigin,
      impactPos,
      collisionScene,
    };

    this.trailA.geometry.dispose();
    this.trailA.geometry = buildTrailGeometry(satrecA, collisionTimeMs);
    this.trailA.computeLineDistances();

    if (satrecB) {
      this.trailB.geometry.dispose();
      this.trailB.geometry = buildTrailGeometry(satrecB, collisionTimeMs);
      this.trailB.computeLineDistances();
      this.trailB.visible = true;
    } else {
      // Draw a short dashed "missile path" line from surface to impact point
      if (missileOrigin && impactPos) {
        const pts = new Float32Array([
          missileOrigin.x, missileOrigin.y, missileOrigin.z,
          impactPos.x, impactPos.y, impactPos.z,
        ]);
        const geo = new BufferGeometry();
        geo.setAttribute('position', new BufferAttribute(pts, 3));
        this.trailB.geometry.dispose();
        this.trailB.geometry = geo;
        this.trailB.computeLineDistances();
        this.trailB.visible = true;
      } else {
        this.trailB.visible = false;
      }
    }

    this.activeEventId = eventId;
    this.group.visible = true;
  }

  /**
   * Update dot positions to the current sim time.
   * Returns { posA, posB | null } for camera tracking, or null if not active.
   */
  tick(
    simTime: Date,
    collisionTimeMs: number,
  ): { posA: Vector3; posB: Vector3 | null; impactFlash: number } | null {
    if (!this.parsed) return null;

    const { satrecA, satrecB } = this.parsed;
    const propA = propagateObject(satrecA, simTime);
    if (!propA) return null;

    const sceneA = eciToScene(propA.positionEci.x, propA.positionEci.y, propA.positionEci.z);
    let posA = new Vector3(sceneA.x, sceneA.y, sceneA.z);

    // Convergence blend: over the entire 5-min replay window, smoothly pull
    // both dots toward the known collision ECI scene point so they meet at T=0.
    // Uses an ease-in² curve so motion is gentle at the start and accelerates
    // naturally as T→0. This compensates for TLE epoch error (can be 100s km).
    const { collisionScene } = this.parsed;
    const msToImpact = collisionTimeMs - simTime.getTime();
    let blendFactor = 0;
    if (collisionScene) {
      if (msToImpact >= 0 && msToImpact <= EVENT_REPLAY_REWIND_MS) {
        const t = 1 - msToImpact / EVENT_REPLAY_REWIND_MS; // 0 at start → 1 at T=0
        blendFactor = t * t; // ease-in²
      } else if (msToImpact < 0) {
        blendFactor = 1; // hold at collision point after impact
      }
    }

    if (collisionScene && blendFactor > 0) {
      posA = posA.clone().lerp(collisionScene, blendFactor);
    }
    this.dotA.position.copy(posA);

    let posB: Vector3 | null = null;
    if (satrecB) {
      // Two-satellite event: propagate second object normally
      const propB = propagateObject(satrecB, simTime);
      if (propB) {
        const sceneB = eciToScene(propB.positionEci.x, propB.positionEci.y, propB.positionEci.z);
        posB = new Vector3(sceneB.x, sceneB.y, sceneB.z);
        // Apply same convergence blend to object B
        if (collisionScene && blendFactor > 0) {
          posB = posB.clone().lerp(collisionScene, blendFactor);
        }
        this.dotB.position.copy(posB);
        this.dotB.visible = true;
      }
    } else if (this.parsed.missileOrigin && this.parsed.impactPos) {
      // ASAT event: animate missile from Earth surface to impact point
      const rewindMs = EVENT_REPLAY_REWIND_MS;
      const msToImpact = collisionTimeMs - simTime.getTime();
      // progress 0 = T−5min (on ground), progress 1 = T=0 (impact)
      const progress = Math.max(0, Math.min(1, 1 - msToImpact / rewindMs));

      if (progress < 1) {
        posB = this.parsed.missileOrigin.clone().lerp(this.parsed.impactPos, progress);
        this.dotB.position.copy(posB);
        this.dotB.visible = true;
      } else {
        // Past impact — hide missile
        this.dotB.visible = false;
      }
    } else {
      this.dotB.visible = false;
    }

    // Impact flash: glows for 30 s after T=0, at the position of objectA
    const msAfterCollision = simTime.getTime() - collisionTimeMs;
    const FLASH_WINDOW_MS = 30_000;
    let impactFlash = 0;
    if (msAfterCollision >= 0 && msAfterCollision < FLASH_WINDOW_MS) {
      impactFlash = 1 - msAfterCollision / FLASH_WINDOW_MS;
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
