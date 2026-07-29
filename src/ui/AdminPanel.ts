/**
 * AdminPanel — device-local admin mode with analytics overlay.
 *
 * Access flow
 *   First time  : press Ctrl+Shift+A → create a 4-digit PIN → stored as a
 *                 simple hash in localStorage → admin flag set
 *   Later visits: localStorage flag present → auto-admin, button visible in header
 *   Panel       : click ⚙ Admin or Ctrl+Shift+A → modal opens
 *
 * Counter storage
 *   sessionStorage : "This Session" — survives refresh, resets on tab close
 *   localStorage   : "On This Device" — all-time totals on this device
 *   Firebase RTDB  : "All Users" — global aggregates (optional, via REST)
 *
 * All user-facing panel text goes through `t()` (src/i18n) — see the
 * `admin.*` keys in translations.ts. Add new UI strings there, not inline.
 *
 * Firebase security: never recommend root `.read/.write: true`. Deploy
 * `firebase/database.rules.json` (increment-only counters + schema-checked
 * presence). See `firebase/README.md`.
 */

import { getState, subscribe } from '../state/appState';
import type { TrackedObject } from '../types';
import { t, getLang, onLangChange } from '../i18n/i18n';
import { MOBILE_BREAKPOINT_PX } from './Layout';

// ── Storage keys ───────────────────────────────────────────────────────────────

const LS_ADMIN_FLAG    = 'orbital_admin_v1';
const LS_ADMIN_HASH    = 'orbital_admin_pin_v1';
const LS_FIREBASE_URL  = 'orbital_firebase_url';
const LS_TOTAL_PREFIX  = 'orbital_total_';   // all-time, this device
const SS_SESSION_PREFIX= 'orbital_ses_';     // current tab/session

/**
 * Legacy fallback URL (public RTDB endpoint — not a secret; security comes
 * from `firebase/database.rules.json`, not from hiding the host). Prefer
 * `VITE_FIREBASE_RTDB_URL` in `.env` / Vercel so analytics can be pointed at
 * another project or disabled entirely (empty string).
 */
const DEFAULT_FIREBASE_URL = 'https://orbital-congestion-sim-default-rtdb.firebaseio.com';

/** True for https://*.firebaseio.com and https://*.firebasedatabase.app roots. */
export function isValidFirebaseRtdbUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:') return false;
    if (u.pathname !== '/' && u.pathname !== '') return false;
    if (u.search || u.hash) return false;
    return u.hostname.endsWith('.firebaseio.com')
      || u.hostname.endsWith('.firebasedatabase.app');
  } catch {
    return false;
  }
}

function envFirebaseUrl(): string {
  const raw = (import.meta.env.VITE_FIREBASE_RTDB_URL as string | undefined)?.trim() ?? '';
  return raw && isValidFirebaseRtdbUrl(raw) ? raw.replace(/\/$/, '') : '';
}

// ── Real-time Presence ────────────────────────────────────────────────────────

/** Unique ID for this browser tab — persists across F5, resets on tab close. */
function getSessionId(): string {
  let id = sessionStorage.getItem('orbital_sid');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('orbital_sid', id);
  }
  return id;
}

let presenceHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

async function writePresence(countryCode: string): Promise<void> {
  const base = getFirebaseUrl();
  if (!base) return;
  const sid  = getSessionId();
  // Country must match firebase/database.rules.json: /^[A-Z?]{2}$/
  const country = /^[A-Z?]{2}$/.test(countryCode) ? countryCode : 'XX';
  const now = Date.now();
  const payload = JSON.stringify({
    country,
    since: now,
    lastSeen: now,
  });
  await fetch(`${base}/orbital_presence/${sid}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  }).catch(() => null);
}

async function updatePresenceHeartbeat(): Promise<void> {
  const base = getFirebaseUrl();
  if (!base) return;
  const sid  = getSessionId();
  await fetch(`${base}/orbital_presence/${sid}/lastSeen.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Date.now()),
  }).catch(() => null);
}

function deletePresence(): void {
  const base = getFirebaseUrl();
  if (!base) return;
  const sid  = getSessionId();
  // keepalive ensures the request completes even during page unload
  fetch(`${base}/orbital_presence/${sid}.json`, {
    method: 'DELETE',
    keepalive: true,
  }).catch(() => null);
}

async function initPresence(): Promise<void> {
  const cachedCode = sessionStorage.getItem('orbital_country_code');

  // If we already know the country (and it's not unknown), just heartbeat
  if (cachedCode && cachedCode !== 'XX') {
    const alreadyWritten = sessionStorage.getItem('orbital_presence_init');
    if (!alreadyWritten) {
      sessionStorage.setItem('orbital_presence_init', '1');
      await writePresence(cachedCode);
      window.addEventListener('beforeunload', deletePresence);
      window.addEventListener('pagehide', deletePresence);
    }
    startPresenceHeartbeat();
    return;
  }

  // First time or country was unknown — fetch geo
  sessionStorage.setItem('orbital_presence_init', '1');
  try {
    const geo = await fetchGeo();
    const code = geo?.country_code ?? 'XX';
    sessionStorage.setItem('orbital_country_code', code);
    await writePresence(code);
  } catch {
    await writePresence('XX');
  }

  startPresenceHeartbeat();
  window.addEventListener('beforeunload', deletePresence);
  window.addEventListener('pagehide', deletePresence);
}

function startPresenceHeartbeat(): void {
  if (presenceHeartbeatTimer) return;
  presenceHeartbeatTimer = setInterval(updatePresenceHeartbeat, 30_000);
}

interface PresenceEntry {
  country: string;
  since: number;
  lastSeen: number;
}

async function fbReadPresence(): Promise<Record<string, PresenceEntry> | null> {
  const r = await fbFetch('/orbital_presence.json');
  if (!r || !r.ok) return null;
  try { return await r.json() as Record<string, PresenceEntry> | null; }
  catch { return null; }
}

// ── Counter helpers ───────────────────────────────────────────────────────────

type CounterKey = 'sat' | 'evt' | 'loads';

function sesGet(k: CounterKey): number {
  return parseInt(sessionStorage.getItem(SS_SESSION_PREFIX + k) ?? '0', 10);
}
function sesInc(k: CounterKey): void {
  sessionStorage.setItem(SS_SESSION_PREFIX + k, String(sesGet(k) + 1));
}
function totGet(k: CounterKey): number {
  try { return parseInt(localStorage.getItem(LS_TOTAL_PREFIX + k) ?? '0', 10); }
  catch { return 0; }
}
function totInc(k: CounterKey): void {
  try { localStorage.setItem(LS_TOTAL_PREFIX + k, String(totGet(k) + 1)); }
  catch { /* ignore */ }
}
function inc(k: CounterKey): void { sesInc(k); totInc(k); }

// Increment page-load counter once per session (not per module re-evaluate)
if (!sessionStorage.getItem(SS_SESSION_PREFIX + 'loaded')) {
  sessionStorage.setItem(SS_SESSION_PREFIX + 'loaded', '1');
  inc('loads');
}

// ── Firebase RTDB REST helpers ────────────────────────────────────────────────

/**
 * Resolve the RTDB base URL used for analytics.
 * Priority: valid localStorage override → VITE_FIREBASE_RTDB_URL → built-in default.
 * Returns '' when analytics should stay off (invalid / explicitly disabled).
 */
export function getFirebaseUrl(): string {
  try {
    const override = localStorage.getItem(LS_FIREBASE_URL)?.trim() ?? '';
    if (override) {
      return isValidFirebaseRtdbUrl(override) ? override.replace(/\/$/, '') : '';
    }
  } catch { /* ignore */ }
  return envFirebaseUrl() || DEFAULT_FIREBASE_URL;
}

/** Persist a custom RTDB URL override. Rejects non-HTTPS Firebase hosts. */
export function setFirebaseUrl(url: string): void {
  const cleaned = url.trim().replace(/\/$/, '');
  if (!isValidFirebaseRtdbUrl(cleaned)) return;
  try { localStorage.setItem(LS_FIREBASE_URL, cleaned); }
  catch { /* ignore */ }
}

/** True when the client has a usable RTDB endpoint configured. */
export function isFirebaseConfigured(): boolean {
  return getFirebaseUrl().length > 0;
}

interface FirebaseMetrics {
  sat:   number;
  loads: number;
}
type CountryMap = Record<string, number>;

/** Structured error reason, kept separate from the (already-localized)
 *  `error` message so callers can branch on the *kind* of failure without
 *  matching against translated text. */
type FbErrorCode = 'no-connection' | 'access-denied' | 'http-error' | 'unexpected';

interface FbReadResult {
  data: FirebaseMetrics | null;
  countries: CountryMap | null;
  error: string | null;
  errorCode: FbErrorCode | null;
}

async function fbFetch(path: string): Promise<Response | null> {
  const base = getFirebaseUrl();
  if (!base) return null;
  const ctl = new AbortController();
  const tid = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${base}${path}`, { signal: ctl.signal });
    clearTimeout(tid);
    return r;
  } catch (e) {
    clearTimeout(tid);
    console.error('[AdminPanel] Firebase fetch error:', e);
    return null;
  }
}

async function fbRead(): Promise<FbReadResult> {
  const [metricsRes, countriesRes] = await Promise.all([
    fbFetch('/orbital_metrics.json'),
    fbFetch('/orbital_countries.json'),
  ]);

  if (!metricsRes) {
    return { data: null, countries: null, error: t('admin.fb_conn_error'), errorCode: 'no-connection' };
  }
  if (metricsRes.status === 401 || metricsRes.status === 403) {
    return {
      data: null, countries: null,
      error: t('admin.fb_access_denied').replace('{status}', String(metricsRes.status)),
      errorCode: 'access-denied',
    };
  }
  if (!metricsRes.ok) {
    return {
      data: null, countries: null,
      error: t('admin.fb_http_error').replace('{status}', String(metricsRes.status)),
      errorCode: 'http-error',
    };
  }

  let raw: Record<string, number> | null = null;
  try { raw = await metricsRes.json() as Record<string, number> | null; }
  catch { raw = null; }

  let countryRaw: CountryMap | null = null;
  try { if (countriesRes?.ok) countryRaw = await countriesRes.json() as CountryMap | null; }
  catch { countryRaw = null; }

  return {
    data: { sat: raw?.sat ?? 0, loads: raw?.loads ?? 0 },
    countries: countryRaw,
    error: null,
    errorCode: null,
  };
}

/** Convert ISO 3166-1 alpha-2 code to flag emoji (e.g. "TR" → "🇹🇷"). */
export function countryFlag(code: string): string {
  if (!code || code === 'XX' || code === '??' || code.length !== 2) return '🌐';
  try {
    return [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('');
  } catch { return '🌐'; }
}

/**
 * Increment a country visit counter under increment-only RTDB rules
 * (create as 1, or existing+1). Retries on concurrent write races.
 */
async function fbIncCountry(code: string): Promise<void> {
  const safeCode = code.toUpperCase().replace(/[^A-Z]/g, 'X').slice(0, 2) || 'XX';
  await fbIncrementPath(`/orbital_countries/${safeCode}.json`);
}

/** Get the display name for an ISO 3166-1 alpha-2 country code, localized
 *  to the currently active UI language (falls back to English on failure —
 *  e.g. a locale/region combo Intl.DisplayNames doesn't recognize). */
export function countryName(code: string): string {
  if (!code || code === 'XX' || code === '??' || code.length !== 2) return t('admin.unknown', 'Unknown');
  try {
    return new Intl.DisplayNames([getLang()], { type: 'region' }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code.toUpperCase();
    } catch { return code.toUpperCase(); }
  }
}

/** Track the visitor's country in Firebase (once per browser session). */
async function trackCountry(): Promise<void> {
  if (isAdminMode()) return;
  if (sessionStorage.getItem('orbital_geo_tracked')) return;
  sessionStorage.setItem('orbital_geo_tracked', '1');
  try {
    const geo = await fetchGeo();
    if (geo?.country_code) {
      await fbIncCountry(geo.country_code);
    }
  } catch { /* non-fatal */ }
}

/** Increment a metrics counter under increment-only RTDB rules. */
async function fbInc(k: CounterKey): Promise<void> {
  await fbIncrementPath(`/orbital_metrics/${k}.json`);
}

/**
 * Read-modify-write +1 against rules that only allow `1` (create) or
 * `data + 1`. Concurrent visitors can race; retry a few times.
 */
async function fbIncrementPath(path: string, attempts = 4): Promise<void> {
  const base = getFirebaseUrl();
  if (!base) return;

  for (let i = 0; i < attempts; i++) {
    const ctl = new AbortController();
    const tid = setTimeout(() => ctl.abort(), 4000);
    try {
      const r = await fetch(`${base}${path}`, { signal: ctl.signal });
      clearTimeout(tid);
      // Missing node → treat as 0 so the first write is 1 (rules require that).
      const cur = r.ok ? ((await r.json() as number | null) ?? 0) : 0;
      if (typeof cur !== 'number' || !Number.isFinite(cur) || cur < 0) return;

      const ctl2 = new AbortController();
      const tid2 = setTimeout(() => ctl2.abort(), 4000);
      const put = await fetch(`${base}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cur + 1),
        signal: ctl2.signal,
      });
      clearTimeout(tid2);
      if (put.ok) return;
      // 400 from rules validation usually means another client won the race.
      if (put.status !== 400 && put.status !== 409) return;
    } catch {
      clearTimeout(tid);
      return;
    }
  }
}

// ── Simple PIN hash (djb2) ────────────────────────────────────────────────────

export function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) h = Math.imul(h, 31) + pin.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// ── Admin auth helpers ────────────────────────────────────────────────────────

export function isAdminMode(): boolean {
  try { return localStorage.getItem(LS_ADMIN_FLAG) === '1'; }
  catch { return false; }
}

function getStoredHash(): string | null {
  try { return localStorage.getItem(LS_ADMIN_HASH); }
  catch { return null; }
}

function setAdminActive(): void {
  try { localStorage.setItem(LS_ADMIN_FLAG, '1'); }
  catch { /* ignore */ }
  refreshAdminButton();
}

export function revokeAdmin(): void {
  try {
    localStorage.removeItem(LS_ADMIN_FLAG);
    localStorage.removeItem(LS_ADMIN_HASH);
  } catch { /* ignore */ }
  refreshAdminButton();
}

// ── Geolocation cache ─────────────────────────────────────────────────────────

interface GeoData {
  ip: string;
  city: string;
  region: string;
  country_name: string;
  country_code: string; // ISO 3166-1 alpha-2, e.g. "TR"
  org: string;
}
let geoCache: GeoData | null = null;
let geoFetching = false;

async function fetchGeo(): Promise<GeoData | null> {
  if (geoCache) return geoCache;
  if (geoFetching) return null;
  geoFetching = true;

  // Try ipapi.co first, fall back to ip-api.com
  const attempts: (() => Promise<GeoData>)[] = [
    async () => {
      const ctl = new AbortController();
      setTimeout(() => ctl.abort(), 5000);
      const r = await fetch('https://ipapi.co/json/', { signal: ctl.signal });
      if (!r.ok) throw new Error(`ipapi.co ${r.status}`);
      const d = await r.json() as GeoData;
      if (!d.country_code) throw new Error('no country_code');
      return d;
    },
    async () => {
      const ctl = new AbortController();
      setTimeout(() => ctl.abort(), 5000);
      const r = await fetch('https://ip-api.com/json/?fields=status,country,countryCode,city,regionName,org,query', { signal: ctl.signal });
      if (!r.ok) throw new Error(`ip-api.com ${r.status}`);
      const d = await r.json() as { status: string; country: string; countryCode: string; city: string; regionName: string; org: string; query: string };
      if (d.status !== 'success') throw new Error('ip-api.com failed');
      return { ip: d.query, city: d.city, region: d.regionName, country_name: d.country, country_code: d.countryCode, org: d.org };
    },
  ];

  for (const attempt of attempts) {
    try {
      geoCache = await attempt();
      geoFetching = false;
      return geoCache;
    } catch { /* try next */ }
  }
  geoFetching = false;
  return null;
}

// ── Browser / device fingerprint ──────────────────────────────────────────────

export function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Unknown';
}
export function detectOS(): string {
  const ua = navigator.userAgent;
  // Order matters: Android UAs also contain "Linux", and iOS UAs also
  // contain "like Mac OS X" — so the more specific mobile checks must run
  // before the desktop ones, or every mobile visitor gets misclassified.
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
}

const SESSION_START = Date.now();
export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) {
    return t('admin.dur_hms')
      .replace('{h}', String(h)).replace('{m}', String(m % 60)).replace('{s}', String(s % 60));
  }
  if (m > 0) {
    return t('admin.dur_ms').replace('{m}', String(m)).replace('{s}', String(s % 60));
  }
  return t('admin.dur_s').replace('{s}', String(s));
}

// ── Admin button in header ────────────────────────────────────────────────────

function refreshAdminButton(): void {
  const existing = document.getElementById('admin-panel-btn');
  if (isAdminMode()) {
    if (!existing) {
      const btn = document.createElement('button');
      btn.id = 'admin-panel-btn';
      btn.className = 'admin-header-btn';
      btn.addEventListener('click', openAdminPanel);
      const header = document.querySelector('.app-header');
      const actions = document.getElementById('header-actions');
      const langSel = document.getElementById('lang-select');
      if (actions && langSel) {
        actions.insertBefore(btn, langSel.closest('.header-lang') ?? langSel);
      } else if (header && langSel) {
        header.insertBefore(btn, langSel);
      } else {
        header?.appendChild(btn);
      }
    }
    refreshAdminButtonLabel();
  } else {
    existing?.remove();
    closeAdminPanel();
  }
}

function refreshAdminButtonLabel(): void {
  const btn = document.getElementById('admin-panel-btn');
  if (!btn) return;
  const label = t('admin.button_label');
  const short = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches;
  btn.textContent = short ? '⚙' : `⚙ ${label}`;
  btn.title = t('admin.button_title');
  btn.setAttribute('aria-label', label);
}

// ── PIN dialog ────────────────────────────────────────────────────────────────

function showPinDialog(): void {
  const storedHash = getStoredHash();
  const isSetup = storedHash === null;

  const overlay = document.createElement('div');
  overlay.id = 'admin-pin-overlay';
  overlay.className = 'admin-pin-overlay';
  overlay.innerHTML = `
    <div class="admin-pin-card">
      <div class="admin-pin-icon">🔐</div>
      <h3 class="admin-pin-title">${isSetup ? t('admin.pin_setup_title') : t('admin.pin_login_title')}</h3>
      <p class="admin-pin-sub">${isSetup ? t('admin.pin_setup_sub') : t('admin.pin_login_sub')}</p>
      <input id="admin-pin-input" class="admin-pin-input" type="password"
        placeholder="${isSetup ? t('admin.pin_placeholder_new') : t('admin.pin_placeholder')}" maxlength="16" autocomplete="off" />
      ${isSetup ? `<input id="admin-pin-confirm" class="admin-pin-input" type="password"
        placeholder="${t('admin.pin_placeholder_confirm')}" maxlength="16" autocomplete="off" />` : ''}
      <p id="admin-pin-error" class="admin-pin-error" style="display:none"></p>
      <div class="admin-pin-actions">
        <button id="admin-pin-cancel" class="admin-pin-btn admin-pin-btn--ghost">${t('admin.cancel')}</button>
        <button id="admin-pin-submit" class="admin-pin-btn admin-pin-btn--primary">
          ${isSetup ? t('admin.pin_create_btn') : t('admin.pin_login_btn')}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input   = overlay.querySelector<HTMLInputElement>('#admin-pin-input')!;
  const confirm = overlay.querySelector<HTMLInputElement>('#admin-pin-confirm');
  const errEl   = overlay.querySelector<HTMLElement>('#admin-pin-error')!;
  const showErr = (m: string): void => { errEl.textContent = m; errEl.style.display = 'block'; };

  const submit = (): void => {
    const pin = input.value.trim();
    if (pin.length < 4) { showErr(t('admin.pin_err_short')); return; }
    if (isSetup) {
      if (pin !== (confirm?.value.trim() ?? '')) { showErr(t('admin.pin_err_mismatch')); return; }
      try { localStorage.setItem(LS_ADMIN_HASH, hashPin(pin)); } catch { /* ignore */ }
      setAdminActive(); overlay.remove(); openAdminPanel();
    } else {
      if (hashPin(pin) !== storedHash) { showErr(t('admin.pin_err_wrong')); return; }
      setAdminActive(); overlay.remove(); openAdminPanel();
    }
  };

  overlay.querySelector('#admin-pin-submit')!.addEventListener('click', submit);
  overlay.querySelector('#admin-pin-cancel')!.addEventListener('click', () => overlay.remove());
  input.addEventListener('keydown',   (e) => { if (e.key === 'Enter') submit(); });
  confirm?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  requestAnimationFrame(() => input.focus());
}

// ── Admin panel modal ─────────────────────────────────────────────────────────

let panelEl: HTMLElement | null = null;
let durationTimer: ReturnType<typeof setInterval> | null = null;
let geoTimer: ReturnType<typeof setTimeout> | null = null;
let presenceRefreshTimer: ReturnType<typeof setInterval> | null = null;

export function openAdminPanel(): void {
  if (!isAdminMode()) { showPinDialog(); return; }
  if (panelEl) { panelEl.remove(); panelEl = null; }

  const backdrop = document.createElement('div');
  backdrop.id = 'admin-panel-backdrop';
  backdrop.className = 'admin-backdrop';

  const panel = document.createElement('div');
  panel.id = 'admin-panel';
  panel.className = 'admin-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', t('admin.panel_title'));

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
  panelEl = backdrop;

  renderPanelContent(panel);

  // Live session-duration counter
  durationTimer = setInterval(() => {
    const el = document.getElementById('ap-dur');
    if (el) el.textContent = formatDuration(Date.now() - SESSION_START);
  }, 1_000);

  geoTimer = setTimeout(refreshDynamicSections, 50);

  // Auto-refresh online users every 20 seconds while panel is open
  presenceRefreshTimer = setInterval(refreshPresenceSection, 20_000);

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeAdminPanel(); });
  document.addEventListener('keydown', handleEsc);
}

/** (Re-)fetches Firebase global metrics, geo labels, and presence — used
 *  both on initial panel open and to repopulate a freshly re-rendered panel
 *  (e.g. after a language change) without waiting for the next timer tick. */
function refreshDynamicSections(): void {
  fbRead().then((res) => {
    if (!panelEl) return;
    updateGlobalSection(res);
  }).catch(() => {
    if (!panelEl) return;
    updateGlobalSection({ data: null, countries: null, error: t('admin.fb_conn_error'), errorCode: 'no-connection' });
  });

  // Geo labels for session info (fetchGeo() is cached, so a re-render after
  // the first successful fetch resolves this immediately).
  fetchGeo().then((geo) => {
    if (!panelEl || !geo) return;
    const loc = document.getElementById('ap-geo-loc');
    const ip  = document.getElementById('ap-geo-ip');
    const org = document.getElementById('ap-geo-org');
    if (loc) loc.textContent = `${geo.city}, ${geo.region}, ${geo.country_name}`;
    if (ip)  ip.textContent  = geo.ip;
    if (org) org.textContent = geo.org;
  }).catch(() => { /* non-fatal */ });

  refreshPresenceSection();
}

function handleEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeAdminPanel();
}

export function closeAdminPanel(): void {
  panelEl?.remove(); panelEl = null;
  if (durationTimer)       { clearInterval(durationTimer);       durationTimer = null; }
  if (geoTimer)            { clearTimeout(geoTimer);             geoTimer = null; }
  if (presenceRefreshTimer){ clearInterval(presenceRefreshTimer); presenceRefreshTimer = null; }
  document.removeEventListener('keydown', handleEsc);
}

const PRESENCE_STALE_MS = 90_000;   // consider offline after 90s without heartbeat
const PRESENCE_PURGE_MS = 5 * 60_000; // auto-delete entries older than 5 min

async function purgeStalePresence(all: Record<string, PresenceEntry>): Promise<void> {
  const base = getFirebaseUrl();
  if (!base) return;
  const now  = Date.now();
  const stale = Object.entries(all).filter(([, e]) => now - (e.lastSeen ?? 0) > PRESENCE_PURGE_MS);
  await Promise.all(stale.map(([sid]) =>
    fetch(`${base}/orbital_presence/${sid}.json`, { method: 'DELETE', keepalive: true }).catch(() => null)
  ));
}

async function refreshPresenceSection(): Promise<void> {
  if (!panelEl) return;
  const sec = document.getElementById('ap-presence-section');
  if (!sec) return;

  const all = await fbReadPresence() ?? {};

  // Silently purge entries older than 5 min
  purgeStalePresence(all).catch(() => null);

  const now = Date.now();
  const online = Object.values(all).filter(e => e && now - (e.lastSeen ?? 0) < PRESENCE_STALE_MS);

  const byCountry = online.reduce<Record<string, number>>((acc, e) => {
    const c = (e.country === 'XX' || !e.country) ? '??' : e.country;
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});

  const total = online.length;
  if (total === 0) {
    sec.innerHTML = `
      <h4 class="ap-section-title">
        ${t('admin.online_now')} <span class="ap-online-count ap-online-zero">0</span>
        <span class="ap-sub-hint">${t('admin.online_refresh_hint')}</span>
      </h4>
      <p class="ap-note-text" style="margin:0;font-size:0.73rem">${t('admin.no_active_visitors')}</p>`;
    return;
  }

  const rows = Object.entries(byCountry)
    .sort(([, a], [, b]) => b - a)
    .map(([code, cnt]) => `
      <div class="ap-country-row">
        <span class="ap-country-flag">${countryFlag(code)}</span>
        <span class="ap-country-name">${countryName(code)}</span>
        <span class="ap-country-bar-wrap">
          <span class="ap-country-bar" style="width:${Math.round((cnt / total) * 100)}%"></span>
        </span>
        <span class="ap-country-count">${cnt}</span>
      </div>`).join('');

  sec.innerHTML = `
    <h4 class="ap-section-title">
      ${t('admin.online_now')} <span class="ap-online-count">${total}</span>
      <span class="ap-sub-hint">${t('admin.online_refresh_hint')}</span>
    </h4>
    <div class="ap-country-list">${rows}</div>`;
}

// ── Render helpers ────────────────────────────────────────────────────────────

function metricBox(val: string | number, label: string): string {
  return `
    <div class="ap-metric">
      <span class="ap-metric-val">${val}</span>
      <span class="ap-metric-lbl">${label}</span>
    </div>`;
}


function updateGlobalSection(result: FbReadResult): void {
  const sec = document.getElementById('ap-global-section');
  if (!sec) return;
  const url = getFirebaseUrl();
  const { data: fb, error, errorCode } = result;

  // url is now always at least DEFAULT_FIREBASE_URL, so this branch rarely fires
  if (!url) {
    sec.innerHTML = `
      <h4 class="ap-section-title">${t('admin.section_global')}</h4>
      <p class="ap-note-text" style="margin:0 0 10px">${t('admin.fb_url_not_found')}</p>`;
    return;
  }

  if (!fb) {
    sec.innerHTML = `
      <h4 class="ap-section-title">${t('admin.section_global')}</h4>
      <p class="ap-note-text" style="color:var(--danger);margin:0 0 6px;font-size:0.76rem">
        ⚠ ${error ?? t('admin.fb_conn_error')}
      </p>
      ${errorCode === 'access-denied' ? `
      <div class="ap-rules-hint">
        <strong>${t('admin.rules_hint_title')}</strong><br>
        ${t('admin.rules_hint_body')}
        <pre class="ap-rules-code">firebase/database.rules.json</pre>
        ${t('admin.rules_hint_footer')}
      </div>` : ''}
      <div class="ap-firebase-row" style="margin-top:10px">
        <input id="ap-fb-url" class="ap-fb-input" type="url" spellcheck="false"
          placeholder="https://…firebaseio.com" value="${url}" />
        <button id="ap-fb-save" class="ap-tool-btn">${t('admin.retry_btn')}</button>
        <button id="ap-fb-clear" class="ap-tool-btn ap-tool-btn--danger">${t('admin.remove_btn')}</button>
      </div>`;
    bindFirebaseSave(sec);
    return;
  }

  const isDefault = url === DEFAULT_FIREBASE_URL;
  sec.innerHTML = `
    <h4 class="ap-section-title">${t('admin.section_global_fb')}
      <span style="color:var(--text-muted);font-size:0.65rem;font-weight:400;text-transform:none;letter-spacing:0">
        — ${url.replace('https://', '').split('.')[0]}
      </span>
    </h4>
    <div class="ap-grid-2" style="margin-bottom:16px">
      ${metricBox(fb.loads.toLocaleString(), t('admin.metric_page_loads'))}
      ${metricBox(fb.sat.toLocaleString(),   t('admin.metric_sat_clicks'))}
    </div>
    ${!isDefault ? `
    <div style="text-align:right;margin-top:10px">
      <button id="ap-fb-clear" class="ap-tool-btn ap-tool-btn--danger" style="padding:4px 10px;font-size:0.72rem">
        ${t('admin.restore_default_btn')}
      </button>
    </div>` : ''}`;
  sec.querySelector('#ap-fb-clear')?.addEventListener('click', () => {
    try { localStorage.removeItem(LS_FIREBASE_URL); } catch { /* ignore */ }
    updateGlobalSection({ data: null, countries: null, error: null, errorCode: null });
  });
}

function bindFirebaseSave(sec: HTMLElement): void {
  const saveBtn = sec.querySelector<HTMLButtonElement>('#ap-fb-save');
  saveBtn?.addEventListener('click', async () => {
    const inp = sec.querySelector<HTMLInputElement>('#ap-fb-url');
    if (!inp) return;
    const url = inp.value.trim().replace(/\/$/, '');
    if (!isValidFirebaseRtdbUrl(url)) {
      inp.style.borderColor = 'var(--danger)';
      return;
    }
    if (saveBtn) { saveBtn.textContent = t('admin.fb_testing'); saveBtn.disabled = true; }
    setFirebaseUrl(url);
    try {
      const res = await fbRead();
      updateGlobalSection(res);
    } catch (e) {
      console.error('[AdminPanel] updateGlobalSection error:', e);
      updateGlobalSection({
        data: null, countries: null,
        error: t('admin.fb_unexpected_error').replace('{msg}', e instanceof Error ? e.message : String(e)),
        errorCode: 'unexpected',
      });
    }
  });
  sec.querySelector('#ap-fb-clear')?.addEventListener('click', () => {
    try { localStorage.removeItem(LS_FIREBASE_URL); } catch { /* ignore */ }
    updateGlobalSection({ data: null, countries: null, error: null, errorCode: null });
  });
}

function renderPanelContent(panel: HTMLElement): void {
  const state = getState();
  const s = state.stats;

  const objs         = state.objects;
  const activeCount  = objs.filter(o => o.category === 'active').length;
  const debrisCount  = objs.filter(o => o.category === 'debris').length;
  const stationCount = objs.filter(o => o.category === 'stations').length;
  const visibleCount = state.filteredIndices.length;
  const totalCount   = objs.length;

  const fetchedAt = s?.fetchedAt ? new Date(s.fetchedAt) : null;
  const tleDays   = fetchedAt ? Math.floor((Date.now() - fetchedAt.getTime()) / 86_400_000) : null;
  const tleAge    = tleDays === null
    ? '—'
    : tleDays === 0
      ? t('admin.tle_age_today')
      : t('admin.tle_age_days_ago').replace('{n}', String(tleDays));

  const selObj: TrackedObject | null =
    state.selectedIndex != null ? (objs[state.selectedIndex] ?? null) : null;
  const selLabel = selObj
    ? `${selObj.name} (${selObj.noradId})`
    : state.selectedEventId
      ? t('admin.selected_event').replace('{id}', state.selectedEventId)
      : t('admin.selected_none');

  const activeFilters = Object.entries(state.layerFilters).filter(([, v]) => !v).map(([k]) => k);
  const filterLabel   = activeFilters.length === 0
    ? t('admin.filters_all_visible')
    : t('admin.filters_hidden').replace('{list}', activeFilters.join(', '));

  const sesTot_sat = totGet('sat');
  const sesTot_evt = totGet('evt');
  const totLds     = totGet('loads');

  panel.innerHTML = `
    <div class="ap-header">
      <div class="ap-logo">🛸 <span>${t('admin.panel_title')}</span></div>
      <button class="ap-close" id="ap-close-btn" title="${t('admin.close_title')}">✕</button>
    </div>

    <div class="ap-body">

      <!-- ── Session Info ───────────────────────────── -->
      <section class="ap-section">
        <h4 class="ap-section-title">${t('admin.section_session')}</h4>
        <div class="ap-grid-2">
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.loc')}</span>
            <span class="ap-stat-value" id="ap-geo-loc">${t('admin.loading')}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.ip')}</span>
            <span class="ap-stat-value" id="ap-geo-ip">${t('admin.loading')}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.isp')}</span>
            <span class="ap-stat-value" id="ap-geo-org">${t('admin.loading')}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.session_duration')}</span>
            <span class="ap-stat-value" id="ap-dur">${formatDuration(Date.now() - SESSION_START)}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.browser_os')}</span>
            <span class="ap-stat-value">${detectBrowser()} / ${detectOS()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.resolution')}</span>
            <span class="ap-stat-value">${screen.width}×${screen.height} (${window.devicePixelRatio}x)</span>
          </div>
        </div>
      </section>

      <!-- ── Simulation Status ─────────────────────────── -->
      <section class="ap-section">
        <h4 class="ap-section-title">${t('admin.section_sim')}</h4>
        <div class="ap-grid-2">
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.total_objects')}</span>
            <span class="ap-stat-value ap-accent">${totalCount.toLocaleString()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.visible')}</span>
            <span class="ap-stat-value ap-accent">${visibleCount.toLocaleString()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.active_rockets')}</span>
            <span class="ap-stat-value">${activeCount.toLocaleString()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.debris')}</span>
            <span class="ap-stat-value">${debrisCount.toLocaleString()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.stations')}</span>
            <span class="ap-stat-value">${stationCount.toLocaleString()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.tle_age')}</span>
            <span class="ap-stat-value ${tleDays !== null && tleDays > 3 ? 'ap-warn' : ''}">${tleAge}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.speed')}</span>
            <span class="ap-stat-value">${state.time.speed}×</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">${t('admin.layer_filters')}</span>
            <span class="ap-stat-value">${filterLabel}</span>
          </div>
        </div>
        <div class="ap-stat ap-stat--full">
          <span class="ap-stat-label">${t('admin.selected_object')}</span>
          <span class="ap-stat-value">${selLabel}</span>
        </div>
      </section>

      <!-- ── On This Device (Totals) ──────────────────── -->
      <section class="ap-section">
        <h4 class="ap-section-title">${t('admin.section_device')}</h4>
        <div class="ap-grid-3">
          ${metricBox(totLds.toLocaleString(),     t('admin.metric_page_loads'))}
          ${metricBox(sesTot_sat.toLocaleString(), t('admin.metric_sat_clicks'))}
          ${metricBox(sesTot_evt.toLocaleString(), t('admin.metric_event_clicks'))}
        </div>
        <div style="margin-top:8px;text-align:right">
          <button id="ap-reset-device" class="ap-tool-btn ap-tool-btn--danger"
            style="padding:4px 10px;font-size:0.72rem">
            ${t('admin.reset_device_btn')}
          </button>
        </div>
      </section>

      <!-- ── Currently Online ──────────────────────────────── -->
      <section class="ap-section ap-section--online" id="ap-presence-section">
        <h4 class="ap-section-title">${t('admin.online_now')} <span class="ap-sub-hint">${t('admin.online_loading')}</span></h4>
      </section>

      <!-- ── All Users (Firebase) ─────────────── -->
      <section class="ap-section ap-section--note" id="ap-global-section">
        <h4 class="ap-section-title">${t('admin.section_global')}</h4>
        <p class="ap-note-text" style="margin:0">${t('admin.loading')}</p>
      </section>

      <!-- ── Quick Tools ─────────────────────────────── -->
      <section class="ap-section">
        <h4 class="ap-section-title">${t('admin.section_tools')}</h4>
        <div class="ap-tools">
          <button class="ap-tool-btn" id="ap-copy-state">${t('admin.copy_snapshot_btn')}</button>
          <button class="ap-tool-btn ap-tool-btn--danger" id="ap-revoke-btn">${t('admin.revoke_btn')}</button>
        </div>
      </section>

    </div>

    <div class="ap-footer">
      <span>${t('admin.footer_brand')}</span>
      <span class="ap-footer-hint">${t('admin.footer_shortcut')}</span>
    </div>
  `;

  // ── Button handlers ─────────────────────────────────────────────────────────

  panel.querySelector('#ap-close-btn')!.addEventListener('click', closeAdminPanel);

  panel.querySelector('#ap-reset-device')!.addEventListener('click', () => {
    if (!confirm(t('admin.confirm_reset_device'))) return;
    (['sat','evt','loads'] as CounterKey[]).forEach(k => {
      try { localStorage.removeItem(LS_TOTAL_PREFIX + k); } catch { /* ignore */ }
      sessionStorage.removeItem(SS_SESSION_PREFIX + k);
    });
    sessionStorage.removeItem(SS_SESSION_PREFIX + 'loaded');
    closeAdminPanel();
    openAdminPanel();
  });

  panel.querySelector('#ap-copy-state')!.addEventListener('click', () => {
    const snap = JSON.stringify({
      timestamp: new Date().toISOString(),
      session: { durationMs: Date.now() - SESSION_START },
      deviceTotal: { loads: totLds, sat: sesTot_sat, evt: sesTot_evt },
      simulation: { totalObjects: totalCount, visibleObjects: visibleCount, tleAge, speed: state.time.speed },
      device: { browser: detectBrowser(), os: detectOS(), resolution: `${screen.width}×${screen.height}` },
      geo: geoCache ?? 'not-fetched',
    }, null, 2);
    navigator.clipboard.writeText(snap).catch(() => {/* ignore */});
    const btn = document.getElementById('ap-copy-state');
    if (btn) {
      btn.textContent = t('admin.copy_snapshot_done');
      setTimeout(() => { btn.textContent = t('admin.copy_snapshot_btn'); }, 2000);
    }
  });

  panel.querySelector('#ap-revoke-btn')!.addEventListener('click', () => {
    if (confirm(t('admin.confirm_revoke'))) {
      revokeAdmin(); closeAdminPanel();
    }
  });
}

// ── Keyboard shortcut Ctrl+Shift+A ───────────────────────────────────────────

function onShortcut(e: KeyboardEvent): void {
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    if (isAdminMode()) { if (panelEl) closeAdminPanel(); else openAdminPanel(); }
    else showPinDialog();
  }
}

// ── State subscription for session + firebase tracking ────────────────────────

let _lastSel: number | null = null;
let _lastEvt: string | null = null;

function setupSessionTracking(): void {
  subscribe(() => {
    const st = getState();

    // Admin's own interactions are tracked locally but excluded from Firebase
    // so the global counters only reflect regular (non-admin) users.
    const sendToFirebase = !isAdminMode();

    if (st.selectedIndex !== null && st.selectedIndex !== _lastSel) {
      inc('sat');
      _lastSel = st.selectedIndex;
      if (sendToFirebase) fbInc('sat').catch(() => {/* non-fatal */});
    }
    if (st.selectedEventId !== null && st.selectedEventId !== _lastEvt) {
      inc('evt');
      _lastEvt = st.selectedEventId;
      if (sendToFirebase) fbInc('evt').catch(() => {/* non-fatal */});
    }
    void st.altitudeFilter; // filter changes no longer tracked
  });
}

// ── Public init ───────────────────────────────────────────────────────────────

/**
 * True when the page is being driven by an automated browser (Playwright,
 * Selenium, Puppeteer, headless CI runners, etc). All of these set
 * `navigator.webdriver = true`. We must never write analytics/presence data
 * to the shared production Firebase from CI test runs — every E2E test does
 * a fresh `page.goto('/')` with clean storage, which would otherwise create
 * a brand-new "visitor" + presence entry on every push.
 */
export function isAutomatedBrowser(): boolean {
  try { return navigator.webdriver === true; }
  catch { return false; }
}

export function initAdminSystem(): void {
  if (isAutomatedBrowser()) return; // never track CI/E2E runs as real visitors

  window.addEventListener('keydown', onShortcut);
  setupSessionTracking();
  // Presence tracked for everyone (admin too — they're also "online")
  initPresence().catch(() => {/* non-fatal */});

  if (!isAdminMode()) {
    fbInc('loads').catch(() => {/* non-fatal */});
    trackCountry().catch(() => {/* non-fatal */});
  }
  if (isAdminMode()) requestAnimationFrame(refreshAdminButton);

  // Keep the header button label and an already-open panel in sync with
  // the active UI language (mirrors the pattern used by KesslerPanel).
  onLangChange(() => {
    refreshAdminButtonLabel();
    if (!panelEl) return;
    const panel = panelEl.querySelector<HTMLElement>('#admin-panel');
    if (!panel) return;
    renderPanelContent(panel);
    // renderPanelContent() resets the presence/global sections back to
    // "Loading…" placeholders — repopulate them immediately instead of
    // waiting for the next 20s presence tick or a manual re-open.
    refreshDynamicSections();
  });
}
