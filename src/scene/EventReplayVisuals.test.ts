// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EventReplayVisuals } from './EventReplayVisuals';
import { getHistoricalEvent } from '../ui/EventCards';
import { EVENT_REPLAY_REWIND_MS } from '../state/appState';

function collisionMsFor(eventId: string): number {
  const event = getHistoricalEvent(eventId)!;
  return new Date(event.collisionTimeUtc).getTime();
}

describe('EventReplayVisuals — two-satellite collision (iridium-cosmos)', () => {
  it('starts far from the collision point at T-5min (progress = 0)', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('iridium-cosmos')!;
    const collisionMs = collisionMsFor('iridium-cosmos');
    visuals.setup(event, collisionMs);

    const startDate = new Date(collisionMs - EVENT_REPLAY_REWIND_MS);
    const result = visuals.tick(startDate, collisionMs);

    expect(result).not.toBeNull();
    const collisionScene = visuals.getCollisionScene()!;
    // 1 scene unit == Earth radius (6371 km); a satellite moving at ~7.5 km/s
    // covers a huge arc in 5 minutes, so it should start thousands of km away.
    const distKm = result!.posA.distanceTo(collisionScene) * 6371;
    expect(distKm).toBeGreaterThan(500);
  });

  it('converges exactly onto the collision point at T=0 (progress = 1)', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('iridium-cosmos')!;
    const collisionMs = collisionMsFor('iridium-cosmos');
    visuals.setup(event, collisionMs);

    const result = visuals.tick(new Date(collisionMs), collisionMs);
    const collisionScene = visuals.getCollisionScene()!;

    expect(result!.posA.distanceTo(collisionScene)).toBeLessThan(1e-9);
    expect(result!.posB!.distanceTo(collisionScene)).toBeLessThan(1e-9);
  });

  it('both objects meet at the same point (zero separation) at impact', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('iridium-cosmos')!;
    const collisionMs = collisionMsFor('iridium-cosmos');
    visuals.setup(event, collisionMs);

    const result = visuals.tick(new Date(collisionMs), collisionMs);
    expect(result!.posA.distanceTo(result!.posB!)).toBeLessThan(1e-9);
  });

  it('reports a large initial separation (thousands of km) at T-5min', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('iridium-cosmos')!;
    visuals.setup(event, collisionMsFor('iridium-cosmos'));

    // Iridium 33 and Cosmos 2251 approach from different orbital planes —
    // separation at T-5min should be on the order of several thousand km.
    expect(visuals.getInitialSeparationKm()).toBeGreaterThan(1000);
  });

  it('exposes the correct object names', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('iridium-cosmos')!;
    visuals.setup(event, collisionMsFor('iridium-cosmos'));

    expect(visuals.getNames()).toEqual({ nameA: 'IRIDIUM 33', nameB: 'COSMOS 2251' });
  });

  it('interpolates monotonically closer to the collision point over time', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('iridium-cosmos')!;
    const collisionMs = collisionMsFor('iridium-cosmos');
    visuals.setup(event, collisionMs);
    const collisionScene = visuals.getCollisionScene()!;

    const startMs = collisionMs - EVENT_REPLAY_REWIND_MS;
    const distances: number[] = [];
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      const t = startMs + frac * EVENT_REPLAY_REWIND_MS;
      const r = visuals.tick(new Date(t), collisionMs)!;
      distances.push(r.posA.distanceTo(collisionScene));
    }
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeLessThanOrEqual(distances[i - 1] + 1e-9);
    }
    expect(distances[distances.length - 1]).toBeLessThan(1e-9);
  });
});

describe('EventReplayVisuals — single-object ASAT event (fengyun-asat)', () => {
  it('models object B as rising from the Earth surface (unit-length position)', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('fengyun-asat')!;
    const collisionMs = collisionMsFor('fengyun-asat');
    visuals.setup(event, collisionMs);

    const startDate = new Date(collisionMs - EVENT_REPLAY_REWIND_MS);
    const result = visuals.tick(startDate, collisionMs)!;
    // ASAT missile starts on the surface — scene radius should be ~1 (Earth radius).
    expect(result.posB!.length()).toBeCloseTo(1, 3);
  });

  it('has zero initial separation (single-object events have no "distance")', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('fengyun-asat')!;
    visuals.setup(event, collisionMsFor('fengyun-asat'));
    expect(visuals.getInitialSeparationKm()).toBe(0);
  });

  it('has no second name for a single-object event', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('fengyun-asat')!;
    visuals.setup(event, collisionMsFor('fengyun-asat'));
    expect(visuals.getNames()!.nameB).toBeNull();
  });
});

describe('EventReplayVisuals — impact flash + debris timing', () => {
  it('produces a full-strength impact flash exactly at the collision instant', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('cosmos-1408')!;
    const collisionMs = collisionMsFor('cosmos-1408');
    visuals.setup(event, collisionMs);

    const result = visuals.tick(new Date(collisionMs), collisionMs)!;
    expect(result.impactFlash).toBeCloseTo(1, 5);
  });

  it('has no impact flash well before the collision', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('cosmos-1408')!;
    const collisionMs = collisionMsFor('cosmos-1408');
    visuals.setup(event, collisionMs);

    const result = visuals.tick(new Date(collisionMs - EVENT_REPLAY_REWIND_MS), collisionMs)!;
    expect(result.impactFlash).toBe(0);
  });

  it('fades the impact flash out over the 30s post-impact window', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('cosmos-1408')!;
    const collisionMs = collisionMsFor('cosmos-1408');
    visuals.setup(event, collisionMs);

    const flashAtImpact = visuals.tick(new Date(collisionMs), collisionMs)!.impactFlash;
    const flashAfter15s = visuals.tick(new Date(collisionMs + 15_000), collisionMs)!.impactFlash;
    expect(flashAfter15s).toBeLessThan(flashAtImpact);
    expect(flashAfter15s).toBeGreaterThan(0);
  });
});

describe('EventReplayVisuals — Yunhai 1-02 two-body collision', () => {
  it('converges both objects to the same point at T=0', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('yunhai-1-02')!;
    const collisionMs = collisionMsFor('yunhai-1-02');
    visuals.setup(event, collisionMs);

    const result = visuals.tick(new Date(collisionMs), collisionMs)!;
    expect(result.posA.distanceTo(result.posB!)).toBeLessThan(1e-9);
  });
});

describe('EventReplayVisuals — setup/dispose lifecycle', () => {
  it('is a no-op when setup() is called twice with the same event id', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('iridium-cosmos')!;
    const collisionMs = collisionMsFor('iridium-cosmos');
    visuals.setup(event, collisionMs);
    const firstScene = visuals.getCollisionScene()!.clone();

    visuals.setup(event, collisionMs);
    expect(visuals.getCollisionScene()!.equals(firstScene)).toBe(true);
  });

  it('dispose() clears parsed state so getCollisionScene() returns null', () => {
    const visuals = new EventReplayVisuals();
    const event = getHistoricalEvent('iridium-cosmos')!;
    visuals.setup(event, collisionMsFor('iridium-cosmos'));
    visuals.dispose();
    expect(visuals.getCollisionScene()).toBeNull();
    expect(visuals.getNames()).toBeNull();
  });

  it('tick() returns null before setup() has been called', () => {
    const visuals = new EventReplayVisuals();
    expect(visuals.tick(new Date(), Date.now())).toBeNull();
  });

  it('allows switching to a different event after dispose', () => {
    const visuals = new EventReplayVisuals();
    const eventA = getHistoricalEvent('iridium-cosmos')!;
    visuals.setup(eventA, collisionMsFor('iridium-cosmos'));

    const eventB = getHistoricalEvent('cosmos-1408')!;
    visuals.setup(eventB, collisionMsFor('cosmos-1408'));

    expect(visuals.getNames()).toEqual({ nameA: 'COSMOS 1408', nameB: null });
  });
});
