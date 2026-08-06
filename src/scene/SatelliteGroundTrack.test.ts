import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  densifySpherePolyline,
  GAP_BREAK,
  groundTrackSampleCount,
  GT_LIFT,
  MAX_RENDER_CHORD,
  splitOnLargeGaps,
  slerpOnSphere,
} from './SatelliteGroundTrack';

describe('groundTrackSampleCount', () => {
  it('gives HEO enough samples for a ~12h Molniya × 1.5 orbits', () => {
    const totalMs = 12 * 3600 * 1000 * 1.5;
    expect(groundTrackSampleCount('HEO', totalMs)).toBeGreaterThanOrEqual(720);
  });

  it('keeps GEO cheap', () => {
    expect(groundTrackSampleCount('GEO', 24 * 3600 * 1000)).toBe(96);
  });
});

describe('splitOnLargeGaps', () => {
  it('keeps a continuous HEO-like path as one segment even when steps exceed the old 0.14 break', () => {
    // Synthetic path with ~0.20 chords (would have been shredded by the old threshold).
    const pts: Vector3[] = [];
    for (let i = 0; i < 20; i++) {
      const lon = (i * 0.2) % (Math.PI * 2);
      pts.push(
        new Vector3(Math.cos(lon) * GT_LIFT, 0.2 * GT_LIFT, Math.sin(lon) * GT_LIFT).normalize().multiplyScalar(GT_LIFT),
      );
    }
    const maxStep = Math.max(
      ...pts.slice(1).map((p, i) => p.distanceTo(pts[i])),
    );
    expect(maxStep).toBeGreaterThan(0.14);
    expect(maxStep).toBeLessThan(GAP_BREAK);

    const segs = splitOnLargeGaps(pts);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toHaveLength(pts.length);
  });

  it('splits only on true discontinuities', () => {
    const a = new Vector3(GT_LIFT, 0, 0);
    const a2 = slerpOnSphere(a, new Vector3(0, GT_LIFT, 0), 0.05, GT_LIFT);
    const c = new Vector3(-GT_LIFT, 0, 0);
    const c2 = slerpOnSphere(c, new Vector3(0, -GT_LIFT, 0), 0.05, GT_LIFT);
    expect(a.distanceTo(c)).toBeGreaterThan(GAP_BREAK);

    const segs = splitOnLargeGaps([a, a2, c, c2]);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toHaveLength(2);
    expect(segs[1]).toHaveLength(2);
  });
});

describe('densifySpherePolyline', () => {
  it('inserts points so consecutive chords stay near MAX_RENDER_CHORD', () => {
    const a = new Vector3(GT_LIFT, 0, 0);
    const b = new Vector3(0, GT_LIFT, 0);
    const out = densifySpherePolyline([a, b]);
    expect(out.length).toBeGreaterThan(2);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].distanceTo(out[i - 1])).toBeLessThanOrEqual(MAX_RENDER_CHORD + 1e-6);
    }
    for (const p of out) {
      expect(p.length()).toBeCloseTo(GT_LIFT, 5);
    }
  });
});

describe('slerpOnSphere', () => {
  it('returns endpoints at t=0 and t=1', () => {
    const a = new Vector3(GT_LIFT, 0, 0);
    const b = new Vector3(0, GT_LIFT, 0);
    expect(slerpOnSphere(a, b, 0, GT_LIFT).distanceTo(a)).toBeLessThan(1e-9);
    expect(slerpOnSphere(a, b, 1, GT_LIFT).distanceTo(b)).toBeLessThan(1e-9);
  });
});
