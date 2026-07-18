export type OrbitLayer = 'LEO' | 'MEO' | 'GEO' | 'HEO';
export type ObjectCategory = 'stations' | 'active' | 'debris';

/** Visual grouping for color-by-function mode (derived from TLE name + category). */
export type ObjectFunctionGroup = 'starlink' | 'debris' | 'station' | 'active';

export interface TleRecord {
  noradId: number;
  name: string;
  line1: string;
  line2: string;
  category: ObjectCategory;
  country?: string;
  owner?: string;
}

export interface TleDataset {
  fetchedAt: string;
  source: string;
  count: number;
  objects: TleRecord[];
}

export interface TrackedObject extends TleRecord {
  country: string;
  owner: string;
  satrec: import('satellite.js').SatRec;
  layer: OrbitLayer;
  color: [number, number, number];
  functionGroup: ObjectFunctionGroup;
  /** Mean orbital altitude in km, derived from TLE mean motion (fast, no propagation). */
  meanAltitudeKm: number;
  /** Orbital inclination in degrees from TLE. */
  inclinationDeg: number;
}

export interface ObjectSnapshot {
  noradId: number;
  name: string;
  altitudeKm: number;
  velocityKmS: number;
  layer: OrbitLayer;
  category: ObjectCategory;
  country: string;
  owner: string;
  inclinationDeg: number;
  positionEci: { x: number; y: number; z: number };
}

export interface ConjunctionEvent {
  objectA: string;
  objectB: string;
  indexA: number;
  indexB: number;
  distanceKm: number;
  relativeVelocityKmS: number;
  time: Date;
  midpointScene: { x: number; y: number; z: number };
}

export type TimeMode = 'live' | 'historical';

export interface TimeState {
  mode: TimeMode;
  current: Date;
  speed: number;
  playing: boolean;
}

export interface AppStats {
  total: number;
  leoPercent: number;
  avgAltitude: number;
  categoryCounts: Record<ObjectCategory, number>;
  fetchedAt: string;
}

export const LAYER_COLORS: Record<OrbitLayer, [number, number, number]> = {
  LEO: [0.133, 0.827, 0.933],
  MEO: [0.98, 0.8, 0.082],
  GEO: [0.984, 0.573, 0.235],
  HEO: [0.655, 0.545, 0.98],
};

export const LAYER_HEX: Record<OrbitLayer, string> = {
  LEO: '#22d3ee',
  MEO: '#facc15',
  GEO: '#fb923c',
  HEO: '#a78bfa',
};

export const EARTH_RADIUS_KM = 6371;
export const ORBIT_DISPLAY_SCALE = 1 / EARTH_RADIUS_KM;
