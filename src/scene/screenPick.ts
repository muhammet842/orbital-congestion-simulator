/** Click radius around a globe catalog marker, in CSS pixels. */
export const GLOBE_PICK_RADIUS_PX = 24;

export interface ScreenPickCandidate {
  index: number;
  ndcX: number;
  ndcY: number;
  /** Clip-space depth after `Vector3.project`; nearer to the camera is smaller. */
  ndcZ: number;
}

/**
 * Nearest on-screen catalog object within `radiusPx` of the pointer.
 * Used because globe markers are ~1 px meshes — exact raycasts miss nearby clicks.
 */
export function pickClosestScreenIndex(
  candidates: readonly ScreenPickCandidate[],
  pointerNdcX: number,
  pointerNdcY: number,
  canvasWidth: number,
  canvasHeight: number,
  radiusPx = GLOBE_PICK_RADIUS_PX,
): number | null {
  if (canvasWidth <= 0 || canvasHeight <= 0 || radiusPx <= 0) return null;

  const radiusSq = radiusPx * radiusPx;
  const halfW = canvasWidth * 0.5;
  const halfH = canvasHeight * 0.5;
  let bestIndex: number | null = null;
  let bestDistSq = Infinity;
  let bestDepth = Infinity;

  for (const candidate of candidates) {
    if (candidate.ndcZ < -1 || candidate.ndcZ > 1) continue;

    const dx = (candidate.ndcX - pointerNdcX) * halfW;
    const dy = (candidate.ndcY - pointerNdcY) * halfH;
    const distSq = dx * dx + dy * dy;
    if (distSq > radiusSq) continue;

    const closer = distSq < bestDistSq - 1e-6;
    const samePixelCloserDepth =
      Math.abs(distSq - bestDistSq) <= 1e-6 && candidate.ndcZ < bestDepth;
    if (!closer && !samePixelCloserDepth) continue;

    bestDistSq = distSq;
    bestDepth = candidate.ndcZ;
    bestIndex = candidate.index;
  }

  return bestIndex;
}
