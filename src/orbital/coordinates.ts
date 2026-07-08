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

const DEG = Math.PI / 180;

/**
 * Minimum usable elevation angle above the local horizon (typical VSAT/ground-station
 * mask). A pure θ = arccos(R/(R+h)) horizon is the *grazing* line of sight — it makes
 * even a 500 km LEO satellite's footprint sweep ~2,500 km across the ground, which reads
 * as disproportionately large. Requiring a minimum elevation shrinks low orbits sharply
 * (they are close to Earth, so the horizon angle is very sensitive to the mask) while
 * leaving high orbits (GEO) still spanning most of the visible hemisphere.
 */
const MIN_ELEVATION_RAD = 15 * DEG;

export interface FootprintHorizonMetrics {
  /** Geocentric half-angle (rad) of the coverage footprint, elevation-mask constrained. */
  thetaRad: number;
  /** Satellite altitude above the lifted surface (scene units). */
  coneHeightScene: number;
  /** Radius of the footprint edge circle on the sphere (scene units): R · sin(θ). */
  baseRadiusScene: number;
  orbitRadiusScene: number;
}

/**
 * Earth central angle (rad) for a ground point at the minimum elevation mask:
 * γ = arccos((R / (R + h)) · cos(ε)) − ε
 * At ε = 0 this reduces to the pure grazing horizon; ε > 0 trims the footprint to a
 * realistic coverage cone that scales proportionally with altitude.
 */
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

/** Horizon metrics from altitude in km (SGP4 geodetic height). */
export function footprintHorizonFromAltitude(altitudeKm: number): FootprintHorizonMetrics {
  const h = Math.max(0, altitudeKm);
  const orbitRadiusScene = 1 + h / EARTH_RADIUS_KM;
  const radiusRatio = EARTH_RADIUS_KM / (EARTH_RADIUS_KM + h);
  return buildHorizonMetrics(orbitRadiusScene, radiusRatio);
}

/** Horizon metrics from propagated scene position (keeps ECI geometry self-consistent). */
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
