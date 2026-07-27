import { describe, expect, it } from 'vitest';
import type { TrackedObject } from '../types';
import { resolveObjectPhoto } from './objectPhotos';

function obj(partial: Partial<TrackedObject> & Pick<TrackedObject, 'noradId' | 'name'>): TrackedObject {
  return {
    category: 'active',
    line1: '',
    line2: '',
    ...partial,
  } as TrackedObject;
}

describe('resolveObjectPhoto', () => {
  it('hides photos for debris', () => {
    expect(resolveObjectPhoto(obj({ noradId: 1, name: 'DEB', category: 'debris' }))).toBeNull();
  });

  it('uses curated NORAD photos for known craft', () => {
    const iss = resolveObjectPhoto(obj({ noradId: 25544, name: 'ISS (ZARYA)', category: 'stations' }));
    expect(iss?.url).toContain('The_station_pictured');
  });

  it('uses Starlink render for Starlink constellation names', () => {
    const photo = resolveObjectPhoto(obj({ noradId: 44713, name: 'STARLINK-1007' }));
    expect(photo?.url).toContain('Starlink_01');
  });

  it('does not assign another satellite photo to unknown active objects', () => {
    const photo = resolveObjectPhoto(obj({ noradId: 18362, name: 'OSCAR 29 (UOSAT 5)' }));
    expect(photo?.url).toBe('/images/satellite-fallback.svg');
    expect(photo?.credit).toMatch(/generic/i);
  });

  it('does not show ISS photo just because category is stations', () => {
    const photo = resolveObjectPhoto(obj({ noradId: 99999, name: 'UNKNOWN STATION', category: 'stations' }));
    expect(photo?.url).toBe('/images/satellite-fallback.svg');
  });
});
