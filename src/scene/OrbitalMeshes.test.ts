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
    // Regression: at the old fixed 2.2x scale, the ~25km-wide exaggerated
    // model completely dwarfed a real few-km separation, making a genuine
    // non-collision close approach look like the two objects had merged.
    const distanceKm = 2.201;
    const scale = conjunctionModelScale(distanceKm);
    const modelSizeKm = modelSizeSceneUnits(scale) / ORBIT_DISPLAY_SCALE;

    expect(modelSizeKm).toBeLessThan(distanceKm);
    // Comfortably smaller, not just barely — should leave a visible gap.
    expect(modelSizeKm).toBeLessThan(distanceKm * 0.5);
  });

  it('shrinks further as the pair gets closer to their CPA', () => {
    const wide = conjunctionModelScale(50);
    const narrow = conjunctionModelScale(2);
    expect(narrow).toBeLessThan(wide);
  });

  it('never shrinks below the absolute visibility floor', () => {
    const scale = conjunctionModelScale(0.05); // 50m — near-actual-collision range
    expect(scale).toBeGreaterThanOrEqual(0.02);
  });

  it('never exceeds the default scale even for a very wide separation', () => {
    expect(conjunctionModelScale(10_000)).toBeLessThanOrEqual(2.2);
  });
});
