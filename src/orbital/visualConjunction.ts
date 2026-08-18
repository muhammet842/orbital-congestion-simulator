import { Vector3 } from 'three';
import { ORBIT_DISPLAY_SCALE } from '../types';

const MIN_VIEW_DISTANCE = 0.035;
/**
 * Opening fly-in distance cap (~540 km). A 500 km live gap otherwise frames
 * the whole globe; close-approach view should look at the pair like an
 * ~80 km snapshot, then the user can zoom out if they want Earth context.
 */
const MAX_OPENING_VIEW_DISTANCE = 0.085;

/**
 * Closest inspect distance to a close-approach midpoint.
 * 0.002 ≈ 13 km — tight enough to read a few-km gap, still above the
 * 0.001 camera near plane.
 */
export const PAIR_INSPECT_MIN_DISTANCE = 0.002;
/** Hard cap when orbiting the pair (not Earth origin). */
export const PAIR_FOCUS_MAX_DISTANCE = 6;

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
  const raw = Math.max(MIN_VIEW_DISTANCE, separationScene * 3.6 + 0.04);
  return Math.min(MAX_OPENING_VIEW_DISTANCE, raw);
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
