import { describe, expect, it } from 'vitest';
import { headingFromOrientationEvent } from './observerSensors';

describe('headingFromOrientationEvent', () => {
  it('prefers webkitCompassHeading when present', () => {
    const event = {
      alpha: 90,
      webkitCompassHeading: 45,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    expect(headingFromOrientationEvent(event)).toBe(45);
  });

  it('falls back to inverted alpha', () => {
    const event = { alpha: 90 } as DeviceOrientationEvent;
    expect(headingFromOrientationEvent(event)).toBe(270);
  });

  it('returns null when no orientation data is available', () => {
    const event = {} as DeviceOrientationEvent;
    expect(headingFromOrientationEvent(event)).toBeNull();
  });
});
