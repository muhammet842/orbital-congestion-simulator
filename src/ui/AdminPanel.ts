/**
 * AdminPanel — device-local admin mode with analytics overlay.
 *
 * Access flow
 *   First time  : press Ctrl+Shift+A → create a 4-digit PIN → stored as a
 *                 simple hash in localStorage → admin flag set
 *   Later visits: localStorage flag present → auto-admin, button visible in header
 *   Panel       : click the ⚙ Admin button → modal with live sim data, session
 *                 info, and quick tools opens on top of the scene
 */

import { getState, subscribe } from '../state/appState';
import type { TrackedObject } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────────

const LS_ADMIN_FLAG = 'orbital_admin_v1';
const LS_ADMIN_HASH = 'orbital_admin_pin_v1';

// ── Session tracking ──────────────────────────────────────────────────────────

const SESSION_START = Date.now();
let satelliteClicks = 0;
let eventClicks = 0;
let filterChanges = 0;
let _lastSel: number | null = null;
let _lastEvt: string | null = null;
let _lastAlt: unknown = null;

// ── Simple PIN hash (djb2) ────────────────────────────────────────────────────

function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) {
    h = Math.imul(h, 31) + pin.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

// ── Admin auth helpers ────────────────────────────────────────────────────────

export function isAdminMode(): boolean {
  try {
    return localStorage.getItem(LS_ADMIN_FLAG) === '1';
  } catch {
    return false;
  }
}

function getStoredHash(): string | null {
  try {
    return localStorage.getItem(LS_ADMIN_HASH);
  } catch {
    return null;
  }
}

function setAdminActive(): void {
  try {
    localStorage.setItem(LS_ADMIN_FLAG, '1');
  } catch {
    /* ignore */
  }
  refreshAdminButton();
}

export function revokeAdmin(): void {
  try {
    localStorage.removeItem(LS_ADMIN_FLAG);
    localStorage.removeItem(LS_ADMIN_HASH);
  } catch {
    /* ignore */
  }
  refreshAdminButton();
}

// ── Geolocation cache ─────────────────────────────────────────────────────────

interface GeoData {
  ip: string;
  city: string;
  region: string;
  country_name: string;
  org: string;
}

let geoCache: GeoData | null = null;
let geoFetching = false;

async function fetchGeo(): Promise<GeoData | null> {
  if (geoCache) return geoCache;
  if (geoFetching) return null;
  geoFetching = true;
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    geoCache = (await res.json()) as GeoData;
    return geoCache;
  } catch {
    return null;
  } finally {
    geoFetching = false;
  }
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

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
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
      btn.title = 'Open Admin Panel (Ctrl+Shift+A)';
      btn.addEventListener('click', openAdminPanel);

      const header = document.querySelector('.app-header');
      const langSelect = document.getElementById('lang-select');
      if (header && langSelect) {
        header.insertBefore(btn, langSelect);
      } else if (header) {
        header.appendChild(btn);
      }
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

  const input = overlay.querySelector<HTMLInputElement>('#admin-pin-input')!;
  const confirmInput = overlay.querySelector<HTMLInputElement>('#admin-pin-confirm');
  const errorEl = overlay.querySelector<HTMLElement>('#admin-pin-error')!;

  const showError = (msg: string): void => {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  };

  const submit = (): void => {
    const pin = input.value.trim();
    if (pin.length < 4) { showError('PIN en az 4 karakter olmalı.'); return; }

    if (isSetup) {
      const confirm = confirmInput?.value.trim() ?? '';
      if (pin !== confirm) { showError('PIN\'ler eşleşmiyor.'); return; }
      try {
        localStorage.setItem(LS_ADMIN_HASH, hashPin(pin));
      } catch { /* ignore */ }
      setAdminActive();
      overlay.remove();
      openAdminPanel();
    } else {
      if (hashPin(pin) !== storedHash) { showError('Hatalı PIN. Tekrar dene.'); return; }
      setAdminActive();
      overlay.remove();
      openAdminPanel();
    }
  };

  overlay.querySelector('#admin-pin-submit')!.addEventListener('click', submit);
  overlay.querySelector('#admin-pin-cancel')!.addEventListener('click', () => overlay.remove());
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  confirmInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  requestAnimationFrame(() => input.focus());
}

// ── Admin panel modal ─────────────────────────────────────────────────────────

let panelEl: HTMLElement | null = null;
let durationInterval: ReturnType<typeof setInterval> | null = null;
let geoUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

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

  // Update duration every second
  durationInterval = setInterval(() => {
    const el = document.getElementById('ap-session-duration');
    if (el) el.textContent = formatDuration(Date.now() - SESSION_START);
  }, 1_000);

  // Fetch geo and update async
  geoUpdateTimeout = setTimeout(async () => {
    const geo = await fetchGeo();
    if (!geo || !panelEl) return;
    const locEl = document.getElementById('ap-geo-location');
    const ipEl  = document.getElementById('ap-geo-ip');
    const orgEl = document.getElementById('ap-geo-org');
    if (locEl) locEl.textContent = `${geo.city}, ${geo.region}, ${geo.country_name}`;
    if (ipEl)  ipEl.textContent  = geo.ip;
    if (orgEl) orgEl.textContent = geo.org;
  }, 100);

  // Close on backdrop click outside panel
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeAdminPanel();
  });

  document.addEventListener('keydown', handleEscClose);
}

function handleEscClose(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeAdminPanel();
}

export function closeAdminPanel(): void {
  panelEl?.remove();
  panelEl = null;
  if (durationInterval) { clearInterval(durationInterval); durationInterval = null; }
  if (geoUpdateTimeout) { clearTimeout(geoUpdateTimeout); geoUpdateTimeout = null; }
  document.removeEventListener('keydown', handleEscClose);
}

function renderPanelContent(panel: HTMLElement): void {
  const state = getState();
  const s = state.stats;

  // Counts by category
  const objs = state.objects;
  const activeCount  = objs.filter(o => o.category === 'active').length;
  const debrisCount  = objs.filter(o => o.category === 'debris').length;
  const stationCount = objs.filter(o => o.category === 'stations').length;
  const visibleCount = state.filteredIndices.length;
  const totalCount   = objs.length;

  // TLE age
  const fetchedAt = s?.fetchedAt ? new Date(s.fetchedAt) : null;
  const tleDays   = fetchedAt
    ? Math.floor((Date.now() - fetchedAt.getTime()) / 86_400_000)
    : null;
  const tleAge = tleDays === null ? '—'
    : tleDays === 0 ? 'Bu gün'
    : `${tleDays} gün önce`;

  // Selected object
  const selObj: TrackedObject | null =
    state.selectedIndex != null ? (objs[state.selectedIndex] ?? null) : null;
  const selLabel = selObj
    ? `${selObj.name} (${selObj.noradId})`
    : state.selectedEventId
      ? `Olay: ${state.selectedEventId}`
      : 'Yok';

  // Speed
  const speed = state.time.speed;

  // Layer filters active
  const activeFilters = Object.entries(state.layerFilters)
    .filter(([, v]) => !v).map(([k]) => k);
  const filterLabel = activeFilters.length === 0 ? 'Tümü görünür'
    : `Gizli: ${activeFilters.join(', ')}`;

  panel.innerHTML = `
    <div class="ap-header">
      <div class="ap-logo">🛸 <span>Admin Panel</span></div>
      <button class="ap-close" id="ap-close-btn" title="Kapat (Esc)">✕</button>
    </div>

    <div class="ap-body">

      <!-- ── Oturum Bilgisi ────────────────────────────── -->
      <section class="ap-section">
        <h4 class="ap-section-title">👤 Oturum Bilgisi</h4>
        <div class="ap-grid-2">
          <div class="ap-stat">
            <span class="ap-stat-label">📍 Konum</span>
            <span class="ap-stat-value" id="ap-geo-location">Yükleniyor…</span>
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
            <span class="ap-stat-value" id="ap-session-duration">${formatDuration(Date.now() - SESSION_START)}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">🖥 Tarayıcı</span>
            <span class="ap-stat-value">${detectBrowser()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">💻 İşletim Sistemi</span>
            <span class="ap-stat-value">${detectOS()}</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">📐 Çözünürlük</span>
            <span class="ap-stat-value">${screen.width}×${screen.height} (${window.devicePixelRatio}x)</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">🌍 Dil</span>
            <span class="ap-stat-value">${navigator.language}</span>
          </div>
        </div>
      </section>

      <!-- ── Simülasyon Durumu ──────────────────────────── -->
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
            <span class="ap-stat-label">🛸 Aktif Uydu / Roket</span>
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
            <span class="ap-stat-label">⚡ Simülasyon Hızı</span>
            <span class="ap-stat-value">${speed}×</span>
          </div>
          <div class="ap-stat">
            <span class="ap-stat-label">📡 TLE Verisi Yaşı</span>
            <span class="ap-stat-value ${tleDays !== null && tleDays > 3 ? 'ap-warn' : ''}">${tleAge}</span>
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

      <!-- ── Bu Oturum (Aksiyonlar) ────────────────────── -->
      <section class="ap-section">
        <h4 class="ap-section-title">📊 Bu Oturumda</h4>
        <div class="ap-grid-3">
          <div class="ap-metric">
            <span class="ap-metric-val">${satelliteClicks}</span>
            <span class="ap-metric-lbl">Uydu Tıklama</span>
          </div>
          <div class="ap-metric">
            <span class="ap-metric-val">${eventClicks}</span>
            <span class="ap-metric-lbl">Olay Tıklama</span>
          </div>
          <div class="ap-metric">
            <span class="ap-metric-val">${filterChanges}</span>
            <span class="ap-metric-lbl">Filtre Değişimi</span>
          </div>
        </div>
      </section>

      <!-- ── Analytics Notu ─────────────────────────────── -->
      <section class="ap-section ap-section--note">
        <h4 class="ap-section-title">📈 Çoklu Kullanıcı Analitiği</h4>
        <p class="ap-note-text">
          Gerçek zamanlı ziyaretçi sayısı ve ülke dağılımı için
          <strong>Vercel Analytics</strong> veya <strong>Google Analytics 4</strong>
          entegrasyonu gereklidir. Mevcut panel yalnızca yerel oturum verisini gösterir.
        </p>
        <a class="ap-note-link"
          href="https://vercel.com/docs/analytics"
          target="_blank" rel="noopener noreferrer">
          Vercel Analytics → Kur
        </a>
      </section>

      <!-- ── Hızlı Araçlar ─────────────────────────────── -->
      <section class="ap-section">
        <h4 class="ap-section-title">⚙ Hızlı Araçlar</h4>
        <div class="ap-tools">
          <button class="ap-tool-btn" id="ap-copy-state">📋 State Kopyala</button>
          <button class="ap-tool-btn ap-tool-btn--danger" id="ap-revoke-btn">
            🔓 Admin Erişimini Kaldır
          </button>
        </div>
      </section>

    </div><!-- /.ap-body -->

    <div class="ap-footer">
      <span>Orbital Congestion Simulator — Admin v1</span>
      <span class="ap-footer-hint">Kısayol: Ctrl+Shift+A</span>
    </div>
  `;

  panel.querySelector('#ap-close-btn')!.addEventListener('click', closeAdminPanel);

  panel.querySelector('#ap-copy-state')!.addEventListener('click', () => {
    const snap = JSON.stringify({
      totalObjects: totalCount,
      visibleObjects: visibleCount,
      selectedIndex: state.selectedIndex,
      selectedEventId: state.selectedEventId,
      speed: state.time.speed,
      sessionDurationMs: Date.now() - SESSION_START,
      satelliteClicks,
      eventClicks,
      filterChanges,
      tleAge,
      geo: geoCache ?? 'not-fetched',
      browser: detectBrowser(),
      os: detectOS(),
      resolution: `${screen.width}×${screen.height}`,
    }, null, 2);
    navigator.clipboard.writeText(snap).catch(() => {
      const el = document.getElementById('ap-copy-state');
      if (el) el.textContent = '⚠ Kopyalanamadı';
    });
    const el = document.getElementById('ap-copy-state');
    if (el) { el.textContent = '✓ Kopyalandı'; setTimeout(() => { el.textContent = '📋 State Kopyala'; }, 2000); }
  });

  panel.querySelector('#ap-revoke-btn')!.addEventListener('click', () => {
    if (confirm('Admin erişimini bu cihazdan tamamen kaldır?')) {
      revokeAdmin();
      closeAdminPanel();
    }
  });
}

// ── Keyboard shortcut: Ctrl+Shift+A ──────────────────────────────────────────

function onKeyboardShortcut(e: KeyboardEvent): void {
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    if (isAdminMode()) {
      if (panelEl) closeAdminPanel();
      else openAdminPanel();
    } else {
      showPinDialog();
    }
  }
}

// ── State subscription for session tracking ───────────────────────────────────

function setupSessionTracking(): void {
  subscribe(() => {
    const st = getState();
    if (st.selectedIndex !== null && st.selectedIndex !== _lastSel) {
      satelliteClicks++;
      _lastSel = st.selectedIndex;
    }
    if (st.selectedEventId !== null && st.selectedEventId !== _lastEvt) {
      eventClicks++;
      _lastEvt = st.selectedEventId;
    }
    if (st.altitudeFilter !== _lastAlt) {
      if (st.altitudeFilter !== null) filterChanges++;
      _lastAlt = st.altitudeFilter;
    }
  });
}

// ── Public init ───────────────────────────────────────────────────────────────

export function initAdminSystem(): void {
  window.addEventListener('keydown', onKeyboardShortcut);
  setupSessionTracking();
  // Auto-show button if already admin on this device
  if (isAdminMode()) {
    // Defer until header DOM is ready
    requestAnimationFrame(refreshAdminButton);
  }
}
