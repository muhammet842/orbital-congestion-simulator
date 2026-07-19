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
 *   sessionStorage : "Bu Oturumda" — survives refresh, resets on tab close
 *   localStorage   : "Bu Cihazda"  — all-time totals on this device
 *   Firebase RTDB  : "Tüm Kullanıcılar" — global aggregates (optional, via REST)
 */

import { getState, subscribe } from '../state/appState';
import type { TrackedObject } from '../types';

// ── Storage keys ───────────────────────────────────────────────────────────────

const LS_ADMIN_FLAG    = 'orbital_admin_v1';
const LS_ADMIN_HASH    = 'orbital_admin_pin_v1';
const LS_FIREBASE_URL  = 'orbital_firebase_url';
const LS_TOTAL_PREFIX  = 'orbital_total_';   // all-time, this device
const SS_SESSION_PREFIX= 'orbital_ses_';     // current tab/session

// ── Counter helpers ───────────────────────────────────────────────────────────

type CounterKey = 'sat' | 'evt' | 'flt' | 'loads';

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

function getFirebaseUrl(): string {
  try { return localStorage.getItem(LS_FIREBASE_URL) ?? ''; }
  catch { return ''; }
}
function setFirebaseUrl(url: string): void {
  try { localStorage.setItem(LS_FIREBASE_URL, url.trim()); }
  catch { /* ignore */ }
}

interface FirebaseMetrics {
  sat:   number;
  evt:   number;
  flt:   number;
  loads: number;
}

interface FbReadResult {
  data: FirebaseMetrics | null;
  error: string | null;
}

async function fbRead(): Promise<FbReadResult> {
  const base = getFirebaseUrl();
  if (!base) return { data: null, error: null };
  try {
    const r = await fetch(`${base}/orbital_metrics.json`, { signal: AbortSignal.timeout(6000) });
    if (r.status === 401 || r.status === 403) {
      return { data: null, error: `Erişim reddedildi (HTTP ${r.status}) — Firebase Realtime Database kurallarında ".read" ve ".write" değerlerini true yapın.` };
    }
    if (!r.ok) {
      return { data: null, error: `Bağlantı hatası (HTTP ${r.status})` };
    }
    const json = await r.json() as FirebaseMetrics | null;
    return { data: json ?? { sat: 0, evt: 0, flt: 0, loads: 0 }, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('timeout') || msg.includes('abort')) {
      return { data: null, error: 'Bağlantı zaman aşımına uğradı — Firebase URL\'sini ve internet bağlantınızı kontrol edin.' };
    }
    return { data: null, error: `Bağlantı hatası: ${msg}` };
  }
}

/** Atomically increment a single counter in Firebase (+= 1 via REST). */
async function fbInc(k: CounterKey): Promise<void> {
  const base = getFirebaseUrl();
  if (!base) return;
  try {
    const r = await fetch(`${base}/orbital_metrics/${k}.json`, { signal: AbortSignal.timeout(3000) });
    const cur = r.ok ? ((await r.json() as number | null) ?? 0) : 0;
    await fetch(`${base}/orbital_metrics/${k}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cur + 1),
      signal: AbortSignal.timeout(3000),
    });
  } catch { /* non-fatal */ }
}

// ── Simple PIN hash (djb2) ────────────────────────────────────────────────────

function hashPin(pin: string): string {
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

interface GeoData { ip: string; city: string; region: string; country_name: string; org: string; }
let geoCache: GeoData | null = null;
let geoFetching = false;

async function fetchGeo(): Promise<GeoData | null> {
  if (geoCache) return geoCache;
  if (geoFetching) return null;
  geoFetching = true;
  try {
    const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    geoCache = (await r.json()) as GeoData;
    return geoCache;
  } catch { return null; }
  finally { geoFetching = false; }
}

// ── Browser / device fingerprint ──────────────────────────────────────────────

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Unknown';
}
function detectOS(): string {
  const ua = navigator.userAgent;
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  return 'Unknown OS';
}

const SESSION_START = Date.now();
function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}s ${m % 60}d ${s % 60}sn`;
  if (m > 0) return `${m}d ${s % 60}sn`;
  return `${s}sn`;
}

// ── Admin button in header ────────────────────────────────────────────────────

function refreshAdminButton(): void {
  const existing = document.getElementById('admin-panel-btn');
  if (isAdminMode()) {
    if (!existing) {
      const btn = document.createElement('button');
      btn.id = 'admin-panel-btn';
      btn.className = 'admin-header-btn';
      btn.textContent = '⚙ Admin';
      btn.title = 'Admin Paneli (Ctrl+Shift+A)';
      btn.addEventListener('click', openAdminPanel);
      const header = document.querySelector('.app-header');
      const langSel = document.getElementById('lang-select');
      if (header && langSel) header.insertBefore(btn, langSel);
      else header?.appendChild(btn);
    }
  } else {
    existing?.remove();
    closeAdminPanel();
  }
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
      <h3 class="admin-pin-title">${isSetup ? 'Admin PIN Oluştur' : 'Admin Girişi'}</h3>
      <p class="admin-pin-sub">${isSetup
        ? 'Bu cihaz için 4+ haneli bir PIN belirle. Sonraki ziyaretlerde otomatik tanınacaksın.'
        : 'Admin erişimi için PIN\'ini gir.'
      }</p>
      <input id="admin-pin-input" class="admin-pin-input" type="password"
        placeholder="${isSetup ? 'Yeni PIN' : 'PIN'}" maxlength="16" autocomplete="off" />
      ${isSetup ? `<input id="admin-pin-confirm" class="admin-pin-input" type="password"
        placeholder="PIN Tekrar" maxlength="16" autocomplete="off" />` : ''}
      <p id="admin-pin-error" class="admin-pin-error" style="display:none"></p>
      <div class="admin-pin-actions">
        <button id="admin-pin-cancel" class="admin-pin-btn admin-pin-btn--ghost">İptal</button>
        <button id="admin-pin-submit" class="admin-pin-btn admin-pin-btn--primary">
          ${isSetup ? 'PIN Oluştur' : 'Giriş Yap'}
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
    if (pin.length < 4) { showErr('PIN en az 4 karakter olmalı.'); return; }
    if (isSetup) {
      if (pin !== (confirm?.value.trim() ?? '')) { showErr('PIN\'ler eşleşmiyor.'); return; }
      try { localStorage.setItem(LS_ADMIN_HASH, hashPin(pin)); } catch { /* ignore */ }
      setAdminActive(); overlay.remove(); openAdminPanel();
    } else {
      if (hashPin(pin) !== storedHash) { showErr('Hatalı PIN.'); return; }
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
  panel.setAttribute('aria-label', 'Admin Panel');

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
  panelEl = backdrop;

  renderPanelContent(panel);

  // Live session-duration counter
  durationTimer = setInterval(() => {
    const el = document.getElementById('ap-dur');
    if (el) el.textContent = formatDuration(Date.now() - SESSION_START);
  }, 1_000);

  // Fetch geo and Firebase independently — don't let one block the other
  geoTimer = setTimeout(() => {
    // Firebase: update section immediately without waiting for geo
    fbRead().then((res) => {
      if (!panelEl) return;
      updateGlobalSection(res);
    }).catch(() => {
      if (!panelEl) return;
      updateGlobalSection({ data: null, error: 'Beklenmedik bağlantı hatası.' });
    });

    // Geo: update labels when ready
    fetchGeo().then((geo) => {
      if (!panelEl || !geo) return;
      const loc = document.getElementById('ap-geo-loc');
      const ip  = document.getElementById('ap-geo-ip');
      const org = document.getElementById('ap-geo-org');
      if (loc) loc.textContent = `${geo.city}, ${geo.region}, ${geo.country_name}`;
      if (ip)  ip.textContent  = geo.ip;
      if (org) org.textContent = geo.org;
    }).catch(() => { /* non-fatal */ });
  }, 50);

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeAdminPanel(); });
  document.addEventListener('keydown', handleEsc);
}

function handleEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeAdminPanel();
}

export function closeAdminPanel(): void {
  panelEl?.remove(); panelEl = null;
  if (durationTimer) { clearInterval(durationTimer); durationTimer = null; }
  if (geoTimer)      { clearTimeout(geoTimer);       geoTimer = null; }
  document.removeEventListener('keydown', handleEsc);
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
  const { data: fb, error } = result;

  if (!url) {
    sec.innerHTML = `
      <h4 class="ap-section-title">🌐 Tüm Kullanıcılar</h4>
      <p class="ap-note-text" style="margin:0 0 10px">
        Firebase Realtime Database bağlayınca tüm kullanıcıların verisi burada
        görünür. Ücretsiz Firebase projesi oluştur ve URL'yi aşağıya yapıştır.
      </p>
      <div class="ap-firebase-row">
        <input id="ap-fb-url" class="ap-fb-input" type="text"
          placeholder="https://PROJE-default-rtdb.firebaseio.com" value="" />
        <button id="ap-fb-save" class="ap-tool-btn">Kaydet</button>
      </div>
      <a class="ap-note-link" style="margin-top:8px;display:inline-block"
        href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">
        Firebase Console → Ücretsiz Proje Oluştur
      </a>`;
    bindFirebaseSave(sec);
    return;
  }

  if (!fb) {
    sec.innerHTML = `
      <h4 class="ap-section-title">🌐 Tüm Kullanıcılar</h4>
      <p class="ap-note-text" style="color:var(--danger);margin:0 0 6px;font-size:0.76rem">
        ⚠ ${error ?? 'Firebase bağlantısı kurulamadı.'}
      </p>
      ${error?.includes('Erişim reddedildi') ? `
      <div class="ap-rules-hint">
        <strong>Nasıl düzeltilir:</strong><br>
        Firebase Console → Realtime Database → <strong>Rules</strong> sekmesini aç ve şunu yapıştır:
        <pre class="ap-rules-code">{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}</pre>
        Ardından <strong>Publish</strong>'e bas ve aşağıdan tekrar dene.
      </div>` : ''}
      <div class="ap-firebase-row" style="margin-top:10px">
        <input id="ap-fb-url" class="ap-fb-input" type="text" value="${url}" />
        <button id="ap-fb-save" class="ap-tool-btn">Tekrar Dene</button>
        <button id="ap-fb-clear" class="ap-tool-btn ap-tool-btn--danger">Kaldır</button>
      </div>`;
    bindFirebaseSave(sec);
    return;
  }

  sec.innerHTML = `
    <h4 class="ap-section-title">🌐 Tüm Kullanıcılar (Firebase) <span style="color:var(--text-muted);font-size:0.65rem;font-weight:400;text-transform:none;letter-spacing:0">— ${url.replace('https://', '').split('.')[0]}</span></h4>
    <div class="ap-grid-4" style="margin-bottom:12px">
      ${metricBox(fb.loads.toLocaleString(), 'Sayfa Yükleme')}
      ${metricBox(fb.sat.toLocaleString(),   'Uydu Tıklama')}
      ${metricBox(fb.evt.toLocaleString(),   'Olay Tıklama')}
      ${metricBox(fb.flt.toLocaleString(),   'Filtre Değişimi')}
    </div>
    <div style="text-align:right">
      <button id="ap-fb-clear" class="ap-tool-btn ap-tool-btn--danger" style="padding:4px 10px;font-size:0.72rem">
        Bağlantıyı Kaldır
      </button>
    </div>`;
  sec.querySelector('#ap-fb-clear')?.addEventListener('click', () => {
    try { localStorage.removeItem(LS_FIREBASE_URL); } catch { /* ignore */ }
    updateGlobalSection({ data: null, error: null });
  });
}

function bindFirebaseSave(sec: HTMLElement): void {
  const saveBtn = sec.querySelector<HTMLButtonElement>('#ap-fb-save');
  saveBtn?.addEventListener('click', () => {
    const inp = sec.querySelector<HTMLInputElement>('#ap-fb-url');
    if (!inp) return;
    const url = inp.value.trim().replace(/\/$/, '');
    if (!url.startsWith('https://')) {
      inp.style.borderColor = 'var(--danger)';
      return;
    }
    // Show loading state
    if (saveBtn) { saveBtn.textContent = '⏳ Test ediliyor…'; saveBtn.disabled = true; }
    setFirebaseUrl(url);
    fbRead()
      .then((res) => updateGlobalSection(res))
      .catch(() => updateGlobalSection({ data: null, error: 'Beklenmedik hata oluştu.' }));
  });
  sec.querySelector('#ap-fb-clear')?.addEventListener('click', () => {
    try { localStorage.removeItem(LS_FIREBASE_URL); } catch { /* ignore */ }
    updateGlobalSection({ data: null, error: null });
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
  const tleAge    = tleDays === null ? '—' : tleDays === 0 ? 'Bu gün' : `${tleDays} gün önce`;

  const selObj: TrackedObject | null =
    state.selectedIndex != null ? (objs[state.selectedIndex] ?? null) : null;
  const selLabel = selObj
    ? `${selObj.name} (${selObj.noradId})`
    : state.selectedEventId ? `Olay: ${state.selectedEventId}` : 'Yok';

  const activeFilters = Object.entries(state.layerFilters).filter(([, v]) => !v).map(([k]) => k);
  const filterLabel   = activeFilters.length === 0 ? 'Tümü görünür' : `Gizli: ${activeFilters.join(', ')}`;

  // Session counters (from sessionStorage — persists across F5)
  const sesSat = sesGet('sat'); const sesTot_sat = totGet('sat');
  const sesEvt = sesGet('evt'); const sesTot_evt = totGet('evt');
  const sesFlt = sesGet('flt'); const sesTot_flt = totGet('flt');
  const totLds = totGet('loads');

  panel.innerHTML = `
    <div class="ap-header">
      <div class="ap-logo">🛸 <span>Admin Panel</span></div>
      <button class="ap-close" id="ap-close-btn" title="Kapat (Esc)">✕</button>
    </div>

    <div class="ap-body">

      <!-- ── Oturum Bilgisi ───────────────────────────── -->
      <section class="ap-section">
        <h4 class="ap-section-title">👤 Oturum Bilgisi</h4>
        <div class="ap-grid-2">
          <div class="ap-stat">
            <span class="ap-stat-label">📍 Konum</span>
            <span class="ap-stat-value" id="ap-geo-loc">Yükleniyor…</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">🌐 IP</span>
            <span class="ap-stat-value" id="ap-geo-ip">Yükleniyor…</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">🏢 ISP / Org</span>
            <span class="ap-stat-value" id="ap-geo-org">Yükleniyor…</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">⏱ Oturum Süresi</span>
            <span class="ap-stat-value" id="ap-dur">${formatDuration(Date.now() - SESSION_START)}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">🖥 Tarayıcı / OS</span>
            <span class="ap-stat-value">${detectBrowser()} / ${detectOS()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">📐 Çözünürlük</span>
            <span class="ap-stat-value">${screen.width}×${screen.height} (${window.devicePixelRatio}x)</span>
          </div>
        </div>
      </section>

      <!-- ── Simülasyon Durumu ─────────────────────────── -->
      <section class="ap-section">
        <h4 class="ap-section-title">🛰 Simülasyon Durumu</h4>
        <div class="ap-grid-2">
          <div class="ap-stat">
            <span class="ap-stat-label">📦 Toplam Nesne</span>
            <span class="ap-stat-value ap-accent">${totalCount.toLocaleString()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">👁 Görünen</span>
            <span class="ap-stat-value ap-accent">${visibleCount.toLocaleString()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">🛸 Aktif / Roket</span>
            <span class="ap-stat-value">${activeCount.toLocaleString()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">💥 Enkaz</span>
            <span class="ap-stat-value">${debrisCount.toLocaleString()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">🌌 İstasyon</span>
            <span class="ap-stat-value">${stationCount.toLocaleString()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">📡 TLE Verisi Yaşı</span>
            <span class="ap-stat-value ${tleDays !== null && tleDays > 3 ? 'ap-warn' : ''}">${tleAge}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">⚡ Hız</span>
            <span class="ap-stat-value">${state.time.speed}×</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">🔍 Katman Filtreleri</span>
            <span class="ap-stat-value">${filterLabel}</span>
          </div>
        </div>
        <div class="ap-stat ap-stat--full">
          <span class="ap-stat-label">🎯 Seçili Nesne</span>
          <span class="ap-stat-value">${selLabel}</span>
        </div>
      </section>

      <!-- ── Bu Cihazda (Toplam) ──────────────────────── -->
      <section class="ap-section">
        <h4 class="ap-section-title">💾 Bu Cihazda (Tüm Oturumlar)</h4>
        <div class="ap-grid-4">
          ${metricBox(totLds.toLocaleString(),     'Sayfa Yükleme')}
          ${metricBox(sesTot_sat.toLocaleString(), 'Uydu Tıklama')}
          ${metricBox(sesTot_evt.toLocaleString(), 'Olay Tıklama')}
          ${metricBox(sesTot_flt.toLocaleString(), 'Filtre Değişimi')}
        </div>
        <div style="margin-top:8px;text-align:right">
          <button id="ap-reset-device" class="ap-tool-btn ap-tool-btn--danger"
            style="padding:4px 10px;font-size:0.72rem">
            Bu Cihaz Verisini Sıfırla
          </button>
        </div>
      </section>

      <!-- ── Tüm Kullanıcılar (Firebase) ─────────────── -->
      <section class="ap-section ap-section--note" id="ap-global-section">
        <h4 class="ap-section-title">🌐 Tüm Kullanıcılar</h4>
        <p class="ap-note-text" style="margin:0">Yükleniyor…</p>
      </section>

      <!-- ── Hızlı Araçlar ─────────────────────────────── -->
      <section class="ap-section">
        <h4 class="ap-section-title">⚙ Hızlı Araçlar</h4>
        <div class="ap-tools">
          <button class="ap-tool-btn" id="ap-copy-state">📋 Snapshot Kopyala</button>
          <button class="ap-tool-btn ap-tool-btn--danger" id="ap-revoke-btn">🔓 Admin Erişimini Kaldır</button>
        </div>
      </section>

    </div>

    <div class="ap-footer">
      <span>Orbital Congestion Simulator — Admin v1</span>
      <span class="ap-footer-hint">Kısayol: Ctrl+Shift+A</span>
    </div>
  `;

  // ── Button handlers ─────────────────────────────────────────────────────────

  panel.querySelector('#ap-close-btn')!.addEventListener('click', closeAdminPanel);

  panel.querySelector('#ap-reset-device')!.addEventListener('click', () => {
    if (!confirm('Bu cihazın tüm istatistikleri sıfırlansın mı?')) return;
    (['sat','evt','flt','loads'] as CounterKey[]).forEach(k => {
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
      session: { sat: sesSat, evt: sesEvt, flt: sesFlt, durationMs: Date.now() - SESSION_START },
      deviceTotal: { loads: totLds, sat: sesTot_sat, evt: sesTot_evt, flt: sesTot_flt },
      simulation: { totalObjects: totalCount, visibleObjects: visibleCount, tleAge, speed: state.time.speed },
      device: { browser: detectBrowser(), os: detectOS(), resolution: `${screen.width}×${screen.height}` },
      geo: geoCache ?? 'not-fetched',
    }, null, 2);
    navigator.clipboard.writeText(snap).catch(() => {/* ignore */});
    const btn = document.getElementById('ap-copy-state');
    if (btn) { btn.textContent = '✓ Kopyalandı'; setTimeout(() => { btn.textContent = '📋 Snapshot Kopyala'; }, 2000); }
  });

  panel.querySelector('#ap-revoke-btn')!.addEventListener('click', () => {
    if (confirm('Admin erişimini bu cihazdan tamamen kaldır?')) {
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
let _lastAlt: unknown = null;

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
    if (st.altitudeFilter !== _lastAlt) {
      if (st.altitudeFilter !== null) {
        inc('flt');
        if (sendToFirebase) fbInc('flt').catch(() => {/* non-fatal */});
      }
      _lastAlt = st.altitudeFilter;
    }
  });
}

// ── Public init ───────────────────────────────────────────────────────────────

export function initAdminSystem(): void {
  window.addEventListener('keydown', onShortcut);
  setupSessionTracking();
  // Increment Firebase page-load counter for non-admin users only
  if (!isAdminMode()) fbInc('loads').catch(() => {/* non-fatal */});
  if (isAdminMode()) requestAnimationFrame(refreshAdminButton);
}
