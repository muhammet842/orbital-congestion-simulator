import { describe, expect, it } from 'vitest';
import { getDayNightState } from './dayNight';

const DEG = Math.PI / 180;

/** Wraps a radian angle into [0, 2*PI) for comparisons that don't care about winding. */
function normalizeRad(rad: number): number {
  const twoPi = Math.PI * 2;
  return ((rad % twoPi) + twoPi) % twoPi;
}

function angleDiffDeg(aRad: number, bRad: number): number {
  const twoPi = Math.PI * 2;
  let diff = normalizeRad(aRad) - normalizeRad(bRad);
  diff = ((diff + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  return diff / DEG;
}

describe('getDayNightState earthRotationY (sidereal Earth spin)', () => {
  it('matches the known GMST at the J2000.0 epoch (280.46061837 deg + texture offset)', () => {
    // J2000.0 = JD 2451545.0 = 2000-01-01T12:00:00Z, by definition of the epoch.
    const state = getDayNightState(new Date('2000-01-01T12:00:00Z'));
    const expectedDeg = ((280.46061837 + 180) % 360 + 360) % 360; // + PI texture offset
    const actualDeg = (normalizeRad(state.earthRotationY) * 180) / Math.PI;
    expect(actualDeg).toBeCloseTo(expectedDeg, 3);
  });

  it('regression: does NOT reset to the same angle at UTC midnight on different dates', () => {
    // This is the exact bug being fixed: the old formula derived the spin
    // purely from (utcDecimalHours / 24), so every UTC midnight — regardless
    // of the actual date — produced the identical angle. Real sidereal time
    // advances by ~0.9856 deg/day, so widely separated midnights must differ
    // by a large, non-trivial amount (never near 0 deg or an exact multiple
    // of 360 deg, except by astronomical coincidence roughly once a year).
    const a = getDayNightState(new Date('2026-01-01T00:00:00Z'));
    const b = getDayNightState(new Date('2026-06-01T00:00:00Z'));
    const diffDeg = Math.abs(angleDiffDeg(a.earthRotationY, b.earthRotationY));
    expect(diffDeg).toBeGreaterThan(5);
  });

  it('advances by one full turn plus the sidereal/solar-day drift every 24 hours', () => {
    const t0 = new Date('2026-03-15T00:00:00Z');
    const t1 = new Date(t0.getTime() + 24 * 3_600_000);

    const a = getDayNightState(t0).earthRotationY;
    const b = getDayNightState(t1).earthRotationY;

    // Sidereal day is ~3m56s shorter than a solar day, so in exactly 24h
    // Earth rotates ~360.9856 deg relative to the stars — i.e. ~0.9856 deg
    // past a full turn, not exactly back to the same angle.
    const extraDeg = angleDiffDeg(b, a);
    expect(extraDeg).toBeGreaterThan(0.9);
    expect(extraDeg).toBeLessThan(1.1);
  });

  it('advances monotonically (forward in time never spins the globe backward)', () => {
    const base = new Date('2026-07-08T10:00:00Z').getTime();
    let previous = getDayNightState(new Date(base)).earthRotationY;

    for (let hours = 1; hours <= 12; hours++) {
      const current = getDayNightState(new Date(base + hours * 3_600_000)).earthRotationY;
      const stepDeg = angleDiffDeg(current, previous);
      // Each hourly step should be a small forward increment (~15 deg/hour),
      // never a large jump or a backward wrap.
      expect(stepDeg).toBeGreaterThan(14);
      expect(stepDeg).toBeLessThan(16);
      previous = current;
    }
  });

  it('accumulates across many elapsed days instead of only within a single day', () => {
    // Same time-of-day, ~200 days apart — under the old bug these were
    // identical (both reset to the same "hours since midnight" fraction).
    const early = getDayNightState(new Date('2026-01-10T06:30:00Z'));
    const later = getDayNightState(new Date('2026-07-29T06:30:00Z'));
    const diffDeg = Math.abs(angleDiffDeg(early.earthRotationY, later.earthRotationY));
    expect(diffDeg).toBeGreaterThan(5);
  });
});
