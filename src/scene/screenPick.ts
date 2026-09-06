
export const GLOBE_PICK_RADIUS_PX = 24;

export const GLOBE_PICK_STACK_SLACK_PX = 8;

export interface ScreenPickCandidate {
  index: number;
  ndcX: number;
  ndcY: number;
  
  ndcZ: number;
  
  radial: number;
}

export function pickClosestScreenIndex(
  candidates: readonly ScreenPickCandidate[],
  pointerNdcX: number,
  pointerNdcY: number,
  canvasWidth: number,
  canvasHeight: number,
  radiusPx = GLOBE_PICK_RADIUS_PX,
  stackSlackPx = GLOBE_PICK_STACK_SLACK_PX,
): number | null {
  if (canvasWidth <= 0 || canvasHeight <= 0 || radiusPx <= 0) return null;

  const radiusSq = radiusPx * radiusPx;
  const halfW = canvasWidth * 0.5;
  const halfH = canvasHeight * 0.5;

  let bestDistSq = Infinity;
  const inRange: Array<{
    index: number;
    distSq: number;
    ndcZ: number;
    radial: number;
  }> = [];

  for (const candidate of candidates) {
    if (candidate.ndcZ < -1 || candidate.ndcZ > 1) continue;

    const dx = (candidate.ndcX - pointerNdcX) * halfW;
    const dy = (candidate.ndcY - pointerNdcY) * halfH;
    const distSq = dx * dx + dy * dy;
    if (distSq > radiusSq) continue;

    inRange.push({
      index: candidate.index,
      distSq,
      ndcZ: candidate.ndcZ,
      radial: candidate.radial,
    });
    if (distSq < bestDistSq) bestDistSq = distSq;
  }

  if (inRange.length === 0) return null;

  const slack = Math.max(0, stackSlackPx);
  const competeDistSq = bestDistSq + slack * slack;

  let bestIndex: number | null = null;
  let bestRadial = -Infinity;
  let bestCompeteDist = Infinity;
  let bestDepth = Infinity;

  for (const hit of inRange) {
    if (hit.distSq > competeDistSq) continue;

    const higherOrbit = hit.radial > bestRadial + 1e-6;
    const sameOrbitCloserPixel =
      Math.abs(hit.radial - bestRadial) <= 1e-6 && hit.distSq < bestCompeteDist - 1e-6;
    const sameOrbitSamePixelCloser =
      Math.abs(hit.radial - bestRadial) <= 1e-6 &&
      Math.abs(hit.distSq - bestCompeteDist) <= 1e-6 &&
      hit.ndcZ < bestDepth;
    if (!higherOrbit && !sameOrbitCloserPixel && !sameOrbitSamePixelCloser) continue;

    bestRadial = hit.radial;
    bestCompeteDist = hit.distSq;
    bestDepth = hit.ndcZ;
    bestIndex = hit.index;
  }

  return bestIndex;
}
