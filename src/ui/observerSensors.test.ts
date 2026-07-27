import { describe, expect, it } from 'vitest';
import {
  compassHeadingFromEuler,
  headingFromOrientationEvent,
  lookElevationFromEuler,
  pitchFromOrientationEvent,
} from './observerSensors';

describe('headingFromOrientationEvent', () => {
  it('prefers webkitCompassHeading when present', () => {
    const event = {
      alpha: 90,
      beta: 40,
      gamma: 0,
      webkitCompassHeading: 45,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    expect(headingFromOrientationEvent(event)).toBe(45);
  });

  it('uses tilt-aware Euler heading instead of raw inverted alpha', () => {
    const event = { alpha: 90, beta: 40, gamma: 20 } as DeviceOrientationEvent;
    const heading = headingFromOrientationEvent(event);
    expect(heading).not.toBeNull();
    expect(heading).toBe(compassHeadingFromEuler(90, 40, 20));
    expect(heading).not.toBe(270);
  });

  it('freezes heading near gimbal lock (beta >= 85)', () => {
    const stable = {
      alpha: 30,
      beta: 40,
      gamma: 0,
      webkitCompassHeading: 120,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    expect(headingFromOrientationEvent(stable)).toBe(120);

    const locked = { alpha: 200, beta: 90, gamma: 0 } as DeviceOrientationEvent;
    expect(headingFromOrientationEvent(locked)).toBe(120);
  });

  it('returns null when no orientation data is available', () => {
    const event = {} as DeviceOrientationEvent;
    expect(headingFromOrientationEvent(event)).toBeNull();
  });
});

describe('lookElevationFromEuler', () => {
  it('is ~0 when phone is upright (beta 90)', () => {
    expect(lookElevationFromEuler(90, 0)).toBeCloseTo(0, 5);
  });

  it('is ~90 when phone is flat screen-up (beta 0)', () => {
    expect(lookElevationFromEuler(0, 0)).toBeCloseTo(90, 5);
  });

  it('is ~45 when tilted halfway', () => {
    expect(lookElevationFromEuler(45, 0)).toBeCloseTo(45, 5);
  });
});

describe('pitchFromOrientationEvent', () => {
  it('reads pitch from beta/gamma', () => {
    const event = { beta: 45, gamma: 0 } as DeviceOrientationEvent;
    expect(pitchFromOrientationEvent(event)).toBeCloseTo(45, 5);
  });
});

describe('compassHeadingFromEuler', () => {
  it('returns a wrapped 0..360 value', () => {
    const h = compassHeadingFromEuler(0, 0, 0);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });
});
