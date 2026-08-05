// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { conjunctionModelScale } from './OrbitalMeshes';
import { TARGET_MODEL_SIZE } from './SatelliteModelLoader';
import { ORBIT_DISPLAY_SCALE } from '../types';

/** Model footprint in scene units for a given scale multiplier. */
function modelSizeSceneUnits(scaleMul: number): number {
  return TARGET_MODEL_SIZE * scaleMul;
}

describe('conjunctionModelScale', () => {
  it('falls back to the default scale when the live distance is unknown', () => {
    expect(conjunctionModelScale(null)).toBe(2.2);
  });

  it('falls back to the default scale for invalid distances', () => {
    expect(conjunctionModelScale(Number.NaN)).toBe(2.2);
    expect(conjunctionModelScale(0)).toBe(2.2);
    expect(conjunctionModelScale(-5)).toBe(2.2);
  });

  it('caps the model well under the real separation for a multi-km near-miss', () => {
    const distanceKm = 2.565;
    const scale = conjunctionModelScale(distanceKm);
    const modelSizeKm = modelSizeSceneUnits(scale) / ORBIT_DISPLAY_SCALE;

    expect(modelSizeKm).toBeLessThan(distanceKm);
    expect(modelSizeKm).toBeLessThan(distanceKm * 0.5);
  });

  it('shrinks further as the pair gets closer to their CPA', () => {
    const wide = conjunctionModelScale(112);
    const narrow = conjunctionModelScale(2.565);
    expect(narrow).toBeLessThan(wide);
  });

  it('never shrinks below the absolute visibility floor', () => {
    const scale = conjunctionModelScale(0.05);
    expect(scale).toBeGreaterThanOrEqual(0.02);
  });

  it('never exceeds the default scale even for a very wide separation', () => {
    expect(conjunctionModelScale(10_000)).toBeLessThanOrEqual(2.2);
  });
});
