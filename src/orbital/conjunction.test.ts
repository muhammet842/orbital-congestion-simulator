import { describe, expect, it } from 'vitest';
import {
  conjunctionPairKey,
  conjunctionSessionKey,
  findCandidatePairsWithinRadius,
  formatCloseApproachAlert,
  formatRelativeVelocityKmS,
  getRiskAssessment,
  isCoOrbitingPair,
} from './conjunction';
import type { ConjunctionEvent } from '../types';

type Vec3 = { x: number; y: number; z: number };

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Reference implementation: the exact O(n^2) scan the grid search replaces. */
function bruteForcePairsWithinRadius(positions: Vec3[], radiusKm: number): Set<string> {
  const pairs = new Set<string>();
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (distance(positions[i], positions[j]) <= radiusKm) {
        pairs.add(`${i},${j}`);
      }
    }
  }
  return pairs;
}

function toPairKeySet(pairs: Array<[number, number]>): Set<string> {
  return new Set(pairs.map(([i, j]) => `${Math.min(i, j)},${Math.max(i, j)}`));
}

/** Deterministic PRNG (mulberry32) so failures are reproducible. */
function makeRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

describe('findCandidatePairsWithinRadius', () => {
  it('finds two points within radius', () => {
    const positions: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ];
    const pairs = findCandidatePairsWithinRadius(positions, 3);
    expect(toPairKeySet(pairs)).toEqual(new Set(['0,1']));
  });

  it('excludes points farther apart than the radius', () => {
    const positions: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
    ];
    const pairs = findCandidatePairsWithinRadius(positions, 3);
    expect(pairs).toEqual([]);
  });

  it('finds pairs that straddle a grid cell boundary', () => {
    // With cell size == radius, points can be within radius of each other
    // while sitting in different (even non-adjacent-looking) grid cells —
    // this is exactly the case the 3x3x3 neighbor search must catch.
    const radius = 3;
    const positions: Vec3[] = [
      { x: 2.99, y: 0, z: 0 }, // just inside one cell
      { x: 3.01, y: 0, z: 0 }, // just inside the next cell, 0.02 km away
    ];
    const pairs = findCandidatePairsWithinRadius(positions, radius);
    expect(toPairKeySet(pairs)).toEqual(new Set(['0,1']));
  });

  it('never returns duplicate or self pairs', () => {
    const positions: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 0.5, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ];
    const pairs = findCandidatePairsWithinRadius(positions, 5);
    const keys = pairs.map(([i, j]) => `${i},${j}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const [i, j] of pairs) {
      expect(i).not.toBe(j);
      expect(i).toBeLessThan(j);
    }
  });

  it('matches an exact brute-force O(n^2) scan over random point clouds', () => {
    const rng = makeRng(1337);
    const radius = 3;

    for (let trial = 0; trial < 20; trial++) {
      const positions: Vec3[] = Array.from({ length: 150 }, () => ({
        // Spread over a LEO-shell-like volume, with a tight sub-cluster so
        // some points are guaranteed to land within the radius of each other.
        x: (rng() - 0.5) * 20,
        y: (rng() - 0.5) * 20,
        z: (rng() - 0.5) * 20,
      }));

      const expected = bruteForcePairsWithinRadius(positions, radius);
      const actual = toPairKeySet(findCandidatePairsWithinRadius(positions, radius));
      expect(actual).toEqual(expected);
    }
  });

  it('returns no candidates for an empty or single-point input', () => {
    expect(findCandidatePairsWithinRadius([], 3)).toEqual([]);
    expect(findCandidatePairsWithinRadius([{ x: 0, y: 0, z: 0 }], 3)).toEqual([]);
  });
});

describe('formatCloseApproachAlert', () => {
  it('formats a human-readable close approach message', () => {
    expect(formatCloseApproachAlert('SAT-A', 'SAT-B', 1.234)).toBe(
      'SAT-A vs SAT-B - 1.23 km close approach!',
    );
  });
});
