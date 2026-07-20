import { describe, it, expect } from 'vitest';
import { isRecentlyLaunched, RECENT_LAUNCH_WINDOW_MS } from './newLaunches';

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
});
