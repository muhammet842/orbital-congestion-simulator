// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeHowToGuide,
  initHowToGuide,
  isHowToGuideOpen,
  openHowToGuide,
} from './HowToGuide';

const LS_HELP_SEEN = 'orbital-help-seen-v1';

function mountHeader(): void {
  document.body.innerHTML = `
    <header class="app-header">
      <div class="header-brand">
        <div class="header-title">Orbital Congestion Simulator</div>
      </div>
      <div class="header-actions" id="header-actions">
        <div class="header-lang">
          <select id="lang-select"></select>
        </div>
      </div>
    </header>
  `;
}

beforeEach(() => {
  localStorage.setItem(LS_HELP_SEEN, '1');
  mountHeader();
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
    const actions = document.getElementById('header-actions');
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe('?');
    expect(actions?.contains(btn!)).toBe(true);
    expect(
      Boolean(btn && langSel && (btn.compareDocumentPosition(langSel) & Node.DOCUMENT_POSITION_FOLLOWING)),
    ).toBe(true);
  });

  it('opens the guide when the header button is clicked', () => {
    initHowToGuide();
    expect(isHowToGuideOpen()).toBe(false);
    document.getElementById('help-guide-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(isHowToGuideOpen()).toBe(true);
  });

  it('auto-opens on first visit after a short delay', () => {
    localStorage.removeItem(LS_HELP_SEEN);
    vi.useFakeTimers();
    initHowToGuide();
    expect(isHowToGuideOpen()).toBe(false);
    vi.advanceTimersByTime(600);
    expect(isHowToGuideOpen()).toBe(true);
  });

  it('does not auto-open when the guide was already seen', () => {
    vi.useFakeTimers();
    initHowToGuide();
    vi.advanceTimersByTime(1000);
    expect(isHowToGuideOpen()).toBe(false);
  });
});

describe('openHowToGuide / closeHowToGuide', () => {
  it('renders seven numbered steps and a Got it button', () => {
    openHowToGuide();
    expect(document.querySelectorAll('.help-step').length).toBe(7);
    expect(document.getElementById('help-got-it')).not.toBeNull();
  });

  it('does not open a second backdrop if already open', () => {
    openHowToGuide();
    openHowToGuide();
    expect(document.querySelectorAll('#help-guide-backdrop').length).toBe(1);
  });

  it('marks the guide seen and closes when Got it is clicked', () => {
    localStorage.removeItem(LS_HELP_SEEN);
    openHowToGuide();
    document.getElementById('help-got-it')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(isHowToGuideOpen()).toBe(false);
    expect(localStorage.getItem(LS_HELP_SEEN)).toBe('1');
  });

  it('closes on Escape and marks the guide seen', () => {
    localStorage.removeItem(LS_HELP_SEEN);
    openHowToGuide();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(isHowToGuideOpen()).toBe(false);
    expect(localStorage.getItem(LS_HELP_SEEN)).toBe('1');
  });
});
