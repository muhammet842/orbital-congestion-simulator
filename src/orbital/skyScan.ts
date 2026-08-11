/**
 * Throttled above-horizon sky scan for Spotter sky mode.
 * Filters catalog objects to FOV-ranked candidates (no debris by default).
 */

import type { SatRec } from 'satellite.js';
import {
  computeLookAngles,
  type LookAngles,
  type ObserverLocation,
} from './lookAngles';
import {
  DEFAULT_FOV_DEG,
  skyFovCenterDistanceDeg,
  type SkyViewCenter,
} from './skyProjection';

export interface SkyScanObject {
  noradId: number;
  name: string;
  satrec: SatRec;
  /** Skip debris-heavy clutter in V1 unless selected. */
  category: string;
}

export interface SkyScanHit {
  noradId: number;
  name: string;
  look: LookAngles;
  /** Angular distance from phone FOV center (degrees). */
  centerDistDeg: number;
}

export interface SkyScanOptions {
  /** Max satellites returned (selected always forced in if above horizon). */
  maxCount?: number;
  /** Horizontal FOV used for soft ranking preference. */
  fovDeg?: number;
  /** Minimum elevation to include (degrees). */
  minElevationDeg?: number;
  /** Include debris category when true. */
  includeDebris?: boolean;
  /** NORAD of the Spotter target — always kept if above horizon. */
  selectedNoradId?: number | null;
}

const DEFAULT_MAX = 100;

/**
 * Scan catalog for above-horizon satellites and rank by distance to FOV center.
 * Pure / sync — caller should throttle (~1s) because SGP4 over thousands is heavy.
 */
export function scanSkyCandidates(
  objects: SkyScanObject[],
  observer: ObserverLocation,
  date: Date,
  view: SkyViewCenter,
  opts: SkyScanOptions = {},
): SkyScanHit[] {
  const maxCount = opts.maxCount ?? DEFAULT_MAX;
  const fovDeg = opts.fovDeg ?? DEFAULT_FOV_DEG;
  const minEl = opts.minElevationDeg ?? 0;
  const includeDebris = opts.includeDebris ?? false;
  const selectedId = opts.selectedNoradId ?? null;

  const hits: SkyScanHit[] = [];

  for (const obj of objects) {
    if (!includeDebris && obj.category === 'debris' && obj.noradId !== selectedId) {
      continue;
    }
    const look = computeLookAngles(obj.satrec, observer, date);
    if (!look || look.elevationDeg < minEl) continue;

    const centerDistDeg = skyFovCenterDistanceDeg(view, {
      azimuthDeg: look.azimuthDeg,
      elevationDeg: look.elevationDeg,
    });
    hits.push({
      noradId: obj.noradId,
      name: obj.name,
      look,
      centerDistDeg,
    });
  }

  hits.sort((a, b) => {
    // Prefer in-FOV-ish, then higher elevation as tie-break.
    const aIn = a.centerDistDeg <= fovDeg * 0.75 ? 0 : 1;
    const bIn = b.centerDistDeg <= fovDeg * 0.75 ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;
    if (a.centerDistDeg !== b.centerDistDeg) return a.centerDistDeg - b.centerDistDeg;
    return b.look.elevationDeg - a.look.elevationDeg;
  });

  let selected: SkyScanHit | null = null;
  if (selectedId != null) {
    const idx = hits.findIndex((h) => h.noradId === selectedId);
    if (idx >= 0) {
      selected = hits[idx];
      hits.splice(idx, 1);
    }
  }

  const capped = hits.slice(0, selected ? maxCount - 1 : maxCount);
  if (selected) capped.unshift(selected);
  return capped;
}
