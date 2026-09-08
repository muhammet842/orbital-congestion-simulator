import type { AppStats, ObjectCategory, OrbitLayer, TimeMode, TimeState, TrackedObject } from '../types';

export interface AppState {
  objects: TrackedObject[];
  filteredIndices: number[];
  selectedIndex: number | null;
  searchQuery: string;
  layerFilters: Record<OrbitLayer, boolean>;
  altitudeFilter: { minKm: number; maxKm: number } | null;
  inclinationFilter: { minDeg: number; maxDeg: number } | null;
  categoryFilter: ObjectCategory | 'all';
  time: TimeState;
  stats: AppStats;
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
  searchQuery: '',
  layerFilters: { ...defaultLayerFilters },
  altitudeFilter: null,
  inclinationFilter: null,
  categoryFilter: 'all',
  time: { mode: 'live', current: new Date(), speed: 1, playing: true },
  stats: {
    total: 0,
    leoPercent: 0,
    avgAltitude: 0,
    categoryCounts: { active: 0, debris: 0, stations: 0 },
    fetchedAt: '',
  },
  colorByFunction: true,
};

const listeners = new Set<Listener>();
let sortedAllIndices: number[] = [];

export function getState(): AppState {
  return state;
}

export function getSimulationTime(): Date {
  return state.time.mode === 'live' ? new Date() : state.time.current;
}

export function getGlobalSimulationTime(): Date {
  return getSimulationTime();
}

export function formatUtcDateTime(date: Date): string {
  const utcTime = date.toISOString().slice(11, 19);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  const year = date.getUTCFullYear();
  return `${utcTime} UTC · ${day} ${month} ${year}`;
}

export function enterLiveMode(): void {
  setState({ time: { mode: 'live', current: new Date(), speed: 1, playing: true } });
}

export function jumpToNow(): void {
  enterHistoricalMode({ current: new Date(), speed: 1, playing: state.time.playing });
}

export function enterHistoricalMode(updates: Partial<TimeState> = {}): void {
  const speed = updates.speed !== undefined ? Math.min(updates.speed, 100) : undefined;
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
    partial.categoryFilter !== undefined
  ) {
    state.filteredIndices = computeFilteredIndices(
      state.objects,
      state.layerFilters,
      state.searchQuery,
      state.altitudeFilter,
      state.inclinationFilter,
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
  categoryFilter: ObjectCategory | 'all' = 'all',
): number[] {
  const query = searchQuery.trim().toLowerCase();
  const indices: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    if (!layerFilters[object.layer]) continue;
    if (categoryFilter !== 'all' && object.category !== categoryFilter) continue;
    if (query && !objectMatchesQuery(object, query)) continue;
    if (altitudeFilter && (object.meanAltitudeKm < altitudeFilter.minKm || object.meanAltitudeKm > altitudeFilter.maxKm)) continue;
    if (inclinationFilter && (object.inclinationDeg < inclinationFilter.minDeg || object.inclinationDeg > inclinationFilter.maxDeg)) continue;
    indices.push(i);
  }
  return indices;
}

export function objectMatchesQuery(object: TrackedObject, queryLower: string): boolean {
  const normalized = queryLower.replace(/turkiye/g, 'türkiye').replace(/turkey/g, 'türkiye');
  return (
    object.name.toLowerCase().includes(normalized) ||
    String(object.noradId).includes(normalized) ||
    object.country.toLowerCase().includes(normalized) ||
    object.owner.toLowerCase().includes(normalized)
  );
}

export function matchesSearchQuery(object: TrackedObject, searchQuery: string): boolean {
  const query = searchQuery.trim().toLowerCase();
  return !query || objectMatchesQuery(object, query);
}

export function getSortedObjectIndices(): number[] {
  return sortedAllIndices;
}

export function getListIndices(): number[] {
  const allowed = new Set(state.filteredIndices);
  return sortedAllIndices.filter((index) => allowed.has(index));
}

export function setSearchQuery(query: string): void {
  setState({ searchQuery: query });
}

export function selectObject(index: number): void {
  setState({ selectedIndex: index });
}

export function clearObjectSelection(): void {
  if (state.selectedIndex == null) return;
  setState({ selectedIndex: null });
}

export function setColorByFunction(enabled: boolean): void {
  if (state.colorByFunction === enabled) return;
  setState({ colorByFunction: enabled });
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

export function initState(objects: TrackedObject[], stats: AppStats): void {
  sortedAllIndices = objects
    .map((_, index) => index)
    .sort((a, b) => objects[a].name.localeCompare(objects[b].name, 'en', { sensitivity: 'base' }));
  state = {
    ...state,
    objects,
    filteredIndices: computeFilteredIndices(objects, state.layerFilters),
    stats,
    selectedIndex: null,
    searchQuery: '',
    altitudeFilter: null,
    inclinationFilter: null,
    categoryFilter: 'all',
    colorByFunction: true,
    time: { mode: 'live', current: new Date(), speed: 1, playing: true },
  };
  listeners.forEach((fn) => fn());
}

export function toggleLayerFilter(layer: OrbitLayer): void {
  setState({ layerFilters: { ...state.layerFilters, [layer]: !state.layerFilters[layer] } });
}

export function setTimePartial(partial: Partial<TimeState>): void {
  const next: TimeState = { ...state.time, ...partial };
  if (next.mode === 'live') next.speed = 1;
  setState({ time: next });
}

export function advanceSimulationTime(current: Date): void {
  if (state.time.mode !== 'historical') return;
  state.time.current = current;
}

export function isLiveMode(): boolean {
  return state.time.mode === 'live';
}

export function getTimeModeLabel(mode: TimeMode): string {
  return mode === 'live' ? 'LIVE' : 'Historical';
}
