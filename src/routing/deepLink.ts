

import {
  getState,
  subscribe,
  selectObject,
  clearObjectSelection,
  selectHistoricalEvent,
  clearHistoricalEventSelection,
} from '../state/appState';
import { getHistoricalEvent } from '../ui/EventCards';
import type { TrackedObject } from '../types';

function getParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

function buildSearch(key: string | null, value: string | null): string {
  if (!key || !value) return '';
  const p = new URLSearchParams();
  p.set(key, value);
  return '?' + p.toString();
}

let noradToIndex: Map<number, number> = new Map();

function buildLookup(objects: TrackedObject[]): void {
  noradToIndex = new Map(objects.map((o, i) => [o.noradId, i]));
}

let suppressNextUrlWrite = false;

let lastWrittenSearch = window.location.search;

function writeUrl(search: string, push: boolean): void {
  if (search === lastWrittenSearch) return;
  lastWrittenSearch = search;
  const url = window.location.pathname + search;
  if (push) {
    history.pushState(null, '', url);
  } else {
    history.replaceState(null, '', url);
  }
}

function onStateChange(objects: TrackedObject[]): void {
  if (suppressNextUrlWrite) {
    suppressNextUrlWrite = false;
    return;
  }

  const { selectedIndex, selectedEventId } = getState();

  if (selectedEventId) {
    
    writeUrl(buildSearch('event', selectedEventId), true);
    return;
  }

  if (selectedIndex != null) {
    const obj = objects[selectedIndex];
    if (obj) {
      writeUrl(buildSearch('object', String(obj.noradId)), true);
      return;
    }
  }

  
  writeUrl('', false);
}

function applyUrl(): void {
  const eventId = getParam('event');
  const noradStr = getParam('object');

  if (eventId && getHistoricalEvent(eventId)) {
    selectHistoricalEvent(eventId);
    return;
  }

  if (noradStr) {
    const norad = parseInt(noradStr, 10);
    if (!Number.isNaN(norad)) {
      const idx = noradToIndex.get(norad);
      if (idx != null) {
        selectObject(idx);
        return;
      }
    }
  }

  
  const { selectedIndex, selectedEventId, eventReplay } = getState();
  if (eventReplay || selectedEventId) clearHistoricalEventSelection();
  if (selectedIndex != null) clearObjectSelection();
}

export function initDeepLink(objects: TrackedObject[]): void {
  buildLookup(objects);

  
  
  
  
  lastWrittenSearch = window.location.search;
  applyUrl();

  
  subscribe(() => onStateChange(objects));

  
  window.addEventListener('popstate', () => {
    suppressNextUrlWrite = true;
    lastWrittenSearch = window.location.search; 
    applyUrl();
  });
}
