import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FOV_DEG,
  horizonYForPitch,
  projectAzElToCanvas,
  signedAzimuthDeltaDeg,
  skyFovCenterDistanceDeg,
} from './skyProjection';

describe('signedAzimuthDeltaDeg', () => {
  it('wraps across 0/360', () => {
    expect(signedAzimuthDeltaDeg(350, 10)).toBeCloseTo(20, 5);
    expect(signedAzimuthDeltaDeg(10, 350)).toBeCloseTo(-20, 5);
  });
});

describe('projectAzElToCanvas', () => {
  const size = 300;
  const view = { headingDeg: 0, pitchDeg: 45 };

  it('places a matching az/el at the canvas center', () => {
    const p = projectAzElToCanvas(view, { azimuthDeg: 0, elevationDeg: 45 }, size, size);
    expect(p.x).toBeCloseTo(size / 2, 5);
    expect(p.y).toBeCloseTo(size / 2, 5);
    expect(p.inView).toBe(true);
  });

  it('places a target 30° to the right near the right edge for 60° FOV', () => {
    // half FOV = 30° → right edge
    const p = projectAzElToCanvas(
      view,
      { azimuthDeg: 30, elevationDeg: 45 },
      size,
      size,
      DEFAULT_FOV_DEG,
    );
    expect(p.x).toBeCloseTo(size, 5);
    expect(p.y).toBeCloseTo(size / 2, 5);
    expect(p.inView).toBe(true);
  });

  it('marks far targets as out of view', () => {
    const p = projectAzElToCanvas(view, { azimuthDeg: 90, elevationDeg: 45 }, size, size);
    expect(p.inView).toBe(false);
  });

  it('moves higher elevation toward the top of the screen', () => {
    const p = projectAzElToCanvas(view, { azimuthDeg: 0, elevationDeg: 60 }, size, size);
    expect(p.y).toBeLessThan(size / 2);
  });
});

describe('skyFovCenterDistanceDeg', () => {
  it('is zero at the view center', () => {
    expect(
      skyFovCenterDistanceDeg(
        { headingDeg: 100, pitchDeg: 20 },
        { azimuthDeg: 100, elevationDeg: 20 },
      ),
    ).toBeCloseTo(0, 5);
  });
});

describe('horizonYForPitch', () => {
  it('puts the horizon at mid-canvas when phone pitch is 0', () => {
    expect(horizonYForPitch(0, 300)).toBeCloseTo(150, 5);
  });

  it('moves the horizon down when looking up', () => {
    expect(horizonYForPitch(30, 300)).toBeGreaterThan(150);
  });
});
