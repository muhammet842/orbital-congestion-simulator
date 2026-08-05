import { describe, expect, it } from 'vitest';
import {
  getConjunctionFramingSeparationKm,
  getConjunctionViewDistance,
  getVisualConjunctionLayout,
  MIN_VISUAL_SEPARATION_SCENE,
} from './visualConjunction';
import { ORBIT_DISPLAY_SCALE } from '../types';

describe('getConjunctionFramingSeparationKm', () => {
  it('floors tight live gaps at the on-screen exaggeration equivalent', () => {
    const floorKm = MIN_VISUAL_SEPARATION_SCENE / ORBIT_DISPLAY_SCALE;
    expect(getConjunctionFramingSeparationKm(0.22)).toBeCloseTo(floorKm, 5);
    expect(getConjunctionFramingSeparationKm(2)).toBeCloseTo(floorKm, 5);
  });

  it('passes through wide separations unchanged', () => {
    expect(getConjunctionFramingSeparationKm(200)).toBeCloseTo(200, 5);
  });
});

describe('getConjunctionViewDistance', () => {
  it('zooms in as the framed separation shrinks', () => {
    const far = getConjunctionViewDistance(0.05);
    const near = getConjunctionViewDistance(0.014);
    expect(near).toBeLessThan(far);
  });

  it('never collapses below a usable minimum', () => {
    expect(getConjunctionViewDistance(0)).toBeGreaterThan(0);
  });
});

describe('getVisualConjunctionLayout', () => {
  it('exaggerates sub-floor separations and reports separationScene', () => {
    const a = { x: 1.1, y: 0, z: 0 };
    const b = { x: 1.10001, y: 0, z: 0 };
    const layout = getVisualConjunctionLayout(a, b, 0.5);
    expect(layout.exaggerated).toBe(true);
    expect(layout.separationScene).toBeGreaterThanOrEqual(MIN_VISUAL_SEPARATION_SCENE - 1e-9);
  });
});
