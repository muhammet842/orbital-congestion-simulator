/**
 * Upper bound on how many objects a single fetch may mark as "newly launched".
 * A real bi-weekly window might see a few dozen (e.g. a Starlink batch); if we
 * suddenly see thousands, the previous catalog was missing/reshuffled and
 * stamping everything would flood the UI "NEW" filter with false positives.
 */
export const MAX_NEW_LAUNCHES_PER_FETCH = 200;

/**
 * If this many objects share the exact same `firstSeenAt` timestamp, the stamp
 * was almost certainly produced by a bulk false-positive (empty baseline or
 * catalog reshuffle). Those stamps are discarded when loading the previous
 * dataset so they don't get carried forward forever.
 */
export const BULK_FIRST_SEEN_COLLAPSE_THRESHOLD = 100;

/**
 * Objects whose TLE international-designator launch year is older than this
 * many calendar years before `fetchedAt` cannot be "new launches" — they are
 * catalog re-entries (group-cap churn, fallback fill, temporary CelesTrak
 * gaps). OSCAR 29 (1987) must never get a 2026 NEW badge.
 */
export const MAX_LAUNCH_AGE_YEARS_FOR_NEW = 2;

/**
 * Parse launch calendar year from TLE line 1 international designator
 * (columns 10–11, 1-indexed → substring 9–11). Returns null if unreadable.
 *
 * @param {string | undefined} line1
 * @returns {number | null}
 */
export function launchYearFromTleLine1(line1) {
  if (typeof line1 !== 'string' || line1.length < 11) return null;
  const yy = Number.parseInt(line1.substring(9, 11), 10);
  if (!Number.isFinite(yy)) return null;
  // Standard TLE 2-digit year: 57–99 → 1957–1999, 00–56 → 2000–2056.
  return yy >= 57 ? 1900 + yy : 2000 + yy;
}

/**
 * True when this object is plausibly a recent launch (not a decades-old
 * satellite that merely reappeared in our capped catalog).
 *
 * @param {{ line1?: string }} obj
 * @param {string} fetchedAt
 */
export function isPlausibleNewLaunch(obj, fetchedAt) {
  const launchYear = launchYearFromTleLine1(obj.line1);
  if (launchYear == null) {
    // No designator (e.g. some analyst objects) — allow stamp; still gated
    // by the per-fetch candidate cap.
    return true;
  }
  const fetchYear = new Date(fetchedAt).getUTCFullYear();
  if (!Number.isFinite(fetchYear)) return true;
  return launchYear >= fetchYear - MAX_LAUNCH_AGE_YEARS_FOR_NEW;
}

/**
 * Decide which NORAD IDs get a fresh `firstSeenAt` stamp and which existing
 * stamps survive. Mutates `seen` objects in place.
 *
 * @param {Map<number, { firstSeenAt?: string, line1?: string }>} seen
 * @param {{ known: Set<number>, firstSeenAt: Map<number, string> }} previous
 * @param {string} fetchedAt ISO timestamp for this fetch
 * @returns {{ newlyLaunchedCount: number, skippedReason: string | null, droppedCorrupt: number, rejectedStaleLaunch: number }}
 */
export function applyFirstSeenAt(seen, previous, fetchedAt) {
  const stampCounts = new Map();
  for (const ts of previous.firstSeenAt.values()) {
    stampCounts.set(ts, (stampCounts.get(ts) ?? 0) + 1);
  }

  const sanePreviousFirstSeen = new Map();
  let droppedCorrupt = 0;
  for (const [noradId, ts] of previous.firstSeenAt) {
    if ((stampCounts.get(ts) ?? 0) >= BULK_FIRST_SEEN_COLLAPSE_THRESHOLD) {
      droppedCorrupt++;
      continue;
    }
    sanePreviousFirstSeen.set(noradId, ts);
  }

  // No usable baseline → seed the catalog silently. Marking every object as
  // "new" would make the NEW filter show thousands of decades-old satellites.
  if (previous.known.size === 0) {
    return {
      newlyLaunchedCount: 0,
      skippedReason: 'no-previous-catalog',
      droppedCorrupt,
      rejectedStaleLaunch: 0,
    };
  }

  const candidates = [];
  let rejectedStaleLaunch = 0;
  for (const [noradId, obj] of seen) {
    const carriedForward = sanePreviousFirstSeen.get(noradId);
    if (carriedForward) {
      // Drop carried-forward stamps that could never have been real launches
      // (e.g. OSCAR 29 stamped after a catalog reshuffle).
      if (!isPlausibleNewLaunch(obj, carriedForward)) {
        delete obj.firstSeenAt;
        rejectedStaleLaunch++;
        continue;
      }
      obj.firstSeenAt = carriedForward;
    } else if (!previous.known.has(noradId)) {
      if (!isPlausibleNewLaunch(obj, fetchedAt)) {
        rejectedStaleLaunch++;
        continue;
      }
      candidates.push(obj);
    }
  }

  if (candidates.length > MAX_NEW_LAUNCHES_PER_FETCH) {
    // Catalog composition churned too hard (group caps, source changes, …).
    // Refuse to stamp — better to miss a real launch for one cycle than to
    // flood the UI with false "NEW" badges.
    return {
      newlyLaunchedCount: 0,
      skippedReason: `too-many-candidates:${candidates.length}`,
      droppedCorrupt,
      rejectedStaleLaunch,
    };
  }

  for (const obj of candidates) {
    obj.firstSeenAt = fetchedAt;
  }
  return {
    newlyLaunchedCount: candidates.length,
    skippedReason: null,
    droppedCorrupt,
    rejectedStaleLaunch,
  };
}
