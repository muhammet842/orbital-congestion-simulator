import { Vector3 } from 'three';
import { ORBIT_DISPLAY_SCALE } from '../types';

/** Minimum on-screen separation so two close objects can be framed side by side. */
export const MIN_VISUAL_SEPARATION_SCENE = 0.014;
const MIN_VIEW_DISTANCE = 0.035;

export function getVisualConjunctionLayout(
  posA: { x: number; y: number; z: number },
  posB: { x: number; y: number; z: number },
  separationKm: number,
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
  const targetSep = Math.max(actualSep, separationKm * ORBIT_DISPLAY_SCALE, MIN_VISUAL_SEPARATION_SCENE);

  if (actualSep >= targetSep * 0.85) {
    return {
      visualA: a,
      visualB: b,
      visualMid: mid,
      exaggerated: false,
      separationScene: actualSep,
    };
  }

  let dir = b.clone().sub(a);
  if (dir.lengthSq() < 1e-12) {
    dir = mid.clone().normalize().cross(new Vector3(0, 1, 0));
    if (dir.lengthSq() < 1e-12) dir.set(1, 0, 0);
  }
  dir.normalize();

  const half = targetSep * 0.5;
  return {
    visualA: mid.clone().sub(dir.clone().multiplyScalar(half)),
    visualB: mid.clone().add(dir.multiplyScalar(half)),
    visualMid: mid.clone(),
    exaggerated: true,
    separationScene: targetSep,
  };
}

/**
 * Separation used for model sizing / camera framing. Never smaller than the
 * on-screen exaggeration floor, otherwise models shrink to invisible specks
 * while the camera still frames the enlarged pair.
 */
export function getConjunctionFramingSeparationKm(liveDistanceKm: number): number {
  const liveScene = Math.max(0, liveDistanceKm) * ORBIT_DISPLAY_SCALE;
  const framingScene = Math.max(liveScene, MIN_VISUAL_SEPARATION_SCENE);
  return framingScene / ORBIT_DISPLAY_SCALE;
}

/** Camera distance that keeps a framed pair readable in the viewport. */
export function getConjunctionViewDistance(separationScene: number): number {
  return Math.max(MIN_VIEW_DISTANCE, separationScene * 3.6 + 0.04);
}

/** Camera pose that keeps the pair framed with the lens pointed outward from Earth. */
export function getConjunctionCameraPose(
  posA: { x: number; y: number; z: number },
  posB: { x: number; y: number; z: number },
  separationKm: number,
): { cameraPos: Vector3; target: Vector3; fov: number } {
  const layout = getVisualConjunctionLayout(posA, posB, separationKm);
  const mid = layout.visualMid;
  const radial = mid.clone().normalize();

  const separationScene = layout.separationScene;
  const viewDistance = getConjunctionViewDistance(separationScene);

  const offsetDir = layout.visualB.clone().sub(layout.visualA).normalize();
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
