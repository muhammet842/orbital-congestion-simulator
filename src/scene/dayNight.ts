
export const TURKEY_UTC_OFFSET_HOURS = 3;

const SUN_DISTANCE = 15;

export interface DayNightState {
  earthRotationY: number;
  sunPosition: { x: number; y: number; z: number };
  
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

export function getSunEci(date: Date): { x: number; y: number; z: number } {
  const jd = toJulianDate(date);
  const n = jd - 2_451_545.0;
  const meanLongitudeDeg = (280.46 + 0.9856474 * n) % 360;
  const meanAnomalyRad = ((357.528 + 0.9856003 * n) % 360) * (Math.PI / 180);
  const lambdaRad =
    (meanLongitudeDeg + 1.915 * Math.sin(meanAnomalyRad) + 0.02 * Math.sin(2 * meanAnomalyRad)) *
    (Math.PI / 180);
  const obliquityRad = (23.439 - 0.0000004 * n) * (Math.PI / 180);
  const sinLambda = Math.sin(lambdaRad);
  const cosLambda = Math.cos(lambdaRad);
  const cosObl = Math.cos(obliquityRad);
  const sinObl = Math.sin(obliquityRad);
  
  return {
    x: cosLambda,
    y: cosObl * sinLambda,
    z: sinObl * sinLambda,
  };
}

export function getGmstRad(date: Date): number {
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

export function getDayNightState(date: Date): DayNightState {
  const utcDecimalHours = getUtcDecimalHours(date);

  
  
  
  
  const earthRotationY = getGmstRad(date);

  
  
  const sunEci = getSunEci(date);
  const sunScene = {
    x: sunEci.x,
    y: sunEci.z,   
    z: -sunEci.y,  
  };
  const sunPosition = {
    x: sunScene.x * SUN_DISTANCE,
    y: sunScene.y * SUN_DISTANCE,
    z: sunScene.z * SUN_DISTANCE,
  };

  return {
    earthRotationY,
    sunPosition,
    sunDirection: sunScene,
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
