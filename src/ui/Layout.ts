import { getState, subscribe } from '../state/appState';

export const MOBILE_BREAKPOINT_PX = 860;

export function createLayout(root: HTMLElement): {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  sceneContainer: HTMLElement;
  timeBar: HTMLElement;
} {
  root.innerHTML = `
    <div class="app-grid">
      <aside id="left-panel" class="panel panel-left"></aside>
      <main id="scene-container" class="scene-container"></main>
      <aside id="right-panel" class="panel panel-right"></aside>
      <div id="mobile-backdrop" class="mobile-backdrop"></div>
      <footer id="time-bar" class="time-bar"></footer>
    </div>
  `;

  const leftPanel = root.querySelector<HTMLElement>('#left-panel')!;
  const rightPanel = root.querySelector<HTMLElement>('#right-panel')!;
  const sceneContainer = root.querySelector<HTMLElement>('#scene-container')!;
  const timeBar = root.querySelector<HTMLElement>('#time-bar')!;

  setupMobilePanelToggles(root, leftPanel, rightPanel);

  return { leftPanel, rightPanel, sceneContainer, timeBar };
}

function setupMobilePanelToggles(
  root: HTMLElement,
  leftPanel: HTMLElement,
  rightPanel: HTMLElement,
): void {
  const backdrop = root.querySelector<HTMLElement>('#mobile-backdrop')!;
  const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);

  const closePanels = (): void => {
    leftPanel.classList.remove('panel--open');
    rightPanel.classList.remove('panel--open');
    backdrop.classList.remove('mobile-backdrop--visible');
  };

  const openPanel = (panel: HTMLElement): void => {
    leftPanel.classList.remove('panel--open');
    rightPanel.classList.remove('panel--open');
    panel.classList.add('panel--open');
    backdrop.classList.add('mobile-backdrop--visible');
  };

  backdrop.addEventListener('click', closePanels);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanels();
  });

  let lastSelectedIndex: number | null = null;
  subscribe(() => {
    const { selectedIndex } = getState();
    if (!mobileQuery.matches) {
      lastSelectedIndex = selectedIndex;
      return;
    }
    if (selectedIndex != null && selectedIndex !== lastSelectedIndex) {
      openPanel(rightPanel);
    }
    lastSelectedIndex = selectedIndex;
  });

  mobileQuery.addEventListener('change', (e) => {
    if (!e.matches) closePanels();
  });
}

export function isMobileLayout(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches
  );
}

export function setTourPanel(side: 'left' | 'right' | null): void {
  const leftPanel = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');
  const backdrop = document.getElementById('mobile-backdrop');
  if (!leftPanel || !rightPanel || !backdrop) return;

  leftPanel.classList.remove('panel--open');
  rightPanel.classList.remove('panel--open');
  backdrop.classList.remove('mobile-backdrop--visible');

  if (!isMobileLayout() || side == null) return;

  const panel = side === 'left' ? leftPanel : rightPanel;
  panel.classList.add('panel--open');
  backdrop.classList.add('mobile-backdrop--visible');
}