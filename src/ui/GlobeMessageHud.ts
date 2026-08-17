/**
 * Always-on globe caption: catalog mix + a business-as-usual +25y outlook.
 * Keeps the congestion thesis on screen without opening Kessler or the tour.
 */

import {
  KESSLER_PRESETS,
  REAL_WORLD_BASELINE_OBJECTS,
  projectKesslerTimeline,
} from '../orbital/kesslerProjection';
import { getState, subscribe } from '../state/appState';
import { onLangChange, t } from '../i18n/i18n';
import { openKesslerPanel } from './KesslerPanel';
import { LEO_SHELL_ALTITUDE_KM } from '../scene/LeoShell';

const PROJECTION_YEARS = 25;

let rootEl: HTMLElement | null = null;
let unsubState: (() => void) | null = null;
let unsubLang: (() => void) | null = null;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatHudCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString()}k`;
  return n.toLocaleString();
}

export function bauOutlookInYears(years = PROJECTION_YEARS): {
  year: number;
  totalObjects: number;
  riskMultiple: number;
} {
  const startYear = new Date().getUTCFullYear();
  const points = projectKesslerTimeline(
    startYear,
    startYear + years,
    REAL_WORLD_BASELINE_OBJECTS,
    KESSLER_PRESETS.bau,
  );
  const last = points[points.length - 1]!;
  return {
    year: last.year,
    totalObjects: last.totalObjects,
    riskMultiple: last.riskIndex / 100,
  };
}

function fillTemplate(key: string, vars: Record<string, string>): string {
  let s = t(key);
  for (const [name, value] of Object.entries(vars)) {
    s = s.replaceAll(`{${name}}`, value);
  }
  return s;
}

function shouldHide(): boolean {
  const { eventReplay, selectedConjunction, selectedEventId } = getState();
  return eventReplay != null || selectedConjunction != null || selectedEventId != null;
}

function renderHud(): void {
  if (!rootEl) return;
  const { stats, conjunctions, conjunctionHiddenCount } = getState();
  const hidden = shouldHide();
  rootEl.hidden = hidden;
  rootEl.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) return;

  const outlook = bauOutlookInYears();
  const close24h = conjunctions.length + conjunctionHiddenCount;
  const lede = rootEl.querySelector('#globe-hud-lede');
  const catalog = rootEl.querySelector('#globe-hud-catalog');
  const leo = rootEl.querySelector('#globe-hud-leo');
  const debris = rootEl.querySelector('#globe-hud-debris');
  const approaches = rootEl.querySelector('#globe-hud-approaches');
  const outlookEl = rootEl.querySelector('#globe-hud-outlook');
  const openBtn = rootEl.querySelector('#globe-hud-open');
  const shell = rootEl.querySelector('#globe-hud-shell');

  if (lede) lede.textContent = t('hud.lede');
  if (catalog) catalog.textContent = formatHudCount(stats.total);
  if (leo) leo.textContent = `${Math.round(stats.leoPercent)}%`;
  if (debris) debris.textContent = formatHudCount(stats.categoryCounts.debris);
  if (approaches) approaches.textContent = formatHudCount(close24h);
  if (outlookEl) {
    outlookEl.textContent = fillTemplate('hud.outlook', {
      year: String(outlook.year),
      n: formatHudCount(outlook.totalObjects),
      r: outlook.riskMultiple.toFixed(1),
    });
  }
  if (openBtn) openBtn.textContent = t('hud.outlook_open');
  if (shell) {
    shell.textContent = fillTemplate('hud.shell_caption', {
      km: String(LEO_SHELL_ALTITUDE_KM),
    });
  }
}

export function initGlobeMessageHud(container: HTMLElement): void {
  if (rootEl) return;

  const hud = document.createElement('aside');
  hud.id = 'globe-message-hud';
  hud.className = 'globe-hud';
  hud.setAttribute('aria-label', t('hud.aria'));
  hud.innerHTML = `
    <p class="globe-hud__lede" id="globe-hud-lede"></p>
    <dl class="globe-hud__stats">
      <div class="globe-hud__stat">
        <dt data-i18n="hud.stat_globe">${escapeHtml(t('hud.stat_globe'))}</dt>
        <dd id="globe-hud-catalog">—</dd>
      </div>
      <div class="globe-hud__stat">
        <dt data-i18n="hud.stat_leo">${escapeHtml(t('hud.stat_leo'))}</dt>
        <dd id="globe-hud-leo">—</dd>
      </div>
      <div class="globe-hud__stat">
        <dt data-i18n="hud.stat_debris">${escapeHtml(t('hud.stat_debris'))}</dt>
        <dd id="globe-hud-debris">—</dd>
      </div>
      <div class="globe-hud__stat">
        <dt data-i18n="hud.stat_approaches">${escapeHtml(t('hud.stat_approaches'))}</dt>
        <dd id="globe-hud-approaches">—</dd>
      </div>
    </dl>
    <p class="globe-hud__outlook" id="globe-hud-outlook"></p>
    <button type="button" class="globe-hud__btn" id="globe-hud-open"></button>
    <p class="globe-hud__shell" id="globe-hud-shell"></p>
  `;
  container.appendChild(hud);
  rootEl = hud;

  hud.querySelector('#globe-hud-open')?.addEventListener('click', () => {
    openKesslerPanel();
  });

  unsubState = subscribe(renderHud);
  unsubLang = onLangChange(() => {
    hud.setAttribute('aria-label', t('hud.aria'));
    hud.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n!);
    });
    renderHud();
  });
  renderHud();
}

/** Test helper — also safe to call on teardown. */
export function unmountGlobeMessageHud(): void {
  unsubState?.();
  unsubLang?.();
  unsubState = null;
  unsubLang = null;
  rootEl?.remove();
  rootEl = null;
}
