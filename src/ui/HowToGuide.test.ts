// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLang, setLang } from '../i18n/i18n';
import {
  closeHowToGuide,
  initHowToGuide,
  isHowToGuideOpen,
  openHowToGuide,
} from './HowToGuide';

const LS_HELP_SEEN = 'orbital-help-seen-v2';

function mountAppShell(): void {
  document.body.innerHTML = `
    <header class="app-header">
      <div class="header-brand">
        <div class="header-title">Orbital Congestion Simulator</div>
      </div>
      <div class="header-actions" id="header-actions">
        <div class="header-lang">
          <select id="lang-select">
            <option value="en">EN</option>
            <option value="tr">TR</option>
          </select>
        </div>
      </div>
    </header>
    <aside id="left-panel" class="panel panel-left">
      <div id="tour-region-search"></div>
      <div id="tour-region-approaches"></div>
      <div class="event-cards"></div>
    </aside>
    <main id="scene-container" class="scene-container"></main>
    <aside id="right-panel" class="panel panel-right"></aside>
    <div id="mobile-backdrop" class="mobile-backdrop"></div>
    <footer id="time-bar" class="time-bar"></footer>
    <button id="toggle-left-panel" aria-expanded="false"></button>
    <button id="toggle-right-panel" aria-expanded="false"></button>
    <button id="kessler-panel-btn" type="button"></button>
  `;
}

beforeEach(() => {
  localStorage.setItem(LS_HELP_SEEN, '1');
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  setLang('en');
  mountAppShell();
  vi.useRealTimers();
});

afterEach(() => {
  closeHowToGuide();
  document.body.innerHTML = '';
  localStorage.clear();
  vi.useRealTimers();
});

describe('initHowToGuide', () => {
  it('inserts a "?" header button before the language selector', () => {
    initHowToGuide();
    const btn = document.getElementById('help-guide-btn');
    const langSel = document.getElementById('lang-select');
    expect(btn?.textContent).toBe('?');
    expect(
      Boolean(btn && langSel && (btn.compareDocumentPosition(langSel) & Node.DOCUMENT_POSITION_FOLLOWING)),
    ).toBe(true);
  });

  it('auto-opens on first visit after a short delay', () => {
    localStorage.removeItem(LS_HELP_SEEN);
    vi.useFakeTimers();
    initHowToGuide();
    expect(isHowToGuideOpen()).toBe(false);
    vi.advanceTimersByTime(700);
    expect(isHowToGuideOpen()).toBe(true);
    expect(document.getElementById('tour-title')?.textContent).toBe('Choose a language to continue');
  });
});

describe('interactive tour', () => {
  it('starts with a language gate and Skip', () => {
    openHowToGuide();
    expect(document.getElementById('tour-title')?.textContent).toBe('Choose a language to continue');
    expect(document.querySelectorAll('.tour-lang-btn').length).toBe(5);
    expect(document.getElementById('tour-skip')).not.toBeNull();
  });

  it('continues in the chosen language after picking Türkçe', () => {
    openHowToGuide();
    document.querySelector<HTMLButtonElement>('.tour-lang-btn[data-lang="tr"]')?.click();
    expect(getLang()).toBe('tr');
    expect(document.querySelector<HTMLSelectElement>('#lang-select')?.value).toBe('tr');
    expect(document.querySelector('.tour-progress')?.textContent).toBe('1 / 7');
    expect(document.getElementById('tour-skip')?.textContent).toBe('Atla');
    expect(document.querySelector('.tour-title')?.textContent).toMatch(/Küreyi/i);
  });

  it('advances with Next and can be skipped', () => {
    openHowToGuide();
    document.querySelector<HTMLButtonElement>('.tour-lang-btn[data-lang="en"]')?.click();
    document.getElementById('tour-next')?.click();
    expect(document.querySelector('.tour-progress')?.textContent).toBe('2 / 7');
    document.getElementById('tour-skip')?.click();
    expect(isHowToGuideOpen()).toBe(false);
    expect(localStorage.getItem(LS_HELP_SEEN)).toBe('1');
  });

  it('does not open a second root if already open', () => {
    openHowToGuide();
    openHowToGuide();
    expect(document.querySelectorAll('#help-tour-root').length).toBe(1);
  });
});
