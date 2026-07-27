import { describe, it, expect } from 'vitest';
import { isRecentlyLaunched, hasAnyRecentlyLaunched, RECENT_LAUNCH_WINDOW_MS } from './newLaunches';

describe('isRecentlyLaunched', () => {
  const now = new Date('2026-07-20T00:00:00Z').getTime();

  it('is false when firstSeenAt is absent (the vast majority of the catalog)', () => {
    expect(isRecentlyLaunched({ firstSeenAt: undefined }, now)).toBe(false);
  });

  it('is true for an object first seen a few hours ago', () => {
    const seen = new Date(now - 3 * 60 * 60 * 1000).toISOString();
    expect(isRecentlyLaunched({ firstSeenAt: seen }, now)).toBe(true);
  });

  it('is true right up to (but not past) the recent-launch window', () => {
    const justInside = new Date(now - (RECENT_LAUNCH_WINDOW_MS - 1000)).toISOString();
    expect(isRecentlyLaunched({ firstSeenAt: justInside }, now)).toBe(true);
  });

  it('is false once older than the recent-launch window', () => {
    const justOutside = new Date(now - (RECENT_LAUNCH_WINDOW_MS + 1000)).toISOString();
    expect(isRecentlyLaunched({ firstSeenAt: justOutside }, now)).toBe(false);
  });

  it('is false for a malformed timestamp', () => {
    expect(isRecentlyLaunched({ firstSeenAt: 'not-a-date' }, now)).toBe(false);
  });

  it('is false for a firstSeenAt in the future (clock skew guard)', () => {
    const future = new Date(now + 60_000).toISOString();
    expect(isRecentlyLaunched({ firstSeenAt: future }, now)).toBe(false);
  });

  it('is false for a decades-old launch even with a fresh firstSeenAt stamp (OSCAR 29)', () => {
    const seen = new Date(now - 3 * 60 * 60 * 1000).toISOString();
    const oscar29Line1 = '1 18362U 87080B   26207.64992772  .00000068  00000+0  10087-3 0  9998';
    expect(isRecentlyLaunched({ firstSeenAt: seen, line1: oscar29Line1 }, now)).toBe(false);
  });
});

describe('hasAnyRecentlyLaunched', () => {
  const now = new Date('2026-07-20T00:00:00Z').getTime();

  it('is false for an empty catalog', () => {
    expect(hasAnyRecentlyLaunched([], now)).toBe(false);
  });

  it('is false when no object has firstSeenAt (the entire pre-existing catalog)', () => {
    const objects = [{ firstSeenAt: undefined }, { firstSeenAt: undefined }];
    expect(hasAnyRecentlyLaunched(objects, now)).toBe(false);
  });

  it('is false when every firstSeenAt is stale (older than the window)', () => {
    const stale = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(hasAnyRecentlyLaunched([{ firstSeenAt: stale }], now)).toBe(false);
  });

  it('is true when at least one object is within the recent-launch window', () => {
    const recent = new Date(now - 60 * 60 * 1000).toISOString();
    const stale = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(hasAnyRecentlyLaunched([{ firstSeenAt: stale }, { firstSeenAt: recent }], now)).toBe(true);
  });
});
