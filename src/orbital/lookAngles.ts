/**
 * Ground-observer look angles for a selected satellite.
 *
 * Uses satellite.js SGP4 + ECF topocentric transforms so any catalog object
 * (ISS, Starlink, debris, …) can be aimed at from a phone GPS location.
 */

import {
  degreesToRadians,
  ecfToEci,
  ecfToLookAngles,
  eciToEcf,
  geodeticToEcf,
  gstime,
  propagate,
  type EciVec3,
  type SatRec,
} from 'satellite.js';

export interface ObserverLocation {
  /** Geodetic latitude, degrees (−90…+90). */
  latitudeDeg: number;
  /** Geodetic longitude, degrees (−180…+180). */
  longitudeDeg: number;
  /** Height above WGS84 ellipsoid, km (default 0). */
  altitudeKm?: number;
}

export interface LookAngles {
  /** Azimuth from true north, degrees clockwise (0 = N, 90 = E). */
  azimuthDeg: number;
  /** Elevation above local horizon, degrees (−90…+90). */
  elevationDeg: number;
  /** Slant range, km. */
  rangeKm: number;
  /** True when the satellite is above the geometric horizon. */
  visible: boolean;
}

export interface PassEvent {
  rise: { time: Date; azimuthDeg: number } | null;
  max: { time: Date; elevationDeg: number; azimuthDeg: number } | null;
  set: { time: Date; azimuthDeg: number } | null;
}

const DEG = 180 / Math.PI;
const VISIBLE_ELEV_DEG = 0;
/** Practical “worth aiming” threshold for photography guidance. */
export const GOOD_ELEV_DEG = 10;
const EARTH_RADIUS_KM = 6378.137;

function wrap360(deg: number): number {
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
}

/**
 * Signed turn from device heading to target azimuth, degrees in (−180, 180].
 * Positive = turn right (clockwise); negative = turn left.
 */
export function headingDelta(deviceHeadingDeg: number, targetAzimuthDeg: number): number {
  let d = wrap360(targetAzimuthDeg) - wrap360(deviceHeadingDeg);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function observerGd(observer: ObserverLocation) {
  return {
    latitude: degreesToRadians(observer.latitudeDeg),
    longitude: degreesToRadians(observer.longitudeDeg),
    height: observer.altitudeKm ?? 0,
  };
}

/**
 * Instantaneous look angles from an observer to a satellite at `date`.
 * Returns null if SGP4 fails (decayed / invalid epoch).
 */
export function computeLookAngles(
  satrec: SatRec,
  observer: ObserverLocation,
  date: Date,
): LookAngles | null {
  const result = propagate(satrec, date);
  if (!result?.position) return null;

  const position = result.position as EciVec3<number>;
  const gmst = gstime(date);
  const positionEcf = eciToEcf(position, gmst);
  const look = ecfToLookAngles(observerGd(observer), positionEcf);

  const elevationDeg = look.elevation * DEG;
  return {
    azimuthDeg: wrap360(look.azimuth * DEG),
    elevationDeg,
    rangeKm: look.rangeSat,
    visible: elevationDeg > VISIBLE_ELEV_DEG,
  };
}

/**
 * Coarse scan for the next rise / max elevation / set within `horizonHours`.
 * Step size trades accuracy for speed — fine enough for photographer guidance.
 */
export function findNextPass(
  satrec: SatRec,
  observer: ObserverLocation,
  start: Date,
  horizonHours = 6,
  stepSeconds = 45,
): PassEvent {
  const empty: PassEvent = { rise: null, max: null, set: null };
  const endMs = start.getTime() + horizonHours * 3_600_000;
  const stepMs = stepSeconds * 1000;

  let prev: LookAngles | null = null;
  let prevTime = start;
  let rise: PassEvent['rise'] = null;
  let max: PassEvent['max'] = null;
  let set: PassEvent['set'] = null;
  let tracking = false;

  for (let t = start.getTime(); t <= endMs; t += stepMs) {
    const time = new Date(t);
    const look = computeLookAngles(satrec, observer, time);
    if (!look) {
      prev = null;
      prevTime = time;
      continue;
    }

    if (prev && !tracking && prev.elevationDeg <= VISIBLE_ELEV_DEG && look.elevationDeg > VISIBLE_ELEV_DEG) {
      rise = { time, azimuthDeg: look.azimuthDeg };
      tracking = true;
      max = { time, elevationDeg: look.elevationDeg, azimuthDeg: look.azimuthDeg };
    }

    if (tracking) {
      if (!max || look.elevationDeg > max.elevationDeg) {
        max = { time, elevationDeg: look.elevationDeg, azimuthDeg: look.azimuthDeg };
      }
      if (prev && prev.elevationDeg > VISIBLE_ELEV_DEG && look.elevationDeg <= VISIBLE_ELEV_DEG) {
        set = { time: prevTime, azimuthDeg: prev.azimuthDeg };
        break;
      }
    }

    // Already up at scan start — treat as mid-pass.
    if (!tracking && look.elevationDeg > VISIBLE_ELEV_DEG && !rise) {
      tracking = true;
      max = { time, elevationDeg: look.elevationDeg, azimuthDeg: look.azimuthDeg };
    }

    prev = look;
    prevTime = time;
  }

  if (!tracking && !rise) return empty;
  return { rise, max, set };
}

/**
 * Rough photo-quality hint: satellite sunlit + observer in darkness.
 * Uses a simple umbra cylinder (Earth radius) in ECI — good enough for UI copy.
 */
export function assessPhotoConditions(
  satrec: SatRec,
  observer: ObserverLocation,
  date: Date,
  sunEciUnit: { x: number; y: number; z: number },
): { satelliteLit: boolean; observerDark: boolean; favorable: boolean } | null {
  const result = propagate(satrec, date);
  if (!result?.position) return null;
  const pos = result.position as EciVec3<number>;

  const satLit = isPositionSunlit(pos, sunEciUnit);
  const obsEci = observerToApproxEci(observer, date);
  const observerDark = !isPositionSunlit(obsEci, sunEciUnit, true);

  return {
    satelliteLit: satLit,
    observerDark,
    favorable: satLit && observerDark,
  };
}

function observerToApproxEci(observer: ObserverLocation, date: Date): { x: number; y: number; z: number } {
  const ecf = geodeticToEcf(observerGd(observer));
  return ecfToEci(ecf, gstime(date));
}

function isPositionSunlit(
  positionEci: { x: number; y: number; z: number },
  sunUnit: { x: number; y: number; z: number },
  treatAsSurface = false,
): boolean {
  const along = positionEci.x * sunUnit.x + positionEci.y * sunUnit.y + positionEci.z * sunUnit.z;
  if (along > 0) return true;
  const rx = positionEci.x - along * sunUnit.x;
  const ry = positionEci.y - along * sunUnit.y;
  const rz = positionEci.z - along * sunUnit.z;
  const radial = Math.sqrt(rx * rx + ry * ry + rz * rz);
  const limit = treatAsSurface ? EARTH_RADIUS_KM * 0.999 : EARTH_RADIUS_KM;
  return radial > limit;
}
