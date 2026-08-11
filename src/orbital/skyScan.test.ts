import { describe, expect, it } from 'vitest';
import { twoline2satrec } from 'satellite.js';
import { scanSkyCandidates } from './skyScan';

/** ISS TLE near a known epoch — used only for elev filter shape, not absolute sky. */
function issObject() {
  const satrec = twoline2satrec(
    '1 25544U 98067A   19156.50900463  .00003075  00000-0  59442-4 0  9992',
    '2 25544  51.6433  59.2583 0008217  16.4489 347.6017 15.51174618173442',
  );
  return {
    noradId: 25544,
    name: 'ISS (ZARYA)',
    satrec,
    category: 'stations' as const,
  };
}

describe('scanSkyCandidates', () => {
  const observer = { latitudeDeg: 41.01, longitudeDeg: 28.97, altitudeKm: 0.05 };
  const date = new Date('2019-06-05T12:00:00Z');
  const view = { headingDeg: 0, pitchDeg: 45 };

  it('excludes debris unless selected', () => {
    const debrisSat = issObject();
    const debris = {
      ...debrisSat,
      noradId: 99999,
      name: 'DEB',
      category: 'debris',
    };
    const hits = scanSkyCandidates([debris], observer, date, view, {
      includeDebris: false,
      selectedNoradId: null,
      maxCount: 50,
    });
    expect(hits.every((h) => h.noradId !== 99999)).toBe(true);
  });

  it('never returns below-horizon hits', () => {
    const hits = scanSkyCandidates([issObject()], observer, date, view, { maxCount: 20 });
    for (const h of hits) {
      expect(h.look.elevationDeg).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps the selected NORAD first when above horizon', () => {
    const a = issObject();
    const hits = scanSkyCandidates([a], observer, date, view, {
      selectedNoradId: 25544,
      maxCount: 5,
    });
    if (hits.length > 0) {
      expect(hits[0].noradId).toBe(25544);
    }
  });
});
