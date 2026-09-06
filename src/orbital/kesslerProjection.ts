

export interface KesslerScenarioParams {
  
  launchRateMultiplier: number;
  
  mitigationRate: number;
  
  collisionRiskMultiplier: number;
}

export const DEFAULT_KESSLER_SCENARIO: KesslerScenarioParams = {
  launchRateMultiplier: 1,
  mitigationRate: 1,
  collisionRiskMultiplier: 1,
};

export const KESSLER_PRESETS = {
  bau: { launchRateMultiplier: 1, mitigationRate: 1, collisionRiskMultiplier: 1 },
  boom: { launchRateMultiplier: 2.5, mitigationRate: 0.7, collisionRiskMultiplier: 1.3 },
  green: { launchRateMultiplier: 0.85, mitigationRate: 2.2, collisionRiskMultiplier: 0.55 },
  asat: { launchRateMultiplier: 1.15, mitigationRate: 0.85, collisionRiskMultiplier: 3.2 },
} as const satisfies Record<string, KesslerScenarioParams>;

export type KesslerPresetId = keyof typeof KESSLER_PRESETS;

export interface KesslerYearPoint {
  year: number;
  
  totalObjects: number;
  
  debrisObjects: number;
  
  leoObjects: number;
  
  meoObjects: number;
  
  geoObjects: number;
  
  expectedCollisionsThisYear: number;
  
  cumulativeCollisions: number;
  
  riskIndex: number;
}

export type KesslerOutlookBand = 'stable' | 'concerning' | 'critical' | 'runaway';

export const REAL_WORLD_BASELINE_OBJECTS = 40_000;

export const BASELINE_SHELL_FRACTIONS = {
  leo: 0.82,
  meo: 0.08,
  geo: 0.1,
} as const;

const BASELINE_ANNUAL_LAUNCHES = 2600;

const LAUNCH_SHELL_FRACTIONS = { leo: 0.92, meo: 0.04, geo: 0.04 } as const;

const BASELINE_COLLISION_P = { leo: 0.11, meo: 0.006, geo: 0.008 } as const;

const DEBRIS_PER_COLLISION = { leo: 1800, meo: 900, geo: 600 } as const;

const ACTIVE_REMOVAL_FRACTION = { leo: 0.07, meo: 0.02, geo: 0.015 } as const;

const DEBRIS_REMOVAL_FRACTION = { leo: 0.025, meo: 0.002, geo: 0.0004 } as const;

const INITIAL_DEBRIS_FRACTION = 0.55;
const MAX_TOTAL_OBJECTS = 5_000_000;
const MIN_PROJECTION_YEARS = 1;
const MAX_PROJECTION_YEARS = 100;

type ShellId = 'leo' | 'meo' | 'geo';
const SHELLS: ShellId[] = ['leo', 'meo', 'geo'];

interface ShellPop {
  total: number;
  debris: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampScenarioParams(params: KesslerScenarioParams): KesslerScenarioParams {
  return {
    launchRateMultiplier: clamp(params.launchRateMultiplier, 0, 6),
    mitigationRate: clamp(params.mitigationRate, 0, 3),
    collisionRiskMultiplier: clamp(params.collisionRiskMultiplier, 0, 6),
  };
}

function seedShells(startingObjectCount: number): Record<ShellId, ShellPop> {
  const baseline = Math.max(startingObjectCount, 1);
  const out = {} as Record<ShellId, ShellPop>;
  for (const shell of SHELLS) {
    const total = baseline * BASELINE_SHELL_FRACTIONS[shell];
    out[shell] = { total, debris: total * INITIAL_DEBRIS_FRACTION };
  }
  return out;
}

function stepShell(
  pop: ShellPop,
  shell: ShellId,
  params: KesslerScenarioParams,
  shellBaseline: number,
): { pop: ShellPop; expectedCollisions: number } {
  const densityRatio = pop.total / Math.max(shellBaseline, 1);
  const expectedCollisions =
    BASELINE_COLLISION_P[shell] *
    densityRatio *
    densityRatio *
    params.collisionRiskMultiplier;

  const newDebris = expectedCollisions * DEBRIS_PER_COLLISION[shell];
  const newLaunches =
    BASELINE_ANNUAL_LAUNCHES * params.launchRateMultiplier * LAUNCH_SHELL_FRACTIONS[shell];

  const activeRemoved = Math.min(
    pop.total,
    pop.total * ACTIVE_REMOVAL_FRACTION[shell] * params.mitigationRate,
  );
  const debrisRemoved = Math.min(
    pop.debris,
    pop.debris * DEBRIS_REMOVAL_FRACTION[shell] * params.mitigationRate,
  );

  const nextTotal = clamp(
    pop.total + newLaunches - activeRemoved + newDebris,
    shellBaseline * 0.08,
    MAX_TOTAL_OBJECTS * BASELINE_SHELL_FRACTIONS[shell] * 2.5,
  );
  const nextDebris = Math.max(0, Math.min(pop.debris + newDebris - debrisRemoved, nextTotal));

  return {
    pop: { total: nextTotal, debris: nextDebris },
    expectedCollisions,
  };
}

export function projectKesslerTimeline(
  startYear: number,
  endYear: number,
  startingObjectCount: number,
  rawParams: KesslerScenarioParams = DEFAULT_KESSLER_SCENARIO,
): KesslerYearPoint[] {
  const params = clampScenarioParams(rawParams);
  const years = clamp(Math.round(endYear - startYear), MIN_PROJECTION_YEARS, MAX_PROJECTION_YEARS);
  const baseline = Math.max(startingObjectCount, 1);
  const shellBaseline = {
    leo: baseline * BASELINE_SHELL_FRACTIONS.leo,
    meo: baseline * BASELINE_SHELL_FRACTIONS.meo,
    geo: baseline * BASELINE_SHELL_FRACTIONS.geo,
  };

  let shells = seedShells(baseline);
  let cumulativeCollisions = 0;
  const points: KesslerYearPoint[] = [];

  for (let i = 1; i <= years; i++) {
    let yearCollisions = 0;
    const next = {} as Record<ShellId, ShellPop>;

    for (const shell of SHELLS) {
      const stepped = stepShell(shells[shell], shell, params, shellBaseline[shell]);
      next[shell] = stepped.pop;
      yearCollisions += stepped.expectedCollisions;
    }

    shells = next;
    cumulativeCollisions += yearCollisions;

    const leoObjects = Math.round(shells.leo.total);
    const meoObjects = Math.round(shells.meo.total);
    const geoObjects = Math.round(shells.geo.total);
    const totalObjects = leoObjects + meoObjects + geoObjects;
    const debris = shells.leo.debris + shells.meo.debris + shells.geo.debris;

    
    const leoDensityRatio = shells.leo.total / Math.max(shellBaseline.leo, 1);
    const riskIndex = leoDensityRatio * leoDensityRatio * params.collisionRiskMultiplier * 100;

    points.push({
      year: startYear + i,
      totalObjects,
      debrisObjects: Math.round(Math.min(debris, totalObjects)),
      leoObjects,
      meoObjects,
      geoObjects,
      expectedCollisionsThisYear: yearCollisions,
      cumulativeCollisions,
      riskIndex,
    });
  }

  return points;
}

export function classifyOutlook(riskIndex: number): KesslerOutlookBand {
  if (riskIndex >= 3000) return 'runaway';
  if (riskIndex >= 800) return 'critical';
  if (riskIndex >= 150) return 'concerning';
  return 'stable';
}
