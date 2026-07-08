import { describe, expect, it } from 'vitest';
import {
  eciToScene,
  eciVectorToScene,
  footprintHorizonFromAltitude,
  footprintHorizonFromOrbitRadius,
  getSubSatelliteScenePoints,
  sceneVectorLength,
  SURFACE_LIFT,
} from './coordinates';
import { EARTH_RADIUS_KM } from '../types';

describe('eciToScene', () => {
  it('scales by Earth radius and applies the ECI -> Three.js Y-up axis swap', () => {
    const onX = eciToScene(EARTH_RADIUS_KM, 0, 0);
    expect(onX.x).toBeCloseTo(1, 10);
    expect(onX.y).toBeCloseTo(0, 10);
    expect(onX.z).toBeCloseTo(0, 10);

    const onEciY = eciToScene(0, EARTH_RADIUS_KM, 0);
    expect(onEciY.x).toBeCloseTo(0, 10);
    expect(onEciY.y).toBeCloseTo(0, 10);
    expect(onEciY.z).toBeCloseTo(-1, 10);

    const onEciZ = eciToScene(0, 0, EARTH_RADIUS_KM);
    expect(onEciZ.x).toBeCloseTo(0, 10);
    expect(onEciZ.y).toBeCloseTo(1, 10);
    expect(onEciZ.z).toBeCloseTo(0, 10);
  });

  it('is linear (scales proportionally with distance)', () => {
    const half = eciToScene(EARTH_RADIUS_KM / 2, 0, 0);
    const full = eciToScene(EARTH_RADIUS_KM, 0, 0);
    expect(half.x).toBeCloseTo(full.x / 2, 10);
  });
});

describe('eciVectorToScene', () => {
  it('applies the same axis swap as eciToScene (no translation, direction only)', () => {
    const pos = eciToScene(1000, 2000, 3000);
    const vec = eciVectorToScene(1000, 2000, 3000);
    expect(vec.x).toBeCloseTo(pos.x, 10);
    expect(vec.y).toBeCloseTo(pos.y, 10);
    expect(vec.z).toBeCloseTo(pos.z, 10);
  });
});

describe('footprintHorizonFromAltitude', () => {
  it('collapses to zero footprint at the surface (h = 0)', () => {
    const horizon = footprintHorizonFromAltitude(0);
    expect(horizon.thetaRad).toBeCloseTo(0, 6);
    expect(horizon.baseRadiusScene).toBeCloseTo(0, 6);
  });

  it('clamps negative altitude to the surface case', () => {
    const horizon = footprintHorizonFromAltitude(-100);
    expect(horizon.thetaRad).toBeCloseTo(0, 6);
  });

  it('matches the elevation-mask-constrained Earth central angle formula', () => {
    // Reference values independently computed from
    // gamma = acos((R / (R + h)) * cos(15deg)) - 15deg
    const cases: Array<[number, number]> = [
      [400, 9.651261653165843],
      [526, 11.841443742677178],
      [8072, 49.78078154813801],
      [20200, 61.60855644322936],
      [35786, 66.60619432765591],
    ];

    for (const [altitudeKm, expectedThetaDeg] of cases) {
      const horizon = footprintHorizonFromAltitude(altitudeKm);
      expect(horizon.thetaRad * (180 / Math.PI)).toBeCloseTo(expectedThetaDeg, 6);
    }
  });

  it('is strictly smaller than the pure grazing horizon for h > 0 (regression guard)', () => {
    // This is the exact bug fixed for "LEO footprint looks disproportionately large":
    // a 0-elevation grazing horizon must never be used directly as the footprint angle.
    for (const altitudeKm of [400, 526, 2000, 8072, 20200, 35786]) {
      const horizon = footprintHorizonFromAltitude(altitudeKm);
      const grazingHorizonRad = Math.acos(
        EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm),
      );
      expect(horizon.thetaRad).toBeLessThan(grazingHorizonRad);
    }
  });

  it('grows monotonically with altitude (higher orbits sweep a wider footprint)', () => {
    const altitudes = [200, 400, 526, 2000, 8072, 20200, 35786, 40000];
    const thetas = altitudes.map((h) => footprintHorizonFromAltitude(h).thetaRad);
    for (let i = 1; i < thetas.length; i++) {
      expect(thetas[i]).toBeGreaterThan(thetas[i - 1]);
    }
  });

  it('scales the footprint proportionally with altitude — GEO spans much more than LEO', () => {
    const leo = footprintHorizonFromAltitude(526); // Starlink-class
    const geo = footprintHorizonFromAltitude(35786); // Turksat-class
    expect(geo.thetaRad / leo.thetaRad).toBeGreaterThan(3);
    // GEO must still sweep most of the visible hemisphere.
    expect(geo.thetaRad * (180 / Math.PI)).toBeGreaterThan(60);
    // LEO must stay local, not continent-spanning.
    expect(leo.thetaRad * (180 / Math.PI)).toBeLessThan(20);
  });

  it('never produces a base radius larger than the lifted surface radius', () => {
    for (const altitudeKm of [400, 8072, 35786, 100_000]) {
      const horizon = footprintHorizonFromAltitude(altitudeKm);
      expect(horizon.baseRadiusScene).toBeLessThanOrEqual(SURFACE_LIFT);
    }
  });
});

describe('footprintHorizonFromOrbitRadius', () => {
  it('returns zero footprint when the orbit radius is at or below the lifted surface', () => {
    const horizon = footprintHorizonFromOrbitRadius(SURFACE_LIFT);
    expect(horizon.thetaRad).toBeCloseTo(0, 6);
    expect(horizon.coneHeightScene).toBeCloseTo(0, 6);
  });

  it('produces a positive footprint and height above the surface', () => {
    const horizon = footprintHorizonFromOrbitRadius(1.5);
    expect(horizon.thetaRad).toBeGreaterThan(0);
    expect(horizon.baseRadiusScene).toBeGreaterThan(0);
    expect(horizon.coneHeightScene).toBeCloseTo(1.5 - SURFACE_LIFT, 10);
  });
});

describe('getSubSatelliteScenePoints', () => {
  it('returns null when the satellite position is at or inside the lifted surface', () => {
    expect(getSubSatelliteScenePoints({ x: 0, y: 0, z: 0 })).toBeNull();
  });

  it('places the nadir point exactly on the lifted surface, along the satellite direction', () => {
    const positionEci = { x: 0, y: 0, z: EARTH_RADIUS_KM * 2 }; // 1 Earth-radius altitude, on Z axis
    const subSat = getSubSatelliteScenePoints(positionEci, EARTH_RADIUS_KM);
    expect(subSat).not.toBeNull();
    if (!subSat) return;

    expect(sceneVectorLength(subSat.nadirWorld)).toBeCloseTo(SURFACE_LIFT, 10);

    // Nadir must be collinear with (and much closer than) the satellite position.
    const satLen = sceneVectorLength(subSat.satellite);
    const nadirLen = sceneVectorLength(subSat.nadirWorld);
    expect(nadirLen).toBeLessThan(satLen);
  });

  it('uses altitude-based horizon metrics when altitude is provided', () => {
    const positionEci = { x: EARTH_RADIUS_KM + 526, y: 0, z: 0 };
    const subSat = getSubSatelliteScenePoints(positionEci, 526);
    expect(subSat).not.toBeNull();
    const expected = footprintHorizonFromAltitude(526);
    expect(subSat?.thetaRad).toBeCloseTo(expected.thetaRad, 10);
  });
});
