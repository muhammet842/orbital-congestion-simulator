import { EARTH_RADIUS_KM, ORBIT_DISPLAY_SCALE } from '../types';

/** Map ECI position (km) to Three.js Y-up scene coordinates (Earth radius = 1 unit). */
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

/** Map ECI velocity (km/s) to scene-space direction (same axis swap as position). */
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

export interface FootprintHorizonMetrics {
  /** Geocentric half-angle (rad) to the line-of-sight horizon: θ = arccos(R / (R + h)). */
  thetaRad: number;
  /** Satellite altitude above the lifted surface (scene units). */
  coneHeightScene: number;
  /** Radius of the horizon circle on the sphere (scene units): R · sin(θ). */
  baseRadiusScene: number;
  orbitRadiusScene: number;
}

/** Horizon metrics from altitude in km (SGP4 geodetic height). */
export function footprintHorizonFromAltitude(altitudeKm: number): FootprintHorizonMetrics {
  const h = Math.max(0, altitudeKm);
  const orbitRadiusScene = 1 + h / EARTH_RADIUS_KM;
  const thetaRad = Math.acos(Math.min(1, EARTH_RADIUS_KM / (EARTH_RADIUS_KM + h)));
  const coneHeightScene = orbitRadiusScene - SURFACE_LIFT;
  const baseRadiusScene = SURFACE_LIFT * Math.sin(thetaRad);
  return { thetaRad, coneHeightScene, baseRadiusScene, orbitRadiusScene };
}

/** Horizon metrics from propagated scene position (keeps ECI geometry self-consistent). */
export function footprintHorizonFromOrbitRadius(orbitRadiusScene: number): FootprintHorizonMetrics {
  const r = Math.max(SURFACE_LIFT, orbitRadiusScene);
  const thetaRad = Math.acos(Math.min(1, SURFACE_LIFT / r));
  const coneHeightScene = r - SURFACE_LIFT;
  const baseRadiusScene = SURFACE_LIFT * Math.sin(thetaRad);
  return { thetaRad, coneHeightScene, baseRadiusScene, orbitRadiusScene: r };
}

export interface SubSatelliteScenePoints {
  satellite: { x: number; y: number; z: number };
  nadirWorld: { x: number; y: number; z: number };
  orbitRadiusScene: number;
  thetaRad: number;
  baseRadiusScene: number;
  coneHeightScene: number;
}

/** Sub-satellite geometry in inertial scene space (Earth radius = 1). */
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
