import { describe, expect, it } from 'vitest';
import {
  BUNDLED_MODEL_KEYS,
  isBundledModelKey,
  modelPathForKey,
  resolveModelKey,
} from './modelResolver';
import type { TrackedObject } from '../types';

function makeObj(partial: Partial<TrackedObject> & Pick<TrackedObject, 'name' | 'category'>): TrackedObject {
  return {
    noradId: 1,
    line1: '',
    line2: '',
    country: 'Unknown',
    owner: 'Unknown',
    satrec: {} as never,
    layer: 'LEO',
    color: [1, 1, 1],
    functionGroup: 'active',
    meanAltitudeKm: 400,
    inclinationDeg: 51,
    ...partial,
  };
}

describe('resolveModelKey', () => {
  it('maps stations / ISS names to iss', () => {
    expect(resolveModelKey(makeObj({ name: 'ISS (ZARYA)', category: 'stations' }))).toBe('iss');
    expect(resolveModelKey(makeObj({ name: 'CSS (TIANHE)', category: 'active' }))).toBe('iss');
  });

  it('maps cargo craft names to cargo_capsule', () => {
    expect(resolveModelKey(makeObj({ name: 'PROGRESS-MS 20', category: 'active' }))).toBe('cargo_capsule');
    expect(resolveModelKey(makeObj({ name: 'CYGNUS NG-20', category: 'active' }))).toBe('cargo_capsule');
  });

  it('maps cubesat names to cubesat', () => {
    expect(resolveModelKey(makeObj({ name: 'CUBESAT DEMO', category: 'active' }))).toBe('cubesat');
  });

  it('maps debris category to debris', () => {
    expect(resolveModelKey(makeObj({ name: 'UNKNOWN', category: 'debris' }))).toBe('debris');
  });

  it('defaults other actives to sat_leo', () => {
    expect(resolveModelKey(makeObj({ name: 'STARLINK-1234', category: 'active' }))).toBe('sat_leo');
  });
});

describe('bundled model paths', () => {
  it('only sat_leo is bundled today', () => {
    expect([...BUNDLED_MODEL_KEYS]).toEqual(['sat_leo']);
    expect(isBundledModelKey('sat_leo')).toBe(true);
    expect(isBundledModelKey('iss')).toBe(false);
    expect(modelPathForKey('sat_leo')).toBe('/models/sat_leo.glb');
    expect(modelPathForKey('debris')).toBeNull();
  });
});
