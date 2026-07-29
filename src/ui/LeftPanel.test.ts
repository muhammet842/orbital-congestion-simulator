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

  it('hides the "recently launched" toggle when no object qualifies as recently launched', () => {
    setState({ objects: [] });
    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);
    expect(container.querySelector('#show-recent-launches')).toBeNull();
    document.body.removeChild(container);
  });

  it('shows the "recently launched" toggle when at least one object was seen in the last 14 days', () => {
    const recentIso = new Date().toISOString();
    setState({
      objects: [
        {
          noradId: 1,
          name: 'TEST-NEW-SAT',
          line1: '',
          line2: '',
          category: 'active',
          country: 'Unknown',
          owner: 'Unknown',
          satrec: {} as never,
          layer: 'LEO',
          color: [1, 1, 1],
          functionGroup: 'active',
          meanAltitudeKm: 500,
          inclinationDeg: 50,
          firstSeenAt: recentIso,
        },
      ],
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);
    expect(container.querySelector('#show-recent-launches')).not.toBeNull();
    document.body.removeChild(container);
    setState({ objects: [] });
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

  it('keeps alert countdowns on the global clock while verifying a selected CPA', () => {
    const near = makeFutureConjunction(40 * 60 * 1000); // ~40m from now
    const far = makeFutureConjunction(2 * 60 * 60 * 1000 + 20 * 60 * 1000); // ~2h20m
    far.objectA = 'STARLINK-FAR-A';
    far.objectB = 'STARLINK-FAR-B';

    setState({
      conjunctions: [far, near],
      conjunctionHiddenCount: 0,
      // Scrubbing near the far event's CPA must not make the near event look "imminent".
      verificationTime: {
        cpaTimeMs: far.time.getTime(),
        currentMs: far.time.getTime() - 60_000,
        playing: true,
        speed: 1,
      },
      selectedConjunctionSessionKey: 'far-session',
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);

    const texts = [...container.querySelectorAll('.conjunction-alert-text')].map(
      (el) => el.textContent ?? '',
    );
    const nearText = texts.find((t) => t.includes('STARLINK-1')) ?? '';
    const farText = texts.find((t) => t.includes('STARLINK-FAR-A')) ?? '';

    expect(nearText).toMatch(/40m|in 40/);
    expect(nearText).not.toContain('close approach!');
    expect(farText).toMatch(/2h|in 2h/);

    document.body.removeChild(container);
    setState({
      conjunctions: [],
      conjunctionHiddenCount: 0,
      verificationTime: null,
      selectedConjunctionSessionKey: null,
    });
  });

  it('does not remount alert cards when the same conjunction list is re-rendered', () => {
    const alert = makeFutureConjunction(15 * 60 * 1000);
    setState({ conjunctions: [alert], conjunctionHiddenCount: 0 });

    const container = document.createElement('div');
    document.body.appendChild(container);
    initLeftPanel(container);

    const first = container.querySelector('.conjunction-alert');
    expect(first).not.toBeNull();

    // Same payload again (e.g. identical scan publish) — nodes must stay put.
    setState({ conjunctions: [alert], conjunctionHiddenCount: 0 });
    const second = container.querySelector('.conjunction-alert');
    expect(second).toBe(first);

    document.body.removeChild(container);
    setState({ conjunctions: [], conjunctionHiddenCount: 0 });
  });
});
