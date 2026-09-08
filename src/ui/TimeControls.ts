import {
  enterHistoricalMode,
  enterLiveMode,
  formatUtcDateTime,
  getSimulationTime,
  getState,
  jumpToNow,
  setTimePartial,
  subscribe,
} from '../state/appState';

const SPEEDS = [1, 10, 100];
const SLIDER_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

export function initTimeControls(container: HTMLElement): void {
  container.innerHTML = `
    <div class="time-controls">
      <div class="time-row time-row--transport">
        <div class="time-buttons">
          <button type="button" id="btn-rewind" title="Back 1 hour">⏮</button>
          <button type="button" id="btn-play" title="Play / Pause">⏸</button>
          <button type="button" id="btn-forward" title="Forward 1 hour">⏭</button>
        </div>
        <input type="range" id="time-slider" class="time-slider" min="-100" max="100" step="1" value="0" />
      </div>
      <div class="time-row time-row--meta">
        <div class="time-display" id="time-display"></div>
        <div class="time-mode-btns">
          <button type="button" id="btn-now" class="btn-now" title="Jump to current time">Now</button>
          <button type="button" id="btn-live" class="btn-live active" title="Switch to live mode">Live</button>
        </div>
        <div class="speed-controls">
          <span class="speed-label">Playback</span>
          <div id="speed-buttons" class="speed-buttons"></div>
        </div>
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
  const display = container.querySelector('#time-display')!;

  speedButtons.innerHTML = SPEEDS.map(
    (speed) => `<button type="button" class="speed-btn" data-speed="${speed}">${speed}x</button>`,
  ).join('');

  let anchorTime = Date.now();
  let sliderDragging = false;

  playBtn.addEventListener('click', () => {
    setTimePartial({ playing: !getState().time.playing });
  });

  const moveTime = (hours: number): void => {
    const { time } = getState();
    const base = time.mode === 'live' ? Date.now() : time.current.getTime();
    enterHistoricalMode({
      current: new Date(base + hours * 3600_000),
      playing: time.playing,
    });
    anchorTime = getState().time.current.getTime();
    slider.value = '0';
  };

  rewindBtn.addEventListener('click', () => moveTime(-1));
  forwardBtn.addEventListener('click', () => moveTime(1));

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

  slider.addEventListener('pointerdown', () => { sliderDragging = true; });
  const endSliderDrag = (): void => { sliderDragging = false; };
  slider.addEventListener('pointerup', endSliderDrag);
  slider.addEventListener('pointercancel', endSliderDrag);

  slider.addEventListener('input', () => {
    const { time } = getState();
    if (time.mode === 'live') anchorTime = Date.now();
    const offset = (parseFloat(slider.value) / 100) * SLIDER_RANGE_MS;
    enterHistoricalMode({ current: new Date(anchorTime + offset), playing: time.playing });
  });

  speedButtons.querySelectorAll('.speed-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const speed = parseInt((button as HTMLButtonElement).dataset.speed!, 10);
      const { time } = getState();
      if (time.mode === 'live' && speed !== 1) {
        enterHistoricalMode({ current: new Date(), speed, playing: time.playing });
        anchorTime = Date.now();
        slider.value = '0';
      } else if (time.mode === 'historical') {
        enterHistoricalMode({ speed, playing: time.playing });
      }
    });
  });

  subscribe(() => {
    const { time } = getState();
    const isLive = time.mode === 'live';
    playBtn.textContent = time.playing ? '⏸' : '▶';
    liveBtn.classList.toggle('active', isLive);
    liveBtn.textContent = isLive ? 'Live' : 'Historical';
    slider.classList.toggle('time-slider--live', isLive);
    speedButtons.querySelectorAll('.speed-btn').forEach((button) => {
      const speed = parseInt((button as HTMLButtonElement).dataset.speed!, 10);
      button.classList.toggle('active', speed === (isLive ? 1 : time.speed));
    });
  });

  const refreshTimeDisplay = (): void => {
    const { time } = getState();
    const isLive = time.mode === 'live';
    display.textContent = formatUtcDateTime(isLive ? new Date() : getSimulationTime());
    display.classList.toggle('time-display--live', isLive);
    if (!sliderDragging && !isLive) {
      const offset = getSimulationTime().getTime() - anchorTime;
      const value = Math.max(-100, Math.min(100, (offset / SLIDER_RANGE_MS) * 100));
      slider.value = String(Math.round(value));
    }
    requestAnimationFrame(refreshTimeDisplay);
  };
  requestAnimationFrame(refreshTimeDisplay);
}
