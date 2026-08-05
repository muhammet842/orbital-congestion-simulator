// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { conjunctionModelScale } from './OrbitalMeshes';
import { TARGET_MODEL_SIZE } from './SatelliteModelLoader';
import { ORBIT_DISPLAY_SCALE } from '../types';
import { getConjunctionFramingSeparationKm } from '../orbital/visualConjunction';

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

  it('caps the model under the framed separation for a wide near-miss', () => {
    // Above the visual-exaggeration floor so framing == live distance.
    const distanceKm = 200;
    const scale = conjunctionModelScale(distanceKm);
    const modelSizeKm = modelSizeSceneUnits(scale) / ORBIT_DISPLAY_SCALE;
    const framingKm = getConjunctionFramingSeparationKm(distanceKm);

    expect(modelSizeKm).toBeLessThan(framingKm);
    expect(modelSizeKm).toBeLessThan(framingKm * 0.5);
  });

  it('shrinks as framed separation shrinks (wide vs mid-range)', () => {
    const wide = conjunctionModelScale(500);
    const mid = conjunctionModelScale(120);
    expect(mid).toBeLessThan(wide);
  });

  it('keeps tight CPA models readable via the framing floor', () => {
    const scale = conjunctionModelScale(0.22);
    expect(scale).toBeGreaterThanOrEqual(0.12);
    // Same framing floor as a few-km gap — models stay visible while zoomed in.
    expect(conjunctionModelScale(2)).toBeCloseTo(scale, 5);
  });

  it('never exceeds the default scale even for a very wide separation', () => {
    expect(conjunctionModelScale(10_000)).toBeLessThanOrEqual(2.2);
  });
});
