// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initState } from '../state/appState';
import { closeKesslerPanel, initKesslerPanel, isKesslerPanelOpen, openKesslerPanel } from './KesslerPanel';

function mountHeader(): void {
  document.body.innerHTML = `
    <header class="app-header">
      <div class="header-brand">
        <div class="header-title">Orbital Congestion Simulator</div>
      </div>
      <div class="header-actions" id="header-actions">
        <select id="lang-select"></select>
      </div>
    </header>
  `;
}

beforeEach(() => {
  mountHeader();
  initState([], {
    total: 12000,
    leoPercent: 80,
    avgAltitude: 600,
    categoryCounts: { active: 6000, debris: 5000, stations: 1000 },
    fetchedAt: new Date().toISOString(),
  });
});

afterEach(() => {
  closeKesslerPanel();
  document.body.innerHTML = '';
});

describe('initKesslerPanel', () => {
  it('inserts a header trigger button before the language selector', () => {
    initKesslerPanel();
    const btn = document.getElementById('kessler-panel-btn');
    const langSel = document.getElementById('lang-select');
    const actions = document.getElementById('header-actions');
    expect(btn).not.toBeNull();
    expect(actions?.contains(btn!)).toBe(true);
    expect(
      Boolean(btn && langSel && (btn.compareDocumentPosition(langSel) & Node.DOCUMENT_POSITION_FOLLOWING)),
    ).toBe(true);
  });

  it('opens the panel when the header button is clicked', () => {
    initKesslerPanel();
    expect(isKesslerPanelOpen()).toBe(false);
    document.getElementById('kessler-panel-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(isKesslerPanelOpen()).toBe(true);
  });
});

describe('openKesslerPanel / closeKesslerPanel', () => {
  it('renders the scenario sliders, presets, and run button', () => {
    openKesslerPanel();
    expect(document.getElementById('kp-launch')).not.toBeNull();
    expect(document.getElementById('kp-mitigation')).not.toBeNull();
    expect(document.getElementById('kp-risk')).not.toBeNull();
    expect(document.getElementById('kp-target-year')).not.toBeNull();
    expect(document.getElementById('kp-run')).not.toBeNull();
    expect(document.querySelectorAll('[data-preset]').length).toBe(4);
  });

  it('auto-runs the business-as-usual projection when opened', () => {
    openKesslerPanel();
    expect(document.getElementById('kp-results-section')?.hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('kp-prompt')?.hasAttribute('hidden')).toBe(true);
    expect(document.getElementById('kp-stat-total')?.textContent).not.toBe('—');
    expect(document.getElementById('kp-stat-leo')?.textContent).not.toBe('—');
    expect(document.getElementById('kp-narrative')?.textContent?.length).toBeGreaterThan(0);
  });

  it('does not open a second backdrop if already open', () => {
    openKesslerPanel();
    openKesslerPanel();
    expect(document.querySelectorAll('#kessler-panel-backdrop').length).toBe(1);
  });

  it('shows LEO collision risk as a multiplier, not a percent', () => {
    openKesslerPanel();
    const risk = document.getElementById('kp-stat-risk')?.textContent ?? '';
    expect(risk).toMatch(/×$/);
    expect(risk).not.toContain('%');
  });

  it('projects a larger population for a higher launch-rate slider value', () => {
    openKesslerPanel();
    const baselineText = document.getElementById('kp-stat-total')?.textContent ?? '0';
    const baselineTotal = Number(baselineText.replace(/[^\d]/g, ''));

    const launchSlider = document.getElementById('kp-launch') as HTMLInputElement;
    launchSlider.value = '400';
    launchSlider.dispatchEvent(new Event('input', { bubbles: true }));

    const aggressiveText = document.getElementById('kp-stat-total')?.textContent ?? '0';
    const aggressiveTotal = Number(aggressiveText.replace(/[^\d]/g, ''));

    expect(aggressiveTotal).toBeGreaterThan(baselineTotal);
  });

  it('applies a named preset and updates the projection', () => {
    openKesslerPanel();
    const bauTotal = Number((document.getElementById('kp-stat-total')?.textContent ?? '0').replace(/[^\d]/g, ''));

    const boomBtn = document.querySelector('[data-preset="boom"]') as HTMLButtonElement;
    boomBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const boomTotal = Number((document.getElementById('kp-stat-total')?.textContent ?? '0').replace(/[^\d]/g, ''));
    expect(boomTotal).toBeGreaterThan(bauTotal);
    expect(boomBtn.classList.contains('kp-preset--active')).toBe(true);
  });

  it('updates the scrubbed year display when the scrub slider changes', () => {
    openKesslerPanel();

    const scrub = document.getElementById('kp-scrub') as HTMLInputElement;
    scrub.value = '0';
    scrub.dispatchEvent(new Event('input', { bubbles: true }));

    const scrubVal = document.getElementById('kp-scrub-val')?.textContent ?? '';
    expect(scrubVal).toContain(String(new Date().getUTCFullYear() + 1));
  });

  it('closes on Escape and removes the backdrop from the DOM', () => {
    openKesslerPanel();
    expect(isKesslerPanelOpen()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(isKesslerPanelOpen()).toBe(false);
    expect(document.getElementById('kessler-panel-backdrop')).toBeNull();
  });

  it('closes when clicking directly on the backdrop', () => {
    openKesslerPanel();
    const backdrop = document.getElementById('kessler-panel-backdrop')!;
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(isKesslerPanelOpen()).toBe(false);
  });
});
