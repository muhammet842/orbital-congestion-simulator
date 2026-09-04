// Application bootstrap
import './style.css';
import { loadTleDataset, createTrackedObjects, computeStats } from './data/tleLoader';
import { getState, initState } from './state/appState';
import { SceneManager } from './scene/SceneManager';
import { createLayout } from './ui/Layout';
import { initLeftPanel } from './ui/LeftPanel';
import { initRightPanel } from './ui/RightPanel';
import { initTimeControls } from './ui/TimeControls';
import { initDeepLink } from './routing/deepLink';
import { initKesslerPanel } from './ui/KesslerPanel';
import { initHowToGuide } from './ui/HowToGuide';
import { findConjunctions } from './orbital/conjunction';
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

    // Deep linking
    initDeepLink(objects);

    // Future Projection panel
    initKesslerPanel();

    // First-visit walkthrough
    initHowToGuide();

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__debugConjunctions = (isoTime?: string) =>
        findConjunctions(getState().objects, isoTime ? new Date(isoTime) : new Date());
    }
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
