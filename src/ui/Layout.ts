import { getState, subscribe } from '../state/appState';
import { getLang, setLang, SUPPORTED_LANGS } from '../i18n/i18n';

/** Must match the max-width used for `.app-grid`'s mobile layout in style.css. */
export const MOBILE_BREAKPOINT_PX = 860;

export function createLayout(root: HTMLElement): {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  sceneContainer: HTMLElement;
  timeBar: HTMLElement;
} {
  root.innerHTML = `
    <div class="app-grid">
      <header class="app-header">
        <button id="toggle-left-panel" class="panel-toggle-btn" type="button" aria-label="Toggle filters &amp; stats panel" aria-expanded="false">☰</button>
        <div class="header-title">
          <span class="header-icon" aria-hidden="true">🛰</span>
          <span class="header-title-full">Orbital Congestion Simulator</span>
          <span class="header-title-short">Orbital Congestion</span>
        </div>
        <button id="toggle-right-panel" class="panel-toggle-btn" type="button" aria-label="Toggle object details panel" aria-expanded="false">ℹ</button>
        <select id="lang-select" class="lang-select" aria-label="Select language">
          ${SUPPORTED_LANGS.map((l) => `<option value="${l}"${l === getLang() ? ' selected' : ''}>${l.toUpperCase()}</option>`).join('')}
        </select>
        <a class="header-link" href="https://github.com" target="_blank" rel="noopener noreferrer">
          GitHub ↗
        </a>
      </header>
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
  setupLangSelect(root);

  return { leftPanel, rightPanel, sceneContainer, timeBar };
}

function setupLangSelect(root: HTMLElement): void {
  const select = root.querySelector<HTMLSelectElement>('#lang-select');
  if (!select) return;
  select.addEventListener('change', () => {
    setLang(select.value as Parameters<typeof setLang>[0]);
  });
}

function setupMobilePanelToggles(
  root: HTMLElement,
  leftPanel: HTMLElement,
  rightPanel: HTMLElement,
): void {
  const toggleLeftBtn = root.querySelector<HTMLButtonElement>('#toggle-left-panel')!;
  const toggleRightBtn = root.querySelector<HTMLButtonElement>('#toggle-right-panel')!;
  const backdrop = root.querySelector<HTMLElement>('#mobile-backdrop')!;
  const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);

  const isPanelOpen = (panel: HTMLElement): boolean => panel.classList.contains('panel--open');

  const closePanels = (): void => {
    leftPanel.classList.remove('panel--open');
    rightPanel.classList.remove('panel--open');
    backdrop.classList.remove('mobile-backdrop--visible');
    toggleLeftBtn.setAttribute('aria-expanded', 'false');
    toggleRightBtn.setAttribute('aria-expanded', 'false');
  };

  const openPanel = (panel: HTMLElement, btn: HTMLButtonElement): void => {
    leftPanel.classList.remove('panel--open');
    rightPanel.classList.remove('panel--open');
    toggleLeftBtn.setAttribute('aria-expanded', 'false');
    toggleRightBtn.setAttribute('aria-expanded', 'false');
    panel.classList.add('panel--open');
    btn.setAttribute('aria-expanded', 'true');
    backdrop.classList.add('mobile-backdrop--visible');
  };

  const togglePanel = (panel: HTMLElement, btn: HTMLButtonElement): void => {
    if (isPanelOpen(panel)) {
      closePanels();
    } else {
      openPanel(panel, btn);
    }
  };

  toggleLeftBtn.addEventListener('click', () => togglePanel(leftPanel, toggleLeftBtn));
  toggleRightBtn.addEventListener('click', () => togglePanel(rightPanel, toggleRightBtn));
  backdrop.addEventListener('click', closePanels);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanels();
  });

  // Selecting an object is the main mobile action that needs the (hidden by
  // default) right panel — surface it automatically instead of leaving the
  // user stuck looking at an empty globe.
  let lastSelectedIndex: number | null = null;
  subscribe(() => {
    const { selectedIndex } = getState();
    if (!mobileQuery.matches) {
      lastSelectedIndex = selectedIndex;
      return;
    }
    if (selectedIndex != null && selectedIndex !== lastSelectedIndex) {
      openPanel(rightPanel, toggleRightBtn);
    }
    lastSelectedIndex = selectedIndex;
  });

  mobileQuery.addEventListener('change', (e) => {
    if (!e.matches) closePanels();
  });
}
