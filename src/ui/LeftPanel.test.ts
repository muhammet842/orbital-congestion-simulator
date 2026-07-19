// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initLeftPanel } from './LeftPanel';
import { setState } from '../state/appState';
import type { ConjunctionEvent } from '../types';

// requestAnimationFrame is not implemented in jsdom — stub it so initLeftPanel
// can register the live-time refresh loop without throwing.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn());
});

describe('initLeftPanel – DOM smoke', () => {
  it('mounts without throwing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    expect(() => initLeftPanel(container)).not.toThrow();
    document.body.removeChild(container);
  });

  it('creates the #object-search input', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);
    expect(container.querySelector('#object-search')).not.toBeNull();
    document.body.removeChild(container);
  });

  it('creates the #layer-filters section', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);
    expect(container.querySelector('#layer-filters')).not.toBeNull();
    document.body.removeChild(container);
  });

  it('renders a checkbox for each of the four orbit layers', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);
    const layerCheckboxes = container.querySelectorAll('input[data-layer]');
    expect(layerCheckboxes.length).toBe(4);
    const layers = Array.from(layerCheckboxes).map(
      (el) => (el as HTMLInputElement).dataset.layer,
    );
    expect(layers).toContain('LEO');
    expect(layers).toContain('MEO');
    expect(layers).toContain('GEO');
    expect(layers).toContain('HEO');
    document.body.removeChild(container);
  });

  it('creates the advanced-filters section', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);
    expect(container.querySelector('#advanced-filters')).not.toBeNull();
    document.body.removeChild(container);
  });

  it('creates the event accordion inside the left panel', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);
    expect(container.querySelector('#event-accordion')).not.toBeNull();
    document.body.removeChild(container);
  });

  it('creates the conjunction-list section', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);
    expect(container.querySelector('#conjunction-list')).not.toBeNull();
    document.body.removeChild(container);
  });

  it('creates the #color-by-function display option checkbox', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);
    expect(container.querySelector('#color-by-function')).not.toBeNull();
    document.body.removeChild(container);
  });
});

describe('renderConjunctions — predicted (future) close approaches', () => {
  function makeFutureConjunction(msFromNow: number): ConjunctionEvent {
    return {
      objectA: 'STARLINK-1',
      objectB: 'COSMOS-99',
      noradIdA: 1,
      noradIdB: 2,
      indexA: 0,
      indexB: 1,
      distanceKm: 1.85,
      relativeVelocityKmS: 7.2,
      time: new Date(Date.now() + msFromNow),
      midpointScene: { x: 0, y: 0, z: 0 },
    };
  }

  it('shows a "closest approach in <duration>" style message for a future event', () => {
    setState({ conjunctions: [makeFutureConjunction(3 * 60 * 60 * 1000 + 12 * 60 * 1000)], conjunctionHiddenCount: 0 });

    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);

    const text = container.querySelector('.conjunction-alert-text')?.textContent ?? '';
    expect(text).toContain('STARLINK-1');
    expect(text).toContain('COSMOS-99');
    expect(text).toContain('1.85');
    // ~3h12m away — must not render as if it were already happening now.
    expect(text).toMatch(/3h ?12m|in 3h/);

    document.body.removeChild(container);
    setState({ conjunctions: [], conjunctionHiddenCount: 0 });
  });

  it('shows the plain "close approach!" message once an event is at/past CPA', () => {
    setState({ conjunctions: [makeFutureConjunction(0)], conjunctionHiddenCount: 0 });

    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);

    const text = container.querySelector('.conjunction-alert-text')?.textContent ?? '';
    expect(text).toContain('close approach!');

    document.body.removeChild(container);
    setState({ conjunctions: [], conjunctionHiddenCount: 0 });
  });
});
