import { t, onLangChange } from '../i18n/i18n';

const LS_HELP_SEEN = 'orbital-help-seen-v1';

const STEPS = [
  'globe',
  'search',
  'details',
  'approaches',
  'events',
  'time',
  'projection',
] as const;

type StepId = (typeof STEPS)[number];

let backdropEl: HTMLElement | null = null;

function hasSeenGuide(): boolean {
  try {
    return localStorage.getItem(LS_HELP_SEEN) === '1';
  } catch {
    return true;
  }
}

function markGuideSeen(): void {
  try {
    localStorage.setItem(LS_HELP_SEEN, '1');
  } catch {
    /* ignore */
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSteps(): string {
  return STEPS.map((id: StepId, index) => `
    <li class="help-step">
      <span class="help-step-num" aria-hidden="true">${index + 1}</span>
      <div class="help-step-body">
        <h3 class="help-step-title">${escapeHtml(t(`help.step.${id}.title`))}</h3>
        <p class="help-step-text">${escapeHtml(t(`help.step.${id}.body`))}</p>
      </div>
    </li>
  `).join('');
}

function renderPanelContent(panel: HTMLElement): void {
  panel.innerHTML = `
    <div class="ap-header">
      <div class="ap-logo"><span>${escapeHtml(t('help.title'))}</span></div>
      <button type="button" class="ap-close" id="help-close" aria-label="${escapeHtml(t('help.close'))}" title="${escapeHtml(t('help.close'))}">✕</button>
    </div>
    <div class="ap-body help-body">
      <p class="help-subtitle">${escapeHtml(t('help.subtitle'))}</p>
      <ol class="help-steps">
        ${renderSteps()}
      </ol>
      <div class="help-actions">
        <button type="button" class="help-primary-btn" id="help-got-it">${escapeHtml(t('help.got_it'))}</button>
      </div>
    </div>
  `;

  panel.querySelector('#help-close')?.addEventListener('click', dismissHowToGuide);
  panel.querySelector('#help-got-it')?.addEventListener('click', dismissHowToGuide);
}

function handleEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape') dismissHowToGuide();
}

function dismissHowToGuide(): void {
  markGuideSeen();
  closeHowToGuide();
}

export function openHowToGuide(): void {
  if (backdropEl) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'help-guide-backdrop';
  backdrop.className = 'admin-backdrop help-backdrop';

  const panel = document.createElement('div');
  panel.id = 'help-guide-panel';
  panel.className = 'admin-panel help-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', t('help.title'));

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
  backdropEl = backdrop;

  renderPanelContent(panel);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) dismissHowToGuide();
  });
  document.addEventListener('keydown', handleEsc);

  requestAnimationFrame(() => {
    panel.querySelector<HTMLButtonElement>('#help-got-it')?.focus();
  });
}

export function closeHowToGuide(): void {
  document.removeEventListener('keydown', handleEsc);
  backdropEl?.remove();
  backdropEl = null;
}

export function isHowToGuideOpen(): boolean {
  return backdropEl != null;
}

/** Header help button + first-visit auto-open. */
export function initHowToGuide(): void {
  const btn = document.createElement('button');
  btn.id = 'help-guide-btn';
  btn.className = 'help-header-btn';
  btn.type = 'button';
  btn.textContent = '?';

  const refreshLabel = (): void => {
    const label = t('help.button');
    btn.title = label;
    btn.setAttribute('aria-label', label);
  };
  refreshLabel();
  btn.addEventListener('click', openHowToGuide);

  const actions = document.getElementById('header-actions');
  const langSel = document.getElementById('lang-select');
  if (actions && langSel) {
    actions.insertBefore(btn, langSel.closest('.header-lang') ?? langSel);
  } else {
    document.querySelector('.app-header')?.appendChild(btn);
  }

  onLangChange(() => {
    refreshLabel();
    if (backdropEl) {
      const panel = backdropEl.querySelector<HTMLElement>('#help-guide-panel');
      if (panel) renderPanelContent(panel);
    }
  });

  if (!hasSeenGuide()) {
    window.setTimeout(() => {
      if (!hasSeenGuide()) openHowToGuide();
    }, 600);
  }
}
