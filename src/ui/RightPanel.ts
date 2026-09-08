import { propagateObject, toObjectSnapshot } from '../orbital/propagator';
import {
  formatUtcDateTime,
  getSimulationTime,
  getState,
  subscribe,
} from '../state/appState';
import { loadObjectPhotoInto } from '../data/objectPhotos';

export function initRightPanel(container: HTMLElement): void {
  container.innerHTML = '<div id="object-detail" class="object-detail"></div>';
  let renderKey = '';

  const renderIfNeeded = (): void => {
    const state = getState();
    const key = `${state.selectedIndex}|${state.time.mode}`;
    if (key === renderKey) return;
    renderKey = key;
    render(container);
  };

  renderIfNeeded();
  subscribe(renderIfNeeded);

  const refresh = (): void => {
    const state = getState();
    if (state.selectedIndex == null) return;
    const object = state.objects[state.selectedIndex];
    const propagation = object ? propagateObject(object.satrec, getSimulationTime()) : null;
    const detail = container.querySelector('#object-detail');
    if (!detail || !propagation) return;
    const snapshot = toObjectSnapshot(object.noradId, object.name, object.category, object.country, object.owner, propagation);
    detail.querySelector('[data-field="altitude"]')!.textContent = `${snapshot.altitudeKm.toFixed(0)} km`;
    detail.querySelector('[data-field="velocity"]')!.textContent = `${snapshot.velocityKmS.toFixed(2)} km/s`;
    const time = detail.querySelector('[data-field="sim-time"]');
    if (time) time.textContent = formatUtcDateTime(getSimulationTime());
    requestAnimationFrame(refresh);
  };
  requestAnimationFrame(refresh);
}

function render(container: HTMLElement): void {
  const detail = container.querySelector('#object-detail')!;
  const state = getState();
  if (state.selectedIndex == null) {
    detail.innerHTML = '<h2 class="panel-heading">Satellite Details</h2><p class="muted">Click any object on the globe to see its details here.</p>';
    return;
  }

  const object = state.objects[state.selectedIndex];
  if (!object) return;
  const propagation = propagateObject(object.satrec, getSimulationTime());
  if (!propagation) {
    detail.innerHTML = `<h2 class="panel-heading">${escapeHtml(object.name)}</h2><p class="muted">Propagation data unavailable.</p>`;
    return;
  }

  const snapshot = toObjectSnapshot(object.noradId, object.name, object.category, object.country, object.owner, propagation);
  const categoryLabel: Record<string, string> = { active: 'Active Satellite', debris: 'Debris', stations: 'Space Station' };
  detail.innerHTML = `
    <div class="detail-header"><div class="norad-id">NORAD ${snapshot.noradId}</div><div class="object-name">${escapeHtml(snapshot.name)}</div></div>
    <div class="object-photo-wrap" data-object-photo hidden></div>
    <dl class="detail-list detail-list--meta"><div class="detail-row"><dt>Country</dt><dd>${escapeHtml(snapshot.country)}</dd></div><div class="detail-row"><dt>Operator</dt><dd>${escapeHtml(snapshot.owner)}</dd></div></dl>
    <hr class="detail-divider" />
    <dl class="detail-list"><div class="detail-row"><dt>Altitude</dt><dd data-field="altitude">${snapshot.altitudeKm.toFixed(0)} km</dd></div><div class="detail-row"><dt>Velocity</dt><dd data-field="velocity">${snapshot.velocityKmS.toFixed(2)} km/s</dd></div><div class="detail-row"><dt>Orbit</dt><dd>${snapshot.layer}</dd></div><div class="detail-row"><dt>Type</dt><dd>${categoryLabel[snapshot.category] ?? snapshot.category}</dd></div><div class="detail-row"><dt>Inclination</dt><dd>${snapshot.inclinationDeg.toFixed(1)}°</dd></div><div class="detail-row"><dt>Simulation time</dt><dd data-field="sim-time">${formatUtcDateTime(getSimulationTime())}</dd></div></dl>
  `;

  if (object.category !== 'debris') {
    const photo = detail.querySelector<HTMLElement>('[data-object-photo]');
    if (photo) void loadObjectPhotoInto(photo, object);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
