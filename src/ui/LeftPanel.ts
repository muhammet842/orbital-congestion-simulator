import { LAYER_HEX, type OrbitLayer } from '../types';
import {
  conjunctionSessionKey,
  formatCloseApproachAlert,
} from '../orbital/conjunction';
import {
  formatUtcDateTime,
  getListIndices,
  getSimulationTime,
  getState,
  getTimeModeLabel,
  toggleConjunctionFromAlert,
  selectObject,
  setSearchQuery,
  subscribe,
  toggleLayerFilter,
  setColorByFunction,
} from '../state/appState';
import { initEventCards } from './EventCards';
import { t, applyTranslations, onLangChange } from '../i18n/i18n';

const LAYERS: OrbitLayer[] = ['LEO', 'MEO', 'GEO', 'HEO'];
const LIST_ITEM_HEIGHT = 36;
const LIST_VIEWPORT_HEIGHT = 200;
const LIST_OVERSCAN = 6;

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

    <h2 class="panel-heading panel-heading--alert" data-i18n="ui.close_approach">Close Approach Alerts</h2>
    <div class="conjunction-list" id="conjunction-list"></div>
  `;

  initSearchAndList(container);
  renderLayerFilters(container);
  renderDisplayOptions(container);
  renderStats(container);
  renderConjunctions(container);
  initEventCards(container);

  container.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLButtonElement>(
      '.conjunction-alert[data-alert-index]',
    );
    if (!card) return;

    e.preventDefault();
    const index = Number(card.dataset.alertIndex);
    const match = getState().conjunctions[index];
    if (match) {
      toggleConjunctionFromAlert(match);
    }
  });

  const refreshLiveStatTime = (): void => {
    const timeEl = container.querySelector('#live-stat-time');
    if (timeEl) {
      timeEl.textContent = formatUtcDateTime(getSimulationTime());
    }
    requestAnimationFrame(refreshLiveStatTime);
  };
  requestAnimationFrame(refreshLiveStatTime);

  // On language change: update data-i18n labels and re-render dynamic sections
  onLangChange(() => {
    applyTranslations(container);
    renderDisplayOptions(container);
    renderStats(container);
    renderConjunctions(container);
  });

  let lastListKey = '';
  let lastSelectedIndex: number | null = null;

  subscribe(() => {
    renderStats(container);
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
  `;

  const checkbox = optionsEl.querySelector('#color-by-function') as HTMLInputElement;
  checkbox.addEventListener('change', () => {
    setColorByFunction(checkbox.checked);
  });

  subscribe(() => {
    checkbox.checked = getState().colorByFunction;
  });
}

function renderStats(container: HTMLElement): void {
  const state = getState();
  const { stats, time } = state;
  const isLive = time.mode === 'live';
  const simTime = getSimulationTime();

  const categoryEl = container.querySelector('#category-stats')!;
  categoryEl.innerHTML = `
    <li>${t('cat.active')}: <strong>${stats.categoryCounts.active.toLocaleString()}</strong></li>
    <li>${t('cat.debris')}: <strong>${stats.categoryCounts.debris.toLocaleString()}</strong></li>
    <li>${t('cat.stations')}: <strong>${stats.categoryCounts.stations.toLocaleString()}</strong></li>
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

function renderConjunctions(container: HTMLElement): void {
  const { conjunctions, conjunctionHiddenCount, selectedConjunctionSessionKey } = getState();
  const listEl = container.querySelector('#conjunction-list')!;

  if (conjunctions.length === 0) {
    previousAlertKeys.clear();
    listEl.innerHTML = `<p class="muted conjunction-empty">${t('conj.empty')}</p>`;
    return;
  }

  const nextKeys = new Set<string>();
  const alertsHtml = conjunctions
    .map((c, index) => {
      const sessionKey = conjunctionSessionKey(c);
      const isNew = !previousAlertKeys.has(sessionKey);
      const isActive = sessionKey === selectedConjunctionSessionKey;
      nextKeys.add(sessionKey);
      const message = formatCloseApproachAlert(c.objectA, c.objectB, c.distanceKm);
      return `
        <button
          type="button"
          class="conjunction-alert${isNew ? ' conjunction-alert--new' : ''}${isActive ? ' conjunction-alert--active' : ''}"
          data-alert-index="${index}"
        >
          <span class="conjunction-alert-icon" aria-hidden="true">⚠</span>
          <span class="conjunction-alert-text">${escapeHtml(message)}</span>
        </button>
      `;
    })
    .join('');

  const overflowHtml =
    conjunctionHiddenCount > 0
      ? `<p class="conjunction-more muted">+${conjunctionHiddenCount.toLocaleString()} more critical close approach${conjunctionHiddenCount === 1 ? '' : 'es'}</p>`
      : '';

  listEl.innerHTML = alertsHtml + overflowHtml;
  previousAlertKeys = nextKeys;
}

let previousAlertKeys = new Set<string>();
