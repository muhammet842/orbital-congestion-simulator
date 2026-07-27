import { describe, expect, it } from 'vitest';
import { compassHeadingFromEuler, headingFromOrientationEvent } from './observerSensors';

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
    // Raw 360-alpha would be 270 — Euler with tilt/roll differs.
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

describe('compassHeadingFromEuler', () => {
  it('returns a wrapped 0..360 value', () => {
    const h = compassHeadingFromEuler(0, 0, 0);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });
});
