import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
} from 'three';
import { getSubSatelliteScenePoints } from '../orbital/coordinates';
import { propagateObject } from '../orbital/propagator';
import type { TrackedObject } from '../types';

const SWATH_COLOR = 0xc9b896;

function usesFootprint(obj: TrackedObject): boolean {
  return obj.category === 'active' || obj.category === 'stations';
}

export class SatelliteFootprint {
  readonly group: Group;
  private readonly nadirLine: Line;

  constructor() {
    this.group = new Group();
    this.group.name = 'satellite-footprint';
    this.group.renderOrder = 1;

    const ringGeometry = new BufferGeometry();
    ringGeometry.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
    this.nadirLine = new Line(
      ringGeometry,
      new LineBasicMaterial({
        color: SWATH_COLOR,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.nadirLine.frustumCulled = false;
    this.nadirLine.name = 'satellite-nadir-line';
    this.nadirLine.renderOrder = 2;

    this.group.add(this.nadirLine);
    this.group.visible = false;
  }

  
  update(selectedIndex: number | null, objects: TrackedObject[], date: Date): void {
    if (selectedIndex == null) {
      this.group.visible = false;
      return;
    }

    const obj = objects[selectedIndex];
    if (!obj || !usesFootprint(obj)) {
      this.group.visible = false;
      return;
    }

    const propagation = propagateObject(obj.satrec, date);
    if (!propagation) {
      this.group.visible = false;
      return;
    }

    const subSat = getSubSatelliteScenePoints(
      propagation.positionEci,
      propagation.altitudeKm,
    );
    if (!subSat) {
      this.group.visible = false;
      return;
    }

    const positions = this.nadirLine.geometry.getAttribute('position') as BufferAttribute;
    positions.setXYZ(0, subSat.satellite.x, subSat.satellite.y, subSat.satellite.z);
    positions.setXYZ(1, subSat.nadirWorld.x, subSat.nadirWorld.y, subSat.nadirWorld.z);
    positions.needsUpdate = true;

    this.group.visible = true;
  }
}

export { getSubSatelliteScenePoints } from '../orbital/coordinates';
