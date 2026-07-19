import './style.css';
import { loadTleDataset, createTrackedObjects, computeStats } from './data/tleLoader';
import { initState } from './state/appState';
import { SceneManager } from './scene/SceneManager';
import { createLayout } from './ui/Layout';
import { initLeftPanel } from './ui/LeftPanel';
import { initRightPanel } from './ui/RightPanel';
import { initTimeControls } from './ui/TimeControls';
import { initDeepLink } from './routing/deepLink';

async function main(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;

  showLoading(app);

  try {
    showLoading(app, 'Loading orbital data…');

    const dataset = await loadTleDataset();

    if (dataset.objects.length === 0) {
      showError(app, 'No orbital objects loaded.');
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
    await sceneManager.initOrbitalMeshes(objects);
    sceneManager.start();

    // Deep linking: sync ?object=NORAD / ?event=ID ↔ app state.
    // Must run after the scene is ready so a linked satellite gets framed
    // correctly on first load.
    initDeepLink(objects);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load orbital data.';
    showError(app, message);
    console.error(err);
  }
}

function showLoading(app: HTMLElement, message = 'Loading orbital data…'): void {
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
      <h1>Unable to start simulator</h1>
      <p class="muted">${escapeHtml(message)}</p>
      <p class="muted">Run: <code>npm run fetch-tle</code></p>
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
