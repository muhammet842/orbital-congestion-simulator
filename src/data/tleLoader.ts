
import { twoline2satrec } from 'satellite.js';
import { getCategoryColor, inferFunctionGroup } from '../orbital/classify';
import { propagateObject } from '../orbital/propagator';
import { enrichRecord } from './objectMetadata';
import type { TleDataset, TrackedObject, ObjectCategory } from '../types';

export async function loadTleDataset(): Promise<TleDataset> {
  
  const response = await fetch('/data/tle.json', { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error('Orbital data not found. Run: npm run fetch-tle');
  }
  return response.json() as Promise<TleDataset>;
}

export function createTrackedObjects(dataset: TleDataset, date = new Date()): TrackedObject[] {
  const tracked: TrackedObject[] = [];

  for (const record of dataset.objects) {
    try {
      const enriched = enrichRecord({
        ...record,
        category: record.category as ObjectCategory,
      });

      const satrec = twoline2satrec(enriched.line1, enriched.line2);
      const propagation = propagateObject(satrec, date);
      if (!propagation) {
        console.warn(`Skipping ${enriched.name}: propagation failed at ${date.toISOString()}`);
        continue;
      }

      
      
      const GM_KM3_S2 = 398600.4418;
      const nRadS = satrec.no / 60; 
      const semiMajorKm = Math.cbrt(GM_KM3_S2 / (nRadS * nRadS));
      const meanAltitudeKm = Math.max(0, semiMajorKm - 6371);
      const inclinationDeg = satrec.inclo * (180 / Math.PI);

      tracked.push({
        ...enriched,
        satrec,
        layer: propagation.layer,
        color: getCategoryColor(enriched.category, propagation.layer, enriched.country),
        functionGroup: inferFunctionGroup(enriched.name, enriched.category),
        meanAltitudeKm,
        inclinationDeg,
      });
    } catch (err) {
      console.warn(`Skipping invalid TLE for ${record.name}:`, err);
    }
  }

  return tracked;
}

export function computeStats(objects: TrackedObject[], fetchedAt: string, date = new Date()) {
  const categoryCounts: Record<ObjectCategory, number> = {
    active: 0,
    debris: 0,
    stations: 0,
  };

  let leoCount = 0;
  let altitudeSum = 0;
  let altitudeCount = 0;

  for (const obj of objects) {
    categoryCounts[obj.category]++;
    const propagation = propagateObject(obj.satrec, date);
    if (!propagation) continue;
    if (propagation.layer === 'LEO') leoCount++;
    altitudeSum += propagation.altitudeKm;
    altitudeCount++;
  }

  const total = objects.length;
  return {
    total,
    leoPercent: altitudeCount > 0 ? Math.round((leoCount / altitudeCount) * 100) : 0,
    avgAltitude: altitudeCount > 0 ? Math.round(altitudeSum / altitudeCount) : 0,
    categoryCounts,
    fetchedAt,
  };
}
