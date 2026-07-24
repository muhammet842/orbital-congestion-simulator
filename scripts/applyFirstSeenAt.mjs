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
 * Decide which NORAD IDs get a fresh `firstSeenAt` stamp and which existing
 * stamps survive. Mutates `seen` objects in place.
 *
 * @param {Map<number, { firstSeenAt?: string }>} seen
 * @param {{ known: Set<number>, firstSeenAt: Map<number, string> }} previous
 * @param {string} fetchedAt ISO timestamp for this fetch
 * @returns {{ newlyLaunchedCount: number, skippedReason: string | null, droppedCorrupt: number }}
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
    return { newlyLaunchedCount: 0, skippedReason: 'no-previous-catalog', droppedCorrupt };
  }

  const candidates = [];
  for (const [noradId, obj] of seen) {
    const carriedForward = sanePreviousFirstSeen.get(noradId);
    if (carriedForward) {
      obj.firstSeenAt = carriedForward;
    } else if (!previous.known.has(noradId)) {
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
    };
  }

  for (const obj of candidates) {
    obj.firstSeenAt = fetchedAt;
  }
  return { newlyLaunchedCount: candidates.length, skippedReason: null, droppedCorrupt };
}
