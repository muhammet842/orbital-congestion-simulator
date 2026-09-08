import { PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EARTH_RADIUS_KM } from '../types';

const FLY_DURATION_MS = 1600;
const GLOBE_FRAME_DURATION_MS = 900;
const DEFAULT_FOV = 45;
const DEFAULT_POSITION = new Vector3(0, 0, 4.5);
const DEFAULT_TARGET = new Vector3(0, 0, 0);

type MotionMode = 'linear' | 'globe-orbit';

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function slerpDirection(from: Vector3, to: Vector3, t: number, out: Vector3): void {
  const dot = Math.min(1, Math.max(-1, from.dot(to)));
  const omega = Math.acos(dot);
  if (omega < 1e-5) {
    out.copy(from);
    return;
  }
  const sinOmega = Math.sin(omega);
  out.copy(from).multiplyScalar(Math.sin((1 - t) * omega) / sinOmega).addScaledVector(to, Math.sin(t * omega) / sinOmega);
}

interface CameraSnapshot {
  position: Vector3;
  target: Vector3;
  fov: number;
}

export class CameraFly {
  private active = false;
  private restoringGlobal = false;
  private motionMode: MotionMode = 'linear';
  private startTime = 0;
  private fromPos = new Vector3();
  private toPos = new Vector3();
  private fromTarget = new Vector3();
  private toTarget = new Vector3();
  private fromDir = new Vector3();
  private toDir = new Vector3();
  private fromOrbitRadius = DEFAULT_POSITION.length();
  private toOrbitRadius = DEFAULT_POSITION.length();
  private fromFov = DEFAULT_FOV;
  private toFov = DEFAULT_FOV;
  private globalSnapshot: CameraSnapshot | null = null;
  private durationMs = FLY_DURATION_MS;

  captureGlobalView(camera: PerspectiveCamera, controls: OrbitControls): void {
    if (this.globalSnapshot) return;
    this.globalSnapshot = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
  }

  clearGlobalSnapshot(): void {
    this.globalSnapshot = null;
  }

  frameSelectedOnGlobe(camera: PerspectiveCamera, controls: OrbitControls, nadirWorld: { x: number; y: number; z: number }, altitudeKm: number): void {
    const nadir = new Vector3(nadirWorld.x, nadirWorld.y, nadirWorld.z).normalize();
    const cameraDir = camera.position.clone().normalize();
    const targetRadius = (1 + Math.max(0, altitudeKm) / EARTH_RADIUS_KM) * 1.35 + 1.55;
    if (nadir.dot(cameraDir) > 0.88 && Math.abs(camera.position.length() - targetRadius) < 0.12) {
      controls.target.set(0, 0, 0);
      controls.update();
      return;
    }
    this.motionMode = 'globe-orbit';
    this.fromDir.copy(cameraDir);
    this.toDir.copy(nadir);
    this.fromOrbitRadius = camera.position.length();
    this.toOrbitRadius = targetRadius;
    this.fromTarget.copy(controls.target);
    this.toTarget.set(0, 0, 0);
    this.fromFov = camera.fov;
    this.toFov = camera.fov;
    this.restoringGlobal = false;
    this.durationMs = GLOBE_FRAME_DURATION_MS;
    this.startTime = performance.now();
    this.active = true;
    controls.enabled = false;
  }

  flyToGlobalView(camera: PerspectiveCamera, controls: OrbitControls): void {
    const snapshot = this.globalSnapshot ?? { position: DEFAULT_POSITION.clone(), target: DEFAULT_TARGET.clone(), fov: DEFAULT_FOV };
    this.beginLinearMotion(camera, controls, snapshot.position, snapshot.target, snapshot.fov, FLY_DURATION_MS);
    this.restoringGlobal = true;
  }

  update(camera: PerspectiveCamera, controls: OrbitControls, now: number): boolean {
    if (!this.active) return false;
    const progress = Math.min(1, (now - this.startTime) / this.durationMs);
    const eased = easeInOutCubic(progress);
    if (this.motionMode === 'globe-orbit') {
      const direction = new Vector3();
      slerpDirection(this.fromDir, this.toDir, eased, direction);
      camera.position.copy(direction.multiplyScalar(this.fromOrbitRadius + (this.toOrbitRadius - this.fromOrbitRadius) * eased));
      controls.target.lerpVectors(this.fromTarget, this.toTarget, eased);
    } else {
      camera.position.lerpVectors(this.fromPos, this.toPos, eased);
      controls.target.lerpVectors(this.fromTarget, this.toTarget, eased);
    }
    camera.fov = this.fromFov + (this.toFov - this.fromFov) * eased;
    camera.updateProjectionMatrix();
    if (progress >= 1) {
      this.active = false;
      this.motionMode = 'linear';
      controls.enabled = true;
      controls.update();
      if (this.restoringGlobal) {
        this.globalSnapshot = null;
        this.restoringGlobal = false;
      }
    }
    return this.active;
  }

  resetFov(camera: PerspectiveCamera): void {
    camera.fov = this.globalSnapshot?.fov ?? DEFAULT_FOV;
    camera.updateProjectionMatrix();
  }

  isActive(): boolean {
    return this.active;
  }

  private beginLinearMotion(camera: PerspectiveCamera, controls: OrbitControls, toPos: Vector3, toTarget: Vector3, toFov: number, durationMs: number): void {
    this.motionMode = 'linear';
    this.fromPos.copy(camera.position);
    this.toPos.copy(toPos);
    this.fromTarget.copy(controls.target);
    this.toTarget.copy(toTarget);
    this.fromFov = camera.fov;
    this.toFov = toFov;
    this.durationMs = durationMs;
    this.startTime = performance.now();
    this.active = true;
    controls.enabled = false;
  }
}
