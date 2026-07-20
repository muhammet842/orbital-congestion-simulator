import type { TrackedObject } from '../types';

/** How long an object keeps showing a "recently launched" badge after it
 *  first appears in an automated TLE fetch. */
export const RECENT_LAUNCH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * True when `obj` was first observed by our automated TLE fetch within the
 * last `RECENT_LAUNCH_WINDOW_MS`. Objects fetched before this field existed
 * (i.e. the vast majority of the catalog) have no `firstSeenAt` and are
 * never considered "recent" — this is intentional, since we can't know
 * their true first-seen date retroactively.
 */
export function isRecentlyLaunched(obj: Pick<TrackedObject, 'firstSeenAt'>, nowMs: number = Date.now()): boolean {
  if (!obj.firstSeenAt) return false;
  const seenMs = new Date(obj.firstSeenAt).getTime();
  if (Number.isNaN(seenMs)) return false;
  return nowMs - seenMs < RECENT_LAUNCH_WINDOW_MS && nowMs >= seenMs;
}

/** True when at least one object in the catalog currently qualifies as
 *  "recently launched" — used to hide the filter toggle entirely when it
 *  would just produce an empty list. */
export function hasAnyRecentlyLaunched(
  objects: ReadonlyArray<Pick<TrackedObject, 'firstSeenAt'>>,
  nowMs: number = Date.now(),
): boolean {
  return objects.some((obj) => isRecentlyLaunched(obj, nowMs));
}
