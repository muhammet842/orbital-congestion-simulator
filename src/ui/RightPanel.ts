// Right panel: satellite detail, conjunction verify view, or historical event replay HUD.
import {
  getDistanceAtTime,
  getRelativeVelocityAtTime,
  getVerificationAssessment,
  getColocatedObjectNames,
  formatRelativeVelocityKmS,
  getVerificationRewindMs,
  isCoOrbitingPair,
} from '../orbital/conjunction';
import { propagateObject, toObjectSnapshot } from '../orbital/propagator';
import type { ConjunctionEvent } from '../types';
import {
  formatUtcDateTime,
  getSimulationTime,
  getState,
  exitConjunctionView,
  setShowOrbitTrail,
  setShowGroundTrack,
  setEventReplayPartial,
  stopEventReplay,
  subscribe,
  EVENT_REPLAY_REWIND_MS,
  EVENT_REPLAY_SCRUB_STEP_MS,
  getEventReplayWindowMs,
} from '../state/appState';
import type { HistoricalEvent } from './EventCards';
import { getHistoricalEvent } from './EventCards';
import { loadObjectPhotoInto } from '../data/objectPhotos';
import { isRecentlyLaunched } from '../data/newLaunches';

// Compute the 3-D separation in km between two collision objects at T-5min,
// mirroring the same back-tracking geometry as EventReplayVisuals.
function computeInitialSeparationKm(event: HistoricalEvent, _startMs: number): number {
  if (!event.approachB) return 0;
  const { collisionGeo, approachA, approachB } = event;
  const GM = 398600;
  const R = 6371 + collisionGeo.altKm;
  const v = Math.sqrt(GM / R);
  const arcRad = (v * EVENT_REPLAY_REWIND_MS / 1000) / R;
  const DEG = Math.PI / 180;

  function backtrack(
    incl: number,
    asc: boolean,
  ): [number, number] {
    const lat1 = collisionGeo.latDeg * DEG;
    const lon1 = collisionGeo.lonDeg * DEG;
    const sinAz = Math.min(1, Math.abs(Math.cos(incl * DEG) / Math.cos(lat1)));
    const az = Math.asin(sinAz);
    const prograde = incl <= 90;
    let bearing: number;
    if (asc) { bearing = prograde ? az : -az; }
    else      { bearing = prograde ? Math.PI - az : Math.PI + az; }
    const back = bearing + Math.PI;
    const sinLat2 = Math.sin(lat1)*Math.cos(arcRad) + Math.cos(lat1)*Math.sin(arcRad)*Math.cos(back);
    const lat2 = Math.asin(Math.max(-Math.sin(incl*DEG), Math.min(Math.sin(incl*DEG), sinLat2)));
    const n = Math.sin(back)*Math.sin(arcRad)*Math.cos(lat1);
    const d = Math.cos(arcRad)-Math.sin(lat1)*Math.sin(lat2);
    const lon2 = (Math.abs(d) < 1e-9 && Math.abs(n) < 1e-9) ? lon1 : lon1 + Math.atan2(n, d);
    return [lat2, lon2];
  }

  const [latA, lonA] = backtrack(approachA.inclinationDeg, approachA.ascending);
  const [latB, lonB] = backtrack(approachB.inclinationDeg, approachB.ascending);

  const dLat = latB - latA;
  const dLon = lonB - lonA;
  const a = Math.sin(dLat/2)**2 + Math.cos(latA)*Math.cos(latB)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const replayInitialSepCache: Map<string, number> = new Map();

function verificationRiskClass(status: string): string {
  if (status === 'COLLISION CONFIRMED') return 'conjunction-risk--confirmed';
  if (status === 'COLLISION AVERTED') return 'conjunction-risk--averted';
  if (status === 'CRITICAL RISK') return 'conjunction-risk--critical';
  if (status === 'LOW RISK' || status === 'NO RISK') return 'conjunction-risk--low';
  return 'conjunction-risk--monitor';
}

function getVerificationHint(
  assessment: ReturnType<typeof getVerificationAssessment>,
  liveDistanceKm: number | null,
): string {
  if (assessment.riskLabel === 'UNAVAILABLE') return 'Verification data unavailable.';
  if (assessment.status === 'COLLISION CONFIRMED') {
    return `Confirmed collision at ${(liveDistanceKm ?? 0).toFixed(3)} km separation.`;
  }
  if (assessment.status === 'COLLISION AVERTED') {
    return `Closest approach: ${(liveDistanceKm ?? 0).toFixed(3)} km — no collision.`;
  }
  if (assessment.status === 'APPROACHING') return 'Objects approaching...';
  return 'Paused. Press play to continue.';
}

export function initRightPanel(container: HTMLElement): void {
  container.innerHTML = `<div id="object-detail" class="object-detail"></div>`;

  let renderKey = '';

  const maybeRender = (): void => {
    const state = getState();
    const key = `${state.selectedIndex}|${state.selectedEventId}|${state.selectedConjunctionSessionKey}|${state.conjunctionRevision}|${state.showOrbitTrail}|${state.showGroundTrack}|${state.eventReplay?.eventId ?? ''}`;
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

    const gtBtn = (e.target as HTMLElement).closest('#btn-ground-track');
    if (gtBtn) {
      e.preventDefault();
      const { showGroundTrack } = getState();
      setShowGroundTrack(!showGroundTrack);
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

    const replayBackBtn = (e.target as HTMLElement).closest('#btn-replay-back');
    if (replayBackBtn) {
      e.preventDefault();
      const { eventReplay } = getState();
      if (eventReplay) {
        setEventReplayPartial({
          currentMs: eventReplay.currentMs - EVENT_REPLAY_SCRUB_STEP_MS,
          playing: false,
        });
      }
      return;
    }

    const replayFwdBtn = (e.target as HTMLElement).closest('#btn-replay-fwd');
    if (replayFwdBtn) {
      e.preventDefault();
      const { eventReplay } = getState();
      if (eventReplay) {
        setEventReplayPartial({
          currentMs: eventReplay.currentMs + EVENT_REPLAY_SCRUB_STEP_MS,
          playing: false,
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

  container.addEventListener('input', (e) => {
    const scrub = (e.target as HTMLElement).closest<HTMLInputElement>('#era-scrub');
    if (!scrub) return;
    const { eventReplay } = getState();
    if (!eventReplay) return;
    const { startMs, endMs } = getEventReplayWindowMs(eventReplay.collisionTimeMs);
    const pct = Number(scrub.value) / 100;
    setEventReplayPartial({
      currentMs: startMs + pct * (endMs - startMs),
      playing: false,
    });
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
    timeToCpaEl.textContent =
      msToCpa > 0
        ? `T−${Math.ceil(msToCpa / 1000)}s`
        : `T+${Math.ceil(-msToCpa / 1000)}s`;
  }
  if (riskEl) {
    riskEl.textContent = assessment.riskLabel;
    riskEl.className = verificationRiskClass(assessment.riskLabel);
  }
  if (hintEl) hintEl.textContent = getVerificationHint(assessment, liveDistance);
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
      <h2 class="panel-heading">Satellite Details</h2>
      <p class="muted">Click any object on the globe to see its details here.</p>
    `;
    return;
  }

  const obj = state.objects[state.selectedIndex];
  if (!obj) return;

  const propagation = propagateObject(obj.satrec, getSimulationTime());
  if (!propagation) {
    detailEl.innerHTML = `
      <h2 class="panel-heading">${escapeHtml(obj.name)}</h2>
      <p class="muted">Propagation data unavailable.</p>
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

  const newBadge = isRecentlyLaunched(obj)
    ? `<span class="new-launch-badge" title="Launched within the last 30 days">NEW</span>`
    : '';

  const categoryLabel: Record<string, string> = {
    active: 'Active Satellite',
    debris: 'Debris',
    stations: 'Space Station',
  };

  detailEl.innerHTML = `
    <div class="detail-header">
      <div class="norad-id">NORAD ${snapshot.noradId}</div>
      <div class="object-name">${escapeHtml(snapshot.name)}${newBadge}</div>
    </div>
    <dl class="detail-list detail-list--meta">
      <div class="detail-row"><dt>Country</dt><dd>${escapeHtml(snapshot.country)}</dd></div>
      <div class="detail-row"><dt>Operator</dt><dd>${escapeHtml(snapshot.owner)}</dd></div>
    </dl>
    <hr class="detail-divider" />
    <dl class="detail-list">
      <div class="detail-row"><dt>Altitude</dt><dd data-field="altitude">${snapshot.altitudeKm.toFixed(0)} km</dd></div>
      <div class="detail-row"><dt>Velocity</dt><dd data-field="velocity">${snapshot.velocityKmS.toFixed(2)} km/s</dd></div>
      <div class="detail-row"><dt>Orbit</dt><dd>${snapshot.layer}</dd></div>
      <div class="detail-row"><dt>Type</dt><dd>${categoryLabel[snapshot.category] ?? snapshot.category}</dd></div>
      <div class="detail-row"><dt>Inclination</dt><dd>${snapshot.inclinationDeg.toFixed(1)}°</dd></div>
    </dl>
    <button type="button" id="btn-orbit-trail" class="btn-orbit-trail${state.showOrbitTrail ? ' active' : ''}">
      ${state.showOrbitTrail ? 'Hide Orbit Trail' : 'Show Orbit Trail'}
    </button>
    <button type="button" id="btn-ground-track" class="btn-orbit-trail${state.showGroundTrack ? ' active' : ''}">
      ${state.showGroundTrack ? 'Hide Ground Track' : 'Show Ground Track'}
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
    const names = colocatedA.filter((n) => n !== conjunction.objectA).join(', ');
    colocatedNote = `<p class="muted conjunction-colocated-note">${escapeHtml(conjunction.objectA)} appears alongside ${escapeHtml(names)}</p>`;
  } else if (isCoOrbitingPair(conjunction.relativeVelocityKmS)) {
    colocatedNote = `<p class="muted conjunction-colocated-note">These objects are co-orbiting (very low relative velocity).</p>`;
  }

  const rewindSecs = Math.round(getVerificationRewindMs(conjunction.relativeVelocityKmS) / 1000);

  detailEl.innerHTML = `
    <h2 class="panel-heading panel-heading--alert">Close Approach</h2>
    <div class="conjunction-detail-title">
      ${escapeHtml(conjunction.objectA)} vs ${escapeHtml(conjunction.objectB)}
    </div>
    <dl class="detail-list">
      <div class="detail-row"><dt>CPA Time</dt><dd>${formatUtcDateTime(conjunction.time)}</dd></div>
      <div class="detail-row"><dt>Sim Time</dt><dd data-field="sim-time">—</dd></div>
      <div class="detail-row"><dt>Time to CPA</dt><dd data-field="time-to-cpa">—</dd></div>
      <div class="detail-row"><dt>Live Separation</dt><dd data-field="live-distance">—</dd></div>
      <div class="detail-row"><dt>Minimum Distance</dt><dd>${conjunction.distanceKm.toFixed(3)} km</dd></div>
      <div class="detail-row"><dt>Relative Velocity</dt><dd data-field="relative-velocity">—</dd></div>
      <div class="detail-row"><dt>Risk</dt><dd data-field="verification-risk" class="conjunction-risk--monitor">—</dd></div>
    </dl>
    ${colocatedNote}
    <p class="muted conjunction-detail-hint" data-field="verification-hint">
      Rewound ${rewindSecs}s before closest approach. Press play to watch.
    </p>
    <button type="button" id="btn-exit-conjunction" class="btn-exit-conjunction">
      ← Back to Globe
    </button>
  `;
}

function buildInfoCard(event: ReturnType<typeof getHistoricalEvent>): string {
  if (!event?.info) return '';
  const eType = event.eventType ?? 'collision';
  return `
    <div class="eic eic--${escapeHtml(eType)}">
      <div class="eic__title">
        <span class="eic__badge">${escapeHtml(event.info.title)}</span>
      </div>
      <div class="eic__section">
        <h4 class="eic__heading">Why it happened</h4>
        <p class="eic__text">${escapeHtml(event.info.reason)}</p>
      </div>
      <div class="eic__section">
        <h4 class="eic__heading">Outcome</h4>
        <p class="eic__text">${escapeHtml(event.info.outcome)}</p>
      </div>
    </div>
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
        <div class="detail-row"><dt>Debris Created</dt><dd>${escapeHtml(event.debrisCount)}</dd></div>
      </dl>
    </div>
    ${buildInfoCard(event)}
  `;
}

const REPLAY_PANEL_META = {
  collision: { heading: 'Collision Replay', tti: 'Time to Impact', banner: 'IMPACT', showSep: true  },
  asat:      { heading: 'ASAT Intercept Replay', tti: 'Time to Intercept', banner: 'INTERCEPT', showSep: false },
  docking:   { heading: 'Docking Replay', tti: 'Time to Docking', banner: 'DOCKED', showSep: true  },
  breakup:   { heading: 'Breakup Replay', tti: 'Time to Breakup', banner: 'BREAKUP', showSep: false },
} as const;

function renderEventReplayPanel(detailEl: Element, eventId: string): void {
  const event = getHistoricalEvent(eventId);
  if (!event) return;

  const eType = event.eventType ?? 'collision';
  const meta  = REPLAY_PANEL_META[eType] ?? REPLAY_PANEL_META.collision;

  const objectBHtml = (() => {
    if (event.objectB) {
      return `<div class="era-sat era-sat--b" title="${escapeHtml(event.objectB.name)}">
                <span class="era-dot era-dot--b"></span>
                <span class="era-label">${escapeHtml(event.objectB.name)}</span>
              </div>`;
    }
    if (eType === 'asat') {
      return `<div class="era-sat era-sat--missile"><span class="era-missile">⚡</span><span class="era-label">Missile</span></div>`;
    }
    return '';
  })();

  detailEl.innerHTML = `
    <h2 class="panel-heading panel-heading--alert">${escapeHtml(meta.heading)}</h2>
    <div class="event-replay-title">${escapeHtml(event.title)}</div>

    <div class="event-replay-approach">
      <div class="era-sat era-sat--a" title="${escapeHtml(event.objectA.name)}">
        <span class="era-dot era-dot--a"></span>
        <span class="era-label">${escapeHtml(event.objectA.name)}</span>
      </div>
      ${objectBHtml}
    </div>

    <dl class="detail-list era-stats">
      <div class="detail-row"><dt>Sim Time</dt><dd data-field="era-simtime">—</dd></div>
      <div class="detail-row"><dt>${escapeHtml(meta.tti)}</dt><dd data-field="era-tti">—</dd></div>
      ${meta.showSep
        ? `<div class="detail-row"><dt>Separation</dt><dd data-field="era-dist">—</dd></div>`
        : ''
      }
    </dl>

    <div class="era-controls">
      <button type="button" id="btn-replay-back" class="btn-era-ctrl" title="Back 5 seconds">⏮</button>
      <button type="button" id="btn-replay-restart" class="btn-era-ctrl" title="Restart">↺</button>
      <button type="button" id="btn-replay-play" class="btn-era-ctrl btn-era-play" data-field="era-play-btn">⏸</button>
      <button type="button" id="btn-replay-fwd" class="btn-era-ctrl" title="Forward 5 seconds">⏭</button>
    </div>

    <button type="button" id="btn-replay-exit" class="btn-exit-conjunction">
      ← Back to Globe
    </button>

    ${buildInfoCard(event)}
  `;
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
  const scrubEl = detailEl.querySelector<HTMLInputElement>('#era-scrub');
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

  if (scrubEl && document.activeElement !== scrubEl) {
    scrubEl.value = String(progress * 100);
  }

  if (playBtn) {
    playBtn.textContent = eventReplay.playing ? '⏸' : '▶';
  }

  // Distance decreases from initialSep → 0 at impact, using the same linear model as EventReplayVisuals
  if (distEl) {
    const event = getHistoricalEvent(eventId);
    if (event?.approachB) {
      if (!replayInitialSepCache.has(eventId)) {
        const startMs = collisionTimeMs - EVENT_REPLAY_REWIND_MS;
        const sep = computeInitialSeparationKm(event, startMs);
        replayInitialSepCache.set(eventId, sep);
      }
      const startMs = collisionTimeMs - EVENT_REPLAY_REWIND_MS;
      const prog = Math.max(0, Math.min(1,
        (eventReplay.currentMs - startMs) / (collisionTimeMs - startMs),
      ));
      const initialSep = replayInitialSepCache.get(eventId) ?? 0;
      const distKm = (1 - prog) * initialSep;
      distEl.textContent = distKm < 1
        ? `${distKm.toFixed(2)} km`
        : `${distKm.toFixed(0)} km`;
    }
  }

  if (impactEl) {
    const atOrPastImpact = msToImpact <= 0;
    impactEl.hidden = !atOrPastImpact;
    impactEl.classList.toggle('era-impact--active', atOrPastImpact);
  }

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
