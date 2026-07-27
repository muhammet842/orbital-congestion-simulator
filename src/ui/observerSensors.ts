/**
 * Live GPS + device-compass sensors for the satellite spotter.
 *
 * Location is persisted so a denied permission still allows manual lat/lon.
 * Compass uses DeviceOrientationEvent (iOS requires an explicit permission grant).
 */

import type { ObserverLocation } from '../orbital/lookAngles';

const LS_LOCATION_KEY = 'orbital-spotter-location';

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

/**
 * Extract compass heading (degrees from true north) from a DeviceOrientation event.
 * Prefers webkitCompassHeading (iOS); falls back to absolute alpha.
 */
export function headingFromOrientationEvent(event: DeviceOrientationEvent): number | null {
  const webkit = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
  if (typeof webkit === 'number' && Number.isFinite(webkit)) {
    return ((webkit % 360) + 360) % 360;
  }
  if (typeof event.alpha !== 'number' || !Number.isFinite(event.alpha)) return null;
  // When absolute is true, alpha is degrees from north (CW when looking down — invert).
  return ((360 - event.alpha) % 360 + 360) % 360;
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
    window.addEventListener('deviceorientation', onOrientation, true);
    orientationBound = true;
  }
}

export function stopOrientation(): void {
  if (orientationBound) {
    window.removeEventListener('deviceorientation', onOrientation, true);
    orientationBound = false;
  }
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
