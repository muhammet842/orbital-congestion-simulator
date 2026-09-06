import type { TrackedObject } from '../types';

export const RECENT_LAUNCH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export const MAX_LAUNCH_AGE_YEARS_FOR_NEW = 2;

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

export function hasAnyRecentlyLaunched(
  objects: ReadonlyArray<Pick<TrackedObject, 'firstSeenAt'> & { line1?: string }>,
  nowMs: number = Date.now(),
): boolean {
  return objects.some((obj) => isRecentlyLaunched(obj, nowMs));
}
