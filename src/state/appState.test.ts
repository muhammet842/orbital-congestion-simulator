import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getState,
  setState,
  initState,
  selectObject,
  clearObjectSelection,
  selectHistoricalEvent,
  setShowOrbitTrail,
  setShowGroundTrack,
  setSearchQuery,
  toggleLayerFilter,
  setAltitudeFilter,
  setInclinationFilter,
  resetAdvancedFilters,
  startEventReplay,
  stopEventReplay,
  setColorByFunction,
  setShowOnlyRecentLaunches,
  computeFilteredIndices,
  getListIndices,
  selectConjunctionFromAlert,
  EVENT_REPLAY_REWIND_MS,
} from './appState';
import { VERIFY_REWIND_MS } from '../orbital/conjunction';
import * as propagatorModule from '../orbital/propagator';
import type { ConjunctionEvent, TrackedObject } from '../types';

/**
 * Hard-reset module state to known defaults before each test.
 * We do this by directly calling setState with the expected initial values.
 */
function resetState(): void {
  setState({
    objects: [],
    filteredIndices: [],
    selectedIndex: null,
    selectedEventId: null,
    selectedConjunction: null,
    selectedConjunctionSessionKey: null,
    conjunctionRevision: 0,
    verificationTime: null,
    eventReplay: null,
    searchQuery: '',
    layerFilters: { LEO: true, MEO: true, GEO: true, HEO: true },
    altitudeFilter: null,
    inclinationFilter: null,
    showOnlyRecentLaunches: false,
    showOrbitTrail: false,
    showGroundTrack: true,
    colorByFunction: false,
    conjunctions: [],
    conjunctionHiddenCount: 0,
    conjunctionSortMode: 'time',
  });
}

beforeEach(resetState);

// ── Selection ─────────────────────────────────────────────────────────────────

describe('selectObject', () => {
  it('sets selectedIndex to the given index', () => {
    selectObject(42);
    expect(getState().selectedIndex).toBe(42);
  });

  it('overwrites a previous selection', () => {
    selectObject(1);
    selectObject(7);
    expect(getState().selectedIndex).toBe(7);
  });
});

describe('clearObjectSelection', () => {
  it('sets selectedIndex to null', () => {
    selectObject(3);
    clearObjectSelection();
    expect(getState().selectedIndex).toBeNull();
  });

  it('is a no-op when nothing is selected', () => {
    clearObjectSelection();
    expect(getState().selectedIndex).toBeNull();
  });
});

// ── Historical event ──────────────────────────────────────────────────────────

describe('selectHistoricalEvent', () => {
  it('sets selectedEventId', () => {
    selectHistoricalEvent('iridium-cosmos');
    expect(getState().selectedEventId).toBe('iridium-cosmos');
  });

  it('clears any active satellite selection', () => {
    selectObject(5);
    selectHistoricalEvent('iridium-cosmos');
    expect(getState().selectedIndex).toBeNull();
  });

  it('clears eventReplay state', () => {
    startEventReplay('iridium-cosmos', Date.now());
    selectHistoricalEvent('iridium-cosmos');
    expect(getState().eventReplay).toBeNull();
  });
});

// ── Event replay ──────────────────────────────────────────────────────────────

describe('startEventReplay', () => {
  it('creates an eventReplay state with the correct eventId', () => {
    const collisionMs = new Date('2009-02-10T16:56:00Z').getTime();
    startEventReplay('iridium-cosmos', collisionMs);
    const replay = getState().eventReplay;
    expect(replay).not.toBeNull();
    expect(replay!.eventId).toBe('iridium-cosmos');
  });

  it('sets currentMs to collisionTimeMs minus REWIND_MS', () => {
    const collisionMs = new Date('2009-02-10T16:56:00Z').getTime();
    startEventReplay('iridium-cosmos', collisionMs);
    const replay = getState().eventReplay!;
    expect(replay.currentMs).toBe(collisionMs - EVENT_REPLAY_REWIND_MS);
  });

  it('starts the replay in playing state', () => {
    startEventReplay('iridium-cosmos', Date.now());
    expect(getState().eventReplay!.playing).toBe(true);
  });
});

describe('stopEventReplay', () => {
  it('clears eventReplay and selectedEventId', () => {
    startEventReplay('iridium-cosmos', Date.now());
    stopEventReplay();
    expect(getState().eventReplay).toBeNull();
    expect(getState().selectedEventId).toBeNull();
  });
});

// ── Visibility toggles ────────────────────────────────────────────────────────

describe('setShowOrbitTrail', () => {
  it('toggles showOrbitTrail to true', () => {
    setShowOrbitTrail(true);
    expect(getState().showOrbitTrail).toBe(true);
  });

  it('toggles showOrbitTrail to false', () => {
    setShowOrbitTrail(true);
    setShowOrbitTrail(false);
    expect(getState().showOrbitTrail).toBe(false);
  });
});

describe('setShowGroundTrack', () => {
  it('defaults to true', () => {
    expect(getState().showGroundTrack).toBe(true);
  });

  it('can be set to false', () => {
    setShowGroundTrack(false);
    expect(getState().showGroundTrack).toBe(false);
  });
});

describe('setColorByFunction', () => {
  it('defaults to false', () => {
    expect(getState().colorByFunction).toBe(false);
  });

  it('can be toggled on and off', () => {
    setColorByFunction(true);
    expect(getState().colorByFunction).toBe(true);
    setColorByFunction(false);
    expect(getState().colorByFunction).toBe(false);
  });
});

describe('setShowOnlyRecentLaunches', () => {
  it('defaults to false', () => {
    expect(getState().showOnlyRecentLaunches).toBe(false);
  });

  it('can be toggled on and off', () => {
    setShowOnlyRecentLaunches(true);
    expect(getState().showOnlyRecentLaunches).toBe(true);
    setShowOnlyRecentLaunches(false);
    expect(getState().showOnlyRecentLaunches).toBe(false);
  });

  it('narrows the sidebar list to recently launched objects when enabled', () => {
    const now = Date.now();
    const recent = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const stale = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    initState(
      [
        {
          noradId: 1,
          name: 'NEW SAT',
          line1: '',
          line2: '',
          category: 'active',
          country: 'X',
          owner: 'X',
          satrec: {} as TrackedObject['satrec'],
          layer: 'LEO',
          color: [1, 1, 1],
          functionGroup: 'active',
          meanAltitudeKm: 500,
          inclinationDeg: 50,
          firstSeenAt: recent,
        },
        {
          noradId: 2,
          name: 'OLD SAT',
          line1: '',
          line2: '',
          category: 'active',
          country: 'X',
          owner: 'X',
          satrec: {} as TrackedObject['satrec'],
          layer: 'LEO',
          color: [1, 1, 1],
          functionGroup: 'active',
          meanAltitudeKm: 500,
          inclinationDeg: 50,
          firstSeenAt: stale,
        },
      ],
      {
        total: 2,
        leoPercent: 100,
        avgAltitude: 500,
        categoryCounts: { active: 2, debris: 0, stations: 0 },
        fetchedAt: new Date().toISOString(),
      },
    );

    expect(getListIndices().length).toBe(2);
    setShowOnlyRecentLaunches(true);
    expect(getListIndices()).toEqual([0]);
  });
});

describe('computeFilteredIndices with showOnlyRecentLaunches', () => {
  function makeObj(overrides: Partial<TrackedObject>): TrackedObject {
    return {
      noradId: 1,
      name: 'TEST',
      line1: '',
      line2: '',
      category: 'active',
      country: 'Unknown',
      owner: 'Unknown',
      satrec: {} as TrackedObject['satrec'],
      layer: 'LEO',
      color: [1, 1, 1],
      functionGroup: 'active',
      meanAltitudeKm: 500,
      inclinationDeg: 50,
      ...overrides,
    };
  }

  const layerFilters = { LEO: true, MEO: true, GEO: true, HEO: true };

  it('includes everything when the flag is off, even objects with no firstSeenAt', () => {
    const objects = [makeObj({ firstSeenAt: undefined }), makeObj({ noradId: 2 })];
    const indices = computeFilteredIndices(objects, layerFilters, '', null, null, false);
    expect(indices).toEqual([0, 1]);
  });

  it('keeps only objects first seen within the last 14 days when the flag is on', () => {
    const recent = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const stale = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const objects = [
      makeObj({ noradId: 1, firstSeenAt: recent }),
      makeObj({ noradId: 2, firstSeenAt: stale }),
      makeObj({ noradId: 3, firstSeenAt: undefined }),
    ];
    const indices = computeFilteredIndices(objects, layerFilters, '', null, null, true);
    expect(indices).toEqual([0]);
  });
});

// ── Layer filters ─────────────────────────────────────────────────────────────

describe('toggleLayerFilter', () => {
  it('disables a layer that is currently enabled', () => {
    toggleLayerFilter('LEO');
    expect(getState().layerFilters.LEO).toBe(false);
  });

  it('re-enables a layer that is currently disabled', () => {
    toggleLayerFilter('GEO');
    toggleLayerFilter('GEO');
    expect(getState().layerFilters.GEO).toBe(true);
  });

  it('does not affect other layers', () => {
    toggleLayerFilter('MEO');
    const { LEO, GEO, HEO } = getState().layerFilters;
    expect(LEO).toBe(true);
    expect(GEO).toBe(true);
    expect(HEO).toBe(true);
  });
});

// ── Search ────────────────────────────────────────────────────────────────────

describe('setSearchQuery', () => {
  it('stores the search string', () => {
    setSearchQuery('starlink');
    expect(getState().searchQuery).toBe('starlink');
  });

  it('trims the query', () => {
    setSearchQuery('  ISS  ');
    // The appState trims before storing
    expect(getState().searchQuery.trim()).toBe('ISS');
  });
});

// ── Advanced filters ──────────────────────────────────────────────────────────

describe('setAltitudeFilter', () => {
  it('stores the altitude range', () => {
    setAltitudeFilter({ minKm: 400, maxKm: 800 });
    expect(getState().altitudeFilter).toEqual({ minKm: 400, maxKm: 800 });
  });

  it('can be cleared with null', () => {
    setAltitudeFilter({ minKm: 400, maxKm: 800 });
    setAltitudeFilter(null);
    expect(getState().altitudeFilter).toBeNull();
  });
});

describe('setInclinationFilter', () => {
  it('stores the inclination range', () => {
    setInclinationFilter({ minDeg: 50, maxDeg: 90 });
    expect(getState().inclinationFilter).toEqual({ minDeg: 50, maxDeg: 90 });
  });

  it('can be cleared with null', () => {
    setInclinationFilter({ minDeg: 50, maxDeg: 90 });
    setInclinationFilter(null);
    expect(getState().inclinationFilter).toBeNull();
  });
});

describe('resetAdvancedFilters', () => {
  it('clears both altitude and inclination filters', () => {
    setAltitudeFilter({ minKm: 200, maxKm: 1000 });
    setInclinationFilter({ minDeg: 30, maxDeg: 120 });
    resetAdvancedFilters();
    expect(getState().altitudeFilter).toBeNull();
    expect(getState().inclinationFilter).toBeNull();
  });
});

describe('selectConjunctionFromAlert', () => {
  function makeObj(overrides: Partial<TrackedObject>): TrackedObject {
    return {
      noradId: 1,
      name: 'TEST',
      line1: '',
      line2: '',
      category: 'active',
      country: 'Unknown',
      owner: 'Unknown',
      satrec: {} as TrackedObject['satrec'],
      layer: 'LEO',
      color: [1, 1, 1],
      functionGroup: 'active',
      meanAltitudeKm: 500,
      inclinationDeg: 50,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.spyOn(propagatorModule, 'propagateObject').mockImplementation(() => ({
      positionEci: { x: 1, y: 2, z: 3 },
      velocityEci: { x: 1, y: 0, z: 0 },
      altitudeKm: 500,
      velocityKmS: 7.5,
      inclinationDeg: 50,
      layer: 'LEO',
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts verification playback automatically from T−60s', () => {
    setState({
      objects: [makeObj({ noradId: 1, name: 'A' }), makeObj({ noradId: 2, name: 'B' })],
    });
    const cpa = new Date('2026-07-25T02:12:25.000Z');
    const alert: ConjunctionEvent = {
      objectA: 'A',
      objectB: 'B',
      noradIdA: 1,
      noradIdB: 2,
      indexA: 0,
      indexB: 1,
      distanceKm: 0.34,
      relativeVelocityKmS: 0.4,
      time: cpa,
      midpointScene: { x: 0, y: 0, z: 0 },
    };

    selectConjunctionFromAlert(alert);

    const vt = getState().verificationTime;
    expect(vt).not.toBeNull();
    expect(vt!.playing).toBe(true);
    expect(vt!.speed).toBe(1);
    expect(vt!.currentMs).toBe(cpa.getTime() - VERIFY_REWIND_MS);
  });
});
