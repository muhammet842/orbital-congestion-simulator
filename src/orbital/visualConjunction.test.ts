import { describe, expect, it } from 'vitest';
import {
  getConjunctionViewDistance,
  getVisualConjunctionLayout,
} from './visualConjunction';

describe('getConjunctionViewDistance', () => {
  it('zooms in as the framed separation shrinks', () => {
    const far = getConjunctionViewDistance(0.012);
    const near = getConjunctionViewDistance(0.004);
    expect(near).toBeLessThan(far);
  });

  it('never collapses below a usable minimum', () => {
    expect(getConjunctionViewDistance(0)).toBeGreaterThan(0);
  });

  it('does not open on a globe-scale shot for a wide live gap', () => {
    const wide = getConjunctionViewDistance(0.08);
    expect(wide).toBeLessThanOrEqual(0.085);
  });
});

describe('getVisualConjunctionLayout', () => {
  it('keeps true positions without on-screen exaggeration', () => {
    const a = { x: 1.1, y: 0, z: 0 };
    const b = { x: 1.10001, y: 0, z: 0 };
    const layout = getVisualConjunctionLayout(a, b, 0.5);
    expect(layout.exaggerated).toBe(false);
    expect(layout.visualA.x).toBeCloseTo(a.x, 8);
    expect(layout.visualB.x).toBeCloseTo(b.x, 8);
    expect(layout.separationScene).toBeCloseTo(0.00001, 8);
  });
});
