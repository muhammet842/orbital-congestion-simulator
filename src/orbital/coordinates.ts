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

/** GEO reference altitude for footprint scaling (km). */
const GEO_REFERENCE_ALTITUDE_KM = 35786;
/** Minimum geocentric angular radius on the unit sphere (~3.5°). */
const MIN_FOOTPRINT_ALPHA = 0.06;

/**
 * Geocentric angular radius (radians) of the coverage disc on the unit sphere.
 * LEO footprints stay small/local; MEO/GEO grow toward the horizon limit.
 */
export function footprintAngularRadiusFromAltitude(altitudeKm: number): number {
  const h = Math.max(0, altitudeKm);
  const maxHorizon = Math.acos(Math.min(1, EARTH_RADIUS_KM / (EARTH_RADIUS_KM + h)));
  const altitudeRatio = Math.min(1, h / GEO_REFERENCE_ALTITUDE_KM);
  const t = Math.pow(altitudeRatio, 0.55);
  return MIN_FOOTPRINT_ALPHA + t * (maxHorizon - MIN_FOOTPRINT_ALPHA);
}

export interface SubSatelliteScenePoints {
  satellite: { x: number; y: number; z: number };
  nadirWorld: { x: number; y: number; z: number };
  orbitRadiusScene: number;
  footprintRadiusScene: number;
  coneHeightScene: number;
}

/** Sub-satellite geometry in inertial scene space (Earth radius = 1). */
export function getSubSatelliteScenePoints(
  positionEci: { x: number; y: number; z: number },
  altitudeKm: number,
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

  return {
    satellite,
    nadirWorld,
    orbitRadiusScene,
    footprintRadiusScene: footprintAngularRadiusFromAltitude(altitudeKm),
    coneHeightScene: orbitRadiusScene - SURFACE_LIFT,
  };
}

export function sceneVectorLength(v: { x: number; y: number; z: number }): number {
  return Math.hypot(v.x, v.y, v.z);
}
