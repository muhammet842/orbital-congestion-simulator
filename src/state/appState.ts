import type { ConjunctionScanResult } from '../orbital/conjunction';
import {
  conjunctionSessionKey,
  invalidateConjunctionCache,
  invalidateUpcomingConjunctionCache,
  normalizeConjunctionAlert,
  VERIFY_REWIND_MS,
} from '../orbital/conjunction';
import type { AppStats, ConjunctionEvent, OrbitLayer, TimeMode, TimeState, TrackedObject } from '../types';
import { isRecentlyLaunched } from '../data/newLaunches';

/** How far before the collision to start the replay (ms). */
export const EVENT_REPLAY_REWIND_MS = 5 * 60 * 1000;
/** Playback multiplier for event replays. */
export const EVENT_REPLAY_SPEED = 15;

export interface EventReplayState {
  eventId: string;
  /** Collision/destruction moment (ms UTC). */
  collisionTimeMs: number;
  /** Current replay clock position (ms UTC). */
  currentMs: number;
  playing: boolean;
  speed: number;
}

export interface VerificationTimeState {
  /** Immutable CPA instant from the alert card (ms UTC). */
  cpaTimeMs: number;
  /** Playback clock for verification only — does not mutate global time. */
  currentMs: number;
  playing: boolean;
  speed: number;
}

export interface AppState {
  objects: TrackedObject[];
  filteredIndices: number[];
  selectedIndex: number | null;
  selectedEventId: string | null;
  selectedConjunction: ConjunctionEvent | null;
  selectedConjunctionSessionKey: string | null;
  conjunctionRevision: number;
  verificationTime: VerificationTimeState | null;
  /** Active historical event replay clock — overrides global sim time when set. */
  eventReplay: EventReplayState | null;
  searchQuery: string;
  layerFilters: Record<OrbitLayer, boolean>;
  /** Optional altitude band filter applied to the list and 3-D scene. */
  altitudeFilter: { minKm: number; maxKm: number } | null;
  /** Optional inclination band filter applied to the list and 3-D scene. */
  inclinationFilter: { minDeg: number; maxDeg: number } | null;
  /** When true, only objects first observed in the last ~14 days are shown. */
  showOnlyRecentLaunches: boolean;
  time: TimeState;
  stats: AppStats;
  conjunctions: ConjunctionEvent[];
  conjunctionHiddenCount: number;
  showOrbitTrail: boolean;
  showGroundTrack: boolean;
  colorByFunction: boolean;
}

type Listener = () => void;

const defaultLayerFilters: Record<OrbitLayer, boolean> = {
  LEO: true,
  MEO: true,
  GEO: true,
  HEO: true,
};

let state: AppState = {
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
  layerFilters: { ...defaultLayerFilters },
  altitudeFilter: null,
  inclinationFilter: null,
  showOnlyRecentLaunches: false,
  time: {
    mode: 'live',
    current: new Date(),
    speed: 1,
    playing: true,
  },
  stats: {
    total: 0,
    leoPercent: 0,
    avgAltitude: 0,
    categoryCounts: { active: 0, debris: 0, stations: 0 },
    fetchedAt: '',
  },
  conjunctions: [],
  conjunctionHiddenCount: 0,
  showOrbitTrail: false,
  showGroundTrack: true,
  colorByFunction: false,
};

const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

/** Time used for SGP4 propagation — verification overlay → event replay → live/historical global clock. */
export function getSimulationTime(): Date {
  if (state.verificationTime) {
    return new Date(state.verificationTime.currentMs);
  }
  if (state.eventReplay) {
    return new Date(state.eventReplay.currentMs);
  }
  return state.time.mode === 'live' ? new Date() : state.time.current;
}

export function formatUtcDateTime(date: Date): string {
  const utcTime = date.toISOString().slice(11, 19);
  // Zero-pad the day so the string width does not jump between "3 Jan"
  // and "13 Jan" (which was shoving wrapped labels up/down every second).
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  const year = date.getUTCFullYear();
  return `${utcTime} UTC · ${day} ${month} ${year}`;
}

export function enterLiveMode(): void {
  if (state.verificationTime) {
    setVerificationPartial({ playing: true, speed: 1 });
    return;
  }

  setState({
    time: {
      mode: 'live',
      current: new Date(),
      speed: 1,
      playing: true,
    },
    selectedConjunction: null,
    selectedConjunctionSessionKey: null,
    verificationTime: null,
  });
}

/** Reset simulated clock to the current UTC moment (historical mode). */
export function jumpToNow(): void {
  enterHistoricalMode({
    current: new Date(),
    speed: 1,
    playing: state.time.playing,
  });
}

export function enterHistoricalMode(updates: Partial<TimeState> = {}): void {
  const speed =
    updates.speed !== undefined ? Math.min(updates.speed, 100) : undefined;
  setState({
    time: {
      ...state.time,
      mode: 'historical',
      ...updates,
      ...(speed !== undefined ? { speed } : {}),
    },
  });
}

export function setState(partial: Partial<AppState>): void {
  state = { ...state, ...partial };

  if (
    partial.layerFilters !== undefined ||
    partial.searchQuery !== undefined ||
    partial.altitudeFilter !== undefined ||
    partial.inclinationFilter !== undefined ||
    partial.showOnlyRecentLaunches !== undefined
  ) {
    state.filteredIndices = computeFilteredIndices(
      state.objects, state.layerFilters, state.searchQuery,
      state.altitudeFilter, state.inclinationFilter, state.showOnlyRecentLaunches,
    );
  }

  listeners.forEach((fn) => fn());
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function computeFilteredIndices(
  objects: TrackedObject[],
  layerFilters: Record<OrbitLayer, boolean>,
  searchQuery = '',
  altitudeFilter: { minKm: number; maxKm: number } | null = null,
  inclinationFilter: { minDeg: number; maxDeg: number } | null = null,
  showOnlyRecentLaunches = false,
): number[] {
  const q = searchQuery.trim().toLowerCase();
  const now = Date.now();
  const indices: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (!layerFilters[obj.layer]) continue;
    if (q && !objectMatchesQuery(obj, q)) continue;
    if (altitudeFilter && (obj.meanAltitudeKm < altitudeFilter.minKm || obj.meanAltitudeKm > altitudeFilter.maxKm)) continue;
    if (inclinationFilter && (obj.inclinationDeg < inclinationFilter.minDeg || obj.inclinationDeg > inclinationFilter.maxDeg)) continue;
    if (showOnlyRecentLaunches && !isRecentlyLaunched(obj, now)) continue;
    indices.push(i);
  }
  return indices;
}

export function objectMatchesQuery(obj: TrackedObject, queryLower: string): boolean {
  const normalized = queryLower
    .replace(/turkiye/g, 'türkiye')
    .replace(/turkey/g, 'türkiye');

  return (
    obj.name.toLowerCase().includes(normalized) ||
    String(obj.noradId).includes(normalized) ||
    obj.country.toLowerCase().includes(normalized) ||
    obj.owner.toLowerCase().includes(normalized)
  );
}

export function matchesSearchQuery(obj: TrackedObject, searchQuery: string): boolean {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;
  return objectMatchesQuery(obj, q);
}

let sortedAllIndices: number[] = [];

export function getSortedObjectIndices(): number[] {
  return sortedAllIndices;
}

/** Indices for the sidebar list (search + optional recent-only filter). */
export function getListIndices(): number[] {
  const q = state.searchQuery.trim().toLowerCase();
  let indices = sortedAllIndices;
  if (state.showOnlyRecentLaunches) {
    const now = Date.now();
    indices = indices.filter((i) => isRecentlyLaunched(state.objects[i], now));
  }
  if (!q) return indices;
  return indices.filter((i) => objectMatchesQuery(state.objects[i], q));
}

export function setSearchQuery(query: string): void {
  setState({ searchQuery: query });
}

function restoreGlobalLiveTime(): TimeState {
  return {
    mode: 'live',
    current: new Date(),
    speed: 1,
    playing: true,
  };
}

export function selectObject(index: number): void {
  const wasVerifying = state.verificationTime != null;
  if (wasVerifying) {
    invalidateConjunctionCache();
    invalidateUpcomingConjunctionCache();
  }
  setState({
    selectedIndex: index,
    selectedEventId: null,
    selectedConjunction: null,
    selectedConjunctionSessionKey: null,
    verificationTime: null,
    eventReplay: null,
    ...(wasVerifying ? { time: restoreGlobalLiveTime() } : {}),
  });
}

export function clearObjectSelection(): void {
  if (state.selectedIndex == null) return;
  setState({ selectedIndex: null });
}

export function selectHistoricalEvent(eventId: string): void {
  const wasVerifying = state.verificationTime != null;
  if (wasVerifying) {
    invalidateConjunctionCache();
    invalidateUpcomingConjunctionCache();
  }
  setState({
    selectedEventId: eventId,
    selectedIndex: null,
    selectedConjunction: null,
    selectedConjunctionSessionKey: null,
    verificationTime: null,
    eventReplay: null,
    showOrbitTrail: false,
    showGroundTrack: true,
    ...(wasVerifying ? { time: restoreGlobalLiveTime() } : {}),
  });
}

/** Start a timed replay of a historical event — sets a dedicated replay clock. */
export function startEventReplay(eventId: string, collisionTimeMs: number): void {
  const startMs = collisionTimeMs - EVENT_REPLAY_REWIND_MS;
  setState({
    eventReplay: {
      eventId,
      collisionTimeMs,
      currentMs: startMs,
      playing: true,
      speed: EVENT_REPLAY_SPEED,
    },
  });
}

export function setEventReplayPartial(
  partial: Partial<Pick<EventReplayState, 'playing' | 'speed' | 'currentMs'>>,
): void {
  if (!state.eventReplay) return;
  state.eventReplay = { ...state.eventReplay, ...partial };
  listeners.forEach((fn) => fn());
}

export function stopEventReplay(): void {
  if (!state.eventReplay) return;
  // Also clear the card selection so the event card is deselected and
  // SceneManager.onStateChange() cleans up the 3-D visuals + restores
  // catalog satellite visibility.
  setState({ eventReplay: null, selectedEventId: null });
}

/** Advance event replay clock without triggering full re-render. */
export function advanceEventReplayTime(deltaMs: number): void {
  if (!state.eventReplay?.playing) return;
  state.eventReplay.currentMs += deltaMs * state.eventReplay.speed;
}

export function getEventReplayState(): EventReplayState | null {
  return state.eventReplay;
}

export function selectConjunctionFromAlert(alert: ConjunctionEvent): void {
  const frozen = normalizeConjunctionAlert(alert, state.objects);
  if (!frozen) return;

  if (state.verificationTime) {
    invalidateConjunctionCache();
    invalidateUpcomingConjunctionCache();
  }

  const cpaTimeMs = frozen.time.getTime();
  const sessionKey = conjunctionSessionKey(frozen);

  setState({
    selectedConjunction: frozen,
    selectedConjunctionSessionKey: sessionKey,
    conjunctionRevision: state.conjunctionRevision + 1,
    verificationTime: {
      cpaTimeMs,
      currentMs: cpaTimeMs - VERIFY_REWIND_MS,
      // Auto-play from T−60s so selecting an alert immediately shows the
      // approach — users shouldn't need a second click on VERIFY/Play.
      playing: true,
      speed: 1,
    },
    selectedIndex: null,
    selectedEventId: null,
    showOrbitTrail: false,
    showGroundTrack: true,
  });
}

export function toggleConjunctionFromAlert(alert: ConjunctionEvent): void {
  const frozen = normalizeConjunctionAlert(alert, state.objects);
  if (!frozen) return;

  const sessionKey = conjunctionSessionKey(frozen);
  if (state.selectedConjunctionSessionKey === sessionKey) {
    clearSelectedConjunction();
    return;
  }
  selectConjunctionFromAlert(alert);
}

export function clearSelectedConjunction(): void {
  if (!state.selectedConjunction && !state.verificationTime) return;
  invalidateConjunctionCache();
  invalidateUpcomingConjunctionCache();
  setState({
    selectedConjunction: null,
    selectedConjunctionSessionKey: null,
    verificationTime: null,
    time: restoreGlobalLiveTime(),
  });
}

export function exitConjunctionView(): void {
  clearSelectedConjunction();
}

export function setVerificationPartial(
  partial: Partial<Pick<VerificationTimeState, 'playing' | 'speed' | 'currentMs'>>,
): void {
  if (!state.verificationTime) return;
  const speed =
    partial.speed !== undefined ? Math.min(partial.speed, 100) : partial.speed;
  state.verificationTime = { ...state.verificationTime, ...partial, ...(speed !== undefined ? { speed } : {}) };
  listeners.forEach((fn) => fn());
}

/** Advance verification playback clock without touching global time state. */
export function advanceVerificationTime(deltaMs: number): void {
  if (!state.verificationTime?.playing) return;
  state.verificationTime.currentMs += deltaMs * state.verificationTime.speed;
}

export function setShowOrbitTrail(show: boolean): void {
  setState({ showOrbitTrail: show });
}

export function setShowGroundTrack(show: boolean): void {
  setState({ showGroundTrack: show });
}

export function setColorByFunction(enabled: boolean): void {
  if (state.colorByFunction === enabled) return;
  setState({ colorByFunction: enabled });
}

export function setShowOnlyRecentLaunches(enabled: boolean): void {
  if (state.showOnlyRecentLaunches === enabled) return;
  setState({ showOnlyRecentLaunches: enabled });
}

export function setAltitudeFilter(filter: { minKm: number; maxKm: number } | null): void {
  setState({ altitudeFilter: filter });
}

export function setInclinationFilter(filter: { minDeg: number; maxDeg: number } | null): void {
  setState({ inclinationFilter: filter });
}

export function resetAdvancedFilters(): void {
  setState({ altitudeFilter: null, inclinationFilter: null });
}

export function setConjunctions({ alerts, hiddenCount }: ConjunctionScanResult): void {
  const prev = state.conjunctions;
  if (
    state.conjunctionHiddenCount === hiddenCount &&
    prev.length === alerts.length &&
    prev.every(
      (c, i) =>
        c.objectA === alerts[i].objectA &&
        c.objectB === alerts[i].objectB &&
        Math.abs(c.distanceKm - alerts[i].distanceKm) < 0.001,
    )
  ) {
    // Still wake subscribers: after a first sweep finishes with zero hits,
    // the left panel needs to leave the "Scanning…" placeholder even though
    // `conjunctions` was already `[]`.
    listeners.forEach((fn) => fn());
    return;
  }
  setState({ conjunctions: alerts, conjunctionHiddenCount: hiddenCount });
}

export function initState(
  objects: TrackedObject[],
  stats: AppStats,
): void {
  sortedAllIndices = objects
    .map((_, i) => i)
    .sort((a, b) => objects[a].name.localeCompare(objects[b].name, 'en', { sensitivity: 'base' }));

  state = {
    ...state,
    objects,
    filteredIndices: computeFilteredIndices(objects, state.layerFilters, state.searchQuery),
    stats,
    selectedIndex: null,
    selectedEventId: null,
    selectedConjunction: null,
    selectedConjunctionSessionKey: null,
    conjunctionRevision: 0,
    verificationTime: null,
    eventReplay: null,
    searchQuery: '',
    altitudeFilter: null,
    inclinationFilter: null,
    conjunctions: [],
    conjunctionHiddenCount: 0,
    showOrbitTrail: false,
    showGroundTrack: true,
    colorByFunction: false,
    time: {
      mode: 'live',
      current: new Date(),
      speed: 1,
      playing: true,
    },
  };
  listeners.forEach((fn) => fn());
}

export function toggleLayerFilter(layer: OrbitLayer): void {
  setState({
    layerFilters: {
      ...state.layerFilters,
      [layer]: !state.layerFilters[layer],
    },
  });
}

export function setTimePartial(partial: Partial<TimeState>): void {
  if (state.verificationTime) {
    if (partial.playing !== undefined) {
      setVerificationPartial({ playing: partial.playing });
    }
    if (partial.speed !== undefined) {
      setVerificationPartial({ speed: partial.speed });
    }
    return;
  }

  const next: TimeState = { ...state.time, ...partial };
  if (next.mode === 'live') {
    next.speed = 1;
  }
  setState({ time: next });
}

/** Advance historical sim clock without re-rendering UI panels every frame. */
export function advanceSimulationTime(current: Date): void {
  if (state.time.mode !== 'historical') return;
  state.time.current = current;
}

export function isLiveMode(): boolean {
  return state.time.mode === 'live';
}

export function isConjunctionVerificationActive(): boolean {
  return state.verificationTime != null;
}

export function isVerificationPlaying(): boolean {
  return state.verificationTime?.playing ?? false;
}

export function getVerificationTimeState(): VerificationTimeState | null {
  return state.verificationTime;
}

export function getTimeModeLabel(mode: TimeMode): string {
  return mode === 'live' ? 'LIVE' : 'Historical';
}
