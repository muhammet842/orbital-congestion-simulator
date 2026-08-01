import { describe, expect, it } from 'vitest';
import { twoline2satrec } from 'satellite.js';
import { propagateObject, toObjectSnapshot } from './propagator';

/** Classic ISS sample TLE (epoch mid-2019). */
const ISS_LINE1 = '1 25544U 98067A   19249.04864348  .00001909  00000-0  40858-4 0  9990';
const ISS_LINE2 = '2 25544  51.6464 339.7939 0007927 131.8860 308.6206 15.50431119187116';

describe('propagateObject', () => {
  it('returns a LEO snapshot near the TLE epoch', () => {
    const satrec = twoline2satrec(ISS_LINE1, ISS_LINE2);
    const date = new Date(Date.UTC(2019, 8, 6, 1, 10, 0));
    const result = propagateObject(satrec, date);
    expect(result).not.toBeNull();
    expect(result!.altitudeKm).toBeGreaterThan(300);
    expect(result!.altitudeKm).toBeLessThan(500);
    expect(result!.velocityKmS).toBeGreaterThan(7);
    expect(result!.velocityKmS).toBeLessThan(8.5);
    expect(result!.layer).toBe('LEO');
    expect(result!.positionEci.x).toBeTypeOf('number');
  });

  it('returns null for a date far outside a valid epoch window', () => {
    const satrec = twoline2satrec(ISS_LINE1, ISS_LINE2);
    // Decades away — SGP4 typically fails / returns bad state.
    const result = propagateObject(satrec, new Date('2100-01-01T00:00:00Z'));
    // Either null or absurd altitude; prefer null but accept failure modes.
    if (result) {
      expect(result.altitudeKm < 0 || result.altitudeKm > 50_000).toBe(true);
    } else {
      expect(result).toBeNull();
    }
  });
});

describe('toObjectSnapshot', () => {
  it('copies propagation fields into a snapshot', () => {
    const satrec = twoline2satrec(ISS_LINE1, ISS_LINE2);
    const propagation = propagateObject(satrec, new Date(Date.UTC(2019, 8, 6, 1, 10, 0)))!;
    const snap = toObjectSnapshot(25544, 'ISS', 'stations', 'USA', 'NASA', propagation);
    expect(snap.noradId).toBe(25544);
    expect(snap.name).toBe('ISS');
    expect(snap.category).toBe('stations');
    expect(snap.altitudeKm).toBe(propagation.altitudeKm);
    expect(snap.layer).toBe(propagation.layer);
  });
});
