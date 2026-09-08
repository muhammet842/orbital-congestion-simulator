
import './style.css';
import { loadTleDataset, createTrackedObjects, computeStats } from './data/tleLoader';
import { initState } from './state/appState';
import { SceneManager } from './scene/SceneManager';
import {
  createLayout,
  initLeftPanel,
  initRightPanel,
  initTimeControls,
} from './ui';
import { initDeepLink } from './routing/deepLink';

async function main(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;

  showLoading(app);

  try {
    showLoading(app, 'Loading catalog...');

    const dataset = await loadTleDataset();

    if (dataset.objects.length === 0) {
      showError(app, 'No satellites found in the catalog.');
      return;
    }

    const objects = createTrackedObjects(dataset);
    const stats = computeStats(objects, dataset.fetchedAt);
    initState(objects, stats);

    app.innerHTML = '';
    const { leftPanel, rightPanel, sceneContainer, timeBar } = createLayout(app);
    initLeftPanel(leftPanel);
    initRightPanel(rightPanel);
    initTimeControls(timeBar);

    const sceneManager = new SceneManager(sceneContainer);
    sceneManager.initOrbitalMeshes(objects);
    sceneManager.start();

    initDeepLink(objects);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load simulator data.';
    showError(app, message);
    console.error(err);
  }
}

function showLoading(app: HTMLElement, message = 'Loading catalog...'): void {
  app.innerHTML = `
    <div class="loading-screen">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function showError(app: HTMLElement, message: string): void {
  app.innerHTML = `
    <div class="error-screen">
      <h1>System Offline</h1>
      <p class="muted">${escapeHtml(message)}</p>
      <p class="muted">Check your connection or try refreshing the page.</p>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

main();
