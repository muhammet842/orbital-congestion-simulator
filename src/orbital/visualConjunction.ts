import { Vector3 } from 'three';
import { ORBIT_DISPLAY_SCALE } from '../types';

const MIN_VIEW_DISTANCE = 0.035;

/**
 * Closest inspect distance to a close-approach midpoint.
 * 0.002 ≈ 13 km — tight enough to read a few-km gap, still above the
 * 0.001 camera near plane. 0.05 (≈ 320 km) left both objects as specks.
 */
export const PAIR_INSPECT_MIN_DISTANCE = 0.002;
/** Hard cap when looking away from Earth in pair-focus. */
export const PAIR_FOCUS_MAX_DISTANCE = 6;
/**
 * Keep the camera outside the unit Earth mesh. 1.08 ≈ 510 km above the
 * surface — below typical LEO, so a pair at ~780 km can still be framed.
 */
export const EARTH_CAMERA_CLEARANCE = 1.08;

/**
 * OrbitControls dolly range that keeps the camera outside Earth while still
 * orbiting a close-approach / collision midpoint (not Earth origin).
 *
 * minDistance / maxDistance are isotropic, so this uses the current
 * camera-target direction: looking out to space keeps a wide zoom-out;
 * looking toward the globe stops before the near-clip tunnels into Earth.
 */
export function getEarthSafeDollyRange(
  target: { x: number; y: number; z: number },
  camera: { x: number; y: number; z: number },
  earthClearance = EARTH_CAMERA_CLEARANCE,
): { minDistance: number; maxDistance: number } {
  const tx = target.x;
  const ty = target.y;
  const tz = target.z;
  const ox = camera.x - tx;
  const oy = camera.y - ty;
  const oz = camera.z - tz;
  const tLenSq = tx * tx + ty * ty + tz * tz;
  const C2 = earthClearance * earthClearance;
  const tNow = Math.hypot(ox, oy, oz);

  if (tLenSq <= C2 + 1e-8) {
    if (tNow < 1e-8) {
      return { minDistance: earthClearance, maxDistance: 10 };
    }
    const hx = ox / tNow;
    const hy = oy / tNow;
    const hz = oz / tNow;
    const tDot = tx * hx + ty * hy + tz * hz;
    const disc = Math.max(0, tDot * tDot - tLenSq + C2);
    const tExit = -tDot + Math.sqrt(disc);
    return {
      minDistance: Math.max(earthClearance, tExit),
      maxDistance: 10,
    };
  }

  const minDistance = PAIR_INSPECT_MIN_DISTANCE;
  let maxDistance = PAIR_FOCUS_MAX_DISTANCE;

  if (tNow < 1e-8) {
    return { minDistance, maxDistance };
  }

  const hx = ox / tNow;
  const hy = oy / tNow;
  const hz = oz / tNow;
  const tDot = tx * hx + ty * hy + tz * hz;
  const disc = tDot * tDot - tLenSq + C2;

  if (disc > 1e-12) {
    const s = Math.sqrt(disc);
    const tEnter = Math.min(-tDot - s, -tDot + s);
    if (tEnter > 0.03) {
      maxDistance = Math.min(maxDistance, tEnter - 0.02);
    } else if (tEnter > 0) {
      maxDistance = Math.min(maxDistance, tEnter * 0.85);
    }
  }

  if (maxDistance < minDistance) {
    return { minDistance: maxDistance, maxDistance };
  }
  return { minDistance, maxDistance };
}

/**
 * True-space layout for a conjunction pair. No on-screen exaggeration —
 * verification is for precise observation, so the gap must match live km.
 */
export function getVisualConjunctionLayout(
  posA: { x: number; y: number; z: number },
  posB: { x: number; y: number; z: number },
  _separationKm: number,
): {
  visualA: Vector3;
  visualB: Vector3;
  visualMid: Vector3;
  exaggerated: boolean;
  separationScene: number;
} {
  const a = new Vector3(posA.x, posA.y, posA.z);
  const b = new Vector3(posB.x, posB.y, posB.z);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const actualSep = a.distanceTo(b);

  return {
    visualA: a,
    visualB: b,
    visualMid: mid,
    exaggerated: false,
    separationScene: Math.max(actualSep, 1e-9),
  };
}

/** Camera distance that keeps a framed pair readable in the viewport. */
export function getConjunctionViewDistance(separationScene: number): number {
  return Math.max(MIN_VIEW_DISTANCE, separationScene * 3.6 + 0.04);
}

/** Initial camera pose when entering verification (one-shot fly-in only). */
export function getConjunctionCameraPose(
  posA: { x: number; y: number; z: number },
  posB: { x: number; y: number; z: number },
  separationKm: number,
): { cameraPos: Vector3; target: Vector3; fov: number } {
  const layout = getVisualConjunctionLayout(posA, posB, separationKm);
  const mid = layout.visualMid;
  const radial = mid.clone().normalize();

  // Prefer live km for the opening frame so a multi-km CPA is not started
  // from an overly tight pose; user then zooms manually for detail.
  const separationScene = Math.max(
    layout.separationScene,
    Math.max(0, separationKm) * ORBIT_DISPLAY_SCALE,
  );
  const viewDistance = getConjunctionViewDistance(separationScene);

  const offsetDir = layout.visualB.clone().sub(layout.visualA);
  if (offsetDir.lengthSq() < 1e-12) {
    offsetDir.crossVectors(radial, new Vector3(0, 1, 0));
    if (offsetDir.lengthSq() < 1e-12) offsetDir.set(1, 0, 0);
  }
  offsetDir.normalize();

  const side = new Vector3().crossVectors(radial, offsetDir);
  if (side.lengthSq() < 1e-6) side.crossVectors(radial, new Vector3(0, 0, 1));
  side.normalize();

  const cameraPos = mid
    .clone()
    .add(radial.clone().multiplyScalar(viewDistance))
    .add(side.multiplyScalar(separationScene * 0.8 + 0.025))
    .add(new Vector3(0, separationScene * 0.35 + 0.015, 0));

  return { cameraPos, target: mid.clone(), fov: 38 };
}
