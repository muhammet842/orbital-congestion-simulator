import { describe, expect, it } from 'vitest';
import {
  classifyOutlook,
  clampScenarioParams,
  DEFAULT_KESSLER_SCENARIO,
  projectKesslerTimeline,
  REAL_WORLD_BASELINE_OBJECTS,
} from './kesslerProjection';

describe('projectKesslerTimeline', () => {
  it('returns one point per projected year', () => {
    const points = projectKesslerTimeline(2025, 2050, 12000);
    expect(points).toHaveLength(25);
    expect(points[0].year).toBe(2026);
    expect(points[24].year).toBe(2050);
  });

  it('clamps the span to at least one year even if end <= start', () => {
    expect(projectKesslerTimeline(2025, 2025, 12000)).toHaveLength(1);
    expect(projectKesslerTimeline(2025, 2020, 12000)).toHaveLength(1);
  });

  it('caps the projected span at 100 years', () => {
    expect(projectKesslerTimeline(2025, 3025, 12000)).toHaveLength(100);
  });

  it('grows the object population under the default (business-as-usual) scenario', () => {
    const points = projectKesslerTimeline(2025, 2050, 12000);
    const last = points[points.length - 1];
    expect(last.totalObjects).toBeGreaterThan(12000);
    // Population should be monotonically non-decreasing year over year.
    for (let i = 1; i < points.length; i++) {
      expect(points[i].totalObjects).toBeGreaterThanOrEqual(points[i - 1].totalObjects);
    }
  });

  it('produces a larger population under a higher launch-rate multiplier', () => {
    const baseline = projectKesslerTimeline(2025, 2050, 12000, DEFAULT_KESSLER_SCENARIO);
    const aggressive = projectKesslerTimeline(2025, 2050, 12000, {
      ...DEFAULT_KESSLER_SCENARIO,
      launchRateMultiplier: 3,
    });
    expect(aggressive[aggressive.length - 1].totalObjects).toBeGreaterThan(
      baseline[baseline.length - 1].totalObjects,
    );
  });

  it('produces a smaller population under aggressive debris mitigation', () => {
    const baseline = projectKesslerTimeline(2025, 2050, 12000, DEFAULT_KESSLER_SCENARIO);
    const mitigated = projectKesslerTimeline(2025, 2050, 12000, {
      ...DEFAULT_KESSLER_SCENARIO,
      mitigationRate: 2.5,
    });
    expect(mitigated[mitigated.length - 1].totalObjects).toBeLessThan(
      baseline[baseline.length - 1].totalObjects,
    );
  });

  it('raises the risk index and cumulative collisions under higher collision risk', () => {
    const baseline = projectKesslerTimeline(2025, 2050, 12000, DEFAULT_KESSLER_SCENARIO);
    const risky = projectKesslerTimeline(2025, 2050, 12000, {
      ...DEFAULT_KESSLER_SCENARIO,
      collisionRiskMultiplier: 4,
    });
    const lastBase = baseline[baseline.length - 1];
    const lastRisky = risky[risky.length - 1];
    expect(lastRisky.riskIndex).toBeGreaterThan(lastBase.riskIndex);
    expect(lastRisky.cumulativeCollisions).toBeGreaterThan(lastBase.cumulativeCollisions);
  });

  it('never lets the population collapse below 10% of the baseline', () => {
    const points = projectKesslerTimeline(2025, 2100, 12000, {
      launchRateMultiplier: 0,
      mitigationRate: 3,
      collisionRiskMultiplier: 0,
    });
    for (const p of points) {
      expect(p.totalObjects).toBeGreaterThanOrEqual(1200 * 0.99);
    }
  });

  it('guards against a zero or negative starting object count', () => {
    const points = projectKesslerTimeline(2025, 2030, 0);
    expect(points.every((p) => Number.isFinite(p.totalObjects))).toBe(true);
    expect(points.every((p) => p.totalObjects >= 0)).toBe(true);
  });

  it('never produces NaN or Infinity even under an extreme worst-case scenario over a long horizon', () => {
    const points = projectKesslerTimeline(2025, 2100, REAL_WORLD_BASELINE_OBJECTS, {
      launchRateMultiplier: 6,
      mitigationRate: 0,
      collisionRiskMultiplier: 6,
    });
    for (const p of points) {
      expect(Number.isFinite(p.totalObjects)).toBe(true);
      expect(Number.isFinite(p.debrisObjects)).toBe(true);
      expect(Number.isFinite(p.riskIndex)).toBe(true);
      expect(Number.isFinite(p.cumulativeCollisions)).toBe(true);
    }
  });

  it('keeps the default (business-as-usual) scenario in a believable "concerning" range over 25 years', () => {
    // Regression guard for the real-world-baseline calibration: at 1×/1×/1×
    // the model should show meaningful but not apocalyptic growth by 2050 —
    // if this ever creeps into "runaway" territory, the panel loses its
    // ability to show contrast between a good and a bad policy scenario.
    const points = projectKesslerTimeline(2025, 2050, REAL_WORLD_BASELINE_OBJECTS);
    const last = points[points.length - 1];
    expect(classifyOutlook(last.riskIndex)).not.toBe('runaway');
  });

  it('keeps an aggressive-mitigation scenario "stable" over 25 years', () => {
    const points = projectKesslerTimeline(2025, 2050, REAL_WORLD_BASELINE_OBJECTS, {
      launchRateMultiplier: 0.5,
      mitigationRate: 2.5,
      collisionRiskMultiplier: 0.5,
    });
    const last = points[points.length - 1];
    expect(classifyOutlook(last.riskIndex)).toBe('stable');
  });
});

describe('clampScenarioParams', () => {
  it('leaves in-range values untouched', () => {
    expect(clampScenarioParams({ launchRateMultiplier: 2, mitigationRate: 1, collisionRiskMultiplier: 1.5 })).toEqual({
      launchRateMultiplier: 2,
      mitigationRate: 1,
      collisionRiskMultiplier: 1.5,
    });
  });

  it('clamps extreme or negative values into range', () => {
    const clamped = clampScenarioParams({
      launchRateMultiplier: -5,
      mitigationRate: 999,
      collisionRiskMultiplier: 999,
    });
    expect(clamped.launchRateMultiplier).toBe(0);
    expect(clamped.mitigationRate).toBe(3);
    expect(clamped.collisionRiskMultiplier).toBe(6);
  });
});

describe('classifyOutlook', () => {
  it('classifies risk index bands correctly', () => {
    expect(classifyOutlook(0)).toBe('stable');
    expect(classifyOutlook(149)).toBe('stable');
    expect(classifyOutlook(150)).toBe('concerning');
    expect(classifyOutlook(399)).toBe('concerning');
    expect(classifyOutlook(400)).toBe('critical');
    expect(classifyOutlook(999)).toBe('critical');
    expect(classifyOutlook(1000)).toBe('runaway');
    expect(classifyOutlook(5000)).toBe('runaway');
  });
});
