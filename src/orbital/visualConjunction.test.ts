import { describe, expect, it } from 'vitest';
import {
  EARTH_CAMERA_CLEARANCE,
  getConjunctionViewDistance,
  getEarthSafeDollyRange,
  getVisualConjunctionLayout,
  PAIR_FOCUS_MAX_DISTANCE,
} from './visualConjunction';

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

describe('getEarthSafeDollyRange', () => {
  it('keeps a globe-centered camera outside Earth', () => {
    const range = getEarthSafeDollyRange({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 4.5 });
    expect(range.minDistance).toBeGreaterThanOrEqual(EARTH_CAMERA_CLEARANCE);
  });

  it('allows zooming out when looking at a LEO pair from space', () => {
    const range = getEarthSafeDollyRange({ x: 1.12, y: 0, z: 0 }, { x: 1.32, y: 0, z: 0 });
    expect(range.minDistance).toBeLessThan(0.1);
    expect(range.maxDistance).toBe(PAIR_FOCUS_MAX_DISTANCE);
  });

  it('lets a space-side camera dolly in close enough to inspect a tens-of-km gap', () => {
    const range = getEarthSafeDollyRange({ x: 1.12, y: 0, z: 0 }, { x: 1.32, y: 0, z: 0 });
    // 0.01 scene ≈ 64 km; a 50 km pair is unreadable farther than that.
    expect(range.minDistance).toBeLessThanOrEqual(0.003);
  });

  it('stops an Earthward dolly before the camera enters the globe', () => {
    const target = { x: 1.12, y: 0, z: 0 };
    const camera = { x: 1.12 - 0.03, y: 0, z: 0 };
    const range = getEarthSafeDollyRange(target, camera);
    const closestCamR = 1.12 - range.maxDistance;
    expect(closestCamR).toBeGreaterThanOrEqual(EARTH_CAMERA_CLEARANCE - 1e-6);
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
