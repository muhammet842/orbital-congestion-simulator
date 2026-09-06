import { ORBIT_DISPLAY_SCALE } from '../types';
import { TARGET_MODEL_SIZE } from './SatelliteModelLoader';

export const DEFAULT_CONJUNCTION_SCALE = 2.2;

export const MIN_CONJUNCTION_SCALE = 0.0015;

export const CONJUNCTION_SIZE_FRACTION_OF_SEPARATION = 0.12;

export function conjunctionModelScale(liveDistanceKm: number | null): number {
  if (liveDistanceKm == null || !Number.isFinite(liveDistanceKm) || liveDistanceKm <= 0) {
    return DEFAULT_CONJUNCTION_SCALE;
  }
  const maxModelSizeScene = liveDistanceKm * ORBIT_DISPLAY_SCALE * CONJUNCTION_SIZE_FRACTION_OF_SEPARATION;
  const distanceCappedScale = maxModelSizeScene / TARGET_MODEL_SIZE;
  return Math.min(DEFAULT_CONJUNCTION_SCALE, Math.max(MIN_CONJUNCTION_SCALE, distanceCappedScale));
}
