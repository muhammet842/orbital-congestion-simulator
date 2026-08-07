/**
 * Live Satellite Spotter — minimal turn / tilt guide for the selected object.
 *
 * Shows only: how far to rotate left/right, and how far to tilt the phone up/down.
 * Heavy globe rendering is paused while this panel is open.
 */

import {
  assessPhotoConditions,
  computeLookAngles,
  findNextPass,
  GOOD_ELEV_DEG,
  headingDelta,
  skyAngularSeparationDeg,
  type LookAngles,
  type PassEvent,
} from '../orbital/lookAngles';
import { getSunEci } from '../scene/dayNight';
import { getState, isLiveMode, subscribe } from '../state/appState';
import { onLangChange, t } from '../i18n/i18n';
import {
  GPS_ACCURACY_WARN_M,
  getSensorSnapshot,
  setManualLocation,
  startObserverSensors,
  startOrientation,
  stopObserverSensors,
  subscribeSensors,
  type SensorSnapshot,
} from './observerSensors';

let backdropEl: HTMLElement | null = null;
let panelEl: HTMLElement | null = null;
let timerId = 0;
let unsubState: (() => void) | null = null;
let unsubSensors: (() => void) | null = null;
let unsubLang: (() => void) | null = null;
let lastLook: LookAngles | null = null;
let lastLookMs = 0;
let aimLocked = false;
let lastTurnText = '';
let lastTiltText = '';
let lastSelectedIndex: number | null = null;
let radarCanvas: HTMLCanvasElement | null = null;
let radarCtx: CanvasRenderingContext2D | null = null;
let lastRadarKey = '';
let cachedPass: PassEvent | null = null;
let cachedPassKey = '';
let passComputeScheduled = false;
let lastLightText = '';
let lastChipsHtml = '';
let lastPhoto: PhotoAssessment | null = null;

type PhotoAssessment = NonNullable<ReturnType<typeof assessPhotoConditions>>;

/** Poll sensors + refresh guide (no continuous rAF). */
const TICK_MS = 100;
/** Recompute satellite az/el at most this often. */
const LOOK_INTERVAL_MS = 500;
const LOCK_ENTER_DEG = 8;
const LOCK_EXIT_DEG = 14;
const DEADBAND_DEG = 3;
/** Warn in Spotter when catalog is older than this (LEO drifts fast). */
const TLE_STALE_WARN_DAYS = 2;
/** Photo-condition refresh cadence (sunlit / daytime). */
const PHOTO_INTERVAL_MS = 2_000;
let lastPhotoMs = 0;

/** Spotter aims at the real sky — always wall-clock, never 10x/100x sim time. */
function getSpotterTime(): Date {
  return new Date();
}

export function isSpotterOpen(): boolean {
  return backdropEl != null;
}

export function openSpotterPanel(): void {
  if (backdropEl) return;
  const state = getState();
  if (state.selectedIndex == null) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'spotter-backdrop';
  backdrop.className = 'spotter-backdrop';

  const panel = document.createElement('div');
  panel.id = 'spotter-panel';
  panel.className = 'spotter-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
  backdropEl = backdrop;
  panelEl = panel;

  lastLook = null;
  lastLookMs = 0;
  aimLocked = false;
  lastTurnText = '';
  lastTiltText = '';
  lastSelectedIndex = state.selectedIndex;
  radarCanvas = null;
  radarCtx = null;
  lastRadarKey = '';
  cachedPass = null;
  cachedPassKey = '';
  passComputeScheduled = false;
  lastLightText = '';
  lastChipsHtml = '';
  lastPhoto = null;
  lastPhotoMs = 0;

  startObserverSensors();
  renderShell();
  bindShellEvents();

  unsubSensors = subscribeSensors(() => {
    cachedPass = null;
    cachedPassKey = '';
    tick();
  });
  unsubState = subscribe(() => {
    const s = getState();
    if (s.selectedIndex == null) {
      closeSpotterPanel();
      return;
    }
    // Ignore simulation-time churn — only react to selection changes.
    if (s.selectedIndex !== lastSelectedIndex) {
      lastSelectedIndex = s.selectedIndex;
      lastLook = null;
      aimLocked = false;
      cachedPass = null;
      cachedPassKey = '';
      renderShell();
      bindShellEvents();
      tick();
    }
  });
  unsubLang = onLangChange(() => {
    renderShell();
    bindShellEvents();
    tick();
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSpotterPanel();
  });
  document.addEventListener('keydown', handleEsc);

  tick();
  timerId = window.setInterval(tick, TICK_MS);
}

export function closeSpotterPanel(): void {
  if (timerId) {
    clearInterval(timerId);
    timerId = 0;
  }
  stopObserverSensors();
  unsubState?.();
  unsubSensors?.();
  unsubLang?.();
  unsubState = null;
  unsubSensors = null;
  unsubLang = null;
  document.removeEventListener('keydown', handleEsc);
  backdropEl?.remove();
  backdropEl = null;
  panelEl = null;
  radarCanvas = null;
  radarCtx = null;
  lastLook = null;
  cachedPass = null;
  cachedPassKey = '';
}

function handleEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeSpotterPanel();
}

function renderShell(): void {
  if (!panelEl) return;
  const state = getState();
  const obj = state.selectedIndex != null ? state.objects[state.selectedIndex] : null;
  const name = obj?.name ?? '—';
  const sensors = getSensorSnapshot();
  const lat = sensors.location?.latitudeDeg.toFixed(5) ?? '';
  const lon = sensors.location?.longitudeDeg.toFixed(5) ?? '';
  const needLoc = !sensors.location;

  panelEl.innerHTML = `
    <div class="spotter-header">
      <div class="spotter-title">${t('spotter.title')}</div>
      <button type="button" class="spotter-close" id="spotter-close" aria-label="${t('spotter.close')}">✕</button>
    </div>
    <div class="spotter-body spotter-body--minimal">
      <p class="spotter-target">${escapeHtml(name)}</p>
      <p class="spotter-hint">${t('spotter.compass_hint')}</p>
      <p class="spotter-hint spotter-hint--muted">${t('spotter.hold_hint')}</p>

      <div class="spotter-radar-wrap">
        <canvas id="spotter-radar" class="spotter-radar spotter-radar--sm" width="200" height="200"></canvas>
      </div>

      <p class="spotter-cue spotter-cue--turn" id="spotter-turn">—</p>
      <p class="spotter-cue spotter-cue--tilt" id="spotter-tilt">—</p>
      <div class="spotter-chips" id="spotter-chips"></div>
      <p class="spotter-light" id="spotter-light"></p>
      ${!isLiveMode() ? `<p class="spotter-realtime-note">${t('spotter.realtime_only')}</p>` : ''}

      <details class="spotter-sensors" ${needLoc ? 'open' : ''}>
        <summary>${t('spotter.location')} · <span id="spotter-loc-status">${locationStatusText(sensors)}</span></summary>
        <div class="spotter-manual">
          <label>${t('spotter.lat')}
            <input id="spotter-lat" type="number" step="0.0001" value="${lat}" />
          </label>
          <label>${t('spotter.lon')}
            <input id="spotter-lon" type="number" step="0.0001" value="${lon}" />
          </label>
          <button type="button" id="spotter-apply-loc" class="spotter-btn spotter-btn--secondary">${t('spotter.apply_location')}</button>
        </div>
        <button type="button" id="spotter-enable-compass" class="spotter-btn spotter-btn--secondary">${t('spotter.enable_compass')}</button>
      </details>
    </div>
  `;
  radarCanvas = panelEl.querySelector('#spotter-radar');
  radarCtx = radarCanvas?.getContext('2d') ?? null;
  lastTurnText = '';
  lastTiltText = '';
  lastLightText = '';
  lastChipsHtml = '';
}

function bindShellEvents(): void {
  panelEl?.querySelector('#spotter-close')?.addEventListener('click', closeSpotterPanel);
  panelEl?.querySelector('#spotter-enable-compass')?.addEventListener('click', () => {
    void startOrientation();
  });
  panelEl?.querySelector('#spotter-apply-loc')?.addEventListener('click', () => {
    const latEl = panelEl?.querySelector<HTMLInputElement>('#spotter-lat');
    const lonEl = panelEl?.querySelector<HTMLInputElement>('#spotter-lon');
    if (!latEl || !lonEl) return;
    const latitudeDeg = Number(latEl.value);
    const longitudeDeg = Number(lonEl.value);
    if (!Number.isFinite(latitudeDeg) || !Number.isFinite(longitudeDeg)) return;
    setManualLocation({ latitudeDeg, longitudeDeg, altitudeKm: 0 });
  });
}

function locationStatusText(sensors: SensorSnapshot): string {
  if (sensors.locationSource === 'gps') {
    const acc = sensors.accuracyMeters;
    if (acc != null && acc >= GPS_ACCURACY_WARN_M) {
      return t('spotter.loc_gps_weak').replace('{m}', Math.round(acc).toString());
    }
    return t('spotter.loc_gps');
  }
  if (sensors.locationSource === 'manual') return t('spotter.loc_manual');
  if (sensors.locationSource === 'cached') return t('spotter.loc_cached');
  if (sensors.locationError === 'denied') return t('spotter.loc_denied');
  if (sensors.locationError === 'unsupported') return t('spotter.loc_unsupported');
  return t('spotter.loc_waiting');
}

function tick(): void {
  if (!panelEl) return;
  const state = getState();
  const sensors = getSensorSnapshot();
  const now = performance.now();

  const locStatus = panelEl.querySelector('#spotter-loc-status');
  if (locStatus) locStatus.textContent = locationStatusText(sensors);

  if (state.selectedIndex == null || !sensors.location) {
    lastLook = null;
    lastPhoto = null;
    setCue('spotter-turn', t('spotter.need_location'));
    setCue('spotter-tilt', '');
    setLight('');
    setChipsHtml('');
    return;
  }

  const obj = state.objects[state.selectedIndex];
  if (!lastLook || now - lastLookMs >= LOOK_INTERVAL_MS) {
    lastLookMs = now;
    lastLook = computeLookAngles(obj.satrec, sensors.location, getSpotterTime());
  }

  if (lastLook?.visible && (now - lastPhotoMs >= PHOTO_INTERVAL_MS || !lastPhoto)) {
    lastPhotoMs = now;
    lastPhoto = assessPhotoConditions(
      obj.satrec,
      sensors.location,
      getSpotterTime(),
      getSunEci(getSpotterTime()),
    );
  } else if (!lastLook?.visible) {
    lastPhoto = null;
  }

  if (lastLook && !lastLook.visible) {
    schedulePassCompute(obj.satrec, sensors.location);
  }

  updateCues(lastLook, sensors, lastPhoto);
  updateChips(sensors, lastLook, lastPhoto);
  updateLightHint(lastLook, lastPhoto);
  maybeDrawRadar(
    lastLook,
    sensors.headingReliable ? sensors.headingDeg : null,
    sensors.pitchDeg,
  );
}

function schedulePassCompute(
  _satrec: import('satellite.js').SatRec,
  location: NonNullable<SensorSnapshot['location']>,
): void {
  const time = getSpotterTime();
  const key = `${getState().selectedIndex}|${location.latitudeDeg.toFixed(3)}|${location.longitudeDeg.toFixed(3)}|${Math.floor(time.getTime() / 60_000)}`;
  if (key === cachedPassKey && cachedPass) return;
  if (passComputeScheduled) return;
  passComputeScheduled = true;

  // Defer so the first paint of turn/tilt cues is not blocked by the scan.
  window.setTimeout(() => {
    passComputeScheduled = false;
    if (!backdropEl) return;
    const state = getState();
    const sensors = getSensorSnapshot();
    if (state.selectedIndex == null || !sensors.location) return;
    const obj = state.objects[state.selectedIndex];
    const wallTime = getSpotterTime();
    const nextKey = `${state.selectedIndex}|${sensors.location.latitudeDeg.toFixed(3)}|${sensors.location.longitudeDeg.toFixed(3)}|${Math.floor(wallTime.getTime() / 60_000)}`;
    cachedPassKey = nextKey;
    cachedPass = findNextPass(obj.satrec, sensors.location, wallTime, 18, 30);
    // Refresh below-horizon cue with the predicted rise.
    if (lastLook && !lastLook.visible) updateCues(lastLook, sensors, null);
  }, 0);
}

function updateCues(
  look: LookAngles | null,
  sensors: SensorSnapshot,
  photo: PhotoAssessment | null,
): void {
  if (!look) {
    setCue('spotter-turn', t('spotter.propagate_fail'));
    setCue('spotter-tilt', '');
    return;
  }

  if (!look.visible) {
    aimLocked = false;
    const rise = cachedPass?.rise;
    const max = cachedPass?.max;
    if (rise) {
      setCue(
        'spotter-turn',
        t('spotter.below_rise').replace('{time}', formatLocalTime(rise.time)),
      );
      if (max) {
        setCue(
          'spotter-tilt',
          t('spotter.pass_max')
            .replace('{el}', max.elevationDeg.toFixed(0))
            .replace('{time}', formatLocalTime(max.time)),
        );
      } else {
        setCue('spotter-tilt', '');
      }
    } else if (cachedPassKey) {
      setCue('spotter-turn', t('spotter.below_none'));
      setCue('spotter-tilt', '');
    } else {
      setCue('spotter-turn', t('spotter.below_computing'));
      setCue('spotter-tilt', '');
    }
    return;
  }

  if (sensors.headingDeg == null || !sensors.headingReliable) {
    setCue(
      'spotter-turn',
      t('spotter.guide_no_compass')
        .replace('{az}', look.azimuthDeg.toFixed(0))
        .replace('{el}', look.elevationDeg.toFixed(0)),
    );
    setCue(
      'spotter-tilt',
      sensors.headingError === 'needs_compass' || sensors.headingError === 'stale'
        ? t('spotter.compass_calibrate')
        : t('spotter.enable_compass'),
    );
    return;
  }

  const turn = headingDelta(sensors.headingDeg, look.azimuthDeg);
  const phoneEl = sensors.pitchDeg;
  const hasPitch = phoneEl != null;
  const sep = hasPitch
    ? skyAngularSeparationDeg(sensors.headingDeg, phoneEl, look.azimuthDeg, look.elevationDeg)
    : Math.abs(turn);

  if (aimLocked) {
    if (sep > LOCK_EXIT_DEG) aimLocked = false;
  } else if (sep < LOCK_ENTER_DEG && look.elevationDeg >= GOOD_ELEV_DEG) {
    aimLocked = true;
  }

  if (aimLocked) {
    const lockKey =
      photo?.favorable
        ? 'spotter.cue_locked_visible'
        : !photo?.satelliteLit
          ? 'spotter.cue_locked_eclipse'
          : !photo?.observerDark
            ? 'spotter.cue_locked_day'
            : 'spotter.cue_locked';
    setCue('spotter-turn', t(lockKey));
    setCue('spotter-tilt', '');
    return;
  }

  if (Math.abs(turn) < DEADBAND_DEG) {
    setCue('spotter-turn', t('spotter.cue_turn_ok'));
  } else if (turn > 0) {
    setCue('spotter-turn', t('spotter.guide_right').replace('{deg}', Math.abs(turn).toFixed(0)));
  } else {
    setCue('spotter-turn', t('spotter.guide_left').replace('{deg}', Math.abs(turn).toFixed(0)));
  }

  if (!hasPitch) {
    setCue('spotter-tilt', t('spotter.guide_look_up').replace('{el}', look.elevationDeg.toFixed(0)));
    return;
  }

  const elevErr = look.elevationDeg - phoneEl;
  if (Math.abs(elevErr) < DEADBAND_DEG) {
    setCue('spotter-tilt', t('spotter.cue_tilt_ok'));
  } else if (elevErr > 0) {
    setCue('spotter-tilt', t('spotter.guide_tilt_up').replace('{deg}', elevErr.toFixed(0)));
  } else {
    setCue('spotter-tilt', t('spotter.guide_tilt_down').replace('{deg}', Math.abs(elevErr).toFixed(0)));
  }
}

function updateChips(
  sensors: SensorSnapshot,
  look: LookAngles | null,
  photo: PhotoAssessment | null,
): void {
  const chips: string[] = [];
  if (sensors.accuracyMeters != null && sensors.accuracyMeters >= GPS_ACCURACY_WARN_M) {
    chips.push(chip('warn', t('spotter.chip_gps_weak')));
  }
  if (sensors.locationSource === 'cached') {
    chips.push(chip('warn', t('spotter.chip_loc_cached')));
  }
  if (!sensors.headingReliable) {
    chips.push(chip('warn', t('spotter.chip_compass_off')));
  }
  const tleAgeDays = tleAgeDaysNow();
  if (tleAgeDays != null && tleAgeDays >= TLE_STALE_WARN_DAYS) {
    chips.push(
      chip('warn', t('spotter.chip_tle_stale').replace('{n}', String(Math.floor(tleAgeDays)))),
    );
  }
  if (look?.visible && photo) {
    if (photo.favorable) chips.push(chip('ok', t('spotter.chip_eye_good')));
    else if (!photo.satelliteLit) chips.push(chip('warn', t('spotter.chip_eye_eclipse')));
    else if (!photo.observerDark) chips.push(chip('warn', t('spotter.chip_eye_day')));
  }
  if (
    sensors.headingReliable &&
    sensors.declinationDeg != null &&
    Math.abs(sensors.declinationDeg) >= 0.5
  ) {
    const sign = sensors.declinationDeg >= 0 ? '+' : '';
    chips.push(
      chip('muted', t('spotter.chip_declination').replace('{deg}', `${sign}${sensors.declinationDeg.toFixed(1)}`)),
    );
  }
  setChipsHtml(chips.join(''));
}

function tleAgeDaysNow(): number | null {
  const fetchedAt = getState().stats?.fetchedAt;
  if (!fetchedAt) return null;
  const ms = Date.now() - new Date(fetchedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / 86_400_000;
}

function updateLightHint(look: LookAngles | null, photo: PhotoAssessment | null): void {
  if (!look?.visible || !photo) {
    setLight('');
    return;
  }
  if (photo.favorable) setLight(t('spotter.photo_good_short'));
  else if (!photo.satelliteLit) setLight(t('spotter.photo_eclipse_short'));
  else if (!photo.observerDark) setLight(t('spotter.photo_daytime_short'));
  else setLight(t('spotter.photo_dim_short'));
}

function chip(kind: string, label: string): string {
  return `<span class="spotter-chip spotter-chip--${kind}">${escapeHtml(label)}</span>`;
}

function setLight(text: string): void {
  if (text === lastLightText) return;
  lastLightText = text;
  const el = panelEl?.querySelector('#spotter-light');
  if (el && el.textContent !== text) el.textContent = text;
}

function setChipsHtml(html: string): void {
  if (html === lastChipsHtml) return;
  lastChipsHtml = html;
  const el = panelEl?.querySelector('#spotter-chips');
  if (el && el.innerHTML !== html) el.innerHTML = html;
}

function setCue(id: 'spotter-turn' | 'spotter-tilt', text: string): void {
  if (id === 'spotter-turn') {
    if (text === lastTurnText) return;
    lastTurnText = text;
  } else {
    if (text === lastTiltText) return;
    lastTiltText = text;
  }
  const el = panelEl?.querySelector(`#${id}`);
  if (el && el.textContent !== text) el.textContent = text;
}

function maybeDrawRadar(
  look: LookAngles | null,
  headingDeg: number | null,
  pitchDeg: number | null,
): void {
  const key = [
    look ? look.azimuthDeg.toFixed(1) : '',
    look ? look.elevationDeg.toFixed(1) : '',
    headingDeg?.toFixed(1) ?? 'x',
    pitchDeg?.toFixed(1) ?? 'x',
    aimLocked ? '1' : '0',
  ].join('|');
  if (key === lastRadarKey) return;
  lastRadarKey = key;
  drawRadar(look, headingDeg, pitchDeg);
}

function drawRadar(
  look: LookAngles | null,
  headingDeg: number | null,
  pitchDeg: number | null,
): void {
  const canvas = radarCanvas ?? panelEl?.querySelector<HTMLCanvasElement>('#spotter-radar');
  if (!canvas) return;
  radarCanvas = canvas;
  const ctx = radarCtx ?? canvas.getContext('2d');
  if (!ctx) return;
  radarCtx = ctx;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const css = 200;
  const w = Math.round(css * dpr);
  if (canvas.width !== w) {
    canvas.width = w;
    canvas.height = w;
    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, css, css);

  const cx = css / 2;
  const cy = css / 2;
  const r = css / 2 - 12;

  ctx.beginPath();
  ctx.fillStyle = 'rgba(8, 18, 36, 0.95)';
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232, 164, 90, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const heading = headingDeg ?? 0;

  // Center crosshair
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 8);
  ctx.stroke();

  // Facing tip
  ctx.beginPath();
  ctx.fillStyle = '#f8fafc';
  ctx.moveTo(cx, cy - r + 2);
  ctx.lineTo(cx - 6, cy - r + 12);
  ctx.lineTo(cx + 6, cy - r + 12);
  ctx.closePath();
  ctx.fill();

  if (pitchDeg != null) {
    const pr = elevToRadius(Math.max(0, Math.min(90, pitchDeg)), r);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([3, 3]);
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (look?.visible) {
    const rr = elevToRadius(Math.max(0, Math.min(90, look.elevationDeg)), r);
    const relAz = ((look.azimuthDeg - heading + 360) % 360) * (Math.PI / 180);
    const tx = cx + Math.sin(relAz) * rr;
    const ty = cy - Math.cos(relAz) * rr;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(232, 164, 90, 0.35)';
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = 'rgba(232, 164, 90, 0.95)';
    ctx.arc(tx, ty, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function elevToRadius(elevDeg: number, maxR: number): number {
  if (elevDeg <= 0) return maxR * 0.96;
  return maxR * (1 - Math.min(90, elevDeg) / 90) * 0.92;
}

function formatLocalTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
