/** Turkey uses permanent UTC+3 (no DST) — display helper only. */
export const TURKEY_UTC_OFFSET_HOURS = 3;

const SUN_DISTANCE = 15;
/** Blue Marble on Three.js SphereGeometry — prime meridian subsolar at ~12:00 UTC. */
const EARTH_TEXTURE_OFFSET = Math.PI;

export interface DayNightState {
  earthRotationY: number;
  sunPosition: { x: number; y: number; z: number };
  /** Normalized sun direction from Earth center (for night-side emissive masking). */
  sunDirection: { x: number; y: number; z: number };
  utcDecimalHours: number;
}

function getUtcDecimalHours(date: Date): number {
  return (
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    date.getUTCMilliseconds() / 3_600_000
  );
}

function toJulianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

/** Solar declination (radians) — simplified mean-sun model. */
function getSunDeclinationRad(date: Date): number {
  const jd = toJulianDate(date);
  const n = jd - 2_451_545.0;
  const meanLongitudeDeg = (280.46 + 0.9856474 * n) % 360;
  const meanAnomalyRad = ((357.528 + 0.9856003 * n) % 360) * (Math.PI / 180);
  const eclipticLongitudeRad =
    (meanLongitudeDeg + 1.915 * Math.sin(meanAnomalyRad) + 0.02 * Math.sin(2 * meanAnomalyRad)) *
    (Math.PI / 180);
  const obliquityRad = (23.439 - 0.0000004 * n) * (Math.PI / 180);
  return Math.asin(Math.sin(obliquityRad) * Math.sin(eclipticLongitudeRad));
}

/**
 * Greenwich Mean Sidereal Time (radians) — IAU 1982 / Meeus low-precision
 * formula, driven by the full Julian date (not just time-of-day).
 *
 * This is the piece that was previously missing: a solar day (24h, what
 * `utcDecimalHours` tracks) and a sidereal day (Earth's true rotation
 * period relative to the stars, ~23h56m4s) differ by ~3m56s. Computing the
 * spin angle from `(utcDecimalHours / 24)` resets to the *same* angle every
 * UTC midnight regardless of the date, silently discarding that drift.
 * Since satellite ECI/TEME positions from SGP4 live in the true inertial
 * frame, any days-long accumulated offset here shows up as the visible
 * globe (continents) rotating out of sync with real satellite longitudes —
 * a GEO satellite parked over a fixed real-world longitude will appear to
 * have drifted to a completely different part of the globe.
 */
function getGmstRad(date: Date): number {
  const jd = toJulianDate(date);
  const daysSinceJ2000 = jd - 2_451_545.0;
  const centuriesSinceJ2000 = daysSinceJ2000 / 36525;

  let gmstDeg =
    280.46061837 +
    360.98564736629 * daysSinceJ2000 +
    0.000387933 * centuriesSinceJ2000 * centuriesSinceJ2000 -
    (centuriesSinceJ2000 * centuriesSinceJ2000 * centuriesSinceJ2000) / 38_710_000;

  gmstDeg = ((gmstDeg % 360) + 360) % 360;
  return gmstDeg * (Math.PI / 180);
}

/**
 * UTC-accurate day/night: Earth spins with simulated UTC; sun stays in inertial space
 * (seasonal declination only). Do not rotate sun with Earth — that cancels the terminator.
 */
export function getDayNightState(date: Date): DayNightState {
  const utcDecimalHours = getUtcDecimalHours(date);
  const declination = getSunDeclinationRad(date);

  const earthRotationY = getGmstRad(date) + EARTH_TEXTURE_OFFSET;

  const cosDec = Math.cos(declination);
  const sinDec = Math.sin(declination);
  const sunPosition = {
    x: cosDec * SUN_DISTANCE,
    y: sinDec * SUN_DISTANCE,
    z: 0,
  };

  return {
    earthRotationY,
    sunPosition,
    sunDirection: { x: cosDec, y: sinDec, z: 0 },
    utcDecimalHours,
  };
}

export function getTurkeyDecimalHours(date: Date): number {
  const shifted = date.getTime() + TURKEY_UTC_OFFSET_HOURS * 3_600_000;
  const d = new Date(shifted);
  return (
    d.getUTCHours() +
    d.getUTCMinutes() / 60 +
    d.getUTCSeconds() / 3600 +
    d.getUTCMilliseconds() / 3_600_000
  );
}

export function formatTurkeyTime(date: Date): string {
  const h = getTurkeyDecimalHours(date);
  const hours = Math.floor(h);
  const minutes = Math.floor((h - hours) * 60);
  const seconds = Math.floor(((h - hours) * 60 - minutes) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} TRT (UTC+3)`;
}
