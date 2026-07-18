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
import type { HistoricalEventTLE } from '../ui/EventCards';
import { EVENT_REPLAY_REWIND_MS } from '../state/appState';

/** How far past the collision to draw the trail (ms). */
const TRAIL_FORWARD_MS = 2 * 60 * 1000;
/** Trail sampling interval (ms). */
const TRAIL_STEP_MS = 5_000;

/** Glow sphere radius in scene units (same scale as Earth radius = 1). */
const DOT_RADIUS = 0.005;

interface ParsedObjects {
  satrecA: SatRec;
  satrecB: SatRec | null;
  nameA: string;
  nameB: string | null;
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

    /** Flashing red sphere that marks the ASAT target point / collision flash */
    this.dotImpact = new Mesh(
      new SphereGeometry(DOT_RADIUS * 2, 12, 8),
      new MeshBasicMaterial({
        color: 0xff3322,
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
  ): void {
    if (this.activeEventId === eventId) return;
    this.dispose();

    const satrecA = twoline2satrec(tleA.line1, tleA.line2);
    const satrecB = tleB ? twoline2satrec(tleB.line1, tleB.line2) : null;

    this.parsed = {
      satrecA,
      satrecB,
      nameA: tleA.name,
      nameB: tleB?.name ?? null,
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
      this.trailB.visible = false;
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
    const posA = new Vector3(sceneA.x, sceneA.y, sceneA.z);
    this.dotA.position.copy(posA);

    let posB: Vector3 | null = null;
    if (satrecB) {
      const propB = propagateObject(satrecB, simTime);
      if (propB) {
        const sceneB = eciToScene(propB.positionEci.x, propB.positionEci.y, propB.positionEci.z);
        posB = new Vector3(sceneB.x, sceneB.y, sceneB.z);
        this.dotB.position.copy(posB);
        this.dotB.visible = true;
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
