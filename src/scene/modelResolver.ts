import type { TrackedObject } from '../types';

/**
 * Logical model keys used for selected-object meshes.
 * Only keys in {@link BUNDLED_MODEL_KEYS} load a GLB from disk; others use
 * distinct procedural silhouettes in SatelliteModelLoader (intentional — keeps
 * the bundle small while preserving type readability).
 */
export const MODEL_ASSETS = {
  iss: '/models/iss.glb',
  cargo_capsule: '/models/cargo_capsule.glb',
  cubesat: '/models/cubesat.glb',
  sat_leo: '/models/sat_leo.glb',
  debris: '/models/debris.glb',
} as const;

export type ModelAssetKey = keyof typeof MODEL_ASSETS;

/** Keys that currently ship a real file under public/models/. */
export const BUNDLED_MODEL_KEYS: ReadonlySet<ModelAssetKey> = new Set(['sat_leo']);

export function resolveModelKey(obj: TrackedObject): ModelAssetKey {
  const name = obj.name.toUpperCase();

  if (
    obj.category === 'stations' ||
    name.includes('ISS') ||
    name.includes('CSS') ||
    name.includes('TIANGONG') ||
    name.includes('MIR')
  ) {
    return 'iss';
  }

  if (
    name.includes('PROGRESS') ||
    name.includes('CYGNUS') ||
    name.includes('DRAGON') ||
    name.includes('SOYUZ') ||
    name.includes('SHENZHOU') ||
    name.includes('TIANZHOU') ||
    name.includes('CARGO') ||
    name.includes('SUPPLY') ||
    name.includes('TRANSPORT')
  ) {
    return 'cargo_capsule';
  }

  if (name.includes('CUBESAT') || name.includes('CUBE SAT') || name.includes('CUBE-SAT')) {
    return 'cubesat';
  }

  if (obj.category === 'debris') {
    return 'debris';
  }

  return 'sat_leo';
}

export function modelPathForKey(key: ModelAssetKey): string | null {
  if (!BUNDLED_MODEL_KEYS.has(key)) return null;
  return MODEL_ASSETS[key];
}

export function isBundledModelKey(key: ModelAssetKey): boolean {
  return BUNDLED_MODEL_KEYS.has(key);
}
