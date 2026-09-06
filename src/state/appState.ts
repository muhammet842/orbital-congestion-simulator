
import type { ConjunctionScanResult, ConjunctionSortMode } from '../orbital/conjunction';
import {
  clampVerificationTimeMs,
  conjunctionSessionKey,
  getVerificationRewindMs,
  getVerificationWindowMs,
  hasUpcomingConjunctionScanCompleted,
  normalizeConjunctionAlert,
} from '../orbital/conjunction';
import type { AppStats, ConjunctionEvent, ObjectCategory, OrbitLayer, TimeMode, TimeState, TrackedObject } from '../types';
import { isRecentlyLaunched } from '../data/newLaunches';

export const EVENT_REPLAY_REWIND_MS = 5 * 60 * 1000;

export const EVENT_REPLAY_SPEED = 15;

export const EVENT_REPLAY_SCRUB_STEP_MS = 5_000;

export const MAX_FOCUSED_CLOCK_FRAME_MS = 50;

export interface EventReplayState {
  eventId: string;
  
  collisionTimeMs: number;
  
  currentMs: number;
  playing: boolean;
  speed: number;
}

export interface VerificationTimeState {
  
  cpaTimeMs: number;
  
  currentMs: number;
  playing: boolean;
  speed: number;
  
  relativeVelocityKmS?: number;
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
  
  eventReplay: EventReplayState | null;
  searchQuery: string;
  layerFilters: Record<OrbitLayer, boolean>;
  
  altitudeFilter: { minKm: number; maxKm: number } | null;
  
  inclinationFilter: { minDeg: number; maxDeg: number } | null;
  
  showOnlyRecentLaunches: boolean;
  
  categoryFilter: ObjectCategory | 'all';
  time: TimeState;
  stats: AppStats;
  conjunctions: ConjunctionEvent[];
  conjunctionHiddenCount: number;
  
  conjunctionSortMode: ConjunctionSortMode;
  showOrbitTrail: boolean;
  showGroundTrack: boolean;
  colorByFunction: boolean;
}

type Listener = () => void;

let emptyConjunctionScanAcked = false;

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
  categoryFilter: 'all',
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
  conjunctionSortMode: 'time',
  showOrbitTrail: false,
  showGroundTrack: true,
  colorByFunction: true,
};

const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function getSimulationTime(): Date {
  if (state.verificationTime) {
    return new Date(state.verificationTime.currentMs);
  }
  if (state.eventReplay) {
    return new Date(state.eventReplay.currentMs);
  }
  return getGlobalSimulationTime();
}

export function getGlobalSimulationTime(): Date {
  return state.time.mode === 'live' ? new Date() : state.time.current;
}

export function formatUtcDateTime(date: Date): string {
  const utcTime = date.toISOString().slice(11, 19);
  
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
  if (state.eventReplay) {
    
    setEventReplayPartial({ playing: true, speed: 1 });
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
    partial.showOnlyRecentLaunches !== undefined ||
    partial.categoryFilter !== undefined
  ) {
    state.filteredIndices = computeFilteredIndices(
      state.objects, state.layerFilters, state.searchQuery,
      state.altitudeFilter, state.inclinationFilter, state.showOnlyRecentLaunches,
      state.categoryFilter,
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
  categoryFilter: ObjectCategory | 'all' = 'all',
): number[] {
  const q = searchQuery.trim().toLowerCase();
  const now = Date.now();
  const indices: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (!layerFilters[obj.layer]) continue;
    if (categoryFilter !== 'all' && obj.category !== categoryFilter) continue;
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

export function getListIndices(): number[] {
  const allowed = new Set(state.filteredIndices);
  return sortedAllIndices.filter((i) => allowed.has(i));
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
  const next = { ...state.eventReplay, ...partial };
  if (partial.currentMs !== undefined) {
    const { startMs, endMs } = getEventReplayWindowMs(next.collisionTimeMs);
    next.currentMs = Math.min(endMs, Math.max(startMs, partial.currentMs));
  }
  state.eventReplay = next;
  listeners.forEach((fn) => fn());
}

export function stopEventReplay(): void {
  if (!state.eventReplay) return;
  
  setState({ eventReplay: null, selectedEventId: null });
}

export function clearHistoricalEventSelection(): void {
  if (state.selectedEventId == null && state.eventReplay == null) return;
  setState({ eventReplay: null, selectedEventId: null });
}

export function advanceEventReplayTime(deltaMs: number): void {
  if (!state.eventReplay?.playing) return;
  const { startMs, endMs } = getEventReplayWindowMs(state.eventReplay.collisionTimeMs);
  const step = Math.min(Math.max(0, deltaMs), MAX_FOCUSED_CLOCK_FRAME_MS) * state.eventReplay.speed;
  const nextMs = state.eventReplay.currentMs + step;
  if (nextMs >= endMs) {
    state.eventReplay = { ...state.eventReplay, currentMs: endMs, playing: false };
    return;
  }
  state.eventReplay.currentMs = Math.max(startMs, nextMs);
}

export function getEventReplayState(): EventReplayState | null {
  return state.eventReplay;
}

export function getEventReplayWindowMs(collisionTimeMs: number): {
  startMs: number;
  endMs: number;
} {
  return {
    startMs: collisionTimeMs - EVENT_REPLAY_REWIND_MS,
    endMs: collisionTimeMs,
  };
}

export function selectConjunctionFromAlert(alert: ConjunctionEvent): void {
  const frozen = normalizeConjunctionAlert(alert, state.objects);
  if (!frozen) return;

  const cpaTimeMs = frozen.time.getTime();
  const sessionKey = conjunctionSessionKey(frozen);
  const relativeVelocityKmS =
    frozen.relativeVelocityKmS > 1e-6
      ? frozen.relativeVelocityKmS
      : alert.relativeVelocityKmS;
  const startMs = cpaTimeMs - getVerificationRewindMs(relativeVelocityKmS);

  setState({
    selectedConjunction: frozen,
    selectedConjunctionSessionKey: sessionKey,
    conjunctionRevision: state.conjunctionRevision + 1,
    verificationTime: {
      cpaTimeMs,
      currentMs: startMs,
      
      playing: true,
      speed: 1,
      relativeVelocityKmS,
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
  const next = { ...state.verificationTime, ...partial, ...(speed !== undefined ? { speed } : {}) };
  if (partial.currentMs !== undefined) {
    next.currentMs = clampVerificationTimeMs(
      next.cpaTimeMs,
      partial.currentMs,
      next.relativeVelocityKmS ?? 0,
    );
  }
  state.verificationTime = next;
  listeners.forEach((fn) => fn());
}

export function advanceVerificationTime(deltaMs: number): void {
  if (!state.verificationTime?.playing) return;
  const vt = state.verificationTime;
  const { endMs } = getVerificationWindowMs(vt.cpaTimeMs, vt.relativeVelocityKmS ?? 0);
  const step = Math.min(Math.max(0, deltaMs), MAX_FOCUSED_CLOCK_FRAME_MS) * vt.speed;
  const nextMs = vt.currentMs + step;
  if (nextMs >= endMs) {
    state.verificationTime = { ...vt, currentMs: endMs, playing: false };
    listeners.forEach((fn) => fn());
    return;
  }
  state.verificationTime.currentMs = nextMs;
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

export function setCategoryFilter(filter: ObjectCategory | 'all'): void {
  if (state.categoryFilter === filter) return;
  setState({ categoryFilter: filter });
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
  const sameContent =
    state.conjunctionHiddenCount === hiddenCount &&
    prev.length === alerts.length &&
    prev.every(
      (c, i) =>
        c.objectA === alerts[i].objectA &&
        c.objectB === alerts[i].objectB &&
        Math.abs(c.distanceKm - alerts[i].distanceKm) < 0.001 &&
        Math.abs(c.time.getTime() - alerts[i].time.getTime()) < 1_000,
    );

  if (sameContent) {
    
    if (alerts.length === 0 && hasUpcomingConjunctionScanCompleted() && !emptyConjunctionScanAcked) {
      emptyConjunctionScanAcked = true;
      listeners.forEach((fn) => fn());
    }
    return;
  }

  emptyConjunctionScanAcked =
    alerts.length === 0 && hasUpcomingConjunctionScanCompleted();
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
    filteredIndices: computeFilteredIndices(
      objects, state.layerFilters, '', null, null, false, 'all',
    ),
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
    showOnlyRecentLaunches: false,
    categoryFilter: 'all',
    conjunctions: [],
    conjunctionHiddenCount: 0,
    conjunctionSortMode: 'time',
    showOrbitTrail: false,
    showGroundTrack: true,
    colorByFunction: true,
    time: {
      mode: 'live',
      current: new Date(),
      speed: 1,
      playing: true,
    },
  };
  listeners.forEach((fn) => fn());
}

export function setConjunctionSortMode(mode: ConjunctionSortMode): void {
  if (state.conjunctionSortMode === mode) return;
  setState({ conjunctionSortMode: mode });
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

export function isEventReplayActive(): boolean {
  return state.eventReplay != null;
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
