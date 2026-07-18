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
import { twoline2satrec } from 'satellite.js';
import type { SatRec } from 'satellite.js';
import type { ConjunctionEvent } from '../types';
import {
  formatUtcDateTime,
  getSimulationTime,
  getState,
  exitConjunctionView,
  setShowOrbitTrail,
  setEventReplayPartial,
  stopEventReplay,
  subscribe,
  EVENT_REPLAY_REWIND_MS,
} from '../state/appState';
import { getHistoricalEvent } from './EventCards';
import { loadObjectPhotoInto } from '../data/objectPhotos';

/** Cached satrecs for event replay distance computation */
const replaySatrecCache: Map<string, { satrecA: SatRec; satrecB: SatRec | null }> = new Map();

/** Throttle distance calculation to ~4 Hz in the right panel */
let _replayDistLastMs = 0;
let _replayDistCached: string | null = null;

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
    const key = `${state.selectedIndex}|${state.selectedEventId}|${state.selectedConjunctionSessionKey}|${state.conjunctionRevision}|${state.showOrbitTrail}|${state.eventReplay?.eventId ?? ''}`;
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
      return;
    }

    const replayPlayBtn = (e.target as HTMLElement).closest('#btn-replay-play');
    if (replayPlayBtn) {
      e.preventDefault();
      const { eventReplay } = getState();
      if (eventReplay) setEventReplayPartial({ playing: !eventReplay.playing });
      return;
    }

    const replayRestartBtn = (e.target as HTMLElement).closest('#btn-replay-restart');
    if (replayRestartBtn) {
      e.preventDefault();
      const { eventReplay } = getState();
      if (eventReplay) {
        setEventReplayPartial({
          currentMs: eventReplay.collisionTimeMs - EVENT_REPLAY_REWIND_MS,
          playing: true,
        });
      }
      return;
    }

    const replayExitBtn = (e.target as HTMLElement).closest('#btn-replay-exit');
    if (replayExitBtn) {
      e.preventDefault();
      stopEventReplay();
    }
  });

  const refreshDynamicValues = (): void => {
    const state = getState();

    if (state.selectedConjunction) {
      refreshConjunctionVerification(container, state.selectedConjunction);
      return;
    }

    if (state.eventReplay) {
      refreshEventReplayHUD(container, state.eventReplay.eventId, state.eventReplay.collisionTimeMs);
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

  if (state.eventReplay) {
    renderEventReplayPanel(detailEl, state.eventReplay.eventId);
    refreshEventReplayHUD(container, state.eventReplay.eventId, state.eventReplay.collisionTimeMs);
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

function renderEventReplayPanel(detailEl: Element, eventId: string): void {
  const event = getHistoricalEvent(eventId);
  if (!event) return;

  const isASAT = event.objectB === null;

  detailEl.innerHTML = `
    <h2 class="panel-heading panel-heading--alert">Collision Replay</h2>
    <div class="event-replay-title">${escapeHtml(event.title)}</div>

    <div class="event-replay-approach">
      <div class="era-sat era-sat--a" title="${escapeHtml(event.objectA.name)}">
        <span class="era-dot era-dot--a"></span>
        <span class="era-label">${escapeHtml(event.objectA.name)}</span>
      </div>
      ${isASAT
        ? `<div class="era-sat era-sat--missile"><span class="era-missile">⚡</span><span class="era-label">ASAT Missile</span></div>`
        : `<div class="era-sat era-sat--b" title="${escapeHtml(event.objectB!.name)}">
             <span class="era-dot era-dot--b"></span>
             <span class="era-label">${escapeHtml(event.objectB!.name)}</span>
           </div>`
      }
    </div>

    <div class="era-timeline">
      <div class="era-timeline-bar">
        <div class="era-progress" data-field="era-progress" style="width:0%"></div>
      </div>
      <div class="era-timeline-labels">
        <span>T−${(EVENT_REPLAY_REWIND_MS / 60000).toFixed(0)}m</span>
        <span>IMPACT</span>
      </div>
    </div>

    <dl class="detail-list era-stats">
      <div class="detail-row"><dt>Sim Time</dt><dd data-field="era-simtime">—</dd></div>
      <div class="detail-row"><dt>Time to Impact</dt><dd data-field="era-tti">—</dd></div>
      ${!isASAT
        ? `<div class="detail-row"><dt>Separation</dt><dd data-field="era-dist">—</dd></div>`
        : ''
      }
    </dl>

    <div class="era-impact-banner" data-field="era-impact" hidden>
      <div class="era-impact-ring"></div>
      <div class="era-impact-text">💥 COLLISION</div>
    </div>

    <div class="era-completed-banner" data-field="era-completed" hidden>
      Replay complete — press ↺ to restart
    </div>

    <div class="era-controls">
      <button type="button" id="btn-replay-restart" class="btn-era-ctrl" title="Restart">↺</button>
      <button type="button" id="btn-replay-play" class="btn-era-ctrl btn-era-play" data-field="era-play-btn">⏸</button>
    </div>

    <button type="button" id="btn-replay-exit" class="btn-exit-conjunction">
      Return to Global View
    </button>
  `;

  // Pre-cache satrecs for refresh
  if (!replaySatrecCache.has(eventId)) {
    replaySatrecCache.set(eventId, {
      satrecA: twoline2satrec(event.objectA.line1, event.objectA.line2),
      satrecB: event.objectB ? twoline2satrec(event.objectB.line1, event.objectB.line2) : null,
    });
  }
}

function refreshEventReplayHUD(container: HTMLElement, eventId: string, collisionTimeMs: number): void {
  const detailEl = container.querySelector('#object-detail');
  if (!detailEl) return;

  const { eventReplay } = getState();
  if (!eventReplay) return;

  const simTime = new Date(eventReplay.currentMs);
  const msToImpact = collisionTimeMs - eventReplay.currentMs;
  const totalWindow = EVENT_REPLAY_REWIND_MS;
  const elapsed = totalWindow - msToImpact;
  const progress = Math.max(0, Math.min(1, elapsed / totalWindow));

  const simTimeEl = detailEl.querySelector('[data-field="era-simtime"]');
  const ttiEl = detailEl.querySelector('[data-field="era-tti"]');
  const distEl = detailEl.querySelector('[data-field="era-dist"]');
  const progressEl = detailEl.querySelector<HTMLElement>('[data-field="era-progress"]');
  const impactEl = detailEl.querySelector<HTMLElement>('[data-field="era-impact"]');
  const playBtn = detailEl.querySelector<HTMLElement>('[data-field="era-play-btn"]');

  if (simTimeEl) simTimeEl.textContent = formatUtcDateTime(simTime);

  if (ttiEl) {
    if (msToImpact > 0) {
      const secs = Math.ceil(msToImpact / 1000);
      ttiEl.textContent = secs >= 60
        ? `T−${Math.floor(secs / 60)}m ${secs % 60}s`
        : `T−${secs}s`;
      ttiEl.className = '';
    } else {
      const secsPast = Math.abs(Math.floor(msToImpact / 1000));
      ttiEl.textContent = `T+${secsPast}s`;
      ttiEl.className = 'era-past-impact';
    }
  }

  if (progressEl) progressEl.style.width = `${(progress * 100).toFixed(1)}%`;

  if (playBtn) {
    playBtn.textContent = eventReplay.playing ? '⏸' : '▶';
  }

  // Distance — throttled to 4 Hz. In the final 2 min the dots are blending
  // toward the collision point, so we scale the displayed distance accordingly.
  if (distEl) {
    const nowPerf = performance.now();
    if (nowPerf - _replayDistLastMs > 250) {
      _replayDistLastMs = nowPerf;
      const cached = replaySatrecCache.get(eventId);
      if (cached?.satrecB) {
        const propA = propagateObject(cached.satrecA, simTime);
        const propB = propagateObject(cached.satrecB, simTime);
        if (propA && propB) {
          const dx = propA.positionEci.x - propB.positionEci.x;
          const dy = propA.positionEci.y - propB.positionEci.y;
          const dz = propA.positionEci.z - propB.positionEci.z;
          let distKm = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Mirror the 3D convergence blend: only apply in the last 2 min,
          // using the same ease-in³ curve as EventReplayVisuals.
          const msToImpact2 = collisionTimeMs - eventReplay.currentMs;
          const BLEND_WINDOW_MS = 2 * 60 * 1000;
          if (msToImpact2 <= 0) {
            distKm = 0;
          } else if (msToImpact2 < BLEND_WINDOW_MS) {
            const t = 1 - msToImpact2 / BLEND_WINDOW_MS;
            const blendFactor = t * t * t;
            distKm = distKm * (1 - blendFactor);
          }

          _replayDistCached = distKm < 1
            ? `${distKm.toFixed(2)} km`
            : `${distKm.toFixed(0)} km`;
        }
      }
    }
    if (_replayDistCached) distEl.textContent = _replayDistCached;
  }

  // Impact banner — show from T=0 onwards (replay pauses here automatically)
  if (impactEl) {
    const atOrPastImpact = msToImpact <= 0;
    impactEl.hidden = !atOrPastImpact;
    impactEl.classList.toggle('era-impact--active', atOrPastImpact);
  }

  // "Replay complete" label: visible when paused at the collision moment
  const completedEl = container.querySelector<HTMLElement>('[data-field="era-completed"]');
  if (completedEl) {
    const pausedAtImpact = msToImpact <= 0 && !eventReplay.playing;
    completedEl.hidden = !pausedAtImpact;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
