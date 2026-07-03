import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  Line,
  LineBasicMaterial,
} from 'three';
import type { SatRec } from 'satellite.js';
import { eciToScene } from '../orbital/coordinates';
import { propagateObject } from '../orbital/propagator';
import type { TrackedObject } from '../types';

const ORBIT_SAMPLES = 180;
const MIN_PERIOD_MS = 45 * 60 * 1000;
const MAX_PERIOD_MS = 24 * 60 * 60 * 1000;
const TRAIL_COLOR = new Color(0x22d3ee);

function getOrbitalPeriodMs(satrec: SatRec): number {
  const no = satrec.no;
  if (!no || no <= 0) return 90 * 60 * 1000;
  const periodMs = ((2 * Math.PI) / no) * 60 * 1000;
  return Math.min(MAX_PERIOD_MS, Math.max(MIN_PERIOD_MS, periodMs));
}

export class OrbitTrail {
  readonly group: Group;
  private readonly line: Line;
  private readonly positions: Float32Array;
  private readonly maxPoints: number;
  private lastUpdateKey = '';

  constructor() {
    this.maxPoints = ORBIT_SAMPLES + 1;
    this.positions = new Float32Array(this.maxPoints * 3);

    const geometry = new BufferGeometry();
    const positionAttr = new BufferAttribute(this.positions, 3);
    positionAttr.setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', positionAttr);

    this.line = new Line(
      geometry,
      new LineBasicMaterial({
        color: TRAIL_COLOR,
        transparent: true,
        opacity: 0.92,
        toneMapped: false,
        depthTest: true,
      }),
    );
    this.line.frustumCulled = false;
    this.line.renderOrder = 4;

    this.group = new Group();
    this.group.add(this.line);
    this.group.visible = false;
    this.group.renderOrder = 4;
  }

  update(
    visible: boolean,
    selectedIndex: number | null,
    objects: TrackedObject[],
    date: Date,
  ): void {
    if (!visible || selectedIndex == null) {
      this.group.visible = false;
      this.lastUpdateKey = '';
      return;
    }

    const obj = objects[selectedIndex];
    if (!obj) {
      this.group.visible = false;
      return;
    }

    const updateKey = `${selectedIndex}|${Math.floor(date.getTime() / 15_000)}`;
    if (updateKey === this.lastUpdateKey && this.group.visible) {
      return;
    }
    this.lastUpdateKey = updateKey;

    const periodMs = getOrbitalPeriodMs(obj.satrec);
    const startMs = date.getTime() - periodMs / 2;

    let validPoints = 0;
    for (let i = 0; i < this.maxPoints; i++) {
      const t = new Date(startMs + (i / ORBIT_SAMPLES) * periodMs);
      const propagation = propagateObject(obj.satrec, t);
      if (!propagation) continue;

      const scenePos = eciToScene(
        propagation.positionEci.x,
        propagation.positionEci.y,
        propagation.positionEci.z,
      );

      const offset = validPoints * 3;
      this.positions[offset] = scenePos.x;
      this.positions[offset + 1] = scenePos.y;
      this.positions[offset + 2] = scenePos.z;
      validPoints++;
    }

    if (validPoints < 2) {
      this.group.visible = false;
      return;
    }

    this.line.geometry.setDrawRange(0, validPoints);
    this.line.geometry.computeBoundingSphere();
    (this.line.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    this.group.visible = true;
  }
}
