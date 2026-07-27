/**
 * Live Satellite Spotter — Google Maps–style aim guide for the selected object.
 *
 * Uses GPS + device compass to show turn/elevation toward any catalog satellite.
 * No camera AR in v1; compass radar + numeric guidance only.
 */

import {
  assessPhotoConditions,
  computeLookAngles,
  findNextPass,
  GOOD_ELEV_DEG,
  headingDelta,
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
let lastComputeMs = 0;
let unsubState: (() => void) | null = null;
let unsubSensors: (() => void) | null = null;
let unsubLang: (() => void) | null = null;
let cachedPass: PassEvent | null = null;
let cachedPassKey = '';
let lastLook: LookAngles | null = null;

const COMPUTE_INTERVAL_MS = 250;

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

  startObserverSensors();
  renderShell();
  bindShellEvents();

  unsubSensors = subscribeSensors(() => {
    refreshPassCache(true);
    updateLiveUi();
  });
  unsubState = subscribe(() => {
    const s = getState();
    if (s.selectedIndex == null) {
      closeSpotterPanel();
      return;
    }
    refreshPassCache(true);
    updateLiveUi();
  });
  unsubLang = onLangChange(() => {
    renderShell();
    bindShellEvents();
    updateLiveUi();
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSpotterPanel();
  });
  document.addEventListener('keydown', handleEsc);

  const loop = (now: number): void => {
    if (!backdropEl) return;
    if (now - lastComputeMs >= COMPUTE_INTERVAL_MS) {
      lastComputeMs = now;
      updateLiveUi();
    } else {
      drawRadarOnly();
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
    return `${sensors.headingDeg.toFixed(0)}°`;
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

function updateLiveUi(): void {
  if (!panelEl) return;
  const state = getState();
  const sensors = getSensorSnapshot();
  const locStatus = panelEl.querySelector('#spotter-loc-status');
  const headStatus = panelEl.querySelector('#spotter-heading-status');
  if (locStatus) locStatus.textContent = locationStatusText(sensors);
  if (headStatus) headStatus.textContent = headingStatusText(sensors);

  if (state.selectedIndex == null || !sensors.location) {
    lastLook = null;
    setText('spotter-guide', t('spotter.need_location'));
    setHtml('spotter-chips', '');
    setText('spotter-pass', '');
    drawRadar(null, sensors.headingDeg);
    return;
  }

  const obj = state.objects[state.selectedIndex];
  const time = getSimulationTime();
  const look = computeLookAngles(obj.satrec, sensors.location, time);
  lastLook = look;
  refreshPassCache();

  const photo = look?.visible
      ? assessPhotoConditions(obj.satrec, sensors.location, time, getSunEci(time))
      : null;

  updateGuide(look, sensors, photo);
  updateChips(look, photo);
  updatePassHint(look);
  drawRadar(look, sensors.headingDeg);
}

type PhotoAssessment = NonNullable<ReturnType<typeof assessPhotoConditions>>;

function updateGuide(
  look: LookAngles | null,
  sensors: SensorSnapshot,
  photo: PhotoAssessment | null,
): void {
  if (!look) {
    setText('spotter-guide', t('spotter.propagate_fail'));
    return;
  }

  if (!look.visible) {
    const rise = cachedPass?.rise;
    if (rise) {
      setText(
        'spotter-guide',
        t('spotter.below_rise')
          .replace('{time}', formatLocalTime(rise.time))
          .replace('{az}', rise.azimuthDeg.toFixed(0)),
      );
    } else {
      setText('spotter-guide', t('spotter.below_none'));
    }
    return;
  }

  const elev = look.elevationDeg.toFixed(0);

  if (sensors.headingDeg == null) {
    setText(
      'spotter-guide',
      t('spotter.guide_no_compass')
        .replace('{az}', look.azimuthDeg.toFixed(0))
        .replace('{el}', elev),
    );
    return;
  }

  const delta = headingDelta(sensors.headingDeg, look.azimuthDeg);
  const abs = Math.abs(delta).toFixed(0);
  const aimed = Math.abs(delta) < 8 && look.elevationDeg >= GOOD_ELEV_DEG;
  if (aimed) {
    const lockKey =
      photo?.favorable
        ? 'spotter.guide_locked'
        : !photo?.satelliteLit
          ? 'spotter.guide_aimed_eclipse'
          : !photo?.observerDark
            ? 'spotter.guide_aimed_day'
            : 'spotter.guide_aimed_dim';
    setText('spotter-guide', t(lockKey).replace('{el}', elev));
    return;
  }
  if (Math.abs(delta) < 8) {
    setText('spotter-guide', t('spotter.guide_look_up').replace('{el}', elev));
    return;
  }
  const turnKey = delta > 0 ? 'spotter.guide_right' : 'spotter.guide_left';
  setText('spotter-guide', t(turnKey).replace('{deg}', abs).replace('{el}', elev));
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
  setHtml('spotter-chips', chips.join(''));
}

function chip(kind: string, label: string): string {
  return `<span class="spotter-chip spotter-chip--${kind}">${escapeHtml(label)}</span>`;
}

function updatePassHint(look: LookAngles | null): void {
  if (!cachedPass?.max) {
    setText('spotter-pass', look?.visible ? '' : t('spotter.pass_none'));
    return;
  }
  const max = cachedPass.max;
  const set = cachedPass.set;
  let text = t('spotter.pass_max')
    .replace('{el}', max.elevationDeg.toFixed(0))
    .replace('{time}', formatLocalTime(max.time));
  if (set) text += ` · ${t('spotter.pass_set').replace('{time}', formatLocalTime(set.time))}`;
  setText('spotter-pass', text);
}

function drawRadarOnly(): void {
  const sensors = getSensorSnapshot();
  drawRadar(lastLook, sensors.headingDeg);
}

function drawRadar(look: LookAngles | null, headingDeg: number | null): void {
  const canvas = panelEl?.querySelector<HTMLCanvasElement>('#spotter-radar');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const css = 280;
  if (canvas.width !== Math.round(css * dpr)) {
    canvas.width = Math.round(css * dpr);
    canvas.height = Math.round(css * dpr);
    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, css, css);

  const cx = css / 2;
  const cy = css / 2;
  const r = css / 2 - 18;

  // Disk
  ctx.beginPath();
  ctx.fillStyle = 'rgba(8, 18, 36, 0.95)';
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Elevation rings (horizon outer, zenith center)
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

  // Cardinal labels relative to device heading (top = facing direction)
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

  // Fixed “you” crosshair at exact center (never offset)
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

  // Facing marker on the rim (top = phone top / look direction)
  ctx.beginPath();
  ctx.fillStyle = '#f8fafc';
  ctx.moveTo(cx, cy - r + 4);
  ctx.lineTo(cx - 7, cy - r + 16);
  ctx.lineTo(cx + 7, cy - r + 16);
  ctx.closePath();
  ctx.fill();

  // Target
  if (look) {
    const elev = Math.max(-5, Math.min(90, look.elevationDeg));
    const rr = elevToRadius(elev, r);
    const relAz = ((look.azimuthDeg - heading + 360) % 360) * (Math.PI / 180);
    const tx = cx + Math.sin(relAz) * rr;
    const ty = cy - Math.cos(relAz) * rr;

    if (look.visible) {
      // Line from you → target
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

      if (hasHeading) {
        const delta = headingDelta(heading, look.azimuthDeg);
        if (Math.abs(delta) < 8 && look.elevationDeg >= GOOD_ELEV_DEG) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
          ctx.lineWidth = 2;
          ctx.arc(cx, cy, 16, 0, Math.PI * 2);
          ctx.stroke();
        }
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

/** Map elevation (0=horizon … 90=zenith) to radius; below horizon → outer rim. */
function elevToRadius(elevDeg: number, maxR: number): number {
  if (elevDeg <= 0) return maxR * 0.96;
  const tElev = Math.min(90, elevDeg) / 90;
  return maxR * (1 - tElev) * 0.92;
}

function formatLocalTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function setText(id: string, text: string): void {
  const el = panelEl?.querySelector(`#${id}`);
  if (el) el.textContent = text;
}

function setHtml(id: string, html: string): void {
  const el = panelEl?.querySelector(`#${id}`);
  if (el) el.innerHTML = html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
