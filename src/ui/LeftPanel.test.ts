// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initLeftPanel } from './LeftPanel';

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
