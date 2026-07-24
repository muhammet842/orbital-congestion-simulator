import { describe, expect, it } from 'vitest';
import {
  applyFirstSeenAt,
  BULK_FIRST_SEEN_COLLAPSE_THRESHOLD,
  MAX_NEW_LAUNCHES_PER_FETCH,
} from './applyFirstSeenAt.mjs';

function makeSeen(ids: number[]): Map<number, { noradId: number; firstSeenAt?: string }> {
  return new Map(ids.map((noradId) => [noradId, { noradId }]));
}

describe('applyFirstSeenAt', () => {
  const fetchedAt = '2026-07-24T12:00:00.000Z';

  it('does not stamp anything when there is no previous catalog (baseline seed)', () => {
    const seen = makeSeen([1, 2, 3]);
    const result = applyFirstSeenAt(seen, { known: new Set(), firstSeenAt: new Map() }, fetchedAt);
    expect(result.newlyLaunchedCount).toBe(0);
    expect(result.skippedReason).toBe('no-previous-catalog');
    expect(seen.get(1)?.firstSeenAt).toBeUndefined();
  });

  it('stamps only NORAD IDs that were absent from the previous catalog', () => {
    const seen = makeSeen([1, 2, 3]);
    const previous = {
      known: new Set([1, 2]),
      firstSeenAt: new Map<number, string>(),
    };
    const result = applyFirstSeenAt(seen, previous, fetchedAt);
    expect(result.newlyLaunchedCount).toBe(1);
    expect(result.skippedReason).toBeNull();
    expect(seen.get(1)?.firstSeenAt).toBeUndefined();
    expect(seen.get(3)?.firstSeenAt).toBe(fetchedAt);
  });

  it('carries forward a legitimate previous firstSeenAt', () => {
    const seen = makeSeen([1]);
    const previous = {
      known: new Set([1]),
      firstSeenAt: new Map([[1, '2026-07-10T00:00:00.000Z']]),
    };
    applyFirstSeenAt(seen, previous, fetchedAt);
    expect(seen.get(1)?.firstSeenAt).toBe('2026-07-10T00:00:00.000Z');
  });

  it('refuses to stamp when candidate count exceeds the per-fetch cap', () => {
    const newIds = Array.from({ length: MAX_NEW_LAUNCHES_PER_FETCH + 1 }, (_, i) => 10_000 + i);
    const seen = makeSeen([1, ...newIds]);
    const previous = {
      known: new Set([1]),
      firstSeenAt: new Map<number, string>(),
    };
    const result = applyFirstSeenAt(seen, previous, fetchedAt);
    expect(result.newlyLaunchedCount).toBe(0);
    expect(result.skippedReason).toMatch(/^too-many-candidates:/);
    expect(seen.get(10_000)?.firstSeenAt).toBeUndefined();
  });

  it('drops bulk-corrupt previous stamps that all share one timestamp', () => {
    const bulkTs = '2026-07-23T06:07:24.317Z';
    const knownIds = Array.from({ length: BULK_FIRST_SEEN_COLLAPSE_THRESHOLD }, (_, i) => i + 1);
    const previousFirstSeen = new Map(knownIds.map((id) => [id, bulkTs] as const));
    // One legitimate stamp mixed in with a different timestamp.
    previousFirstSeen.set(999, '2026-07-20T00:00:00.000Z');
    knownIds.push(999);

    const seen = makeSeen([...knownIds, 1000]);
    const previous = { known: new Set(knownIds), firstSeenAt: previousFirstSeen };
    const result = applyFirstSeenAt(seen, previous, fetchedAt);

    expect(result.droppedCorrupt).toBe(BULK_FIRST_SEEN_COLLAPSE_THRESHOLD);
    expect(seen.get(1)?.firstSeenAt).toBeUndefined();
    expect(seen.get(999)?.firstSeenAt).toBe('2026-07-20T00:00:00.000Z');
    expect(seen.get(1000)?.firstSeenAt).toBe(fetchedAt);
  });
});
