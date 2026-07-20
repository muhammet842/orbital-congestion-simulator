/**
 * Kessler Syndrome projection model.
 *
 * A deliberately simplified, deterministic "what if" model that projects
 * orbital object counts and collision risk forward in time under a
 * user-chosen scenario. It is an educational storytelling tool — NOT an
 * official orbital-debris forecast (real models like NASA's LEGEND or
 * ESA's DELTA use full population-in-bins fragmentation physics).
 *
 * Calibration notes (loosely matched to real-world 2024-25 figures):
 *  - ~2,600 new payloads reach orbit per year (Starlink-driven launch boom).
 *  - Roughly one catastrophic fragmentation event (accidental collision or
 *    ASAT test) has occurred every ~8-9 years historically → ~11% baseline
 *    annual probability at today's density.
 *  - A single catastrophic collision/ASAT test produces on the order of
 *    hundreds to a few thousand trackable fragments (Fengyun-1C: ~3,000+,
 *    Iridium/Cosmos: ~2,300 combined, Cosmos 1408: ~1,500+).
 *  - Collision probability scales roughly with the square of object density
 *    (more objects packed in the same shells → quadratically more
 *    close-approach opportunities) — the core Kessler-syndrome feedback.
 */

export interface KesslerScenarioParams {
  /** Multiplier on today's real-world annual launch cadence (~2,600/yr). 1 = business as usual. */
  launchRateMultiplier: number;
  /** Multiplier on active debris-mitigation effectiveness (deorbiting / end-of-life disposal). 1 = today's policy effort. */
  mitigationRate: number;
  /** Multiplier on collision / ASAT-test frequency risk. 1 = today's historical baseline. */
  collisionRiskMultiplier: number;
}

export const DEFAULT_KESSLER_SCENARIO: KesslerScenarioParams = {
  launchRateMultiplier: 1,
  mitigationRate: 1,
  collisionRiskMultiplier: 1,
};

export interface KesslerYearPoint {
  year: number;
  /** Cumulative tracked objects (active + debris) at the end of this year. */
  totalObjects: number;
  /** Of which are debris (today's already-fragmented baseline + new collision fragments). Always ≤ totalObjects. */
  debrisObjects: number;
  /** Expected (fractional) number of catastrophic fragmentation events during this year. */
  expectedCollisionsThisYear: number;
  /** Cumulative expected fragmentation events since the start year. */
  cumulativeCollisions: number;
  /** Collision-risk index relative to the start year: 100 = same risk as today. */
  riskIndex: number;
}

export type KesslerOutlookBand = 'stable' | 'concerning' | 'critical' | 'runaway';

/**
 * Real-world estimate of tracked objects (active + debris, >10 cm) in orbit
 * today (~2025, per ESA/USSPACECOM public figures). Used as the default
 * starting population — deliberately independent of however many objects
 * this particular app instance has loaded/capped in its own TLE catalog,
 * since the calibration constants below are matched to the real world, not
 * to this app's (smaller, filtered) dataset.
 */
export const REAL_WORLD_BASELINE_OBJECTS = 40_000;

const BASELINE_ANNUAL_LAUNCHES = 2600;
const BASELINE_DEORBIT_FRACTION = 0.05;
const BASELINE_ANNUAL_COLLISION_PROBABILITY = 0.11;
const DEBRIS_PER_COLLISION = 1500;
/** Debris decays out of orbit much more slowly than a maneuverable satellite. */
const DEBRIS_DEORBIT_FACTOR = 0.5;
/**
 * Of today's ~40k tracked objects, roughly half are already non-functional
 * fragmentation/mission-related debris (per ESA's Space Environment Report),
 * not active satellites. Seeding `debris` at this fraction — instead of 0 —
 * makes the "Debris Objects" stat represent the real total debris population
 * rather than only debris created *after* the projection starts.
 */
const INITIAL_DEBRIS_FRACTION = 0.55;
/** Hard ceiling so an extreme scenario asymptotes instead of overflowing to Infinity/NaN. */
const MAX_TOTAL_OBJECTS = 5_000_000;

const MIN_PROJECTION_YEARS = 1;
const MAX_PROJECTION_YEARS = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Keeps user-supplied scenario sliders within sane, non-explosive bounds. */
export function clampScenarioParams(params: KesslerScenarioParams): KesslerScenarioParams {
  return {
    launchRateMultiplier: clamp(params.launchRateMultiplier, 0, 6),
    mitigationRate: clamp(params.mitigationRate, 0, 3),
    collisionRiskMultiplier: clamp(params.collisionRiskMultiplier, 0, 6),
  };
}

/**
 * Projects the orbital population year-by-year from `startYear` to `endYear`.
 * Returns one point per simulated year (not including the start year itself).
 */
export function projectKesslerTimeline(
  startYear: number,
  endYear: number,
  startingObjectCount: number,
  rawParams: KesslerScenarioParams = DEFAULT_KESSLER_SCENARIO,
): KesslerYearPoint[] {
  const params = clampScenarioParams(rawParams);
  const years = clamp(Math.round(endYear - startYear), MIN_PROJECTION_YEARS, MAX_PROJECTION_YEARS);
  const baseline = Math.max(startingObjectCount, 1);

  let total = baseline;
  let debris = baseline * INITIAL_DEBRIS_FRACTION;
  let cumulativeCollisions = 0;
  const points: KesslerYearPoint[] = [];

  for (let i = 1; i <= years; i++) {
    const densityRatio = total / baseline;
    const expectedCollisionsThisYear =
      BASELINE_ANNUAL_COLLISION_PROBABILITY * densityRatio * densityRatio * params.collisionRiskMultiplier;

    const newDebrisFromCollisions = expectedCollisionsThisYear * DEBRIS_PER_COLLISION;
    const newLaunches = BASELINE_ANNUAL_LAUNCHES * params.launchRateMultiplier;
    const deorbited = Math.min(total, total * BASELINE_DEORBIT_FRACTION * params.mitigationRate);
    const debrisDeorbited = Math.min(
      debris,
      debris * BASELINE_DEORBIT_FRACTION * params.mitigationRate * DEBRIS_DEORBIT_FACTOR,
    );

    total = clamp(total + newLaunches - deorbited + newDebrisFromCollisions, baseline * 0.1, MAX_TOTAL_OBJECTS);
    // Debris is a subset of the total population by definition — never let it
    // exceed `total`, even when both are independently approaching the hard cap.
    debris = Math.max(0, Math.min(debris + newDebrisFromCollisions - debrisDeorbited, total));
    cumulativeCollisions += expectedCollisionsThisYear;

    points.push({
      year: startYear + i,
      totalObjects: Math.round(total),
      debrisObjects: Math.round(debris),
      expectedCollisionsThisYear,
      cumulativeCollisions,
      riskIndex: densityRatio * densityRatio * params.collisionRiskMultiplier * 100,
    });
  }

  return points;
}

/**
 * Buckets a risk index into a coarse narrative outlook used to pick UI copy.
 *
 * Because riskIndex scales with density-ratio *squared*, a merely 3-4×
 * increase in population already produces an index of ~1,000-1,600 — that's
 * a serious, attention-worthy trend but not yet the literal, self-sustaining
 * "runaway cascade" Kessler syndrome describes. The "runaway" band is
 * reserved for indices reachable only via genuinely extreme scenarios
 * (≥6× density growth and/or a materially elevated collision-risk slider).
 */
export function classifyOutlook(riskIndex: number): KesslerOutlookBand {
  if (riskIndex >= 3000) return 'runaway';
  if (riskIndex >= 800) return 'critical';
  if (riskIndex >= 150) return 'concerning';
  return 'stable';
}
