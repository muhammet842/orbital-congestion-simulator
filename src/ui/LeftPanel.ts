import { LAYER_HEX, type OrbitLayer } from '../types';
import {
  conjunctionSessionKey,
  filterConjunctionAlerts,
  hasUpcomingConjunctionScanCompleted,
  isUpcomingConjunctionScanPending,
  type ConjunctionHorizonHours,
  type ConjunctionRiskFilter,
} from '../orbital/conjunction';
import {
  formatUtcDateTime,
  getListIndices,
  getGlobalSimulationTime,
  getSimulationTime,
  getState,
  getTimeModeLabel,
  toggleConjunctionFromAlert,
  selectObject,
  setSearchQuery,
  setConjunctionHorizonHours,
  setConjunctionRiskFilter,
  subscribe,
  toggleLayerFilter,
  setColorByFunction,
  setShowOnlyRecentLaunches,
  setAltitudeFilter,
  setInclinationFilter,
  resetAdvancedFilters,
} from '../state/appState';
import { initEventCards } from './EventCards';
import { t, applyTranslations, onLangChange } from '../i18n/i18n';
import { isRecentlyLaunched, hasAnyRecentlyLaunched } from '../data/newLaunches';

const LAYERS: OrbitLayer[] = ['LEO', 'MEO', 'GEO', 'HEO'];
const LIST_ITEM_HEIGHT = 36;
const LIST_VIEWPORT_HEIGHT = 200;
const LIST_OVERSCAN = 6;
const HORIZON_OPTIONS: ConjunctionHorizonHours[] = [1, 6, 12, 24];
const RISK_OPTIONS: ConjunctionRiskFilter[] = ['all', 'critical', 'monitoring'];

/** Currently visible (filtered) alert cards — click handler reads this, not the raw pool. */
let displayedConjunctions: ReturnType<typeof filterConjunctionAlerts> = [];

export function initLeftPanel(container: HTMLElement): void {
  container.innerHTML = `
    <h2 class="panel-heading" data-i18n="ui.search_objects">Search Objects</h2>
    <div class="search-wrap">
      <input
        type="search"
        id="object-search"
        class="search-input"
        placeholder="${t('ui.search_ph')}"
        data-i18n-ph="ui.search_ph"
        autocomplete="off"
        spellcheck="false"
      />
    </div>
    <div class="object-list-meta" id="object-list-meta"></div>
    <div class="object-list-viewport" id="object-list-viewport">
      <div class="object-list-spacer" id="object-list-spacer"></div>
      <div class="object-list-items" id="object-list-items"></div>
    </div>

    <h2 class="panel-heading" data-i18n="ui.orbit_layers">Orbit Layers</h2>
    <div class="layer-filters" id="layer-filters"></div>

    <h2 class="panel-heading" data-i18n="ui.display_options">Display Options</h2>
    <div class="display-options" id="display-options"></div>

    <h2 class="panel-heading" data-i18n="ui.object_categories">Object Categories</h2>
    <ul class="category-stats" id="category-stats"></ul>

    <h2 class="panel-heading" data-i18n="ui.live_stats">Live Stats</h2>
    <dl class="stats-list" id="live-stats"></dl>

    <h2 class="panel-heading panel-heading--alert" data-i18n="ui.close_approach">Close Approach Alerts (Next 24h)</h2>
    <div class="conjunction-filters" id="conjunction-filters"></div>
    <div class="conjunction-list" id="conjunction-list"></div>

    <h2 class="panel-heading" data-i18n="ui.advanced_filters">Advanced Filters</h2>
    <div class="advanced-filters" id="advanced-filters"></div>
  `;

  initSearchAndList(container);
  renderLayerFilters(container);
  renderDisplayOptions(container);
  renderStats(container);
  renderConjunctionFilters(container);
  renderConjunctions(container);
  initEventCards(container);
  initAdvancedFilters(container);

  container.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>(
      '#conjunction-filters [data-horizon], #conjunction-filters [data-risk]',
    );
    if (chip) {
      e.preventDefault();
      const horizon = chip.dataset.horizon;
      const risk = chip.dataset.risk;
      if (horizon) {
        setConjunctionHorizonHours(Number(horizon) as ConjunctionHorizonHours);
      }
      if (risk) {
        setConjunctionRiskFilter(risk as ConjunctionRiskFilter);
      }
      return;
    }

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

  // On language change: update data-i18n labels and re-render dynamic sections
  onLangChange(() => {
    applyTranslations(container);
    renderDisplayOptions(container);
    renderStats(container);
    renderConjunctionFilters(container);
    renderConjunctions(container);
    renderAdvancedFilters(container);
  });

  let lastListKey = '';
  let lastSelectedIndex: number | null = null;

  subscribe(() => {
    renderStats(container);
    renderConjunctionFilters(container);
    renderConjunctions(container);

    const state = getState();
    const viewport = container.querySelector('#object-list-viewport') as HTMLElement;
    const scrollBucket = Math.floor(viewport.scrollTop / LIST_ITEM_HEIGHT);
    const listKey = `${state.searchQuery}|${scrollBucket}|${state.objects.length}`;

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

  viewport.addEventListener('pointerdown', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.object-list-item[data-index]');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const index = Number(btn.dataset.index);
    if (!Number.isInteger(index) || index < 0) return;

    selectObject(index);
    updateListSelectionHighlight(container);
  });

  renderObjectList(container);
}

function renderObjectList(container: HTMLElement): void {
  const state = getState();
  const indices = getListIndices();
  const viewport = container.querySelector('#object-list-viewport') as HTMLElement;
  const spacer = container.querySelector('#object-list-spacer') as HTMLElement;
  const itemsEl = container.querySelector('#object-list-items') as HTMLElement;
  const metaEl = container.querySelector('#object-list-meta') as HTMLElement;

  const total = indices.length;
  metaEl.textContent = state.searchQuery.trim()
    ? `${total.toLocaleString()} match${total === 1 ? '' : 'es'}`
    : `${total.toLocaleString()} objects · A–Z`;

  spacer.style.height = `${total * LIST_ITEM_HEIGHT}px`;

  const scrollTop = viewport.scrollTop;
  const visibleCount = Math.ceil(LIST_VIEWPORT_HEIGHT / LIST_ITEM_HEIGHT) + LIST_OVERSCAN;
  const start = Math.max(0, Math.floor(scrollTop / LIST_ITEM_HEIGHT));
  const end = Math.min(total, start + visibleCount);

  itemsEl.style.transform = `translateY(${start * LIST_ITEM_HEIGHT}px)`;
  itemsEl.innerHTML = indices.slice(start, end).map((index) => renderListItem(state, index)).join('');
}

function renderListItem(state: ReturnType<typeof getState>, index: number): string {
  const obj = state.objects[index];
  const selected = state.selectedIndex === index;
  const name = escapeHtml(obj.name.trim() || `NORAD ${obj.noradId}`);
  const newBadge = isRecentlyLaunched(obj)
    ? `<span class="new-launch-badge" title="${escapeHtml(t('badge.new_launch_title'))}">${t('badge.new_launch')}</span>`
    : '';
  return `
    <button type="button" class="object-list-item${selected ? ' object-list-item--selected' : ''}" data-index="${index}">
      <span class="object-list-name">${name}${newBadge}</span>
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
  filtersEl.innerHTML = LAYERS.map(
    (layer) => `
      <label class="filter-row">
        <input type="checkbox" data-layer="${layer}" checked />
        <span class="layer-dot" style="background: ${LAYER_HEX[layer]}"></span>
        ${layer}
      </label>
    `,
  ).join('');

  filtersEl.querySelectorAll('input[data-layer]').forEach((input) => {
    input.addEventListener('change', () => {
      const layer = (input as HTMLInputElement).dataset.layer as OrbitLayer;
      toggleLayerFilter(layer);
    });
  });

  subscribe(() => {
    const state = getState();
    filtersEl.querySelectorAll('input[data-layer]').forEach((input) => {
      const layer = (input as HTMLInputElement).dataset.layer as OrbitLayer;
      (input as HTMLInputElement).checked = state.layerFilters[layer];
    });
  });
}

function renderDisplayOptions(container: HTMLElement): void {
  const optionsEl = container.querySelector('#display-options')!;
  const showRecentToggle = hasAnyRecentlyLaunched(getState().objects);

  optionsEl.innerHTML = `
    <label class="filter-row filter-row--toggle">
      <input type="checkbox" id="color-by-function" />
      <span class="function-legend" aria-hidden="true">
        <span class="function-dot function-dot--starlink" title="Starlink"></span>
        <span class="function-dot function-dot--station" title="Stations"></span>
        <span class="function-dot function-dot--active" title="Active"></span>
        <span class="function-dot function-dot--debris" title="Debris"></span>
      </span>
      ${t('ui.color_by_function')}
    </label>
    <p class="display-options-hint muted">${t('ui.cbf_hint')}</p>
    ${
      showRecentToggle
        ? `
    <label class="filter-row filter-row--toggle">
      <input type="checkbox" id="show-recent-launches" />
      <span class="new-launch-badge" aria-hidden="true">${t('badge.new_launch')}</span>
      ${t('ui.recent_launches')}
    </label>
    `
        : ''
    }
  `;

  const checkbox = optionsEl.querySelector('#color-by-function') as HTMLInputElement;
  checkbox.addEventListener('change', () => {
    setColorByFunction(checkbox.checked);
  });

  const recentCheckbox = optionsEl.querySelector('#show-recent-launches') as HTMLInputElement | null;
  recentCheckbox?.addEventListener('change', () => {
    setShowOnlyRecentLaunches(recentCheckbox.checked);
  });

  // If the toggle just got hidden (e.g. the recent-launch window rolled past
  // for every object), make sure we're not left silently filtering the list
  // down to nothing via a now-invisible control.
  if (!showRecentToggle && getState().showOnlyRecentLaunches) {
    setShowOnlyRecentLaunches(false);
  }

  subscribe(() => {
    checkbox.checked = getState().colorByFunction;
    if (recentCheckbox) recentCheckbox.checked = getState().showOnlyRecentLaunches;
  });
}

function renderStats(container: HTMLElement): void {
  const state = getState();
  const { stats, time } = state;
  const isLive = time.mode === 'live';
  const simTime = getSimulationTime();

  const categoryEl = container.querySelector('#category-stats')!;
  categoryEl.innerHTML = `
    <li><span>${t('cat.active')}</span><strong>${stats.categoryCounts.active.toLocaleString()}</strong></li>
    <li><span>${t('cat.debris')}</span><strong>${stats.categoryCounts.debris.toLocaleString()}</strong></li>
    <li><span>${t('cat.stations')}</span><strong>${stats.categoryCounts.stations.toLocaleString()}</strong></li>
  `;

  const fetchedDate = stats.fetchedAt
    ? new Date(stats.fetchedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '—';

  const tleAgeDays = stats.fetchedAt
    ? (Date.now() - new Date(stats.fetchedAt).getTime()) / 86_400_000
    : 0;

  const tleStaleHtml = tleAgeDays > 7
    ? `<div class="tle-stale-banner tle-stale-banner--critical">⚠ ${t('tle.critical').replace('{n}', String(Math.floor(tleAgeDays)))}</div>`
    : tleAgeDays > 3
    ? `<div class="tle-stale-banner tle-stale-banner--warn">⚠ ${t('tle.warn').replace('{n}', String(Math.floor(tleAgeDays)))}</div>`
    : '';

  const liveEl = container.querySelector('#live-stats')!;
  const modeClass = isLive ? 'stat-value--live' : 'stat-value--historical';
  const timeLabel = isLive ? t('stats.utc_time') : t('stats.sim_time');

  liveEl.innerHTML = `
    ${tleStaleHtml}
    <div class="stat-row"><dt>${t('stats.mode')}</dt><dd class="${modeClass}">${getTimeModeLabel(time.mode)}</dd></div>
    <div class="stat-row"><dt>${timeLabel}</dt><dd id="live-stat-time">${formatUtcDateTime(simTime)}</dd></div>
    <div class="stat-row"><dt>${t('stats.total')}</dt><dd>${stats.total.toLocaleString()}</dd></div>
    <div class="stat-row"><dt>${t('stats.leo')}</dt><dd>${stats.leoPercent}%</dd></div>
    <div class="stat-row"><dt>${t('stats.avg_alt')}</dt><dd>${stats.avgAltitude.toLocaleString()} km</dd></div>
    <div class="stat-row"><dt>${t('stats.tle_updated')}</dt><dd>${fetchedDate}</dd></div>
  `;
}

function renderConjunctionFilters(container: HTMLElement): void {
  const el = container.querySelector('#conjunction-filters');
  if (!el) return;
  const { conjunctionHorizonHours, conjunctionRiskFilter } = getState();

  const horizonChips = HORIZON_OPTIONS.map(
    (h) => `
      <button
        type="button"
        class="conjunction-filter-chip${conjunctionHorizonHours === h ? ' active' : ''}"
        data-horizon="${h}"
      >${t('conj.filter_horizon').replace('{h}', String(h))}</button>
    `,
  ).join('');

  const riskChips = RISK_OPTIONS.map(
    (r) => `
      <button
        type="button"
        class="conjunction-filter-chip${conjunctionRiskFilter === r ? ' active' : ''}"
        data-risk="${r}"
      >${t(`conj.filter_risk_${r}`)}</button>
    `,
  ).join('');

  el.innerHTML = `
    <div class="conjunction-filter-row" role="group" aria-label="${t('conj.filter_time_label')}">
      <span class="conjunction-filter-label">${t('conj.filter_time_label')}</span>
      <div class="conjunction-filter-chips">${horizonChips}</div>
    </div>
    <div class="conjunction-filter-row" role="group" aria-label="${t('conj.filter_risk_label')}">
      <span class="conjunction-filter-label">${t('conj.filter_risk_label')}</span>
      <div class="conjunction-filter-chips">${riskChips}</div>
    </div>
  `;
}

function getVisibleConjunctions() {
  const {
    conjunctions,
    conjunctionHorizonHours,
    conjunctionRiskFilter,
  } = getState();
  return filterConjunctionAlerts(conjunctions, {
    nowMs: getGlobalSimulationTime().getTime(),
    horizonHours: conjunctionHorizonHours,
    risk: conjunctionRiskFilter,
  });
}

function renderConjunctions(container: HTMLElement): void {
  const { conjunctions, conjunctionHiddenCount, selectedConjunctionSessionKey } = getState();
  const listEl = container.querySelector('#conjunction-list')!;

  if (conjunctions.length === 0) {
    previousAlertKeys.clear();
    lastConjunctionStructureKey = '';
    displayedConjunctions = [];
    const stillScanning =
      isUpcomingConjunctionScanPending() || !hasUpcomingConjunctionScanCompleted();
    const emptyText = t(stillScanning ? 'conj.scanning' : 'conj.empty');
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

  if (visible.length === 0) {
    previousAlertKeys.clear();
    lastConjunctionStructureKey = 'filtered-empty';
    listEl.innerHTML = `<p class="muted conjunction-empty">${t('conj.filter_empty')}</p>`;
    return;
  }

  const structureKey = [
    selectedConjunctionSessionKey ?? '',
    String(conjunctionHiddenCount),
    getState().conjunctionHorizonHours,
    getState().conjunctionRiskFilter,
    ...visible.map(
      (c) =>
        `${conjunctionSessionKey(c)}:${c.distanceKm.toFixed(2)}:${c.time.getTime()}`,
    ),
  ].join('|');

  // Same cards already mounted — only refresh countdown copy (avoids drop animation flicker).
  if (
    structureKey === lastConjunctionStructureKey &&
    listEl.querySelectorAll('.conjunction-alert').length === visible.length
  ) {
    updateConjunctionAlertTexts(listEl, visible, nowMs);
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
          <span class="conjunction-alert-icon" aria-hidden="true">⚠</span>
          <span class="conjunction-alert-text">${escapeHtml(formatAlertMessage(c, nowMs))}</span>
        </button>
      `;
    })
    .join('');

  const poolExtra = Math.max(0, conjunctions.length - visible.length);
  const overflowTotal = conjunctionHiddenCount + poolExtra;
  const overflowHtml =
    overflowTotal > 0
      ? `<p class="conjunction-more muted">${t(overflowTotal === 1 ? 'conj.more_one' : 'conj.more_other').replace('{n}', overflowTotal.toLocaleString())}</p>`
      : '';

  listEl.innerHTML = alertsHtml + overflowHtml;
  previousAlertKeys = nextKeys;
}

function formatAlertMessage(c: { objectA: string; objectB: string; distanceKm: number; time: Date }, nowMs: number): string {
  const msUntil = c.time.getTime() - nowMs;
  return t(msUntil > 1000 ? 'conj.alert_in' : 'conj.alert')
    .replace('{a}', c.objectA)
    .replace('{b}', c.objectB)
    .replace('{km}', c.distanceKm.toFixed(2))
    .replace('{t}', formatTimeUntil(msUntil));
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

/** Tick countdowns without remounting cards (and refresh empty/scanning copy). */
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

/** Compact "in 3h 12m" / "in 45s" style duration, for predicted close approaches
 *  up to 24h out. Falls back to 0s for anything already at/past CPA. */
function formatTimeUntil(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return t('unit.h_m').replace('{h}', String(h)).replace('{m}', String(m));
  if (m > 0) return t('unit.m_s').replace('{m}', String(m)).replace('{s}', String(s));
  return t('unit.s').replace('{s}', String(s));
}

// ── Advanced Filters ──────────────────────────────────────────────────────────

const ALT_MIN_DEFAULT  =     0;
const ALT_MAX_DEFAULT  = 36000;
const INCL_MIN_DEFAULT =     0;
const INCL_MAX_DEFAULT =   180;

/** Build the static HTML scaffold (inputs + tracks). Called once on init and on language change. */
function buildAdvancedFiltersHTML(
  altMin: number, altMax: number,
  inclMin: number, inclMax: number,
  shown: number, hasFilter: boolean,
): string {
  const altPctMin  = (altMin  / ALT_MAX_DEFAULT)  * 100;
  const altPctMax  = (altMax  / ALT_MAX_DEFAULT)  * 100;
  const inclPctMin = (inclMin / INCL_MAX_DEFAULT) * 100;
  const inclPctMax = (inclMax / INCL_MAX_DEFAULT) * 100;

  return `
    <div class="af-group">
      <div class="af-label-row">
        <span class="af-label" data-i18n="filter.altitude">${t('filter.altitude')}</span>
        <span class="af-values" id="af-alt-values">${altMin.toLocaleString()} km — ${altMax.toLocaleString()} km</span>
      </div>
      <div class="dual-range">
        <div class="dual-range-track">
          <div class="dual-range-fill" id="af-alt-fill"
               style="left:${altPctMin.toFixed(1)}%;width:${(altPctMax - altPctMin).toFixed(1)}%"></div>
        </div>
        <input type="range" class="dr-input dr-min" id="af-alt-min"
               min="${ALT_MIN_DEFAULT}" max="${ALT_MAX_DEFAULT}" step="50" value="${altMin}">
        <input type="range" class="dr-input dr-max" id="af-alt-max"
               min="${ALT_MIN_DEFAULT}" max="${ALT_MAX_DEFAULT}" step="50" value="${altMax}">
      </div>
    </div>

    <div class="af-group">
      <div class="af-label-row">
        <span class="af-label" data-i18n="filter.inclination">${t('filter.inclination')}</span>
        <span class="af-values" id="af-incl-values">${inclMin}° — ${inclMax}°</span>
      </div>
      <div class="dual-range">
        <div class="dual-range-track">
          <div class="dual-range-fill" id="af-incl-fill"
               style="left:${inclPctMin.toFixed(1)}%;width:${(inclPctMax - inclPctMin).toFixed(1)}%"></div>
        </div>
        <input type="range" class="dr-input dr-min" id="af-incl-min"
               min="${INCL_MIN_DEFAULT}" max="${INCL_MAX_DEFAULT}" step="1" value="${inclMin}">
        <input type="range" class="dr-input dr-max" id="af-incl-max"
               min="${INCL_MIN_DEFAULT}" max="${INCL_MAX_DEFAULT}" step="1" value="${inclMax}">
      </div>
    </div>

    <div class="af-footer">
      <span class="af-count muted" id="af-count">${t('filter.objects_shown').replace('{n}', shown.toLocaleString())}</span>
      <button type="button" id="af-reset"
              class="btn-af-reset${hasFilter ? '' : ' btn-af-reset--dim'}"
              ${hasFilter ? '' : 'disabled'}>${t('filter.reset')}</button>
    </div>
  `;
}

/**
 * Update only the display elements (labels, fills, count, reset state) without
 * touching the <input> elements. Called on every state change so that dragging
 * is never interrupted by an innerHTML replacement.
 */
function updateAdvancedFiltersDisplay(container: HTMLElement): void {
  const el = container.querySelector('#advanced-filters');
  if (!el) return;

  const state = getState();
  const af   = state.altitudeFilter;
  const incf = state.inclinationFilter;

  const altMin  = af?.minKm    ?? ALT_MIN_DEFAULT;
  const altMax  = af?.maxKm    ?? ALT_MAX_DEFAULT;
  const inclMin = incf?.minDeg ?? INCL_MIN_DEFAULT;
  const inclMax = incf?.maxDeg ?? INCL_MAX_DEFAULT;

  // Value labels
  const altValEl = el.querySelector('#af-alt-values');
  if (altValEl) altValEl.textContent = `${altMin.toLocaleString()} km — ${altMax.toLocaleString()} km`;
  const inclValEl = el.querySelector('#af-incl-values');
  if (inclValEl) inclValEl.textContent = `${inclMin}° — ${inclMax}°`;

  // Fill bars
  const altPctMin  = (altMin  / ALT_MAX_DEFAULT)  * 100;
  const altPctMax  = (altMax  / ALT_MAX_DEFAULT)  * 100;
  const altFill = el.querySelector<HTMLElement>('#af-alt-fill');
  if (altFill) {
    altFill.style.left  = `${altPctMin.toFixed(1)}%`;
    altFill.style.width = `${(altPctMax - altPctMin).toFixed(1)}%`;
  }

  const inclPctMin = (inclMin / INCL_MAX_DEFAULT) * 100;
  const inclPctMax = (inclMax / INCL_MAX_DEFAULT) * 100;
  const inclFill = el.querySelector<HTMLElement>('#af-incl-fill');
  if (inclFill) {
    inclFill.style.left  = `${inclPctMin.toFixed(1)}%`;
    inclFill.style.width = `${(inclPctMax - inclPctMin).toFixed(1)}%`;
  }

  // Sync slider values in case filter was reset programmatically
  const altMinEl  = el.querySelector<HTMLInputElement>('#af-alt-min');
  const altMaxEl  = el.querySelector<HTMLInputElement>('#af-alt-max');
  const inclMinEl = el.querySelector<HTMLInputElement>('#af-incl-min');
  const inclMaxEl = el.querySelector<HTMLInputElement>('#af-incl-max');
  if (altMinEl  && document.activeElement !== altMinEl)  altMinEl.value  = String(altMin);
  if (altMaxEl  && document.activeElement !== altMaxEl)  altMaxEl.value  = String(altMax);
  if (inclMinEl && document.activeElement !== inclMinEl) inclMinEl.value = String(inclMin);
  if (inclMaxEl && document.activeElement !== inclMaxEl) inclMaxEl.value = String(inclMax);

  // Object count
  const countEl = el.querySelector('#af-count');
  if (countEl) countEl.textContent = t('filter.objects_shown').replace('{n}', state.filteredIndices.length.toLocaleString());

  // Reset button
  const hasFilter = af !== null || incf !== null;
  const resetBtn  = el.querySelector<HTMLButtonElement>('#af-reset');
  if (resetBtn) {
    resetBtn.disabled = !hasFilter;
    resetBtn.classList.toggle('btn-af-reset--dim', !hasFilter);
  }
}

/** Full rebuild (called once on init and on language change only). */
function renderAdvancedFilters(container: HTMLElement): void {
  const el = container.querySelector('#advanced-filters');
  if (!el) return;
  const state = getState();
  const af   = state.altitudeFilter;
  const incf = state.inclinationFilter;
  el.innerHTML = buildAdvancedFiltersHTML(
    af?.minKm    ?? ALT_MIN_DEFAULT, af?.maxKm    ?? ALT_MAX_DEFAULT,
    incf?.minDeg ?? INCL_MIN_DEFAULT, incf?.maxDeg ?? INCL_MAX_DEFAULT,
    state.filteredIndices.length, af !== null || incf !== null,
  );
}

function initAdvancedFilters(container: HTMLElement): void {
  renderAdvancedFilters(container);

  container.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const id = target.id;
    if (!['af-alt-min', 'af-alt-max', 'af-incl-min', 'af-incl-max'].includes(id)) return;

    const el = container.querySelector('#advanced-filters')!;

    if (id === 'af-alt-min' || id === 'af-alt-max') {
      const minEl = el.querySelector<HTMLInputElement>('#af-alt-min')!;
      const maxEl = el.querySelector<HTMLInputElement>('#af-alt-max')!;
      let minVal = Number(minEl.value);
      let maxVal = Number(maxEl.value);
      if (minVal > maxVal) {
        if (id === 'af-alt-min') { minVal = maxVal; minEl.value = String(minVal); }
        else                     { maxVal = minVal; maxEl.value = String(maxVal); }
      }
      const isDefault = minVal === ALT_MIN_DEFAULT && maxVal === ALT_MAX_DEFAULT;
      setAltitudeFilter(isDefault ? null : { minKm: minVal, maxKm: maxVal });
    }

    if (id === 'af-incl-min' || id === 'af-incl-max') {
      const minEl = el.querySelector<HTMLInputElement>('#af-incl-min')!;
      const maxEl = el.querySelector<HTMLInputElement>('#af-incl-max')!;
      let minVal = Number(minEl.value);
      let maxVal = Number(maxEl.value);
      if (minVal > maxVal) {
        if (id === 'af-incl-min') { minVal = maxVal; minEl.value = String(minVal); }
        else                      { maxVal = minVal; maxEl.value = String(maxVal); }
      }
      const isDefault = minVal === INCL_MIN_DEFAULT && maxVal === INCL_MAX_DEFAULT;
      setInclinationFilter(isDefault ? null : { minDeg: minVal, maxDeg: maxVal });
    }
  });

  container.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'af-reset') {
      resetAdvancedFilters();
    }
  });

  // On state change: update only display elements — never replace the inputs
  subscribe(() => updateAdvancedFiltersDisplay(container));
}
