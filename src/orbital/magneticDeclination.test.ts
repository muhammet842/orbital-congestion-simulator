import { describe, expect, it } from 'vitest';
import {
  magneticDeclinationDeg,
  magneticToTrueHeadingDeg,
  trueHeadingAtLocationDeg,
} from './magneticDeclination';

describe('magneticDeclinationDeg', () => {
  it('returns ~+6° east for Istanbul in the WMM2025 era', () => {
    const dec = magneticDeclinationDeg(41.01, 28.97);
    expect(dec).toBeGreaterThan(4);
    expect(dec).toBeLessThan(8);
  });

  it('returns west (negative) declination for New York', () => {
    const dec = magneticDeclinationDeg(40.7, -74.0);
    expect(dec).toBeLessThan(-10);
    expect(dec).toBeGreaterThan(-15);
  });

  it('returns 0 for non-finite coordinates', () => {
    expect(magneticDeclinationDeg(Number.NaN, 0)).toBe(0);
  });
});

describe('magneticToTrueHeadingDeg', () => {
  it('adds east declination', () => {
    expect(magneticToTrueHeadingDeg(10, 6)).toBeCloseTo(16, 5);
  });

  it('wraps past 360', () => {
    expect(magneticToTrueHeadingDeg(358, 6)).toBeCloseTo(4, 5);
  });

  it('subtracts west declination', () => {
    expect(magneticToTrueHeadingDeg(20, -12)).toBeCloseTo(8, 5);
  });
});

describe('trueHeadingAtLocationDeg', () => {
  it('shifts Istanbul magnetic heading toward true north by ~6°', () => {
    const trueH = trueHeadingAtLocationDeg(0, 41.01, 28.97);
    expect(trueH).toBeGreaterThan(4);
    expect(trueH).toBeLessThan(8);
  });
});
