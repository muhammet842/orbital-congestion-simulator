export function createLayout(root: HTMLElement): {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  sceneContainer: HTMLElement;
  timeBar: HTMLElement;
} {
  root.innerHTML = `
    <div class="app-grid">
      <header class="app-header">
        <div class="header-title">
          <span class="header-icon">🛰</span>
          Orbital Congestion Simulator
        </div>
        <a class="header-link" href="https://github.com" target="_blank" rel="noopener noreferrer">
          GitHub ↗
        </a>
      </header>
      <aside id="left-panel" class="panel panel-left"></aside>
      <main id="scene-container" class="scene-container"></main>
      <aside id="right-panel" class="panel panel-right"></aside>
      <footer id="time-bar" class="time-bar"></footer>
    </div>
  `;

  return {
    leftPanel: root.querySelector('#left-panel')!,
    rightPanel: root.querySelector('#right-panel')!,
    sceneContainer: root.querySelector('#scene-container')!,
    timeBar: root.querySelector('#time-bar')!,
  };
}
