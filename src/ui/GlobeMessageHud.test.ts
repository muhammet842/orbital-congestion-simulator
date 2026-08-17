// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initState, setState } from '../state/appState';
import { bauOutlookInYears, formatHudCount, initGlobeMessageHud, unmountGlobeMessageHud } from './GlobeMessageHud';
import { closeKesslerPanel, initKesslerPanel, isKesslerPanelOpen } from './KesslerPanel';

function mountShell(): HTMLElement {
  document.body.innerHTML = `
    <header class="app-header">
      <div class="header-actions" id="header-actions">
        <select id="lang-select"></select>
      </div>
    </header>
    <main id="scene-container" class="scene-container"></main>
  `;
  return document.getElementById('scene-container')!;
}

beforeEach(() => {
  mountShell();
  initState([], {
    total: 10000,
    leoPercent: 82,
    avgAltitude: 550,
    categoryCounts: { active: 4000, debris: 5500, stations: 500 },
    fetchedAt: new Date().toISOString(),
  });
});

afterEach(() => {
  unmountGlobeMessageHud();
  closeKesslerPanel();
  document.body.innerHTML = '';
});

describe('formatHudCount', () => {
  it('keeps small numbers readable', () => {
    expect(formatHudCount(42)).toBe('42');
  });

  it('compacts thousands', () => {
    expect(formatHudCount(12_400)).toMatch(/12k/);
  });
});

describe('bauOutlookInYears', () => {
  it('projects a later year with a higher or equal object count', () => {
    const out = bauOutlookInYears(25);
    expect(out.year).toBeGreaterThanOrEqual(new Date().getUTCFullYear() + 20);
    expect(out.totalObjects).toBeGreaterThan(10_000);
    expect(out.riskMultiple).toBeGreaterThan(0);
  });
});

describe('initGlobeMessageHud', () => {
  it('renders catalog stats and an outlook on the globe', () => {
    initGlobeMessageHud(document.getElementById('scene-container')!);
    expect(document.getElementById('globe-message-hud')).not.toBeNull();
    expect(document.getElementById('globe-hud-catalog')?.textContent).toMatch(/10k/);
    expect(document.getElementById('globe-hud-leo')?.textContent).toBe('82%');
    expect(document.getElementById('globe-hud-debris')?.textContent).toMatch(/5/);
    expect(document.getElementById('globe-hud-outlook')?.textContent?.length).toBeGreaterThan(10);
  });

  it('opens the projection panel from the globe caption', () => {
    initKesslerPanel();
    initGlobeMessageHud(document.getElementById('scene-container')!);
    document.getElementById('globe-hud-open')?.click();
    expect(isKesslerPanelOpen()).toBe(true);
  });

  it('hides during a historical replay', () => {
    initGlobeMessageHud(document.getElementById('scene-container')!);
    setState({ selectedEventId: 'iridium-cosmos' });
    expect(document.getElementById('globe-message-hud')?.hidden).toBe(true);
  });
});
