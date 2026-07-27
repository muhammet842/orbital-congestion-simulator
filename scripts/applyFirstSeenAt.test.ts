import { describe, expect, it } from 'vitest';
import {
  applyFirstSeenAt,
  BULK_FIRST_SEEN_COLLAPSE_THRESHOLD,
  isPlausibleNewLaunch,
  launchYearFromTleLine1,
  MAX_NEW_LAUNCHES_PER_FETCH,
} from './applyFirstSeenAt.mjs';

/** Minimal TLE line-1 with the given 2-digit launch year in the intl designator. */
function line1ForLaunchYear(yy: number, noradId = 99999): string {
  const id = String(noradId).padStart(5, '0');
  const y = String(yy).padStart(2, '0');
  // cols: 1 NNNNNU YYNNNAAA …
  return `1 ${id}U ${y}001A   26180.00000000  .00000000  00000+0  00000+0 0  9990`;
}

function makeSeen(
  entries: Array<{ noradId: number; launchYy?: number | null }>,
): Map<number, { noradId: number; firstSeenAt?: string; line1?: string }> {
  return new Map(
    entries.map(({ noradId, launchYy }) => [
      noradId,
      {
        noradId,
        line1: launchYy == null ? undefined : line1ForLaunchYear(launchYy, noradId),
      },
    ]),
  );
}

describe('launchYearFromTleLine1', () => {
  it('parses OSCAR 29 (1987) from a real-shaped line', () => {
    const line = '1 18362U 87080B   26207.64992772  .00000068  00000+0  10087-3 0  9998';
    expect(launchYearFromTleLine1(line)).toBe(1987);
  });

  it('maps 00–56 to 2000–2056 and 57–99 to 1957–1999', () => {
    expect(launchYearFromTleLine1(line1ForLaunchYear(24))).toBe(2024);
    expect(launchYearFromTleLine1(line1ForLaunchYear(57))).toBe(1957);
  });
});

describe('isPlausibleNewLaunch', () => {
  it('rejects a 1987 satellite stamped in 2026', () => {
    expect(
      isPlausibleNewLaunch({ line1: line1ForLaunchYear(87, 18362) }, '2026-07-27T00:00:00.000Z'),
    ).toBe(false);
  });

  it('accepts a launch from the current or previous year', () => {
    expect(
      isPlausibleNewLaunch({ line1: line1ForLaunchYear(26) }, '2026-07-27T00:00:00.000Z'),
    ).toBe(true);
    expect(
      isPlausibleNewLaunch({ line1: line1ForLaunchYear(25) }, '2026-07-27T00:00:00.000Z'),
    ).toBe(true);
  });
});

describe('applyFirstSeenAt', () => {
  const fetchedAt = '2026-07-24T12:00:00.000Z';

  it('does not stamp anything when there is no previous catalog (baseline seed)', () => {
    const seen = makeSeen([
      { noradId: 1, launchYy: 26 },
      { noradId: 2, launchYy: 26 },
      { noradId: 3, launchYy: 26 },
    ]);
    const result = applyFirstSeenAt(seen, { known: new Set(), firstSeenAt: new Map() }, fetchedAt);
    expect(result.newlyLaunchedCount).toBe(0);
    expect(result.skippedReason).toBe('no-previous-catalog');
    expect(seen.get(1)?.firstSeenAt).toBeUndefined();
  });

  it('stamps only NORAD IDs that were absent from the previous catalog', () => {
    const seen = makeSeen([
      { noradId: 1, launchYy: 26 },
      { noradId: 2, launchYy: 26 },
      { noradId: 3, launchYy: 26 },
    ]);
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

  it('refuses to stamp a decades-old satellite that merely re-entered the catalog', () => {
    const seen = makeSeen([
      { noradId: 1, launchYy: 26 },
      { noradId: 18362, launchYy: 87 }, // OSCAR 29
    ]);
    const previous = {
      known: new Set([1]),
      firstSeenAt: new Map<number, string>(),
    };
    const result = applyFirstSeenAt(seen, previous, fetchedAt);
    expect(result.newlyLaunchedCount).toBe(0);
    expect(result.rejectedStaleLaunch).toBe(1);
    expect(seen.get(18362)?.firstSeenAt).toBeUndefined();
  });

  it('strips a carried-forward firstSeenAt from an old launch (catalog churn false positive)', () => {
    const seen = makeSeen([{ noradId: 18362, launchYy: 87 }]);
    const previous = {
      known: new Set([18362]),
      firstSeenAt: new Map([[18362, '2026-07-20T00:00:00.000Z']]),
    };
    const result = applyFirstSeenAt(seen, previous, fetchedAt);
    expect(result.rejectedStaleLaunch).toBe(1);
    expect(seen.get(18362)?.firstSeenAt).toBeUndefined();
  });

  it('carries forward a legitimate previous firstSeenAt', () => {
    const seen = makeSeen([{ noradId: 1, launchYy: 26 }]);
    const previous = {
      known: new Set([1]),
      firstSeenAt: new Map([[1, '2026-07-10T00:00:00.000Z']]),
    };
    applyFirstSeenAt(seen, previous, fetchedAt);
    expect(seen.get(1)?.firstSeenAt).toBe('2026-07-10T00:00:00.000Z');
  });

  it('refuses to stamp when candidate count exceeds the per-fetch cap', () => {
    const newIds = Array.from({ length: MAX_NEW_LAUNCHES_PER_FETCH + 1 }, (_, i) => 10_000 + i);
    const seen = makeSeen([{ noradId: 1, launchYy: 26 }, ...newIds.map((noradId) => ({ noradId, launchYy: 26 }))]);
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
    previousFirstSeen.set(999, '2026-07-20T00:00:00.000Z');
    knownIds.push(999);

    const seen = makeSeen([
      ...knownIds.map((noradId) => ({ noradId, launchYy: 26 })),
      { noradId: 1000, launchYy: 26 },
    ]);
    const previous = { known: new Set(knownIds), firstSeenAt: previousFirstSeen };
    const result = applyFirstSeenAt(seen, previous, fetchedAt);

    expect(result.droppedCorrupt).toBe(BULK_FIRST_SEEN_COLLAPSE_THRESHOLD);
    expect(seen.get(1)?.firstSeenAt).toBeUndefined();
    expect(seen.get(999)?.firstSeenAt).toBe('2026-07-20T00:00:00.000Z');
    expect(seen.get(1000)?.firstSeenAt).toBe(fetchedAt);
  });
});
