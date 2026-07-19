import {
  enterHistoricalMode,
  enterLiveMode,
  formatUtcDateTime,
  getSimulationTime,
  getState,
  getVerificationTimeState,
  isConjunctionVerificationActive,
  isVerificationPlaying,
  jumpToNow,
  setTimePartial,
  setVerificationPartial,
  subscribe,
} from '../state/appState';

const SPEEDS = [1, 10, 100];
const SLIDER_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

export function initTimeControls(container: HTMLElement): void {
  container.innerHTML = `
    <div class="time-controls">
      <div class="time-buttons">
        <button type="button" id="btn-rewind" title="Back 1 hour">⏮</button>
        <button type="button" id="btn-play" title="Play/Pause">⏸</button>
        <button type="button" id="btn-forward" title="Forward 1 hour">⏭</button>
      </div>
      <input type="range" id="time-slider" class="time-slider" min="-100" max="100" step="1" value="0" />
      <div class="time-display" id="time-display"></div>
      <button type="button" id="btn-now" class="btn-now" title="Jump to current UTC time">Now</button>
      <button type="button" id="btn-live" class="btn-live active" title="Live real-time tracking">● LIVE</button>
      <div class="speed-controls">
        <span class="speed-label">Speed:</span>
        <div id="speed-buttons" class="speed-buttons"></div>
      </div>
    </div>
  `;

  const playBtn = container.querySelector('#btn-play') as HTMLButtonElement;
  const rewindBtn = container.querySelector('#btn-rewind') as HTMLButtonElement;
  const forwardBtn = container.querySelector('#btn-forward') as HTMLButtonElement;
  const nowBtn = container.querySelector('#btn-now') as HTMLButtonElement;
  const liveBtn = container.querySelector('#btn-live') as HTMLButtonElement;
  const slider = container.querySelector('#time-slider') as HTMLInputElement;
  const speedButtons = container.querySelector('#speed-buttons')!;

  speedButtons.innerHTML = SPEEDS.map(
    (s) => `<button type="button" class="speed-btn" data-speed="${s}">${s}x</button>`,
  ).join('');

  let anchorTime = Date.now();

  playBtn.addEventListener('click', () => {
    const verifying = isConjunctionVerificationActive();
    if (verifying) {
      const vt = getVerificationTimeState();
      setVerificationPartial({ playing: !vt?.playing });
      return;
    }
    const { playing } = getState().time;
    setTimePartial({ playing: !playing });
  });

  rewindBtn.addEventListener('click', () => {
    const { time } = getState();
    if (isConjunctionVerificationActive()) {
      const vt = getVerificationTimeState();
      if (!vt) return;
      setVerificationPartial({ currentMs: vt.currentMs - 3600_000 });
      return;
    }
    const base = time.mode === 'live' ? Date.now() : time.current.getTime();
    enterHistoricalMode({
      current: new Date(base - 3600_000),
      playing: time.playing,
    });
    anchorTime = getState().time.current.getTime();
    slider.value = '0';
  });

  forwardBtn.addEventListener('click', () => {
    const { time } = getState();
    if (isConjunctionVerificationActive()) {
      const vt = getVerificationTimeState();
      if (!vt) return;
      setVerificationPartial({ currentMs: vt.currentMs + 3600_000 });
      return;
    }
    const base = time.mode === 'live' ? Date.now() : time.current.getTime();
    enterHistoricalMode({
      current: new Date(base + 3600_000),
      playing: time.playing,
    });
    anchorTime = getState().time.current.getTime();
    slider.value = '0';
  });

  liveBtn.addEventListener('click', () => {
    enterLiveMode();
    anchorTime = Date.now();
    slider.value = '0';
  });

  nowBtn.addEventListener('click', () => {
    jumpToNow();
    anchorTime = Date.now();
    slider.value = '0';
  });

  slider.addEventListener('input', () => {
    const offset = (parseFloat(slider.value) / 100) * SLIDER_RANGE_MS;
    const { time } = getState();

    if (isConjunctionVerificationActive()) {
      const vt = getVerificationTimeState();
      if (!vt) return;
      setVerificationPartial({ currentMs: vt.cpaTimeMs + offset });
      return;
    }

    if (time.mode === 'live') {
      anchorTime = Date.now();
    }

    enterHistoricalMode({
      current: new Date(anchorTime + offset),
      playing: time.playing,
    });
  });

  speedButtons.querySelectorAll('.speed-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const speed = parseInt((btn as HTMLButtonElement).dataset.speed!, 10);
      const { time } = getState();

      if (isConjunctionVerificationActive()) {
        // Verification starts paused by design (T-60s preview before the
        // user commits to watching it play out). Picking a speed is a clear
        // signal of intent to watch it run — auto-resume so the objects
        // actually move, instead of silently changing a speed that has no
        // effect until Play is pressed separately.
        setVerificationPartial({ speed, playing: true });
        return;
      }

      if (time.mode === 'live') {
        if (speed === 1) return;
        enterHistoricalMode({
          current: new Date(),
          speed,
          playing: time.playing,
        });
        anchorTime = Date.now();
        slider.value = '0';
        return;
      }

      enterHistoricalMode({ speed, playing: time.playing });
    });
  });

  let wasVerifying = false;

  subscribe(() => {
    const { time } = getState();
    const verifying = isConjunctionVerificationActive();
    const vt = getVerificationTimeState();
    const isLive =
      (time.mode === 'live' && !verifying) ||
      (verifying && isVerificationPlaying() && (vt?.speed ?? 1) === 1);

    if (wasVerifying && !verifying) {
      anchorTime = Date.now();
      slider.value = '0';
    }
    wasVerifying = verifying;

    playBtn.textContent = (verifying ? vt?.playing : time.playing) ? '⏸' : '▶';

    liveBtn.classList.toggle('active', isLive);
    liveBtn.textContent = verifying ? '● VERIFY' : isLive ? '● LIVE' : 'LIVE';

    speedButtons.querySelectorAll('.speed-btn').forEach((btn) => {
      const speed = parseInt((btn as HTMLButtonElement).dataset.speed!, 10);
      const el = btn as HTMLButtonElement;
      const activeSpeed = verifying ? vt?.speed ?? 1 : time.mode === 'live' ? 1 : time.speed;
      el.classList.toggle('active', speed === activeSpeed);
    });

    slider.classList.toggle('time-slider--live', time.mode === 'live' && !verifying);
  });

  const display = container.querySelector('#time-display')!;
  const refreshTimeDisplay = (): void => {
    const { time } = getState();
    const verifying = isConjunctionVerificationActive();
    const isLive = time.mode === 'live' && !verifying;
    const displayTime = verifying || time.mode === 'historical'
      ? getSimulationTime()
      : new Date();
    display.textContent = formatUtcDateTime(displayTime);
    display.classList.toggle('time-display--live', isLive);
    display.classList.toggle('time-display--verify', verifying);
    requestAnimationFrame(refreshTimeDisplay);
  };
  requestAnimationFrame(refreshTimeDisplay);
}
