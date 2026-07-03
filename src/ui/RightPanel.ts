import {
  getDistanceAtTime,
  getRelativeVelocityAtTime,
  getVerificationAssessment,
  getColocatedObjectNames,
  formatRelativeVelocityKmS,
  isCoOrbitingPair,
  VERIFY_REWIND_MS,
} from '../orbital/conjunction';
import { propagateObject, toObjectSnapshot } from '../orbital/propagator';
import type { ConjunctionEvent } from '../types';
import {
  formatUtcDateTime,
  getSimulationTime,
  getState,
  exitConjunctionView,
  setShowOrbitTrail,
  subscribe,
} from '../state/appState';
import { getHistoricalEvent } from './EventCards';
import { loadObjectPhotoInto } from '../data/objectPhotos';

function verificationRiskClass(status: string): string {
  if (status === 'COLLISION CONFIRMED') return 'conjunction-risk--confirmed';
  if (status === 'COLLISION AVERTED') return 'conjunction-risk--averted';
  if (status === 'CRITICAL RISK') return 'conjunction-risk--critical';
  if (status === 'LOW RISK' || status === 'NO RISK') return 'conjunction-risk--low';
  return 'conjunction-risk--monitor';
}

export function initRightPanel(container: HTMLElement): void {
  container.innerHTML = `<div id="object-detail" class="object-detail"></div>`;

  let renderKey = '';

  const maybeRender = (): void => {
    const state = getState();
    const key = `${state.selectedIndex}|${state.selectedEventId}|${state.selectedConjunctionSessionKey}|${state.conjunctionRevision}|${state.showOrbitTrail}`;
    if (key === renderKey) return;
    renderKey = key;
    render(container);
  };

  maybeRender();
  subscribe(maybeRender);

  container.addEventListener('click', (e) => {
    const trailBtn = (e.target as HTMLElement).closest('#btn-orbit-trail');
    if (trailBtn) {
      e.preventDefault();
      const { showOrbitTrail } = getState();
      setShowOrbitTrail(!showOrbitTrail);
      return;
    }

    const exitBtn = (e.target as HTMLElement).closest('#btn-exit-conjunction');
    if (exitBtn) {
      e.preventDefault();
      exitConjunctionView();
    }
  });

  const refreshDynamicValues = (): void => {
    const state = getState();

    if (state.selectedConjunction) {
      refreshConjunctionVerification(container, state.selectedConjunction);
      return;
    }

    if (state.selectedEventId || state.selectedIndex == null) return;

    const obj = state.objects[state.selectedIndex];
    if (!obj) return;

    const propagation = propagateObject(obj.satrec, getSimulationTime());
    if (!propagation) return;

    const snapshot = toObjectSnapshot(
      obj.noradId,
      obj.name,
      obj.category,
      obj.country,
      obj.owner,
      propagation,
    );
    const detailEl = container.querySelector('#object-detail');
    if (!detailEl) return;

    const altitude = detailEl.querySelector('[data-field="altitude"]');
    const velocity = detailEl.querySelector('[data-field="velocity"]');
    if (altitude) altitude.textContent = `${snapshot.altitudeKm.toFixed(0)} km`;
    if (velocity) velocity.textContent = `${snapshot.velocityKmS.toFixed(2)} km/s`;
  };

  const tick = (): void => {
    refreshDynamicValues();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function refreshConjunctionVerification(container: HTMLElement, conjunction: ConjunctionEvent): void {
  const detailEl = container.querySelector('#object-detail');
  if (!detailEl) return;

  const state = getState();
  const simTime = getSimulationTime();
  const liveDistance = getDistanceAtTime(
    state.objects,
    conjunction.indexA,
    conjunction.indexB,
    simTime,
  );
  const liveRelativeVelocity = getRelativeVelocityAtTime(
    state.objects,
    conjunction.indexA,
    conjunction.indexB,
    simTime,
  );
  const assessment = getVerificationAssessment(
    liveDistance,
    simTime.getTime(),
    conjunction.time.getTime(),
    conjunction.distanceKm,
    state.verificationTime?.playing ?? false,
  );

  const simTimeEl = detailEl.querySelector('[data-field="sim-time"]');
  const liveDistanceEl = detailEl.querySelector('[data-field="live-distance"]');
  const relativeVelocityEl = detailEl.querySelector('[data-field="relative-velocity"]');
  const timeToCpaEl = detailEl.querySelector('[data-field="time-to-cpa"]');
  const riskEl = detailEl.querySelector('[data-field="verification-risk"]');
  const hintEl = detailEl.querySelector('[data-field="verification-hint"]');

  if (simTimeEl) simTimeEl.textContent = formatUtcDateTime(simTime);
  if (liveDistanceEl) {
    liveDistanceEl.textContent =
      liveDistance == null ? '—' : `${liveDistance.toFixed(3)} km`;
  }
  if (relativeVelocityEl) {
    relativeVelocityEl.textContent =
      liveRelativeVelocity == null ? '—' : formatRelativeVelocityKmS(liveRelativeVelocity);
  }
  if (timeToCpaEl) {
    const msToCpa = conjunction.time.getTime() - simTime.getTime();
    if (msToCpa > 0) {
      timeToCpaEl.textContent = `T−${Math.ceil(msToCpa / 1000)}s to CPA`;
    } else {
      timeToCpaEl.textContent = `T+${Math.ceil(-msToCpa / 1000)}s past CPA`;
    }
  }
  if (riskEl) {
    riskEl.textContent = assessment.riskLabel;
    riskEl.className = verificationRiskClass(assessment.riskLabel);
  }
  if (hintEl) hintEl.textContent = assessment.hint;
}

function render(container: HTMLElement): void {
  const detailEl = container.querySelector('#object-detail')!;
  const state = getState();

  if (state.selectedConjunction) {
    renderConjunctionDetail(detailEl, state.selectedConjunction);
    refreshConjunctionVerification(container, state.selectedConjunction);
    return;
  }

  if (state.selectedEventId) {
    renderHistoricalEvent(detailEl, state.selectedEventId);
    return;
  }

  if (state.selectedIndex == null) {
    detailEl.innerHTML = `
      <h2 class="panel-heading">Select an object</h2>
      <p class="muted">Click a list item, a close approach alert, or any point in the 3D view.</p>
    `;
    return;
  }

  const obj = state.objects[state.selectedIndex];
  if (!obj) return;

  const propagation = propagateObject(obj.satrec, getSimulationTime());
  if (!propagation) {
    detailEl.innerHTML = `
      <h2 class="panel-heading">${escapeHtml(obj.name)}</h2>
      <p class="muted">Position unavailable at current simulation time.</p>
    `;
    return;
  }

  const snapshot = toObjectSnapshot(
    obj.noradId,
    obj.name,
    obj.category,
    obj.country,
    obj.owner,
    propagation,
  );

  detailEl.innerHTML = `
    <div class="detail-header">
      <div class="norad-id">NORAD ${snapshot.noradId}</div>
      <div class="object-name">${escapeHtml(snapshot.name)}</div>
    </div>
    <div class="object-photo-wrap" data-object-photo hidden></div>
    <dl class="detail-list detail-list--meta">
      <div class="detail-row"><dt>Country</dt><dd>${escapeHtml(snapshot.country)}</dd></div>
      <div class="detail-row"><dt>Operator/Owner</dt><dd>${escapeHtml(snapshot.owner)}</dd></div>
    </dl>
    <hr class="detail-divider" />
    <dl class="detail-list">
      <div class="detail-row"><dt>Altitude</dt><dd data-field="altitude">${snapshot.altitudeKm.toFixed(0)} km</dd></div>
      <div class="detail-row"><dt>Velocity</dt><dd data-field="velocity">${snapshot.velocityKmS.toFixed(2)} km/s</dd></div>
      <div class="detail-row"><dt>Layer</dt><dd>${snapshot.layer}</dd></div>
      <div class="detail-row"><dt>Category</dt><dd>${snapshot.category}</dd></div>
      <div class="detail-row"><dt>Inclination</dt><dd>${snapshot.inclinationDeg.toFixed(1)}°</dd></div>
    </dl>
    <button type="button" id="btn-orbit-trail" class="btn-orbit-trail${state.showOrbitTrail ? ' active' : ''}">
      ${state.showOrbitTrail ? 'Hide orbit trail' : 'Show orbit trail'}
    </button>
  `;

  if (obj.category !== 'debris') {
    const photoEl = detailEl.querySelector<HTMLElement>('[data-object-photo]');
    if (photoEl) void loadObjectPhotoInto(photoEl, obj);
  }
}

function renderConjunctionDetail(detailEl: Element, conjunction: ConjunctionEvent): void {
  const state = getState();
  const colocatedA = getColocatedObjectNames(state.objects, conjunction.indexA);
  const colocatedB = getColocatedObjectNames(state.objects, conjunction.indexB);
  let colocatedNote = '';
  if (colocatedA.length > 1 || colocatedB.length > 1) {
    colocatedNote = `<p class="muted conjunction-colocated-note">Co-located catalog entries share the same orbit ephemeris (e.g. ISS modules). ${
      colocatedA.length > 1
        ? `${escapeHtml(conjunction.objectA)} appears with: ${escapeHtml(colocatedA.filter((n) => n !== conjunction.objectA).join(', '))}. `
        : ''
    }They occupy the same propagated position in this simulator.</p>`;
  } else if (isCoOrbitingPair(conjunction.relativeVelocityKmS)) {
    colocatedNote = `<p class="muted conjunction-colocated-note">These vehicles are on nearly identical orbits (relative speed &lt; 50 m/s). This is co-orbiting proximity — not a hypervelocity crossing event.</p>`;
  }

  detailEl.innerHTML = `
    <h2 class="panel-heading panel-heading--alert">Conjunction Verification</h2>
    <div class="conjunction-detail-title">
      ${escapeHtml(conjunction.objectA)} vs ${escapeHtml(conjunction.objectB)}
    </div>
    <dl class="detail-list">
      <div class="detail-row"><dt>CPA Event (T+0)</dt><dd>${formatUtcDateTime(conjunction.time)}</dd></div>
      <div class="detail-row"><dt>Sim Time</dt><dd data-field="sim-time">—</dd></div>
      <div class="detail-row"><dt>Time to CPA</dt><dd data-field="time-to-cpa">—</dd></div>
      <div class="detail-row"><dt>Live Separation</dt><dd data-field="live-distance">—</dd></div>
      <div class="detail-row"><dt>CPA Minimum</dt><dd>${conjunction.distanceKm.toFixed(3)} km</dd></div>
      <div class="detail-row"><dt>Relative Velocity</dt><dd data-field="relative-velocity">—</dd></div>
      <div class="detail-row"><dt>Risk Assessment</dt><dd data-field="verification-risk" class="conjunction-risk--monitor">—</dd></div>
    </dl>
    ${colocatedNote}
    <p class="muted conjunction-detail-hint" data-field="verification-hint">
      Timeline rewound to T−${VERIFY_REWIND_MS / 1000}s. Press Play or LIVE to verify.
    </p>
    <button type="button" id="btn-exit-conjunction" class="btn-exit-conjunction">
      Return to Global View
    </button>
  `;
}

function renderHistoricalEvent(detailEl: Element, eventId: string): void {
  const event = getHistoricalEvent(eventId);
  if (!event) {
    detailEl.innerHTML = `<p class="muted">Event not found.</p>`;
    return;
  }

  const formattedDate = new Date(`${event.date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  detailEl.innerHTML = `
    <h2 class="panel-heading">Historical Event</h2>
    <div class="event-detail">
      <div class="event-detail-title">${escapeHtml(event.title)}</div>
      <div class="event-detail-date">${formattedDate}</div>
      <p class="event-detail-description">${escapeHtml(event.description)}</p>
      <dl class="detail-list">
        <div class="detail-row"><dt>Debris generated</dt><dd>${escapeHtml(event.debrisCount)}</dd></div>
      </dl>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
