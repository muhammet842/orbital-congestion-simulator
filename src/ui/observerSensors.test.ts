import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetOrientationStateForTests,
  cameraLookFromEuler,
  compassHeadingFromEuler,
  headingFromOrientationEvent,
  lookElevationFromEuler,
  pitchFromOrientationEvent,
  screenOrientationOffsetDeg,
  webkitCompassToCameraHeading,
} from './observerSensors';

beforeEach(() => {
  __resetOrientationStateForTests();
  vi.unstubAllGlobals();
});

describe('headingFromOrientationEvent', () => {
  it('prefers webkitCompassHeading when present (camera-converted)', () => {
    const event = {
      alpha: 90,
      beta: 90,
      gamma: 0,
      webkitCompassHeading: 45,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    // Upright: top axis near vertical → webkit already equals camera facing.
    expect(headingFromOrientationEvent(event)).toEqual({ heading: 45, source: 'webkit' });
  });

  it('rejects relative Euler frames without webkit (arbitrary zero)', () => {
    const event = { alpha: 90, beta: 40, gamma: 20 } as DeviceOrientationEvent;
    expect(headingFromOrientationEvent(event)).toBeNull();
    expect(headingFromOrientationEvent(event, { treatAsAbsolute: false })).toBeNull();
  });

  it('accepts absolute Euler camera heading and applies screen orientation offset', () => {
    vi.stubGlobal('window', {
      screen: { orientation: { angle: 90 } },
    });
    const event = { alpha: 90, beta: 40, gamma: 20, absolute: true } as DeviceOrientationEvent;
    const raw = cameraLookFromEuler(90, 40, 20).headingDeg;
    const parsed = headingFromOrientationEvent(event, { treatAsAbsolute: true });
    expect(parsed).not.toBeNull();
    expect(parsed?.source).toBe('absolute');
    expect(parsed?.heading).toBe(((raw - 90) % 360 + 360) % 360);
    expect(screenOrientationOffsetDeg()).toBe(90);
  });

  it('keeps updating heading when upright (beta 90) — camera azimuth is stable', () => {
    const first = {
      alpha: 30,
      beta: 90,
      gamma: 0,
      webkitCompassHeading: 120,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    expect(headingFromOrientationEvent(first)).toEqual({ heading: 120, source: 'webkit' });

    const turned = {
      alpha: 30,
      beta: 90,
      gamma: 0,
      webkitCompassHeading: 200,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    expect(headingFromOrientationEvent(turned)).toEqual({ heading: 200, source: 'webkit' });
  });

  it('freezes heading when camera points near nadir (beta ~0)', () => {
    const stable = {
      alpha: 30,
      beta: 90,
      gamma: 0,
      webkitCompassHeading: 120,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    expect(headingFromOrientationEvent(stable)).toEqual({ heading: 120, source: 'webkit' });

    const locked = { alpha: 200, beta: 0, gamma: 0 } as DeviceOrientationEvent;
    expect(headingFromOrientationEvent(locked)).toEqual({ heading: 120, source: 'webkit' });
  });

  it('returns null when no orientation data is available', () => {
    const event = {} as DeviceOrientationEvent;
    expect(headingFromOrientationEvent(event)).toBeNull();
  });
});

describe('lookElevationFromEuler (back camera)', () => {
  it('is ~0 when phone is upright (beta 90) — camera at horizon', () => {
    expect(lookElevationFromEuler(90, 0)).toBeCloseTo(0, 5);
  });

  it('is ~-90 when phone is flat screen-up (beta 0) — camera at nadir', () => {
    expect(lookElevationFromEuler(0, 0)).toBeCloseTo(-90, 5);
  });

  it('is ~45 when tipped back past upright (beta 135)', () => {
    expect(lookElevationFromEuler(135, 0)).toBeCloseTo(45, 5);
  });

  it('is ~90 when face-down toward zenith (beta 180)', () => {
    expect(lookElevationFromEuler(180, 0)).toBeCloseTo(90, 5);
  });
});

describe('pitchFromOrientationEvent', () => {
  it('reads camera elevation from beta/gamma', () => {
    const event = { beta: 135, gamma: 0 } as DeviceOrientationEvent;
    expect(pitchFromOrientationEvent(event)).toBeCloseTo(45, 5);
  });
});

describe('compassHeadingFromEuler', () => {
  it('matches camera look heading', () => {
    const h = compassHeadingFromEuler(45, 60, 20);
    expect(h).toBe(cameraLookFromEuler(45, 60, 20).headingDeg);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });
});

describe('webkitCompassToCameraHeading', () => {
  it('leaves upright webkit heading unchanged', () => {
    expect(webkitCompassToCameraHeading(80, 90, 0)).toBe(80);
  });

  it('flips ~180° when tipped past vertical (top vs camera azimuth)', () => {
    // beta 135: top horizontal bearing opposite camera
    expect(webkitCompassToCameraHeading(0, 135, 0)).toBe(180);
  });
});
