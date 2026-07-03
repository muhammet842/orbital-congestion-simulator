import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { getSubSatelliteScenePoints } from '../orbital/coordinates';
import { propagateObject } from '../orbital/propagator';
import type { TrackedObject } from '../types';

const MARKER_DOT_RADIUS = 0.014;
const MARKER_RING_INNER = 0.022;
const MARKER_RING_OUTER = 0.034;
const NADIR_DOT_RADIUS = 0.008;

export class SelectionMarker {
  readonly group: Group;
  private readonly dot: Mesh;
  private readonly ring: Mesh;
  private readonly nadirDot: Mesh;
  private readonly line: Line;
  private readonly linePositions: Float32Array;
  private readonly position = new Vector3();
  private readonly nadir = new Vector3();

  constructor() {
    this.group = new Group();
    this.group.renderOrder = 3;

    this.dot = new Mesh(
      new SphereGeometry(MARKER_DOT_RADIUS, 16, 16),
      new MeshBasicMaterial({ color: 0xffffff, toneMapped: false, depthTest: true }),
    );

    this.ring = new Mesh(
      new RingGeometry(MARKER_RING_INNER, MARKER_RING_OUTER, 48),
      new MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.9,
        side: DoubleSide,
        toneMapped: false,
        depthTest: true,
      }),
    );

    this.nadirDot = new Mesh(
      new SphereGeometry(NADIR_DOT_RADIUS, 12, 12),
      new MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.85,
        toneMapped: false,
        depthTest: true,
      }),
    );

    this.linePositions = new Float32Array(6);
    const lineGeometry = new BufferGeometry();
    lineGeometry.setAttribute('position', new BufferAttribute(this.linePositions, 3));
    this.line = new Line(
      lineGeometry,
      new LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.45,
        toneMapped: false,
        depthTest: true,
      }),
    );

    this.group.add(this.line, this.nadirDot, this.ring, this.dot);
    this.group.visible = false;
  }

  update(
    selectedIndex: number | null,
    objects: TrackedObject[],
    date: Date,
  ): void {
    if (selectedIndex == null) {
      this.group.visible = false;
      return;
    }

    const obj = objects[selectedIndex];
    if (!obj) {
      this.group.visible = false;
      return;
    }

    const propagation = propagateObject(obj.satrec, date);
    if (!propagation) {
      this.group.visible = false;
      return;
    }

    const subSat = getSubSatelliteScenePoints(propagation.positionEci, propagation.altitudeKm);
    if (!subSat) {
      this.group.visible = false;
      return;
    }

    this.position.set(subSat.satellite.x, subSat.satellite.y, subSat.satellite.z);
    this.nadir.set(subSat.nadirWorld.x, subSat.nadirWorld.y, subSat.nadirWorld.z);
    this.group.visible = true;

    // Satellite position is shown by instanced points / GLTF — only draw the ground link.
    this.dot.visible = false;
    this.ring.visible = false;
    this.nadirDot.position.copy(this.nadir);

    this.linePositions[0] = this.nadir.x;
    this.linePositions[1] = this.nadir.y;
    this.linePositions[2] = this.nadir.z;
    this.linePositions[3] = this.position.x;
    this.linePositions[4] = this.position.y;
    this.linePositions[5] = this.position.z;
    (this.line.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
  }
}
