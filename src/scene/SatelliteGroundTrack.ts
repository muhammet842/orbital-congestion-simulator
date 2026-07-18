import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { SatRec } from 'satellite.js';
import { gstime } from 'satellite.js';
import { propagateObject } from '../orbital/propagator';
import type { TrackedObject, OrbitLayer } from '../types';

/** Slightly higher than SURFACE_LIFT (1.001) to prevent z-fighting with Earth mesh. */
const GT_LIFT = 1.004;

/** Number of forward-projection samples per orbit. */
const SAMPLES_LEO = 240;
const SAMPLES_GEO = 96;

/** Angular jump threshold between consecutive samples (in scene units on unit sphere).
 *  Anything larger than ~0.15 units (≈8.6°) is treated as a date-line break and
 *  the line is split into a new segment. */
const BREAK_DIST = 0.14;

const LAYER_COLORS: Record<OrbitLayer, number> = {
  LEO: 0x22d3ee,
  MEO: 0xfacc15,
  GEO: 0xfb923c,
  HEO: 0xa78bfa,
};

function getOrbitalPeriodMs(satrec: SatRec): number {
  const no = satrec.no;
  if (!no || no <= 0) return 90 * 60 * 1000;
  const periodMs = ((2 * Math.PI) / no) * 60 * 1000;
  return Math.min(24 * 60 * 60 * 1000, Math.max(45 * 60 * 1000, periodMs));
}

/**
 * Convert an ECI position (km) at the given GMST angle to the Earth mesh's
 * *local* coordinate frame (Y-up, north pole = +Y).
 *
 * Because the ground track Group is a child of earth.mesh (which rotates by
 * GMST every frame), we store positions in ECEF-local coords here once and
 * the mesh's own transform carries the line along with Earth's rotation —
 * no per-frame recomputation needed.
 *
 * Derivation:
 *   ECI→ECEF: rotate around polar Z by −GMST
 *     ecef.x =  eci.x·cos(θ) + eci.y·sin(θ)
 *     ecef.y = −eci.x·sin(θ) + eci.y·cos(θ)
 *     ecef.z =  eci.z
 *   ECEF→Three.js Y-up local frame: (X=ECEF.X, Y=ECEF.Z, Z=−ECEF.Y)
 */
function eciToEarthLocal(ex: number, ey: number, ez: number, gmst: number): Vector3 {
  const r = Math.sqrt(ex * ex + ey * ey + ez * ez);
  if (r < 1e-9) return new Vector3(GT_LIFT, 0, 0);
  const s = GT_LIFT / r;
  const cx = Math.cos(gmst);
  const sx = Math.sin(gmst);
  const ecefX = (ex * cx + ey * sx) * s;
  const ecefY = (-ex * sx + ey * cx) * s;
  const ecefZ = ez * s;
  // Y-up axis swap: Three.js local X = ECEF X, local Y = ECEF Z (north pole), local Z = −ECEF Y
  return new Vector3(ecefX, ecefZ, -ecefY);
}

export class SatelliteGroundTrack {
  readonly group: Group;
  private readonly activeLines: Line[] = [];
  private readonly currentDot: Mesh;
  private lastUpdateKey = '';

  constructor() {
    this.group = new Group();
    this.group.renderOrder = 2;
    this.group.visible = false;

    this.currentDot = new Mesh(
      new SphereGeometry(0.0055, 8, 6),
      new MeshBasicMaterial({
        color: 0x22d3ee,
        toneMapped: false,
        depthTest: true,
        depthWrite: true,
      }),
    );
    this.currentDot.renderOrder = 3;
    this.currentDot.visible = false;
    this.group.add(this.currentDot);
  }

  /** Attach to the Earth mesh so the group inherits Earth's rotation automatically. */
  attachToEarth(earthMesh: Mesh): void {
    earthMesh.add(this.group);
  }

  update(
    selectedIndex: number | null,
    objects: TrackedObject[],
    date: Date,
  ): void {
    if (selectedIndex == null) {
      this.group.visible = false;
      this.lastUpdateKey = '';
      return;
    }

    const obj = objects[selectedIndex];
    if (!obj) {
      this.group.visible = false;
      return;
    }

    // Throttle: recompute every 30 simulation seconds
    const key = `${selectedIndex}|${Math.floor(date.getTime() / 30_000)}`;
    if (key === this.lastUpdateKey && this.group.visible) return;
    this.lastUpdateKey = key;

    this.buildTrack(obj, date);
  }

  private buildTrack(obj: TrackedObject, date: Date): void {
    // Dispose previous line geometries
    for (const line of this.activeLines) {
      this.group.remove(line);
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    }
    this.activeLines.length = 0;

    const color = LAYER_COLORS[obj.layer] ?? 0x22d3ee;
    (this.currentDot.material as MeshBasicMaterial).color.setHex(color);

    const periodMs = getOrbitalPeriodMs(obj.satrec);
    // LEO/HEO: 1.5 orbits forward; MEO: 1.0; GEO: 1.0 (analemma)
    const numOrbits = obj.layer === 'GEO' || obj.layer === 'MEO' ? 1.0 : 1.5;
    const totalMs = periodMs * numOrbits;
    const samples = obj.layer === 'GEO' ? SAMPLES_GEO : SAMPLES_LEO;

    // Collect sub-satellite points in Earth-local coordinates
    const pts: Vector3[] = [];
    let dotPt: Vector3 | null = null;

    for (let i = 0; i <= samples; i++) {
      const t = new Date(date.getTime() + (i / samples) * totalMs);
      const res = propagateObject(obj.satrec, t);
      if (!res) continue;

      const gmst = gstime(t);
      const pt = eciToEarthLocal(
        res.positionEci.x,
        res.positionEci.y,
        res.positionEci.z,
        gmst,
      );
      pts.push(pt);
      if (i === 0) dotPt = pt;
    }

    // Place sub-satellite dot at current position
    if (dotPt) {
      this.currentDot.position.copy(dotPt);
      this.currentDot.visible = true;
    } else {
      this.currentDot.visible = false;
    }

    if (pts.length < 2) {
      this.group.visible = false;
      return;
    }

    // Split into segments where the date-line (or any large angular gap) occurs
    const segments: Vector3[][] = [];
    let seg: Vector3[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].distanceTo(pts[i - 1]) > BREAK_DIST) {
        if (seg.length >= 2) segments.push(seg);
        seg = [];
      }
      seg.push(pts[i]);
    }
    if (seg.length >= 2) segments.push(seg);

    // Build one Line per segment
    const mat = new LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      toneMapped: false,
      depthTest: true,
      depthWrite: false,
    });

    for (const segment of segments) {
      const arr = new Float32Array(segment.length * 3);
      for (let j = 0; j < segment.length; j++) {
        arr[j * 3] = segment[j].x;
        arr[j * 3 + 1] = segment[j].y;
        arr[j * 3 + 2] = segment[j].z;
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(arr, 3));

      const line = new Line(geo, mat);
      line.frustumCulled = false;
      line.renderOrder = 2;
      this.group.add(line);
      this.activeLines.push(line);
    }

    this.group.visible = this.activeLines.length > 0 || this.currentDot.visible;
  }

  /** Hard-clear on deselect or replay start. */
  clear(): void {
    this.group.visible = false;
    this.lastUpdateKey = '';
    this.currentDot.visible = false;
  }
}
