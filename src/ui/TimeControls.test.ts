// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getState, setState } from '../state/appState';
import { initTimeControls } from './TimeControls';

// requestAnimationFrame is not implemented in jsdom — stub it so the
// live-time refresh loop can register without throwing.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  setState({
    verificationTime: null,
    eventReplay: null,
  });
});

function mount(): HTMLElement {
  // Deliberately not attached to document.body: click()/querySelector()
  // work fine on a detached tree, and it avoids duplicate-id collisions
  // with #speed-buttons etc. left behind by other tests in this file.
  const container = document.createElement('div');
  initTimeControls(container);
  return container;
}

describe('initTimeControls – DOM smoke', () => {
  it('mounts without throwing', () => {
    expect(() => mount()).not.toThrow();
  });

  it('renders play/rewind/forward buttons and a speed control for each speed', () => {
    const container = mount();
    expect(container.querySelector('#btn-play')).not.toBeNull();
    expect(container.querySelector('#btn-rewind')).not.toBeNull();
    expect(container.querySelector('#btn-forward')).not.toBeNull();
    expect(container.querySelectorAll('.speed-btn').length).toBe(3);
  });
});

describe('conjunction verification speed buttons', () => {
  it('auto-resumes playback when a speed is picked while paused (T-60s preview)', () => {
    // Verification always starts paused so the user can inspect the T-60s
    // state before committing to watch it play out.
    setState({
      selectedConjunction: {} as never,
      verificationTime: { cpaTimeMs: 1_000_000, currentMs: 940_000, playing: false, speed: 1 },
    });

    const container = mount();
    const speed100Btn = Array.from(container.querySelectorAll<HTMLButtonElement>('.speed-btn')).find(
      (btn) => btn.dataset.speed === '100',
    );
    expect(speed100Btn).toBeDefined();

    expect(getState().verificationTime?.playing).toBe(false);
    speed100Btn!.click();

    // Picking a speed is an unambiguous signal of intent to watch the
    // objects move — it must not silently no-op while paused.
    expect(getState().verificationTime?.playing).toBe(true);
    expect(getState().verificationTime?.speed).toBe(100);
  });

  it('keeps playback running (does not pause) when switching speed mid-playback', () => {
    setState({
      selectedConjunction: {} as never,
      verificationTime: { cpaTimeMs: 1_000_000, currentMs: 970_000, playing: true, speed: 1 },
    });

    const container = mount();
    const speed10Btn = Array.from(container.querySelectorAll<HTMLButtonElement>('.speed-btn')).find(
      (btn) => btn.dataset.speed === '10',
    );
    speed10Btn!.click();

    expect(getState().verificationTime?.playing).toBe(true);
    expect(getState().verificationTime?.speed).toBe(10);
  });
});
