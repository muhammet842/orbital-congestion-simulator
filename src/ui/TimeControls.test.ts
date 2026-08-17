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

describe('conjunction verification scrubbing', () => {
  const CPA = 1_000_000;

  beforeEach(() => {
    setState({
      selectedConjunction: {} as never,
      verificationTime: {
        cpaTimeMs: CPA,
        currentMs: CPA - 60_000,
        playing: true,
        speed: 1,
      },
    });
  });

  it('maps the slider across the CPA window (T−60s…T+15s), not ±7 days', () => {
    const container = mount();
    const slider = container.querySelector<HTMLInputElement>('#time-slider')!;

    // Midpoint of the 75s window ≈ CPA − 22.5s
    slider.value = '0';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    const vt = getState().verificationTime!;
    expect(vt.playing).toBe(false);
    expect(vt.currentMs).toBeGreaterThan(CPA - 60_000);
    expect(vt.currentMs).toBeLessThan(CPA + 15_000);
    expect(Math.abs(vt.currentMs - (CPA - 22_500))).toBeLessThan(500);
  });

  it('steps ±5 seconds with rewind/forward and clamps to the window', () => {
    const container = mount();
    const rewind = container.querySelector<HTMLButtonElement>('#btn-rewind')!;
    const forward = container.querySelector<HTMLButtonElement>('#btn-forward')!;

    // At window start — rewind must clamp, not jump an hour.
    rewind.click();
    expect(getState().verificationTime!.currentMs).toBe(CPA - 60_000);

    forward.click();
    expect(getState().verificationTime!.currentMs).toBe(CPA - 55_000);
    expect(getState().verificationTime!.playing).toBe(false);
  });
});

describe('event replay scrubbing', () => {
  const IMPACT = 2_000_000;
  const REWIND = 5 * 60 * 1000;

  beforeEach(() => {
    setState({
      eventReplay: {
        eventId: 'fengyun-asat',
        collisionTimeMs: IMPACT,
        currentMs: IMPACT - REWIND,
        playing: true,
        speed: 15,
      },
    });
  });

  it('maps the slider across T−5m…IMPACT', () => {
    const container = mount();
    const slider = container.querySelector<HTMLInputElement>('#time-slider')!;

    slider.value = '0';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    const er = getState().eventReplay!;
    expect(er.playing).toBe(false);
    expect(er.currentMs).toBeGreaterThan(IMPACT - REWIND);
    expect(er.currentMs).toBeLessThan(IMPACT);
    expect(Math.abs(er.currentMs - (IMPACT - REWIND / 2))).toBeLessThan(500);
  });

  it('steps ±5 seconds with rewind/forward and clamps to the window', () => {
    const container = mount();
    const rewind = container.querySelector<HTMLButtonElement>('#btn-rewind')!;
    const forward = container.querySelector<HTMLButtonElement>('#btn-forward')!;

    rewind.click();
    expect(getState().eventReplay!.currentMs).toBe(IMPACT - REWIND);

    forward.click();
    expect(getState().eventReplay!.currentMs).toBe(IMPACT - REWIND + 5_000);
    expect(getState().eventReplay!.playing).toBe(false);
  });

  it('does not swap the global clock to live when LIVE is clicked mid-replay', () => {
    const container = mount();
    container.querySelector<HTMLButtonElement>('#btn-live')!.click();
    expect(getState().eventReplay?.eventId).toBe('fengyun-asat');
    expect(getState().eventReplay?.playing).toBe(true);
    expect(getState().eventReplay?.speed).toBe(1);
  });
});
