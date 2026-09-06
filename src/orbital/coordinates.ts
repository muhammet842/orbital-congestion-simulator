import { EARTH_RADIUS_KM, ORBIT_DISPLAY_SCALE } from '../types';

export function eciToScene(
  x: number,
  y: number,
  z: number,
): { x: number; y: number; z: number } {
  return {
    x: x * ORBIT_DISPLAY_SCALE,
    y: z * ORBIT_DISPLAY_SCALE,
    z: -y * ORBIT_DISPLAY_SCALE,
  };
}

export function eciVectorToScene(
  x: number,
  y: number,
  z: number,
): { x: number; y: number; z: number } {
  return {
    x: x * ORBIT_DISPLAY_SCALE,
    y: z * ORBIT_DISPLAY_SCALE,
    z: -y * ORBIT_DISPLAY_SCALE,
  };
}

export const SURFACE_LIFT = 1.001;

const DEG = Math.PI / 180;

const MIN_ELEVATION_RAD = 15 * DEG;

export interface FootprintHorizonMetrics {
  
  thetaRad: number;
  
  coneHeightScene: number;
  
  baseRadiusScene: number;
  orbitRadiusScene: number;
}

function earthCentralAngleRad(radiusRatio: number): number {
  const cosArg = Math.min(1, Math.max(-1, radiusRatio * Math.cos(MIN_ELEVATION_RAD)));
  return Math.max(0, Math.acos(cosArg) - MIN_ELEVATION_RAD);
}

function buildHorizonMetrics(orbitRadiusScene: number, radiusRatio: number): FootprintHorizonMetrics {
  const thetaRad = earthCentralAngleRad(radiusRatio);
  const coneHeightScene = orbitRadiusScene - SURFACE_LIFT;
  const baseRadiusScene = SURFACE_LIFT * Math.sin(thetaRad);
  return { thetaRad, coneHeightScene, baseRadiusScene, orbitRadiusScene };
}

export function footprintHorizonFromAltitude(altitudeKm: number): FootprintHorizonMetrics {
  const h = Math.max(0, altitudeKm);
  const orbitRadiusScene = 1 + h / EARTH_RADIUS_KM;
  const radiusRatio = EARTH_RADIUS_KM / (EARTH_RADIUS_KM + h);
  return buildHorizonMetrics(orbitRadiusScene, radiusRatio);
}

export function footprintHorizonFromOrbitRadius(orbitRadiusScene: number): FootprintHorizonMetrics {
  const r = Math.max(SURFACE_LIFT, orbitRadiusScene);
  const radiusRatio = SURFACE_LIFT / r;
  return buildHorizonMetrics(r, radiusRatio);
}

export interface SubSatelliteScenePoints {
  satellite: { x: number; y: number; z: number };
  nadirWorld: { x: number; y: number; z: number };
  orbitRadiusScene: number;
  thetaRad: number;
  baseRadiusScene: number;
  coneHeightScene: number;
}

export function getSubSatelliteScenePoints(
  positionEci: { x: number; y: number; z: number },
  altitudeKm?: number,
): SubSatelliteScenePoints | null {
  const satellite = eciToScene(positionEci.x, positionEci.y, positionEci.z);
  const orbitRadiusScene = Math.hypot(satellite.x, satellite.y, satellite.z);
  if (orbitRadiusScene <= SURFACE_LIFT) return null;

  const scale = SURFACE_LIFT / orbitRadiusScene;
  const nadirWorld = {
    x: satellite.x * scale,
    y: satellite.y * scale,
    z: satellite.z * scale,
  };

  const horizon =
    altitudeKm != null && Number.isFinite(altitudeKm)
      ? footprintHorizonFromAltitude(altitudeKm)
      : footprintHorizonFromOrbitRadius(orbitRadiusScene);

  return {
    satellite,
    nadirWorld,
    orbitRadiusScene,
    thetaRad: horizon.thetaRad,
    baseRadiusScene: horizon.baseRadiusScene,
    coneHeightScene: horizon.coneHeightScene,
  };
}

export function sceneVectorLength(v: { x: number; y: number; z: number }): number {
  return Math.hypot(v.x, v.y, v.z);
}
