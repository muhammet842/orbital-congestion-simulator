/**
 * Flat sky-map projection: phone heading/pitch as FOV center,
 * satellite az/el → canvas pixel offsets (equal-angle / “plate carrée” FOV).
 *
 * No stars — only used to place catalog satellites in a camera-less sky view.
 */

export const DEFAULT_FOV_DEG = 60;

export interface SkyViewCenter {
  headingDeg: number;
  pitchDeg: number;
}

export interface SkyAzEl {
  azimuthDeg: number;
  elevationDeg: number;
}

export interface SkyProjectResult {
  /** Pixel X from left (0…width). */
  x: number;
  /** Pixel Y from top (0…height). */
  y: number;
  /** True when inside the rectangular FOV (±fov/2 in both axes). */
  inView: boolean;
  /** Signed azimuth offset from view center, degrees (−180…180]. */
  dAzDeg: number;
  /** Elevation minus phone pitch, degrees. */
  dElDeg: number;
}

function wrap360(deg: number): number {
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
}

/** Shortest signed azimuth delta in (−180, 180]. */
export function signedAzimuthDeltaDeg(fromDeg: number, toDeg: number): number {
  let d = wrap360(toDeg) - wrap360(fromDeg);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Project a sky direction into a canvas centered on the phone look direction.
 * +x = right of facing, +y = down on screen (lower elevation / tip phone down).
 */
export function projectAzElToCanvas(
  view: SkyViewCenter,
  target: SkyAzEl,
  width: number,
  height: number,
  fovDeg = DEFAULT_FOV_DEG,
): SkyProjectResult {
  const dAzDeg = signedAzimuthDeltaDeg(view.headingDeg, target.azimuthDeg);
  const dElDeg = target.elevationDeg - view.pitchDeg;
  const halfFov = fovDeg / 2;
  const pxPerDegX = width / fovDeg;
  const pxPerDegY = height / fovDeg;

  const x = width / 2 + dAzDeg * pxPerDegX;
  const y = height / 2 - dElDeg * pxPerDegY;
  const inView =
    Math.abs(dAzDeg) <= halfFov &&
    Math.abs(dElDeg) <= halfFov &&
    x >= 0 &&
    x <= width &&
    y >= 0 &&
    y <= height;

  return { x, y, inView, dAzDeg, dElDeg };
}

/** Angular distance from FOV center used for ranking candidates (degrees). */
export function skyFovCenterDistanceDeg(view: SkyViewCenter, target: SkyAzEl): number {
  const dAz = signedAzimuthDeltaDeg(view.headingDeg, target.azimuthDeg);
  const dEl = target.elevationDeg - view.pitchDeg;
  // Small-angle chord; good enough for ranking within ~60° FOV.
  return Math.hypot(dAz, dEl);
}

/**
 * Horizon line Y in canvas pixels for the current pitch
 * (elevation 0 relative to phone pitch).
 */
export function horizonYForPitch(pitchDeg: number, height: number, fovDeg = DEFAULT_FOV_DEG): number {
  const dEl = 0 - pitchDeg;
  return height / 2 - dEl * (height / fovDeg);
}

/** Cardinal label azimuths (true north = 0). */
export const CARDINAL_AZIMUTHS: ReadonlyArray<{ az: number; key: 'N' | 'E' | 'S' | 'W' }> = [
  { az: 0, key: 'N' },
  { az: 90, key: 'E' },
  { az: 180, key: 'S' },
  { az: 270, key: 'W' },
];
