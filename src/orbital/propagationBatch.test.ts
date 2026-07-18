import { describe, expect, it } from 'vitest';
import { quantizeSimulationTimeMs, getDebrisUpdateStride } from './propagationBatch';

describe('quantizeSimulationTimeMs', () => {
  it('returns the exact timestamp when speed is 1 (live mode)', () => {
    expect(quantizeSimulationTimeMs(1_700_000_000_000, 1)).toBe(1_700_000_000_000);
  });

  it('returns the exact timestamp when speed is below 1', () => {
    expect(quantizeSimulationTimeMs(1_700_000_000_123, 0.5)).toBe(1_700_000_000_123);
  });

  it('quantizes to 250 ms buckets at speed 2–10', () => {
    for (const speed of [2, 5, 10]) {
      const raw = 1_700_000_000_333;
      const quantized = quantizeSimulationTimeMs(raw, speed);
      expect(quantized % 250).toBe(0);
      expect(quantized).toBeLessThanOrEqual(raw);
      // Must land in the same 250 ms window
      expect(raw - quantized).toBeLessThan(250);
    }
  });

  it('quantizes to 2 000 ms buckets at speed 11–100', () => {
    for (const speed of [11, 50, 100]) {
      const raw = 1_700_000_000_777;
      const quantized = quantizeSimulationTimeMs(raw, speed);
      expect(quantized % 2_000).toBe(0);
      expect(raw - quantized).toBeLessThan(2_000);
    }
  });

  it('quantizes to 10 000 ms buckets at speed 101–500', () => {
    const raw = 1_700_000_007_777;
    const quantized = quantizeSimulationTimeMs(raw, 200);
    expect(quantized % 10_000).toBe(0);
    expect(raw - quantized).toBeLessThan(10_000);
  });

  it('quantizes to 30 000 ms buckets above speed 500', () => {
    const raw = 1_700_000_017_777;
    const quantized = quantizeSimulationTimeMs(raw, 1000);
    expect(quantized % 30_000).toBe(0);
    expect(raw - quantized).toBeLessThan(30_000);
  });

  it('quantized value is always <= the raw value (no overshooting)', () => {
    const raw = 1_700_000_000_999;
    for (const speed of [1, 5, 50, 200, 1000]) {
      expect(quantizeSimulationTimeMs(raw, speed)).toBeLessThanOrEqual(raw);
    }
  });

  it('identical inputs always produce identical outputs (deterministic)', () => {
    const raw = 1_700_000_000_123;
    expect(quantizeSimulationTimeMs(raw, 5)).toBe(quantizeSimulationTimeMs(raw, 5));
  });
});

describe('getDebrisUpdateStride', () => {
  it('returns 1 for speeds below 100 (update every frame)', () => {
    expect(getDebrisUpdateStride(1)).toBe(1);
    expect(getDebrisUpdateStride(99)).toBe(1);
  });

  it('returns 2 for speed 100 (skip every other frame)', () => {
    expect(getDebrisUpdateStride(100)).toBe(2);
    expect(getDebrisUpdateStride(500)).toBe(2);
  });
});
