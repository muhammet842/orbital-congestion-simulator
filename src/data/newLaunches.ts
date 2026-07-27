import type { TrackedObject } from '../types';

/** How long an object keeps showing a "recently launched" badge after it
 *  first appears in an automated TLE fetch. */
export const RECENT_LAUNCH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Same gate as scripts/applyFirstSeenAt.mjs — decades-old international
 * designators (e.g. OSCAR 29 / 1987) must never count as "NEW".
 */
export const MAX_LAUNCH_AGE_YEARS_FOR_NEW = 2;

/** Parse launch calendar year from TLE line 1 intl designator (cols 10–11). */
export function launchYearFromTleLine1(line1: string | undefined): number | null {
  if (typeof line1 !== 'string' || line1.length < 11) return null;
  const yy = Number.parseInt(line1.substring(9, 11), 10);
  if (!Number.isFinite(yy)) return null;
  return yy >= 57 ? 1900 + yy : 2000 + yy;
}

function isPlausibleRecentLaunchYear(
  obj: { line1?: string },
  referenceMs: number,
): boolean {
  const launchYear = launchYearFromTleLine1(obj.line1);
  if (launchYear == null) return true;
  const refYear = new Date(referenceMs).getUTCFullYear();
  return launchYear >= refYear - MAX_LAUNCH_AGE_YEARS_FOR_NEW;
}

/**
 * True when `obj` was first observed by our automated TLE fetch within the
 * last `RECENT_LAUNCH_WINDOW_MS`. Objects fetched before this field existed
 * (i.e. the vast majority of the catalog) have no `firstSeenAt` and are
 * never considered "recent" — this is intentional, since we can't know
 * their true first-seen date retroactively.
 *
 * Also rejects stamps on satellites whose TLE launch year is far older than
 * the stamp (catalog re-entry false positives).
 */
export function isRecentlyLaunched(
  obj: Pick<TrackedObject, 'firstSeenAt'> & { line1?: string },
  nowMs: number = Date.now(),
): boolean {
  if (!obj.firstSeenAt) return false;
  const seenMs = new Date(obj.firstSeenAt).getTime();
  if (Number.isNaN(seenMs)) return false;
  if (!(nowMs - seenMs < RECENT_LAUNCH_WINDOW_MS && nowMs >= seenMs)) return false;
  return isPlausibleRecentLaunchYear(obj, seenMs);
}

/** True when at least one object in the catalog currently qualifies as
 *  "recently launched" — used to hide the filter toggle entirely when it
 *  would just produce an empty list. */
export function hasAnyRecentlyLaunched(
  objects: ReadonlyArray<Pick<TrackedObject, 'firstSeenAt'> & { line1?: string }>,
  nowMs: number = Date.now(),
): boolean {
  return objects.some((obj) => isRecentlyLaunched(obj, nowMs));
}
