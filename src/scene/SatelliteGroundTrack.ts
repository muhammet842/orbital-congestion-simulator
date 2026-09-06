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

export const GT_LIFT = 1.004;

export const GAP_BREAK = 0.75;

export const MAX_RENDER_CHORD = 0.04;

const LAYER_COLORS: Record<OrbitLayer, number> = {
  LEO: 0x22d3ee,
  MEO: 0xfacc15,
  GEO: 0xfb923c,
  HEO: 0xa78bfa,
};

export function getOrbitalPeriodMs(satrec: SatRec): number {
  const no = satrec.no;
  if (!no || no <= 0) return 90 * 60 * 1000;
  const periodMs = ((2 * Math.PI) / no) * 60 * 1000;
  return Math.min(24 * 60 * 60 * 1000, Math.max(45 * 60 * 1000, periodMs));
}

export function groundTrackSampleCount(layer: OrbitLayer, totalMs: number): number {
  if (layer === 'GEO') return 96;
  
  const byTime = Math.ceil(totalMs / 45_000);
  if (layer === 'HEO') return Math.max(720, byTime);
  if (layer === 'MEO') return Math.max(360, byTime);
  return Math.max(240, byTime);
}

export function eciToEarthLocal(ex: number, ey: number, ez: number, gmst: number): Vector3 {
  const r = Math.sqrt(ex * ex + ey * ey + ez * ez);
  if (r < 1e-9) return new Vector3(GT_LIFT, 0, 0);
  const s = GT_LIFT / r;
  const cx = Math.cos(gmst);
  const sx = Math.sin(gmst);
  const ecefX = (ex * cx + ey * sx) * s;
  const ecefY = (-ex * sx + ey * cx) * s;
  const ecefZ = ez * s;
  
  return new Vector3(ecefX, ecefZ, -ecefY);
}

export function slerpOnSphere(a: Vector3, b: Vector3, t: number, radius: number): Vector3 {
  const an = a.clone().normalize();
  const bn = b.clone().normalize();
  let dot = an.dot(bn);
  dot = Math.min(1, Math.max(-1, dot));
  const omega = Math.acos(dot);
  if (omega < 1e-8) {
    return an.multiplyScalar(radius);
  }
  const so = Math.sin(omega);
  an.multiplyScalar(Math.sin((1 - t) * omega) / so);
  bn.multiplyScalar(Math.sin(t * omega) / so);
  return an.add(bn).multiplyScalar(radius);
}

export function splitOnLargeGaps(pts: Vector3[], gapDist = GAP_BREAK): Vector3[][] {
  const segments: Vector3[][] = [];
  let seg: Vector3[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && pts[i].distanceTo(pts[i - 1]) > gapDist) {
      if (seg.length >= 2) segments.push(seg);
      seg = [];
    }
    seg.push(pts[i]);
  }
  if (seg.length >= 2) segments.push(seg);
  return segments;
}

export function densifySpherePolyline(
  pts: Vector3[],
  maxChord = MAX_RENDER_CHORD,
  radius = GT_LIFT,
): Vector3[] {
  if (pts.length < 2) return pts.map((p) => p.clone());
  
  
  const maxAngle = Math.max(1e-6, maxChord / radius);
  const out: Vector3[] = [pts[0].clone()];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const an = a.clone().normalize();
    const bn = b.clone().normalize();
    const omega = Math.acos(Math.min(1, Math.max(-1, an.dot(bn))));
    const steps = Math.max(1, Math.ceil(omega / maxAngle));
    for (let s = 1; s <= steps; s++) {
      out.push(slerpOnSphere(a, b, s / steps, radius));
    }
  }
  return out;
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

    
    const key = `${selectedIndex}|${Math.floor(date.getTime() / 30_000)}`;
    if (key === this.lastUpdateKey && this.group.visible) return;
    this.lastUpdateKey = key;

    this.buildTrack(obj, date);
  }

  private buildTrack(obj: TrackedObject, date: Date): void {
    
    for (const line of this.activeLines) {
      this.group.remove(line);
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    }
    this.activeLines.length = 0;

    const color = LAYER_COLORS[obj.layer] ?? 0x22d3ee;
    (this.currentDot.material as MeshBasicMaterial).color.setHex(color);

    const periodMs = getOrbitalPeriodMs(obj.satrec);
    
    const numOrbits = obj.layer === 'GEO' || obj.layer === 'MEO' ? 1.0 : 1.5;
    const totalMs = periodMs * numOrbits;
    const samples = groundTrackSampleCount(obj.layer, totalMs);

    
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

    const segments = splitOnLargeGaps(pts).map((seg) => densifySpherePolyline(seg));

    
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

  
  clear(): void {
    this.group.visible = false;
    this.lastUpdateKey = '';
    this.currentDot.visible = false;
  }
}
