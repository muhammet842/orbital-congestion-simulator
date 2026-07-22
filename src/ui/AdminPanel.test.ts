// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hashPin,
  countryFlag,
  countryName,
  detectBrowser,
  detectOS,
  formatDuration,
  isAutomatedBrowser,
  getFirebaseUrl,
  setFirebaseUrl,
  isAdminMode,
  revokeAdmin,
} from './AdminPanel';

function setUserAgent(ua: string): void {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
}

function setWebdriver(value: boolean | undefined): void {
  Object.defineProperty(window.navigator, 'webdriver', {
    value,
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── hashPin ───────────────────────────────────────────────────────────────────

describe('hashPin', () => {
  it('produces a deterministic hash for the same input', () => {
    expect(hashPin('1234')).toBe(hashPin('1234'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashPin('1234')).not.toBe(hashPin('4321'));
  });

  it('returns a non-empty string', () => {
    expect(hashPin('0000').length).toBeGreaterThan(0);
  });

  it('is sensitive to a single character change', () => {
    expect(hashPin('123456')).not.toBe(hashPin('123457'));
  });
});

// ── countryFlag ───────────────────────────────────────────────────────────────

describe('countryFlag', () => {
  it('converts a valid 2-letter code to a flag emoji', () => {
    const flag = countryFlag('TR');
    expect(flag).toBe('🇹🇷');
  });

  it('is case-insensitive', () => {
    expect(countryFlag('tr')).toBe(countryFlag('TR'));
  });

  it('falls back to a globe for "XX" (unknown placeholder)', () => {
    expect(countryFlag('XX')).toBe('🌐');
  });

  it('falls back to a globe for "??" (unresolved placeholder)', () => {
    expect(countryFlag('??')).toBe('🌐');
  });

  it('falls back to a globe for empty/invalid-length codes', () => {
    expect(countryFlag('')).toBe('🌐');
    expect(countryFlag('USA')).toBe('🌐');
  });
});

// ── countryName ───────────────────────────────────────────────────────────────

describe('countryName', () => {
  it('resolves a known ISO code to its English display name', () => {
    // ICU/CLDR renamed "Turkey" to "Türkiye" in recent Unicode data — assert
    // against the live Intl.DisplayNames result so this doesn't flake across
    // Node/ICU versions, while still checking it's a real name (not the code).
    expect(countryName('TR')).not.toBe('TR');
    expect(countryName('TR').length).toBeGreaterThan(2);
    expect(countryName('US')).toBe('United States');
  });

  it('returns "Unknown" for placeholder codes', () => {
    expect(countryName('XX')).toBe('Unknown');
    expect(countryName('??')).toBe('Unknown');
    expect(countryName('')).toBe('Unknown');
  });
});

// ── detectBrowser / detectOS ──────────────────────────────────────────────────

describe('detectBrowser', () => {
  it('detects Chrome', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
    expect(detectBrowser()).toBe('Chrome');
  });

  it('detects Firefox', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0');
    expect(detectBrowser()).toBe('Firefox');
  });

  it('detects Edge before Chrome (Edge UA also contains "Chrome")', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0');
    expect(detectBrowser()).toBe('Edge');
  });

  it('falls back to Unknown for an unrecognized UA', () => {
    setUserAgent('SomeExoticBrowser/1.0');
    expect(detectBrowser()).toBe('Unknown');
  });
});

describe('detectOS', () => {
  it('detects Windows 10/11', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(detectOS()).toBe('Windows 10/11');
  });

  it('detects macOS', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    expect(detectOS()).toBe('macOS');
  });

  it('detects Android', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7)');
    expect(detectOS()).toBe('Android');
  });

  it('detects iOS', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(detectOS()).toBe('iOS');
  });
});

// ── formatDuration ────────────────────────────────────────────────────────────

describe('formatDuration', () => {
  // Localized via admin.dur_hms/dur_ms/dur_s (src/i18n) — the test environment
  // resolves to English by default (no stored/browser language override).
  it('formats sub-minute durations as seconds', () => {
    expect(formatDuration(45_000)).toBe('45s');
  });

  it('formats sub-hour durations as minutes + seconds', () => {
    expect(formatDuration(2 * 60_000 + 5_000)).toBe('2m 5s');
  });

  it('formats multi-hour durations as hours + minutes + seconds', () => {
    expect(formatDuration(3 * 3_600_000 + 4 * 60_000 + 7_000)).toBe('3h 4m 7s');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });
});

// ── isAutomatedBrowser (CI/Playwright pollution guard) ────────────────────────

describe('isAutomatedBrowser', () => {
  it('returns true when navigator.webdriver is true (Playwright/Selenium)', () => {
    setWebdriver(true);
    expect(isAutomatedBrowser()).toBe(true);
  });

  it('returns false for a regular browser', () => {
    setWebdriver(false);
    expect(isAutomatedBrowser()).toBe(false);
  });

  it('returns false when navigator.webdriver is undefined', () => {
    setWebdriver(undefined);
    expect(isAutomatedBrowser()).toBe(false);
  });
});

// ── Firebase URL storage ──────────────────────────────────────────────────────

describe('getFirebaseUrl / setFirebaseUrl', () => {
  it('falls back to the built-in default URL when nothing is stored', () => {
    expect(getFirebaseUrl()).toContain('firebaseio.com');
  });

  it('returns the overridden URL after setFirebaseUrl is called', () => {
    setFirebaseUrl('https://custom-project-default-rtdb.firebaseio.com');
    expect(getFirebaseUrl()).toBe('https://custom-project-default-rtdb.firebaseio.com');
  });

  it('trims whitespace when storing a custom URL', () => {
    setFirebaseUrl('  https://spacey-url.firebaseio.com  ');
    expect(getFirebaseUrl()).toBe('https://spacey-url.firebaseio.com');
  });
});

// ── Admin auth ────────────────────────────────────────────────────────────────

describe('isAdminMode / revokeAdmin', () => {
  it('is false by default (no flag in localStorage)', () => {
    expect(isAdminMode()).toBe(false);
  });

  it('becomes true once the admin flag is set', () => {
    localStorage.setItem('orbital_admin_v1', '1');
    expect(isAdminMode()).toBe(true);
  });

  it('revokeAdmin clears the flag and hash', () => {
    localStorage.setItem('orbital_admin_v1', '1');
    localStorage.setItem('orbital_admin_pin_v1', hashPin('1234'));
    revokeAdmin();
    expect(isAdminMode()).toBe(false);
    expect(localStorage.getItem('orbital_admin_pin_v1')).toBeNull();
  });
});
