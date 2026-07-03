import { PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getConjunctionCameraPose, getVisualConjunctionLayout } from '../orbital/visualConjunction';

const FLY_DURATION_MS = 1600;
const DEFAULT_FOV = 45;
const DEFAULT_POSITION = new Vector3(0, 0, 4.5);
const DEFAULT_TARGET = new Vector3(0, 0, 0);
const TRACKING_SMOOTHING = 10;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface CameraSnapshot {
  position: Vector3;
  target: Vector3;
  fov: number;
}

export class CameraFly {
  private active = false;
  private restoringGlobal = false;
  private conjunctionTracking = false;
  private startTime = 0;
  private fromPos = new Vector3();
  private toPos = new Vector3();
  private fromTarget = new Vector3();
  private toTarget = new Vector3();
  private fromFov = DEFAULT_FOV;
  private toFov = DEFAULT_FOV;
  private globalSnapshot: CameraSnapshot | null = null;
  private trackedMid = new Vector3();
  private trackingInitialized = false;
  private trackingOnComplete = false;

  captureGlobalView(camera: PerspectiveCamera, controls: OrbitControls): void {
    if (this.globalSnapshot) return;
    this.globalSnapshot = {
      position: camera.position.clone(),
      target: controls.target.clone(),
      fov: camera.fov,
    };
  }

  clearGlobalSnapshot(): void {
    this.globalSnapshot = null;
  }

  /** One-time smooth zoom when a conjunction card is first selected. */
  flyToConjunctionPair(
    camera: PerspectiveCamera,
    controls: OrbitControls,
    posA: { x: number; y: number; z: number },
    posB: { x: number; y: number; z: number },
    separationKm: number,
  ): void {
    const pose = getConjunctionCameraPose(posA, posB, separationKm);
    this.beginFlight(camera, controls, pose.cameraPos, pose.target, pose.fov, true);
    this.restoringGlobal = false;
    this.conjunctionTracking = false;
    this.trackingInitialized = false;
  }

  /** Frame Earth and a selected spacecraft without shifting the orbit target off-world. */
  flyToSelectedObject(
    camera: PerspectiveCamera,
    controls: OrbitControls,
    satellite: { x: number; y: number; z: number },
    altitudeKm: number,
  ): void {
    const sat = new Vector3(satellite.x, satellite.y, satellite.z);
    const radial = sat.clone().normalize();
    const orbitRadius = sat.length();

    const worldUp = new Vector3(0, 1, 0);
    let side = new Vector3().crossVectors(radial, worldUp);
    if (side.lengthSq() < 1e-4) {
      side = new Vector3(1, 0, 0);
    } else {
      side.normalize();
    }

    const up = new Vector3().crossVectors(side, radial).normalize();
    const target = new Vector3(0, 0, 0);
    const pullBack = Math.max(orbitRadius * 1.05 + 2.5, 7.5);
    const cameraPos = radial
      .clone()
      .multiplyScalar(pullBack * 0.4)
      .add(side.clone().multiplyScalar(pullBack * 0.75))
      .add(up.clone().multiplyScalar(pullBack * 0.15));

    const fov = altitudeKm > 20_000 ? 44 : altitudeKm > 5_000 ? 46 : DEFAULT_FOV;
    this.beginFlight(camera, controls, cameraPos, target, fov, false);
    this.restoringGlobal = false;
    this.conjunctionTracking = false;
    this.trackingInitialized = false;
  }

  flyToGlobalView(camera: PerspectiveCamera, controls: OrbitControls): void {
    const snap = this.globalSnapshot ?? {
      position: DEFAULT_POSITION.clone(),
      target: DEFAULT_TARGET.clone(),
      fov: DEFAULT_FOV,
    };

    this.beginFlight(camera, controls, snap.position, snap.target, snap.fov, false);
    this.restoringGlobal = true;
    this.conjunctionTracking = false;
    this.trackingInitialized = false;
  }

  /**
   * Pan target + camera together so the pair stays centered while preserving
   * the user's orbit angle (OrbitControls remains fully interactive).
   */
  followConjunctionMidpoint(
    camera: PerspectiveCamera,
    controls: OrbitControls,
    posA: { x: number; y: number; z: number },
    posB: { x: number; y: number; z: number },
    separationKm: number,
    deltaMs: number,
  ): void {
    if (!this.conjunctionTracking || this.active) return;

    const desiredMid = getVisualConjunctionLayout(posA, posB, separationKm).visualMid;

    if (!this.trackingInitialized) {
      this.trackedMid.copy(desiredMid);
      this.trackingInitialized = true;
      return;
    }

    const alpha = 1 - Math.exp(-(deltaMs / 1000) * TRACKING_SMOOTHING);
    const nextMid = this.trackedMid.clone().lerp(desiredMid, alpha);
    const delta = nextMid.sub(this.trackedMid);
    this.trackedMid.add(delta);

    controls.target.add(delta);
    camera.position.add(delta);
  }

  update(camera: PerspectiveCamera, controls: OrbitControls, now: number): boolean {
    if (!this.active) return false;

    const elapsed = now - this.startTime;
    const progress = Math.min(1, elapsed / FLY_DURATION_MS);
    const eased = easeInOutCubic(progress);

    camera.position.lerpVectors(this.fromPos, this.toPos, eased);
    controls.target.lerpVectors(this.fromTarget, this.toTarget, eased);
    camera.fov = this.fromFov + (this.toFov - this.fromFov) * eased;
    camera.updateProjectionMatrix();

    if (progress >= 1) {
      this.active = false;
      controls.enabled = true;
      controls.update();

      if (this.restoringGlobal) {
        this.globalSnapshot = null;
        this.restoringGlobal = false;
        this.conjunctionTracking = false;
        this.trackingInitialized = false;
      } else if (this.trackingOnComplete) {
        this.conjunctionTracking = true;
        this.trackedMid.copy(controls.target);
        this.trackingInitialized = true;
      }
    }

    return this.active;
  }

  resetFov(camera: PerspectiveCamera): void {
    const fov = this.globalSnapshot?.fov ?? DEFAULT_FOV;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  isActive(): boolean {
    return this.active;
  }

  private beginFlight(
    camera: PerspectiveCamera,
    controls: OrbitControls,
    toPos: Vector3,
    toTarget: Vector3,
    toFov: number,
    enableTrackingOnComplete: boolean,
  ): void {
    this.fromPos.copy(camera.position);
    this.toPos.copy(toPos);
    this.fromTarget.copy(controls.target);
    this.toTarget.copy(toTarget);
    this.fromFov = camera.fov;
    this.toFov = toFov;
    this.trackingOnComplete = enableTrackingOnComplete;

    this.startTime = performance.now();
    this.active = true;
    controls.enabled = false;
  }
}
