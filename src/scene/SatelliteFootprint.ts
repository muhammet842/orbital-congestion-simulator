import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import { getSubSatelliteScenePoints, SURFACE_LIFT } from '../orbital/coordinates';
import { propagateObject } from '../orbital/propagator';
import type { TrackedObject } from '../types';

const SWATH_COLOR = 0xe8a45a;
const CONE_OPACITY = 0.18;
const RING_OPACITY = 0.72;

/** Unit cone (height = 1, radius = 1) with apex at local origin, body opening along −Y. */
const UNIT_CONE_HEIGHT = 1;

const scratchSatPos = new Vector3();
const scratchToEarth = new Vector3();
const scratchNadir = new Vector3();
const scratchU = new Vector3();
const scratchV = new Vector3();
const scratchPoint = new Vector3();
const APEX_TO_BASE = new Vector3(0, -1, 0);

function usesFootprint(obj: TrackedObject): boolean {
  return obj.category === 'active' || obj.category === 'stations';
}

function horizonRingSegments(thetaRad: number): number {
  return Math.min(128, Math.max(36, Math.ceil((thetaRad * 180) / Math.PI)));
}

/**
 * Cone pivot at the tip: default ConeGeometry is Y-centred; shift so apex = (0,0,0).
 * translate(0, -height/2, 0) moves tip from +Y/2 down to the origin.
 */
function createApexPivotedConeGeometry(): ConeGeometry {
  const geometry = new ConeGeometry(1, UNIT_CONE_HEIGHT, 32, 1, true);
  geometry.translate(0, -UNIT_CONE_HEIGHT / 2, 0);
  return geometry;
}

function writeHorizonRingPositions(
  positions: Float32Array,
  nadirUnit: Vector3,
  thetaRad: number,
  sphereRadius: number,
): void {
  const segments = positions.length / 3 - 1;
  const sinT = Math.sin(thetaRad);
  const cosT = Math.cos(thetaRad);

  scratchNadir.copy(nadirUnit).normalize();
  const refAxis = Math.abs(scratchNadir.y) < 0.9 ? scratchPoint.set(0, 1, 0) : scratchPoint.set(1, 0, 0);
  scratchU.crossVectors(refAxis, scratchNadir).normalize();
  scratchV.crossVectors(scratchNadir, scratchU).normalize();

  for (let i = 0; i <= segments; i++) {
    const az = (i / segments) * Math.PI * 2;
    const cosAz = Math.cos(az);
    const sinAz = Math.sin(az);

    scratchPoint
      .copy(scratchNadir)
      .multiplyScalar(cosT)
      .addScaledVector(scratchU, sinT * cosAz)
      .addScaledVector(scratchV, sinT * sinAz)
      .multiplyScalar(sphereRadius);

    const offset = i * 3;
    positions[offset] = scratchPoint.x;
    positions[offset + 1] = scratchPoint.y;
    positions[offset + 2] = scratchPoint.z;
  }
}

export class SatelliteFootprint {
  readonly group: Group;
  private readonly cone: Mesh;
  private readonly horizonRing: Line;
  private ringPositions: Float32Array;
  private ringSegmentCount = 0;

  constructor() {
    this.group = new Group();
    this.group.name = 'satellite-footprint';
    this.group.renderOrder = 1;

    this.cone = new Mesh(
      createApexPivotedConeGeometry(),
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
    this.cone.name = 'footprint-cone';

    this.ringSegmentCount = 64;
    this.ringPositions = new Float32Array((this.ringSegmentCount + 1) * 3);
    const ringGeometry = new BufferGeometry();
    ringGeometry.setAttribute('position', new BufferAttribute(this.ringPositions, 3));

    this.horizonRing = new Line(
      ringGeometry,
      new LineBasicMaterial({
        color: SWATH_COLOR,
        transparent: true,
        opacity: RING_OPACITY,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.horizonRing.frustumCulled = false;
    this.horizonRing.name = 'footprint-horizon-ring';
    this.horizonRing.renderOrder = 2;

    this.group.add(this.cone, this.horizonRing);
    this.group.visible = false;
  }

  private syncRingBuffer(thetaRad: number): void {
    const needed = horizonRingSegments(thetaRad);
    if (needed === this.ringSegmentCount) return;

    this.ringSegmentCount = needed;
    this.ringPositions = new Float32Array((needed + 1) * 3);
    this.horizonRing.geometry.dispose();
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.ringPositions, 3));
    this.horizonRing.geometry = geometry;
  }

  /** Frame-synced from SceneManager.tick — position, orientation, and scale every frame. */
  update(selectedIndex: number | null, objects: TrackedObject[], date: Date): void {
    if (selectedIndex == null) {
      this.group.visible = false;
      this.cone.visible = false;
      return;
    }

    const obj = objects[selectedIndex];
    if (!obj || !usesFootprint(obj)) {
      this.group.visible = false;
      this.cone.visible = false;
      return;
    }

    const propagation = propagateObject(obj.satrec, date);
    if (!propagation) {
      this.group.visible = false;
      this.cone.visible = false;
      return;
    }

    const subSat = getSubSatelliteScenePoints(
      propagation.positionEci,
      propagation.altitudeKm,
    );
    if (!subSat) {
      this.group.visible = false;
      this.cone.visible = false;
      return;
    }

    scratchSatPos.set(subSat.satellite.x, subSat.satellite.y, subSat.satellite.z);

    const height = subSat.coneHeightScene;
    const baseRadius = subSat.baseRadiusScene;
    const theta = subSat.thetaRad;

    if (height < 1e-4 || baseRadius < 1e-6) {
      this.group.visible = false;
      this.cone.visible = false;
      return;
    }

    // 1. Apex locked to satellite world position
    this.cone.position.copy(scratchSatPos);

    // 2. Orient: local −Y (apex → base) aligns with vector toward Earth centre
    scratchToEarth.copy(scratchSatPos).normalize().negate();
    this.cone.quaternion.setFromUnitVectors(APEX_TO_BASE, scratchToEarth);

    // 3. Scale unit geometry to physical horizon proportions (no geometry rebuild)
    this.cone.scale.set(baseRadius, height, baseRadius);
    this.cone.visible = true;

    this.syncRingBuffer(theta);
    writeHorizonRingPositions(this.ringPositions, scratchSatPos, theta, SURFACE_LIFT);
    (this.horizonRing.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;

    this.group.visible = true;
  }
}

export { getSubSatelliteScenePoints } from '../orbital/coordinates';
