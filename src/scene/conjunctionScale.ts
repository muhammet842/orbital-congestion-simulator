import { ORBIT_DISPLAY_SCALE } from '../types';
import { TARGET_MODEL_SIZE } from './SatelliteModelLoader';

export const DEFAULT_CONJUNCTION_SCALE = 2.2;
/** Absolute floor (~38 m) so sub-100 m live gaps are not forced into overlap. */
export const MIN_CONJUNCTION_SCALE = 0.0015;
/** Keep each object's footprint under this fraction of the live separation. */
export const CONJUNCTION_SIZE_FRACTION_OF_SEPARATION = 0.12;

/**
 * Cap conjunction models by live separation so they shrink as the pair
 * closes. The camera no longer auto-dollies — the user zooms manually for
 * precise inspection while the gap stays honest in world space.
 */
export function conjunctionModelScale(liveDistanceKm: number | null): number {
  if (liveDistanceKm == null || !Number.isFinite(liveDistanceKm) || liveDistanceKm <= 0) {
    return DEFAULT_CONJUNCTION_SCALE;
  }
  const maxModelSizeScene = liveDistanceKm * ORBIT_DISPLAY_SCALE * CONJUNCTION_SIZE_FRACTION_OF_SEPARATION;
  const distanceCappedScale = maxModelSizeScene / TARGET_MODEL_SIZE;
  return Math.min(DEFAULT_CONJUNCTION_SCALE, Math.max(MIN_CONJUNCTION_SCALE, distanceCappedScale));
}
