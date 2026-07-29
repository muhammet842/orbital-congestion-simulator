/**
 * Geomagnetic declination (magnetic variation) via World Magnetic Model 2025–2030.
 *
 * Satellite look angles use true north. Phone compasses report magnetic north.
 * Declination (east-positive) converts between them:
 *   trueHeading = magneticHeading + declination
 */

import { magvar } from 'magvar';

/**
 * Magnetic declination at a WGS84 location, degrees.
 * Positive = magnetic north is east of true north (add to magnetic heading).
 */
export function magneticDeclinationDeg(
  latitudeDeg: number,
  longitudeDeg: number,
  altitudeKm = 0,
): number {
  if (!Number.isFinite(latitudeDeg) || !Number.isFinite(longitudeDeg)) return 0;
  const lat = Math.min(90, Math.max(-90, latitudeDeg));
  const lon = ((longitudeDeg + 180) % 360 + 360) % 360 - 180;
  const alt = Number.isFinite(altitudeKm) ? Math.max(0, altitudeKm) : 0;
  try {
    const dec = magvar(lat, lon, alt);
    return Number.isFinite(dec) ? dec : 0;
  } catch {
    return 0;
  }
}

/** Convert compass (magnetic) heading to true-north heading, degrees [0, 360). */
export function magneticToTrueHeadingDeg(
  magneticHeadingDeg: number,
  declinationDeg: number,
): number {
  return ((magneticHeadingDeg + declinationDeg) % 360 + 360) % 360;
}

/** True heading at a location from a magnetic compass reading. */
export function trueHeadingAtLocationDeg(
  magneticHeadingDeg: number,
  latitudeDeg: number,
  longitudeDeg: number,
  altitudeKm = 0,
): number {
  const dec = magneticDeclinationDeg(latitudeDeg, longitudeDeg, altitudeKm);
  return magneticToTrueHeadingDeg(magneticHeadingDeg, dec);
}
