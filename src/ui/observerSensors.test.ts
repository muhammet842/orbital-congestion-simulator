import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetOrientationStateForTests,
  compassHeadingFromEuler,
  headingFromOrientationEvent,
  lookElevationFromEuler,
  pitchFromOrientationEvent,
  screenOrientationOffsetDeg,
} from './observerSensors';

beforeEach(() => {
  __resetOrientationStateForTests();
  vi.unstubAllGlobals();
});

describe('headingFromOrientationEvent', () => {
  it('prefers webkitCompassHeading when present', () => {
    const event = {
      alpha: 90,
      beta: 40,
      gamma: 0,
      webkitCompassHeading: 45,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    expect(headingFromOrientationEvent(event)).toEqual({ heading: 45, source: 'webkit' });
  });

  it('rejects relative Euler frames without webkit (arbitrary zero)', () => {
    const event = { alpha: 90, beta: 40, gamma: 20 } as DeviceOrientationEvent;
    expect(headingFromOrientationEvent(event)).toBeNull();
    expect(headingFromOrientationEvent(event, { treatAsAbsolute: false })).toBeNull();
  });

  it('accepts absolute Euler heading and applies screen orientation offset', () => {
    vi.stubGlobal('window', {
      screen: { orientation: { angle: 90 } },
    });
    const event = { alpha: 90, beta: 40, gamma: 20, absolute: true } as DeviceOrientationEvent;
    const raw = compassHeadingFromEuler(90, 40, 20);
    const parsed = headingFromOrientationEvent(event, { treatAsAbsolute: true });
    expect(parsed).not.toBeNull();
    expect(parsed?.source).toBe('absolute');
    expect(parsed?.heading).toBe(((raw - 90) % 360 + 360) % 360);
    expect(screenOrientationOffsetDeg()).toBe(90);
  });

  it('freezes heading near gimbal lock (beta >= 85)', () => {
    const stable = {
      alpha: 30,
      beta: 40,
      gamma: 0,
      webkitCompassHeading: 120,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    expect(headingFromOrientationEvent(stable)).toEqual({ heading: 120, source: 'webkit' });

    const locked = { alpha: 200, beta: 90, gamma: 0 } as DeviceOrientationEvent;
    expect(headingFromOrientationEvent(locked)).toEqual({ heading: 120, source: 'webkit' });
  });

  it('returns null when no orientation data is available', () => {
    const event = {} as DeviceOrientationEvent;
    expect(headingFromOrientationEvent(event)).toBeNull();
  });
});

describe('lookElevationFromEuler', () => {
  it('is ~90 when phone is upright (beta 90) — aim over the top bezel', () => {
    expect(lookElevationFromEuler(90, 0)).toBeCloseTo(90, 5);
  });

  it('is ~0 when phone is flat screen-up (beta 0)', () => {
    expect(lookElevationFromEuler(0, 0)).toBeCloseTo(0, 5);
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
