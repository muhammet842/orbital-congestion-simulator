import { describe, expect, it } from 'vitest';
import {
  conjunctionPairKey,
  conjunctionSessionKey,
  formatCloseApproachAlert,
  formatRelativeVelocityKmS,
  getRiskAssessment,
  isCoOrbitingPair,
} from './conjunction';
import type { ConjunctionEvent } from '../types';

function makeEvent(overrides: Partial<ConjunctionEvent> = {}): ConjunctionEvent {
  return {
    objectA: 'SAT-A',
    objectB: 'SAT-B',
    indexA: 0,
    indexB: 1,
    distanceKm: 1.5,
    relativeVelocityKmS: 1.2,
    time: new Date('2026-07-08T12:00:00.000Z'),
    midpointScene: { x: 0, y: 0, z: 0 },
    ...overrides,
  };
}

describe('conjunctionPairKey', () => {
  it('is order-independent — same pair always produces the same key', () => {
    expect(conjunctionPairKey('SAT-A', 'SAT-B')).toBe(conjunctionPairKey('SAT-B', 'SAT-A'));
  });

  it('produces different keys for different pairs', () => {
    expect(conjunctionPairKey('SAT-A', 'SAT-B')).not.toBe(conjunctionPairKey('SAT-A', 'SAT-C'));
  });
});

describe('conjunctionSessionKey', () => {
  it('differs when the CPA time differs, even for the same pair', () => {
    const first = conjunctionSessionKey(makeEvent({ time: new Date('2026-07-08T12:00:00.000Z') }));
    const second = conjunctionSessionKey(makeEvent({ time: new Date('2026-07-08T13:00:00.000Z') }));
    expect(first).not.toBe(second);
  });

  it('differs when the object indices differ, even for the same names and time', () => {
    const first = conjunctionSessionKey(makeEvent({ indexA: 0, indexB: 1 }));
    const second = conjunctionSessionKey(makeEvent({ indexA: 2, indexB: 3 }));
    expect(first).not.toBe(second);
  });

  it('is stable for identical events', () => {
    const a = conjunctionSessionKey(makeEvent());
    const b = conjunctionSessionKey(makeEvent());
    expect(a).toBe(b);
  });
});

describe('getRiskAssessment', () => {
  it('classifies distance thresholds correctly, including boundaries', () => {
    expect(getRiskAssessment(10)).toBe('NO RISK');
    expect(getRiskAssessment(5)).toBe('NO RISK');
    expect(getRiskAssessment(4.999)).toBe('LOW RISK');
    expect(getRiskAssessment(3)).toBe('LOW RISK');
    expect(getRiskAssessment(2.999)).toBe('MONITORING');
    expect(getRiskAssessment(1)).toBe('MONITORING');
    expect(getRiskAssessment(0.999)).toBe('CRITICAL RISK');
    expect(getRiskAssessment(0)).toBe('CRITICAL RISK');
  });
});

describe('isCoOrbitingPair', () => {
  it('treats sub-threshold relative velocity as co-orbiting', () => {
    expect(isCoOrbitingPair(0.01)).toBe(true);
    expect(isCoOrbitingPair(0.049)).toBe(true);
  });

  it('treats at-or-above-threshold relative velocity as a crossing pair', () => {
    expect(isCoOrbitingPair(0.05)).toBe(false);
    expect(isCoOrbitingPair(1.2)).toBe(false);
  });
});

describe('formatRelativeVelocityKmS', () => {
  it('formats sub-10-m/s speeds in meters per second', () => {
    expect(formatRelativeVelocityKmS(0.005)).toBe('5.0 m/s');
  });

  it('formats sub-1-km/s speeds with 3 decimal places', () => {
    expect(formatRelativeVelocityKmS(0.05)).toBe('0.050 km/s');
  });

  it('formats speeds at or above 1 km/s with 2 decimal places', () => {
    expect(formatRelativeVelocityKmS(7.5)).toBe('7.50 km/s');
  });
});

describe('formatCloseApproachAlert', () => {
  it('formats a human-readable close approach message', () => {
    expect(formatCloseApproachAlert('SAT-A', 'SAT-B', 1.234)).toBe(
      'SAT-A vs SAT-B - 1.23 km close approach!',
    );
  });
});
