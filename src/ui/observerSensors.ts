/**
 * Live GPS + device-compass sensors for the satellite spotter.
 *
 * Location is persisted so a denied permission still allows manual lat/lon.
 * Compass uses DeviceOrientationEvent (iOS requires an explicit permission grant).
 */

import type { ObserverLocation } from '../orbital/lookAngles';

const LS_LOCATION_KEY = 'orbital-spotter-location';

/** Near ±90° beta the Euler frame hits gimbal lock — freeze last stable heading. */
const GIMBAL_LOCK_BETA_DEG = 85;

export interface SensorSnapshot {
  location: ObserverLocation | null;
  locationSource: 'gps' | 'manual' | 'cached' | null;
  locationError: string | null;
  /** True north heading in degrees, or null if unavailable. */
  headingDeg: number | null;
  headingError: string | null;
  orientationPermission: 'unknown' | 'granted' | 'denied' | 'unsupported';
}

type Listener = (snap: SensorSnapshot) => void;

let watchId: number | null = null;
let orientationBound = false;
let listeners = new Set<Listener>();
/** Last heading accepted outside gimbal lock (looking straight up). */
let lastStableHeadingDeg: number | null = null;
/** Prefer absolute events when the browser provides them (Android). */
let preferAbsoluteHeading = false;

let snapshot: SensorSnapshot = {
  location: loadCachedLocation(),
  locationSource: loadCachedLocation() ? 'cached' : null,
  locationError: null,
  headingDeg: null,
  headingError: null,
  orientationPermission: 'unknown',
};

function loadCachedLocation(): ObserverLocation | null {
  try {
    const raw = localStorage.getItem(LS_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ObserverLocation;
    if (
      typeof parsed.latitudeDeg === 'number' &&
      typeof parsed.longitudeDeg === 'number' &&
      Number.isFinite(parsed.latitudeDeg) &&
      Number.isFinite(parsed.longitudeDeg)
    ) {
      return {
        latitudeDeg: parsed.latitudeDeg,
        longitudeDeg: parsed.longitudeDeg,
        altitudeKm: typeof parsed.altitudeKm === 'number' ? parsed.altitudeKm : 0,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function persistLocation(loc: ObserverLocation): void {
  try {
    localStorage.setItem(LS_LOCATION_KEY, JSON.stringify(loc));
  } catch {
    /* ignore */
  }
}

function emit(): void {
  for (const fn of listeners) fn({ ...snapshot, location: snapshot.location ? { ...snapshot.location } : null });
}

function setPartial(partial: Partial<SensorSnapshot>): void {
  snapshot = { ...snapshot, ...partial };
  emit();
}

export function getSensorSnapshot(): SensorSnapshot {
  return { ...snapshot, location: snapshot.location ? { ...snapshot.location } : null };
}

export function subscribeSensors(fn: Listener): () => void {
  listeners.add(fn);
  fn(getSensorSnapshot());
  return () => {
    listeners.delete(fn);
  };
}

export function setManualLocation(loc: ObserverLocation): void {
  const next = {
    latitudeDeg: clamp(loc.latitudeDeg, -90, 90),
    longitudeDeg: clamp(loc.longitudeDeg, -180, 180),
    altitudeKm: loc.altitudeKm ?? 0,
  };
  persistLocation(next);
  setPartial({ location: next, locationSource: 'manual', locationError: null });
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Compass heading (degrees from true/magnetic north) that stays stable when the
 * phone is tilted to look at the sky — unlike raw `360 - alpha`, which flips
 * around β ≈ ±90° (gimbal lock).
 *
 * Based on the W3C / Opera deviceorientation compass derivation.
 */
export function compassHeadingFromEuler(alpha: number, beta: number, gamma: number): number {
  const toRad = Math.PI / 180;
  const x = beta * toRad;
  const y = gamma * toRad;
  const z = alpha * toRad;

  const cY = Math.cos(y);
  const cZ = Math.cos(z);
  const sX = Math.sin(x);
  const sY = Math.sin(y);
  const sZ = Math.sin(z);

  const Vx = -cZ * sY - sZ * sX * cY;
  const Vy = -sZ * sY + cZ * sX * cY;

  return wrap360(Math.atan2(Vx, Vy) * (180 / Math.PI));
}

function screenOrientationOffsetDeg(): number {
  if (typeof window === 'undefined') return 0;
  const so = window.screen?.orientation?.angle;
  if (typeof so === 'number' && Number.isFinite(so)) return so;
  const legacy = (window as Window & { orientation?: number }).orientation;
  if (typeof legacy === 'number' && Number.isFinite(legacy)) return legacy;
  return 0;
}

/**
 * Extract compass heading (degrees from north) from a DeviceOrientation event.
 * Prefers iOS webkitCompassHeading; otherwise uses alpha/beta/gamma so looking
 * up past ~90° does not invert the dial.
 */
export function headingFromOrientationEvent(event: DeviceOrientationEvent): number | null {
  const beta = typeof event.beta === 'number' && Number.isFinite(event.beta) ? event.beta : null;

  // Near zenith pointing, Euler angles are singular — keep last stable heading.
  if (beta != null && Math.abs(beta) >= GIMBAL_LOCK_BETA_DEG) {
    return lastStableHeadingDeg;
  }

  const webkit = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
  if (typeof webkit === 'number' && Number.isFinite(webkit)) {
    // iOS heading is relative to the top of the device; compensate screen rotation.
    const heading = wrap360(webkit - screenOrientationOffsetDeg());
    lastStableHeadingDeg = heading;
    return heading;
  }

  if (typeof event.alpha !== 'number' || !Number.isFinite(event.alpha)) return null;

  const gamma = typeof event.gamma === 'number' && Number.isFinite(event.gamma) ? event.gamma : 0;
  const b = beta ?? 0;
  // Prefer tilt-aware Euler heading when beta/gamma exist; raw 360-alpha flips at 90°.
  const heading =
    beta != null
      ? compassHeadingFromEuler(event.alpha, b, gamma)
      : wrap360(360 - event.alpha);

  lastStableHeadingDeg = heading;
  return heading;
}

export function startGeolocation(): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    setPartial({ locationError: 'unsupported' });
    return;
  }
  if (watchId != null) return;

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const next: ObserverLocation = {
        latitudeDeg: pos.coords.latitude,
        longitudeDeg: pos.coords.longitude,
        altitudeKm: (pos.coords.altitude ?? 0) / 1000,
      };
      persistLocation(next);
      setPartial({
        location: next,
        locationSource: 'gps',
        locationError: null,
      });
    },
    (err) => {
      const code =
        err.code === err.PERMISSION_DENIED
          ? 'denied'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'unavailable'
            : 'timeout';
      setPartial({ locationError: code });
    },
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
  );
}

export function stopGeolocation(): void {
  if (watchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

function onOrientationAbsolute(event: DeviceOrientationEvent): void {
  preferAbsoluteHeading = true;
  onOrientation(event);
}

function onOrientationRelative(event: DeviceOrientationEvent): void {
  // Ignore relative alpha once absolute stream is available — it flips at tilt.
  if (preferAbsoluteHeading) return;
  onOrientation(event);
}

function onOrientation(event: DeviceOrientationEvent): void {
  const heading = headingFromOrientationEvent(event);
  if (heading == null) {
    setPartial({ headingError: 'unavailable' });
    return;
  }
  setPartial({
    headingDeg: heading,
    headingError: null,
    orientationPermission: 'granted',
  });
}

export async function startOrientation(): Promise<void> {
  if (typeof window === 'undefined') {
    setPartial({ orientationPermission: 'unsupported', headingError: 'unsupported' });
    return;
  }

  const DOE = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };

  if (typeof DOE.requestPermission === 'function') {
    try {
      const result = await DOE.requestPermission();
      if (result !== 'granted') {
        setPartial({ orientationPermission: 'denied', headingError: 'denied' });
        return;
      }
      setPartial({ orientationPermission: 'granted' });
    } catch {
      setPartial({ orientationPermission: 'denied', headingError: 'denied' });
      return;
    }
  } else if (!('DeviceOrientationEvent' in window)) {
    setPartial({ orientationPermission: 'unsupported', headingError: 'unsupported' });
    return;
  } else {
    setPartial({ orientationPermission: 'granted' });
  }

  if (!orientationBound) {
    // Absolute heading when the browser provides it (Android Chrome).
    window.addEventListener('deviceorientationabsolute', onOrientationAbsolute as EventListener, true);
    window.addEventListener('deviceorientation', onOrientationRelative, true);
    orientationBound = true;
  }
}

export function stopOrientation(): void {
  if (orientationBound) {
    window.removeEventListener('deviceorientationabsolute', onOrientationAbsolute as EventListener, true);
    window.removeEventListener('deviceorientation', onOrientationRelative, true);
    orientationBound = false;
  }
  lastStableHeadingDeg = null;
  preferAbsoluteHeading = false;
}

/** Start both sensors (call when Spotter opens). */
export function startObserverSensors(): void {
  startGeolocation();
  void startOrientation();
}

/** Tear down watches (call when Spotter closes). */
export function stopObserverSensors(): void {
  stopGeolocation();
  stopOrientation();
}
