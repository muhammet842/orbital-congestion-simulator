/**
 * Live Satellite Spotter — Google Maps–style aim guide for the selected object.
 *
 * Uses GPS + device compass to show turn/elevation toward any catalog satellite.
 * Orientation is polled from sensors on a throttled rAF loop (not on every
 * DeviceOrientation event) so aiming near the target does not stall the UI.
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
import { getSimulationTime, getState, subscribe } from '../state/appState';
import { getSunEci } from '../scene/dayNight';
import { onLangChange, t } from '../i18n/i18n';
import {
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
let rafId = 0;
let lastUiMs = 0;
let lastRadarMs = 0;
let lastPropagateMs = 0;
let unsubState: (() => void) | null = null;
let unsubSensors: (() => void) | null = null;
let unsubLang: (() => void) | null = null;
let cachedPass: PassEvent | null = null;
let cachedPassKey = '';
let lastLook: LookAngles | null = null;
let lastPhoto: PhotoAssessment | null = null;
let aimLocked = false;
let lastGuideText = '';
let lastChipsHtml = '';
let lastPassText = '';
let radarCanvas: HTMLCanvasElement | null = null;
let radarCtx: CanvasRenderingContext2D | null = null;

/** Full guide/DOM refresh (includes SGP4 propagate). */
const UI_INTERVAL_MS = 200;
/** Canvas redraw cadence. */
const RADAR_INTERVAL_MS = 50;
/** Re-propagate satellite look angles. */
const PROPAGATE_INTERVAL_MS = 250;
/** Enter / exit thresholds for “on target” (sky degrees) — hysteresis avoids flicker. */
const LOCK_ENTER_DEG = 4;
const LOCK_EXIT_DEG = 8;

type PhotoAssessment = NonNullable<ReturnType<typeof assessPhotoConditions>>;

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

  cachedPass = null;
  cachedPassKey = '';
  lastLook = null;
  lastPhoto = null;
  aimLocked = false;
  lastGuideText = '';
  lastChipsHtml = '';
  lastPassText = '';
  radarCanvas = null;
  radarCtx = null;
  lastUiMs = 0;
  lastRadarMs = 0;
  lastPropagateMs = 0;

  startObserverSensors();
  renderShell();
  bindShellEvents();

  // Location / permission changes only — orientation is polled in rAF.
  unsubSensors = subscribeSensors(() => {
    refreshPassCache(true);
    updateLiveUi(true);
  });
  unsubState = subscribe(() => {
    const s = getState();
    if (s.selectedIndex == null) {
      closeSpotterPanel();
      return;
    }
    refreshPassCache(true);
    updateLiveUi(true);
  });
  unsubLang = onLangChange(() => {
    renderShell();
    bindShellEvents();
    updateLiveUi(true);
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSpotterPanel();
  });
  document.addEventListener('keydown', handleEsc);

  const loop = (now: number): void => {
    if (!backdropEl) return;
    if (now - lastUiMs >= UI_INTERVAL_MS) {
      lastUiMs = now;
      updateLiveUi(false);
    } else if (now - lastRadarMs >= RADAR_INTERVAL_MS) {
      lastRadarMs = now;
      const sensors = getSensorSnapshot();
      drawRadar(lastLook, sensors.headingDeg, sensors.pitchDeg);
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

export function closeSpotterPanel(): void {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
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
  cachedPass = null;
  lastLook = null;
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
  const needManualLoc = !sensors.location || sensors.locationSource !== 'gps';

  panelEl.innerHTML = `
    <div class="spotter-header">
      <div class="spotter-title">${t('spotter.title')}</div>
      <button type="button" class="spotter-close" id="spotter-close" aria-label="${t('spotter.close')}">✕</button>
    </div>
    <div class="spotter-body">
      <p class="spotter-target">${escapeHtml(name)}</p>

      <div class="spotter-radar-wrap">
        <canvas id="spotter-radar" class="spotter-radar" width="280" height="280"></canvas>
        <div class="spotter-compass-hint">${t('spotter.compass_hint')}</div>
      </div>

      <p class="spotter-guide" id="spotter-guide">—</p>
      <p class="spotter-pitch" id="spotter-pitch"></p>
      <div class="spotter-chips" id="spotter-chips"></div>
      <p class="spotter-pass" id="spotter-pass"></p>

      <details class="spotter-sensors" ${needManualLoc ? 'open' : ''}>
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
        <div class="spotter-sensor-row">
          <span>${t('spotter.heading')}</span>
          <span id="spotter-heading-status">${headingStatusText(sensors)}</span>
        </div>
        <button type="button" id="spotter-enable-compass" class="spotter-btn spotter-btn--secondary">${t('spotter.enable_compass')}</button>
      </details>
    </div>
  `;
  radarCanvas = panelEl.querySelector('#spotter-radar');
  radarCtx = radarCanvas?.getContext('2d') ?? null;
  lastGuideText = '';
  lastChipsHtml = '';
  lastPassText = '';
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
  if (sensors.locationSource === 'gps') return t('spotter.loc_gps');
  if (sensors.locationSource === 'manual') return t('spotter.loc_manual');
  if (sensors.locationSource === 'cached') return t('spotter.loc_cached');
  if (sensors.locationError === 'denied') return t('spotter.loc_denied');
  if (sensors.locationError === 'unsupported') return t('spotter.loc_unsupported');
  return t('spotter.loc_waiting');
}

function headingStatusText(sensors: SensorSnapshot): string {
  if (sensors.headingDeg != null) {
    const pitch =
      sensors.pitchDeg != null ? ` · ↑${sensors.pitchDeg.toFixed(0)}°` : '';
    return `${sensors.headingDeg.toFixed(0)}°${pitch}`;
  }
  if (sensors.headingError === 'denied') return t('spotter.heading_denied');
  if (sensors.headingError === 'unsupported') return t('spotter.heading_unsupported');
  return t('spotter.heading_waiting');
}

function refreshPassCache(force = false): void {
  const state = getState();
  const sensors = getSensorSnapshot();
  if (state.selectedIndex == null || !sensors.location) {
    cachedPass = null;
    return;
  }
  const obj = state.objects[state.selectedIndex];
  const time = getSimulationTime();
  const key = `${obj.noradId}|${sensors.location.latitudeDeg.toFixed(3)}|${sensors.location.longitudeDeg.toFixed(3)}|${Math.floor(time.getTime() / 60_000)}`;
  if (!force && key === cachedPassKey && cachedPass) return;
  cachedPassKey = key;
  cachedPass = findNextPass(obj.satrec, sensors.location, time);
}

function updateLiveUi(forcePropagate: boolean): void {
  if (!panelEl) return;
  const state = getState();
  const sensors = getSensorSnapshot();
  const now = performance.now();

  const locStatus = panelEl.querySelector('#spotter-loc-status');
  const headStatus = panelEl.querySelector('#spotter-heading-status');
  if (locStatus) locStatus.textContent = locationStatusText(sensors);
  if (headStatus) headStatus.textContent = headingStatusText(sensors);

  if (state.selectedIndex == null || !sensors.location) {
    lastLook = null;
    lastPhoto = null;
    setTextIfChanged('spotter-guide', t('spotter.need_location'));
    setHtmlIfChanged('spotter-chips', '');
    setTextIfChanged('spotter-pass', '');
    setTextIfChanged('spotter-pitch', '');
    drawRadar(null, sensors.headingDeg, sensors.pitchDeg);
    return;
  }

  const obj = state.objects[state.selectedIndex];
  const time = getSimulationTime();

  if (forcePropagate || now - lastPropagateMs >= PROPAGATE_INTERVAL_MS || !lastLook) {
    lastPropagateMs = now;
    lastLook = computeLookAngles(obj.satrec, sensors.location, time);
    lastPhoto =
      lastLook?.visible
        ? assessPhotoConditions(obj.satrec, sensors.location, time, getSunEci(time))
        : null;
    refreshPassCache(false);
  }

  updateGuide(lastLook, sensors, lastPhoto);
  updatePitchLine(lastLook, sensors);
  updateChips(lastLook, lastPhoto);
  updatePassHint(lastLook);
  drawRadar(lastLook, sensors.headingDeg, sensors.pitchDeg);
  lastRadarMs = now;
}

function updatePitchLine(look: LookAngles | null, sensors: SensorSnapshot): void {
  if (!look?.visible || sensors.pitchDeg == null) {
    setTextIfChanged('spotter-pitch', '');
    return;
  }
  const phone = sensors.pitchDeg;
  const target = look.elevationDeg;
  const delta = target - phone;
  const text = t('spotter.pitch_line')
    .replace('{phone}', phone.toFixed(0))
    .replace('{target}', target.toFixed(0))
    .replace('{delta}', `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}`);
  setTextIfChanged('spotter-pitch', text);
}

function updateGuide(
  look: LookAngles | null,
  sensors: SensorSnapshot,
  photo: PhotoAssessment | null,
): void {
  if (!look) {
    setTextIfChanged('spotter-guide', t('spotter.propagate_fail'));
    return;
  }

  if (!look.visible) {
    const rise = cachedPass?.rise;
    if (rise) {
      setTextIfChanged(
        'spotter-guide',
        t('spotter.below_rise').replace('{time}', formatLocalTime(rise.time)),
      );
    } else {
      setTextIfChanged('spotter-guide', t('spotter.below_none'));
    }
    return;
  }

  const elev = look.elevationDeg.toFixed(0);

  if (sensors.headingDeg == null) {
    setTextIfChanged(
      'spotter-guide',
      t('spotter.guide_no_compass')
        .replace('{az}', look.azimuthDeg.toFixed(0))
        .replace('{el}', elev),
    );
    return;
  }

  const turn = headingDelta(sensors.headingDeg, look.azimuthDeg);
  const phoneEl = sensors.pitchDeg ?? 0;
  const hasPitch = sensors.pitchDeg != null;
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
        ? 'spotter.guide_locked'
        : !photo?.satelliteLit
          ? 'spotter.guide_aimed_eclipse'
          : !photo?.observerDark
            ? 'spotter.guide_aimed_day'
            : 'spotter.guide_aimed_dim';
    setTextIfChanged('spotter-guide', t(lockKey).replace('{el}', elev));
    return;
  }

  const parts: string[] = [];
  if (Math.abs(turn) >= 1.5) {
    const turnKey = turn > 0 ? 'spotter.guide_right' : 'spotter.guide_left';
    parts.push(t(turnKey).replace('{deg}', Math.abs(turn).toFixed(0)));
  }

  if (hasPitch) {
    const elevErr = look.elevationDeg - phoneEl;
    if (Math.abs(elevErr) >= 2) {
      parts.push(
        elevErr > 0
          ? t('spotter.guide_tilt_up').replace('{deg}', elevErr.toFixed(0))
          : t('spotter.guide_tilt_down').replace('{deg}', Math.abs(elevErr).toFixed(0)),
      );
    }
  } else {
    parts.push(t('spotter.guide_look_up').replace('{el}', elev));
  }

  if (parts.length === 0) {
    parts.push(t('spotter.guide_aimed_dim').replace('{el}', elev));
  }

  setTextIfChanged('spotter-guide', parts.join(' · '));
}

function updateChips(look: LookAngles | null, photo: PhotoAssessment | null): void {
  const chips: string[] = [];
  if (!look?.visible) {
    chips.push(chip('muted', t('spotter.chip_below')));
  } else if (look.elevationDeg < GOOD_ELEV_DEG) {
    chips.push(chip('warn', t('spotter.chip_low_elev')));
  }

  if (look?.visible && photo) {
    if (photo.favorable) chips.push(chip('ok', t('spotter.chip_eye_good')));
    else if (!photo.satelliteLit) chips.push(chip('warn', t('spotter.chip_eye_eclipse')));
    else if (!photo.observerDark) chips.push(chip('warn', t('spotter.chip_eye_day')));
  }
  setHtmlIfChanged('spotter-chips', chips.join(''));
}

function chip(kind: string, label: string): string {
  return `<span class="spotter-chip spotter-chip--${kind}">${escapeHtml(label)}</span>`;
}

function updatePassHint(look: LookAngles | null): void {
  if (!cachedPass?.max) {
    setTextIfChanged('spotter-pass', look?.visible ? '' : t('spotter.pass_none'));
    return;
  }
  const max = cachedPass.max;
  const set = cachedPass.set;
  let text = t('spotter.pass_max')
    .replace('{el}', max.elevationDeg.toFixed(0))
    .replace('{time}', formatLocalTime(max.time));
  if (set) text += ` · ${t('spotter.pass_set').replace('{time}', formatLocalTime(set.time))}`;
  setTextIfChanged('spotter-pass', text);
}

function ensureRadarCtx(): CanvasRenderingContext2D | null {
  if (radarCtx) return radarCtx;
  radarCanvas = panelEl?.querySelector('#spotter-radar') ?? null;
  radarCtx = radarCanvas?.getContext('2d') ?? null;
  return radarCtx;
}

function drawRadar(
  look: LookAngles | null,
  headingDeg: number | null,
  pitchDeg: number | null,
): void {
  const canvas = radarCanvas ?? panelEl?.querySelector<HTMLCanvasElement>('#spotter-radar');
  if (!canvas) return;
  radarCanvas = canvas;
  const ctx = ensureRadarCtx();
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const css = 280;
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
  const r = css / 2 - 18;

  ctx.beginPath();
  ctx.fillStyle = 'rgba(8, 18, 36, 0.95)';
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (const elev of [0, 30, 60]) {
    const rr = elevToRadius(elev, r);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  const heading = headingDeg ?? 0;
  const hasHeading = headingDeg != null;

  ctx.font = '600 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labels: [string, number][] = [
    ['N', 0],
    ['E', 90],
    ['S', 180],
    ['W', 270],
  ];
  for (const [label, az] of labels) {
    const rel = ((az - heading + 360) % 360) * (Math.PI / 180);
    const x = cx + Math.sin(rel) * (r - 12);
    const y = cy - Math.cos(rel) * (r - 12);
    ctx.fillStyle = label === 'N' ? '#22d3ee' : 'rgba(148,163,184,0.9)';
    ctx.fillText(label, x, y);
  }

  // Phone pitch ring marker (where you are looking up)
  if (pitchDeg != null) {
    const pr = elevToRadius(Math.max(0, Math.min(90, pitchDeg)), r);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = '#f8fafc';
  ctx.moveTo(cx, cy - r + 4);
  ctx.lineTo(cx - 7, cy - r + 16);
  ctx.lineTo(cx + 7, cy - r + 16);
  ctx.closePath();
  ctx.fill();

  if (look) {
    const elev = Math.max(-5, Math.min(90, look.elevationDeg));
    const rr = elevToRadius(elev, r);
    const relAz = ((look.azimuthDeg - heading + 360) % 360) * (Math.PI / 180);
    const tx = cx + Math.sin(relAz) * rr;
    const ty = cy - Math.cos(relAz) * rr;

    if (look.visible) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = 'rgba(34, 211, 238, 0.95)';
      ctx.arc(tx, ty, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (aimLocked) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
        ctx.lineWidth = 2;
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      const bx = cx + Math.sin(relAz) * (r - 6);
      const by = cy - Math.cos(relAz) * (r - 6);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(248,113,113,0.7)';
      ctx.lineWidth = 2;
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (!hasHeading) {
    ctx.fillStyle = 'rgba(148,163,184,0.75)';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('spotter.radar_no_compass'), cx, cy + r - 28);
  }
}

function elevToRadius(elevDeg: number, maxR: number): number {
  if (elevDeg <= 0) return maxR * 0.96;
  const tElev = Math.min(90, elevDeg) / 90;
  return maxR * (1 - tElev) * 0.92;
}

function formatLocalTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function setTextIfChanged(id: string, text: string): void {
  if (id === 'spotter-guide') {
    if (text === lastGuideText) return;
    lastGuideText = text;
  } else if (id === 'spotter-pass') {
    if (text === lastPassText) return;
    lastPassText = text;
  }
  const el = panelEl?.querySelector(`#${id}`);
  if (el && el.textContent !== text) el.textContent = text;
}

function setHtmlIfChanged(id: string, html: string): void {
  if (id === 'spotter-chips') {
    if (html === lastChipsHtml) return;
    lastChipsHtml = html;
  }
  const el = panelEl?.querySelector(`#${id}`);
  if (el && el.innerHTML !== html) el.innerHTML = html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
