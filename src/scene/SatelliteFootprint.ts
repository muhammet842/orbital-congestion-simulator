import {
  ConeGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  Vector3,
} from 'three';
import { getSubSatelliteScenePoints } from '../orbital/coordinates';
import { propagateObject } from '../orbital/propagator';
import type { TrackedObject } from '../types';

const SWATH_COLOR = 0x22d3ee;
const CONE_OPACITY = 0.15;

function usesFootprint(obj: TrackedObject): boolean {
  return obj.category === 'active' || obj.category === 'stations';
}

/**
 * ConeGeometry: tip at +Y/2, wide base at -Y/2 (local space).
 * Midpoint sits between nadir and satellite so tip = satellite, base = surface.
 */
function placeCoverageCone(
  cone: Mesh,
  apex: Vector3,
  nadir: Vector3,
  footprintRadius: number,
  coneHeight: number,
): void {
  if (coneHeight < 1e-4) {
    cone.visible = false;
    return;
  }

  const axis = apex.clone().normalize();
  const mid = apex.clone().add(nadir).multiplyScalar(0.5);

  cone.position.copy(mid);
  cone.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis);
  cone.scale.set(footprintRadius, coneHeight, footprintRadius);
  cone.visible = true;
}

export class SatelliteFootprint {
  readonly group: Group;
  private readonly cone: Mesh;
  private readonly surfaceRing: Mesh;
  private readonly earthMesh: Object3D;
  private readonly apex = new Vector3();
  private readonly nadirWorld = new Vector3();
  private readonly nadirLocal = new Vector3();
  private readonly surfaceNormal = new Vector3();
  private readonly invEarthMatrix = new Matrix4();

  constructor(earthMesh: Object3D) {
    this.earthMesh = earthMesh;

    this.group = new Group();
    this.group.renderOrder = 1;
    this.group.name = 'satellite-footprint';

    this.cone = new Mesh(
      new ConeGeometry(1, 1, 48, 1, true),
      new MeshBasicMaterial({
        color: SWATH_COLOR,
        transparent: true,
        opacity: CONE_OPACITY,
        side: DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.cone.frustumCulled = false;

    this.surfaceRing = new Mesh(
      new RingGeometry(0.88, 1, 64),
      new MeshBasicMaterial({
        color: SWATH_COLOR,
        transparent: true,
        opacity: 0.55,
        side: DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.surfaceRing.frustumCulled = false;
    this.surfaceRing.renderOrder = 2;

    this.group.add(this.cone);
    this.earthMesh.add(this.surfaceRing);
    this.group.visible = false;
    this.surfaceRing.visible = false;
  }

  update(selectedIndex: number | null, objects: TrackedObject[], date: Date): void {
    if (selectedIndex == null) {
      this.group.visible = false;
      this.surfaceRing.visible = false;
      return;
    }

    const obj = objects[selectedIndex];
    if (!obj || !usesFootprint(obj)) {
      this.group.visible = false;
      this.surfaceRing.visible = false;
      return;
    }

    const propagation = propagateObject(obj.satrec, date);
    if (!propagation) {
      this.group.visible = false;
      this.surfaceRing.visible = false;
      return;
    }

    const subSat = getSubSatelliteScenePoints(propagation.positionEci, propagation.altitudeKm);
    if (!subSat) {
      this.group.visible = false;
      this.surfaceRing.visible = false;
      return;
    }

    this.apex.set(subSat.satellite.x, subSat.satellite.y, subSat.satellite.z);
    this.nadirWorld.set(subSat.nadirWorld.x, subSat.nadirWorld.y, subSat.nadirWorld.z);

    placeCoverageCone(
      this.cone,
      this.apex,
      this.nadirWorld,
      subSat.footprintRadiusScene,
      subSat.coneHeightScene,
    );

    this.earthMesh.updateMatrixWorld(true);
    this.invEarthMatrix.copy(this.earthMesh.matrixWorld).invert();
    this.nadirLocal.copy(this.nadirWorld).applyMatrix4(this.invEarthMatrix);
    this.surfaceRing.position.copy(this.nadirLocal);
    this.surfaceNormal.copy(this.nadirLocal).normalize();
    this.surfaceRing.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), this.surfaceNormal);
    this.surfaceRing.scale.set(
      subSat.footprintRadiusScene,
      subSat.footprintRadiusScene,
      1,
    );

    this.group.visible = true;
    this.surfaceRing.visible = true;
  }
}

export { getSubSatelliteScenePoints } from '../orbital/coordinates';
