import { LAYER_HEX, type ObjectCategory, type OrbitLayer } from '../types';
import {
  getListIndices,
  getState,
  selectObject,
  setCategoryFilter,
  setColorByFunction,
  setSearchQuery,
  subscribe,
  toggleLayerFilter,
} from '../state/appState';

const LAYERS: OrbitLayer[] = ['LEO', 'MEO', 'GEO', 'HEO'];
const CATEGORY_FILTERS: Array<ObjectCategory | 'all'> = ['all', 'active', 'stations', 'debris'];
const ITEM_HEIGHT = 36;
const LIST_VIEWPORT_HEIGHT = 200;

export function initLeftPanel(container: HTMLElement): void {
  container.innerHTML = `
    <div class="search-wrap">
      <input type="search" id="object-search" class="search-input" placeholder="Search name, NORAD ID, or country" autocomplete="off" spellcheck="false" />
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
    <h2 class="panel-heading">Object Counts</h2>
    <ul class="category-stats" id="category-stats"></ul>
  `;

  const searchInput = container.querySelector('#object-search') as HTMLInputElement;
  const viewport = container.querySelector('#object-list-viewport') as HTMLElement;
  searchInput.addEventListener('input', () => {
    setSearchQuery(searchInput.value);
    viewport.scrollTop = 0;
    renderObjectList(container);
  });
  viewport.addEventListener('scroll', () => renderObjectList(container));
  viewport.addEventListener('click', (event) => {
    const item = (event.target as HTMLElement).closest<HTMLButtonElement>('.object-list-item');
    if (item) selectObject(Number(item.dataset.index));
  });

  renderLayerFilters(container);
  renderCategoryFilters(container);
  renderDisplayOptions(container);
  renderObjectCounts(container);
  renderObjectList(container);

  let lastKey = '';
  let lastSelectedIndex: number | null = null;
  subscribe(() => {
    const state = getState();
    renderObjectCounts(container);
    const filterKey = [state.categoryFilter, state.colorByFunction, Object.entries(state.layerFilters).join(',')].join('|');
    if (filterKey !== lastKey) {
      renderLayerFilters(container);
      renderCategoryFilters(container);
      renderDisplayOptions(container);
      lastKey = filterKey;
    }
    const listKey = [state.searchQuery, state.filteredIndices.length, state.selectedIndex, filterKey].join('|');
    if (listKey !== lastKey || state.selectedIndex !== lastSelectedIndex) renderObjectList(container);
    lastSelectedIndex = state.selectedIndex;
  });
}

function renderObjectCounts(container: HTMLElement): void {
  const { categoryCounts } = getState().stats;
  const element = container.querySelector('#category-stats');
  if (!element) return;
  element.innerHTML = `
    <li><span>Active satellites</span><strong>${categoryCounts.active.toLocaleString()}</strong></li>
    <li><span>Debris</span><strong>${categoryCounts.debris.toLocaleString()}</strong></li>
    <li><span>Space stations</span><strong>${categoryCounts.stations.toLocaleString()}</strong></li>
  `;
}

function renderObjectList(container: HTMLElement): void {
  const state = getState();
  const indices = getListIndices();
  const viewport = container.querySelector('#object-list-viewport') as HTMLElement;
  const spacer = container.querySelector('#object-list-spacer') as HTMLElement;
  const items = container.querySelector('#object-list-items') as HTMLElement;
  const start = Math.max(0, Math.floor(viewport.scrollTop / ITEM_HEIGHT));
  const end = Math.min(indices.length, start + Math.ceil(LIST_VIEWPORT_HEIGHT / ITEM_HEIGHT) + 6);
  spacer.setAttribute('style', `height:${indices.length * ITEM_HEIGHT}px`);
  items.setAttribute('style', `transform:translateY(${start * ITEM_HEIGHT}px)`);
  items.innerHTML = indices.slice(start, end).map((index) => {
    const object = state.objects[index];
    const selected = state.selectedIndex === index;
    return `<button type="button" class="object-list-item${selected ? ' object-list-item--selected' : ''}" data-index="${index}"><span class="object-list-name">${escapeHtml(object.name.trim() || `NORAD ${object.noradId}`)}</span><span class="object-list-norad">${object.noradId}</span></button>`;
  }).join('');
}

function renderLayerFilters(container: HTMLElement): void {
  const element = container.querySelector('#layer-filters')!;
  const { layerFilters } = getState();
  element.innerHTML = `<div class="filter-chip-grid" role="group" aria-label="Orbit Layers">${LAYERS.map((layer) => `<button type="button" class="filter-chip${layerFilters[layer] ? ' filter-chip--on' : ''}" data-layer="${layer}" aria-pressed="${layerFilters[layer]}"><span class="filter-chip-dot" style="background:${LAYER_HEX[layer]}"></span><span class="filter-chip-label">${layer}</span></button>`).join('')}</div>`;
  element.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach((button) => button.addEventListener('click', () => toggleLayerFilter(button.dataset.layer as OrbitLayer)));
}

function renderCategoryFilters(container: HTMLElement): void {
  const element = container.querySelector('#category-filters')!;
  const { categoryFilter } = getState();
  element.innerHTML = `<div class="filter-segment" role="radiogroup" aria-label="Object Types">${CATEGORY_FILTERS.map((category) => `<button type="button" class="filter-segment-option${categoryFilter === category ? ' filter-segment-option--on' : ''}" data-category="${category}">${category === 'all' ? 'All' : category[0].toUpperCase() + category.slice(1)}</button>`).join('')}</div>`;
  element.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((button) => button.addEventListener('click', () => setCategoryFilter(button.dataset.category as ObjectCategory | 'all')));
}

function renderDisplayOptions(container: HTMLElement): void {
  const element = container.querySelector('#display-options')!;
  const enabled = getState().colorByFunction;
  element.innerHTML = `<button type="button" class="filter-toggle-card${enabled ? ' filter-toggle-card--on' : ''}" id="color-by-function" aria-pressed="${enabled}"><span class="filter-toggle-copy"><strong>Color by object type</strong><span class="muted">Satellites · stations · active · debris</span></span></button>`;
  element.querySelector('button')?.addEventListener('click', () => setColorByFunction(!getState().colorByFunction));
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
