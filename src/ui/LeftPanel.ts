
import { LAYER_HEX, type ObjectCategory, type OrbitLayer } from '../types';
import {
  conjunctionSessionKey,
  countConjunctionOverflow,
  hasUpcomingConjunctionScanCompleted,
  isUpcomingConjunctionScanPending,
  selectConjunctionAlertsForDisplay,
  type ConjunctionSortMode,
} from '../orbital/conjunction';
import {
  formatUtcDateTime,
  getListIndices,
  getGlobalSimulationTime,
  getSimulationTime,
  getState,
  isConjunctionVerificationActive,
  isEventReplayActive,
  toggleConjunctionFromAlert,
  selectObject,
  setSearchQuery,
  setConjunctionSortMode,
  setCategoryFilter,
  subscribe,
  toggleLayerFilter,
  setColorByFunction,
} from '../state/appState';
import { initEventCards } from '../ui';

const LAYERS: OrbitLayer[] = ['LEO', 'MEO', 'GEO', 'HEO'];
const CATEGORY_FILTERS: Array<ObjectCategory | 'all'> = ['all', 'active', 'stations', 'debris'];
const LIST_ITEM_HEIGHT_FINE = 36;
const LIST_ITEM_HEIGHT_COARSE = 42;
const LIST_VIEWPORT_HEIGHT_DESKTOP = 200;
const LIST_VIEWPORT_HEIGHT_MOBILE = 160;
const LIST_OVERSCAN = 6;

const LIST_TAP_SLOP_PX = 10;
const SORT_MODES: ConjunctionSortMode[] = ['time', 'criticality'];

function matchesMedia(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}
function listItemHeight(): number {
  return matchesMedia('(pointer: coarse)')
    ? LIST_ITEM_HEIGHT_COARSE
    : LIST_ITEM_HEIGHT_FINE;
}

function listViewportHeight(): number {
  return matchesMedia('(max-width: 860px)')
    ? LIST_VIEWPORT_HEIGHT_MOBILE
    : LIST_VIEWPORT_HEIGHT_DESKTOP;
}

let displayedConjunctions: ReturnType<typeof selectConjunctionAlertsForDisplay> = [];

export function initLeftPanel(container: HTMLElement): void {
  container.innerHTML = `
    <div>
      <div class="search-wrap">
        <input
          type="search"
          id="object-search"
          class="search-input"
          placeholder="Name, NORAD, country, or operator"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <div class="object-list-meta" id="object-list-meta"></div>
      <div class="object-list-viewport" id="object-list-viewport">
        <div class="object-list-spacer" id="object-list-spacer"></div>
        <div class="object-list-items" id="object-list-items"></div>
      </div>

      <h2 class="panel-heading">Orbit Layers</h2>
      <div class="layer-filters" id="layer-filters"></div>

      <h2 class="panel-heading">Object Types</h2>
      <div class="category-filters" id="category-filters"></div>

      <h2 class="panel-heading">Display Options</h2>
      <div class="display-options" id="display-options"></div>

    </div>

    <h2 class="panel-heading">Object Categories</h2>
    <ul class="category-stats" id="category-stats"></ul>

    <h2 class="panel-heading">Live Stats</h2>
    <dl class="stats-list" id="live-stats"></dl>

    <div>
      <h2 class="panel-heading panel-heading--alert">Close Approach Alerts (Next 24h)</h2>
      <p class="panel-lede">These satellites are predicted to come within 3 km of each other. Click any alert to watch the approach.</p>
      <div class="conjunction-filters" id="conjunction-filters"></div>
      <div class="conjunction-list" id="conjunction-list"></div>
    </div>
  `;

  initSearchAndList(container);
  renderLayerFilters(container);
  renderCategoryFilters(container);
  renderDisplayOptions(container);
  renderStats(container);
  renderConjunctionFilters(container);
  renderConjunctions(container);
  initEventCards(container);

  container.addEventListener('change', (e) => {
    const input = (e.target as HTMLElement).closest<HTMLInputElement>(
      '#conjunction-filters input[data-sort]',
    );
    if (!input?.dataset.sort) return;
    setConjunctionSortMode(input.dataset.sort as ConjunctionSortMode);
  });

  container.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLButtonElement>(
      '.conjunction-alert[data-session-key]',
    );
    if (!card) return;

    e.preventDefault();
    const key = card.dataset.sessionKey;
    const match = displayedConjunctions.find((c) => conjunctionSessionKey(c) === key);
    if (match) {
      toggleConjunctionFromAlert(match);
    }
  });

  const refreshLiveStatTime = (): void => {
    const timeEl = container.querySelector('#live-stat-time');
    if (timeEl) {
      timeEl.textContent = formatUtcDateTime(getSimulationTime());
    }
    const now = performance.now();
    if (now - lastConjunctionCountdownMs >= 1_000) {
      lastConjunctionCountdownMs = now;
      refreshConjunctionCountdowns(container);
    }
    requestAnimationFrame(refreshLiveStatTime);
  };
  requestAnimationFrame(refreshLiveStatTime);

  let lastListKey = '';
  let lastSelectedIndex: number | null = null;
  let lastFilterUiKey = '';

  subscribe(() => {
    renderStats(container);
    renderConjunctionFilters(container);
    renderConjunctions(container);

    const state = getState();
    const filterUiKey = [
      Object.entries(state.layerFilters).join(','),
      state.categoryFilter,
      state.colorByFunction,
    ].join('|');
    if (filterUiKey !== lastFilterUiKey) {
      renderLayerFilters(container);
      renderCategoryFilters(container);
      renderDisplayOptions(container);
      lastFilterUiKey = filterUiKey;
    }

    const viewport = container.querySelector('#object-list-viewport') as HTMLElement;
    const scrollBucket = Math.floor(viewport.scrollTop / listItemHeight());
    const listKey = [
      state.searchQuery,
      scrollBucket,
      state.objects.length,
      state.filteredIndices.length,
      state.categoryFilter,
      Object.entries(state.layerFilters).join(','),
      state.altitudeFilter?.minKm,
      state.altitudeFilter?.maxKm,
      state.inclinationFilter?.minDeg,
      state.inclinationFilter?.maxDeg,
    ].join('|');

    if (listKey !== lastListKey) {
      renderObjectList(container);
      lastListKey = listKey;
      lastSelectedIndex = state.selectedIndex;
    } else if (state.selectedIndex !== lastSelectedIndex) {
      updateListSelectionHighlight(container);
      lastSelectedIndex = state.selectedIndex;
    }
  });
}

function initSearchAndList(container: HTMLElement): void {
  const searchInput = container.querySelector('#object-search') as HTMLInputElement;
  const viewport = container.querySelector('#object-list-viewport') as HTMLElement;

  searchInput.addEventListener('input', () => {
    setSearchQuery(searchInput.value);
    viewport.scrollTop = 0;
    renderObjectList(container);
  });

  viewport.addEventListener('scroll', () => renderObjectList(container));

  
  
  let listPointer: { id: number; x: number; y: number; index: number } | null = null;
  let listPointerDragged = false;

  const clearListPointer = (): void => {
    listPointer = null;
    listPointerDragged = false;
  };

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.object-list-item[data-index]');
    if (!btn) return;
    const index = Number(btn.dataset.index);
    if (!Number.isInteger(index) || index < 0) return;
    listPointer = { id: e.pointerId, x: e.clientX, y: e.clientY, index };
    listPointerDragged = false;
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!listPointer || e.pointerId !== listPointer.id || listPointerDragged) return;
    const dx = e.clientX - listPointer.x;
    const dy = e.clientY - listPointer.y;
    if (Math.hypot(dx, dy) > LIST_TAP_SLOP_PX) {
      listPointerDragged = true;
    }
  });

  viewport.addEventListener('pointerup', (e) => {
    if (!listPointer || e.pointerId !== listPointer.id) return;
    const { index } = listPointer;
    const dragged = listPointerDragged;
    clearListPointer();
    if (dragged) return;
    selectObject(index);
    updateListSelectionHighlight(container);
  });

  viewport.addEventListener('pointercancel', (e) => {
    if (listPointer && e.pointerId === listPointer.id) clearListPointer();
  });

  renderObjectList(container);
}

function renderObjectList(container: HTMLElement): void {
  const state = getState();
  const indices = getListIndices();
  const viewport = container.querySelector('#object-list-viewport') as HTMLElement;
  const spacer = container.querySelector('#object-list-spacer') as HTMLElement;
  const itemsEl = container.querySelector('#object-list-items') as HTMLElement;

  const total = indices.length;

  const itemHeight = listItemHeight();
  spacer.style.height = `${total * itemHeight}px`;

  const scrollTop = viewport.scrollTop;
  const visibleCount = Math.ceil(listViewportHeight() / itemHeight) + LIST_OVERSCAN;
  const start = Math.max(0, Math.floor(scrollTop / itemHeight));
  const end = Math.min(total, start + visibleCount);

  itemsEl.style.transform = `translateY(${start * itemHeight}px)`;
  itemsEl.innerHTML = indices.slice(start, end).map((index) => renderListItem(state, index)).join('');
}

function renderListItem(state: ReturnType<typeof getState>, index: number): string {
  const obj = state.objects[index];
  const selected = state.selectedIndex === index;
  const name = escapeHtml(obj.name.trim() || `NORAD ${obj.noradId}`);
  return `
    <button type="button" class="object-list-item${selected ? ' object-list-item--selected' : ''}" data-index="${index}">
      <span class="object-list-name">${name}</span>
      <span class="object-list-norad">${obj.noradId}</span>
    </button>
  `;
}

function updateListSelectionHighlight(container: HTMLElement): void {
  const selectedIndex = getState().selectedIndex;
  container.querySelectorAll('.object-list-item').forEach((el) => {
    const index = Number((el as HTMLElement).dataset.index);
    el.classList.toggle('object-list-item--selected', index === selectedIndex);
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLayerFilters(container: HTMLElement): void {
  const filtersEl = container.querySelector('#layer-filters')!;
  const { layerFilters } = getState();

  filtersEl.innerHTML = `
    <div class="filter-chip-grid" role="group" aria-label="Orbit Layers">
      ${LAYERS.map(
        (layer) => `
          <button
            type="button"
            class="filter-chip${layerFilters[layer] ? ' filter-chip--on' : ''}"
            data-layer="${layer}"
            aria-pressed="${layerFilters[layer]}"
          >
            <span class="filter-chip-dot" style="background: ${LAYER_HEX[layer]}"></span>
            <span class="filter-chip-label">${layer}</span>
          </button>
        `,
      ).join('')}
    </div>
  `;

  filtersEl.querySelectorAll<HTMLButtonElement>('button[data-layer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const layer = btn.dataset.layer as OrbitLayer;
      toggleLayerFilter(layer);
    });
  });
}

function renderCategoryFilters(container: HTMLElement): void {
  const el = container.querySelector('#category-filters');
  if (!el) return;
  const { categoryFilter } = getState();

  el.innerHTML = `
    <div class="filter-segment" role="radiogroup" aria-label="Object Types">
      ${CATEGORY_FILTERS.map(
        (cat) => `
          <button 
            type="button"
            data-category="${cat}"
            class="filter-segment-option${categoryFilter === cat ? ' filter-segment-option--on' : ''}"
          >
            <span>${cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
          </button>
        `,
      ).join('')}
    </div>
  `;

  el.querySelectorAll<HTMLButtonElement>('button[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category as ObjectCategory | 'all';
      setCategoryFilter(category);
    });
  });
}

function renderDisplayOptions(container: HTMLElement): void {
  const optionsEl = container.querySelector('#display-options')!;
  const { colorByFunction } = getState();

  optionsEl.innerHTML = `
    <button
      type="button"
      class="filter-toggle-card${colorByFunction ? ' filter-toggle-card--on' : ''}"
      id="color-by-function"
      aria-pressed="${colorByFunction}"
    >
      <span class="filter-toggle-copy">
        <strong>Color by Function</strong>
        <span class="muted">Starlink · Stations · Active · Debris</span>
      </span>
    </button>
  `;

  const colorBtn = optionsEl.querySelector('#color-by-function') as HTMLButtonElement;
  colorBtn.addEventListener('click', () => {
    setColorByFunction(!getState().colorByFunction);
  });

}

function renderStats(container: HTMLElement): void {
  const state = getState();
  const { stats, time } = state;
  const isLive =
    time.mode === 'live' &&
    !isEventReplayActive() &&
    !isConjunctionVerificationActive();
  const simTime = getSimulationTime();

  const categoryEl = container.querySelector('#category-stats')!;
  categoryEl.innerHTML = `
    <li><span>Active Satellites</span><strong>${stats.categoryCounts.active.toLocaleString()}</strong></li>
    <li><span>Debris</span><strong>${stats.categoryCounts.debris.toLocaleString()}</strong></li>
    <li><span>Space Stations</span><strong>${stats.categoryCounts.stations.toLocaleString()}</strong></li>
  `;

  const fetchedDate = stats.fetchedAt
    ? new Date(stats.fetchedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '—';

  const liveEl = container.querySelector('#live-stats')!;
  const timeLabel = isLive ? 'UTC Time' : 'Sim Time';
  const visibleCount = state.filteredIndices.length;
  const closeApproachTotal = state.conjunctions.length + state.conjunctionHiddenCount;

  liveEl.innerHTML = `
    <div class="stat-row"><dt>${timeLabel}</dt><dd id="live-stat-time">${formatUtcDateTime(simTime)}</dd></div>
    <div class="stat-row"><dt>Total Objects</dt><dd>${stats.total.toLocaleString()}</dd></div>
    <div class="stat-row"><dt>Visible</dt><dd>${visibleCount.toLocaleString()}</dd></div>
    <div class="stat-row"><dt>Close Approaches (24h)</dt><dd>${closeApproachTotal.toLocaleString()}</dd></div>
    <div class="stat-row"><dt>Data Updated</dt><dd>${fetchedDate}</dd></div>
  `;
}

function renderConjunctionFilters(container: HTMLElement): void {
  const el = container.querySelector('#conjunction-filters');
  if (!el) return;
  const { conjunctionSortMode } = getState();

  const sortLabels: Record<string, string> = { time: 'By Time', criticality: 'By Distance' };
  const options = SORT_MODES.map(
    (mode) => `
      <label class="conjunction-sort-option">
        <input
          type="radio"
          name="conjunction-sort"
          value="${mode}"
          data-sort="${mode}"
          ${conjunctionSortMode === mode ? 'checked' : ''}
        />
        <span>${sortLabels[mode] ?? mode}</span>
      </label>
    `,
  ).join('');

  el.innerHTML = `
    <div class="conjunction-sort" role="radiogroup" aria-label="Sort alerts">
      ${options}
    </div>
  `;
}

function getVisibleConjunctions() {
  const { conjunctions, conjunctionSortMode } = getState();
  return selectConjunctionAlertsForDisplay(conjunctions, {
    nowMs: getGlobalSimulationTime().getTime(),
    sortMode: conjunctionSortMode,
  });
}

function renderConjunctions(container: HTMLElement): void {
  const { conjunctions, conjunctionHiddenCount, selectedConjunctionSessionKey, conjunctionSortMode } =
    getState();
  const listEl = container.querySelector('#conjunction-list')!;

  if (conjunctions.length === 0) {
    previousAlertKeys.clear();
    lastConjunctionStructureKey = '';
    displayedConjunctions = [];
    const stillScanning =
      isUpcomingConjunctionScanPending() || !hasUpcomingConjunctionScanCompleted();
    const emptyText = stillScanning ? 'Scanning...' : 'No close approaches predicted in the next 24h.';
    const existing = listEl.querySelector('.conjunction-empty');
    if (existing && !listEl.querySelector('.conjunction-alert')) {
      if (existing.textContent !== emptyText) existing.textContent = emptyText;
      return;
    }
    listEl.innerHTML = `<p class="muted conjunction-empty">${emptyText}</p>`;
    return;
  }

  const visible = getVisibleConjunctions();
  displayedConjunctions = visible;
  const nowMs = getGlobalSimulationTime().getTime();
  const overflowTotal = countConjunctionOverflow(conjunctions, {
    nowMs,
    displayedCount: visible.length,
    hiddenCount: conjunctionHiddenCount,
  });

  if (visible.length === 0) {
    previousAlertKeys.clear();
    lastConjunctionStructureKey = 'filtered-empty';
    listEl.innerHTML = `<p class="muted conjunction-empty">No close approaches predicted in the next 24h.</p>`;
    return;
  }

  const structureKey = [
    selectedConjunctionSessionKey ?? '',
    conjunctionSortMode,
    ...visible.map(
      (c) =>
        `${conjunctionSessionKey(c)}:${c.distanceKm.toFixed(2)}:${c.time.getTime()}`,
    ),
  ].join('|');

  
  
  if (
    structureKey === lastConjunctionStructureKey &&
    listEl.querySelectorAll('.conjunction-alert').length === visible.length
  ) {
    updateConjunctionAlertTexts(listEl, visible, nowMs);
    updateConjunctionOverflow(listEl, overflowTotal);
    return;
  }

  lastConjunctionStructureKey = structureKey;
  const nextKeys = new Set<string>();
  const alertsHtml = visible
    .map((c) => {
      const sessionKey = conjunctionSessionKey(c);
      const isNew = !previousAlertKeys.has(sessionKey);
      const isActive = sessionKey === selectedConjunctionSessionKey;
      nextKeys.add(sessionKey);
      return `
        <button
          type="button"
          class="conjunction-alert${isNew ? ' conjunction-alert--new' : ''}${isActive ? ' conjunction-alert--active' : ''}"
          data-session-key="${escapeHtml(sessionKey)}"
        >
          <span class="conjunction-alert-text">${escapeHtml(formatAlertMessage(c, nowMs))}</span>
        </button>
      `;
    })
    .join('');

  listEl.innerHTML = alertsHtml;
  updateConjunctionOverflow(listEl, overflowTotal);
  previousAlertKeys = nextKeys;
}

function formatConjunctionOverflowText(overflowTotal: number): string {
  return `+${overflowTotal.toLocaleString()} more`;
}

function updateConjunctionOverflow(listEl: Element, overflowTotal: number): void {
  let moreEl = listEl.querySelector('.conjunction-more');
  if (overflowTotal <= 0) {
    moreEl?.remove();
    return;
  }
  const text = formatConjunctionOverflowText(overflowTotal);
  if (!moreEl) {
    moreEl = document.createElement('p');
    moreEl.className = 'conjunction-more muted';
    listEl.appendChild(moreEl);
  }
  if (moreEl.textContent !== text) {
    moreEl.textContent = text;
  }
}

function formatAlertMessage(c: { objectA: string; objectB: string; distanceKm: number; time: Date }, nowMs: number): string {
  const msUntil = c.time.getTime() - nowMs;
  const distStr = c.distanceKm.toFixed(2);
  if (msUntil > 1000) {
    return `${c.objectA} ↔ ${c.objectB} — ${distStr} km in ${formatTimeUntil(msUntil)}`;
  }
  return `${c.objectA} ↔ ${c.objectB} — ${distStr} km`;
}

function updateConjunctionAlertTexts(
  listEl: Element,
  conjunctions: { objectA: string; objectB: string; distanceKm: number; time: Date }[],
  nowMs: number,
): void {
  const texts = listEl.querySelectorAll('.conjunction-alert-text');
  conjunctions.forEach((c, i) => {
    const el = texts[i];
    if (!el) return;
    const message = formatAlertMessage(c, nowMs);
    if (el.textContent !== message) el.textContent = message;
  });
}

function refreshConjunctionCountdowns(container: HTMLElement): void {
  const listEl = container.querySelector('#conjunction-list');
  if (!listEl) return;
  const { conjunctions } = getState();
  if (conjunctions.length === 0) {
    renderConjunctions(container);
    return;
  }
  const visible = getVisibleConjunctions();
  displayedConjunctions = visible;
  if (visible.length === 0) {
    renderConjunctions(container);
    return;
  }
  if (listEl.querySelectorAll('.conjunction-alert').length !== visible.length) {
    renderConjunctions(container);
    return;
  }
  updateConjunctionAlertTexts(listEl, visible, getGlobalSimulationTime().getTime());
}

let previousAlertKeys = new Set<string>();
let lastConjunctionStructureKey = '';
let lastConjunctionCountdownMs = 0;

function formatTimeUntil(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

