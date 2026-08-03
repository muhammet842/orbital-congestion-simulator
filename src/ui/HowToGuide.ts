import { applyTranslations, onLangChange, setLang, SUPPORTED_LANGS, t, type Lang } from '../i18n/i18n';
import { closeKesslerPanel, openKesslerPanel } from './KesslerPanel';
import { setTourPanel } from './Layout';

const LS_HELP_SEEN = 'orbital-help-seen-v2';

const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  tr: 'Türkçe',
  de: 'Deutsch',
  ru: 'Русский',
  zh: '中文',
};

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
type Phase = 'lang' | 'tour';

interface StepConfig {
  id: StepId;
  target: string;
  panel: 'left' | 'right' | null;
  openKessler?: boolean;
}

const STEP_CONFIG: StepConfig[] = [
  { id: 'globe', target: '#scene-container', panel: null },
  { id: 'search', target: '#tour-region-search', panel: 'left' },
  { id: 'details', target: '#right-panel', panel: 'right' },
  { id: 'approaches', target: '#tour-region-approaches', panel: 'left' },
  { id: 'events', target: '.event-cards', panel: 'left' },
  { id: 'time', target: '#time-bar', panel: null },
  { id: 'projection', target: '#kessler-panel', panel: null, openKessler: true },
];

let rootEl: HTMLElement | null = null;
let phase: Phase = 'lang';
let stepIndex = 0;
let langUnsub: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let repositionRaf = 0;

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

function syncLangSelect(lang: Lang): void {
  const select = document.querySelector<HTMLSelectElement>('#lang-select');
  if (select) select.value = lang;
}

function handleEsc(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  e.stopPropagation();
  dismissHowToGuide();
}

function cleanupStepSideEffects(): void {
  closeKesslerPanel();
  setTourPanel(null);
  document.querySelectorAll('.tour-target--lit').forEach((el) => {
    el.classList.remove('tour-target--lit');
  });
}

export function closeHowToGuide(): void {
  document.removeEventListener('keydown', handleEsc, true);
  window.removeEventListener('resize', scheduleReposition);
  window.removeEventListener('scroll', scheduleReposition, true);
  if (repositionRaf) cancelAnimationFrame(repositionRaf);
  repositionRaf = 0;
  resizeObserver?.disconnect();
  resizeObserver = null;
  langUnsub?.();
  langUnsub = null;
  cleanupStepSideEffects();
  rootEl?.remove();
  rootEl = null;
}

function dismissHowToGuide(): void {
  markGuideSeen();
  closeHowToGuide();
}

export function isHowToGuideOpen(): boolean {
  return rootEl != null;
}

function ensureRoot(): HTMLElement {
  if (rootEl) return rootEl;
  const root = document.createElement('div');
  root.id = 'help-tour-root';
  root.className = 'tour-root';
  root.innerHTML = `
    <div class="tour-dim" id="tour-dim" aria-hidden="true"></div>
    <div class="tour-pad" id="tour-pad-top" aria-hidden="true"></div>
    <div class="tour-pad" id="tour-pad-left" aria-hidden="true"></div>
    <div class="tour-pad" id="tour-pad-right" aria-hidden="true"></div>
    <div class="tour-pad" id="tour-pad-bottom" aria-hidden="true"></div>
    <div class="tour-highlight" id="tour-highlight" aria-hidden="true"></div>
    <div class="tour-card" id="tour-card" role="dialog" aria-modal="true"></div>
  `;
  document.body.appendChild(root);
  rootEl = root;
  document.addEventListener('keydown', handleEsc, true);
  window.addEventListener('resize', scheduleReposition);
  window.addEventListener('scroll', scheduleReposition, true);
  return root;
}

function scheduleReposition(): void {
  if (!rootEl || phase !== 'tour') return;
  if (repositionRaf) cancelAnimationFrame(repositionRaf);
  repositionRaf = requestAnimationFrame(() => {
    repositionRaf = 0;
    positionHighlightAndCard();
  });
}

function prepareStep(config: StepConfig): HTMLElement | null {
  cleanupStepSideEffects();
  if (config.panel) setTourPanel(config.panel);
  if (config.openKessler) openKesslerPanel();

  const target = document.querySelector<HTMLElement>(config.target);
  if (!target) return null;

  target.classList.add('tour-target--lit');
  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
  return target;
}

function setPadsHidden(hidden: boolean): void {
  if (!rootEl) return;
  for (const id of ['tour-pad-top', 'tour-pad-left', 'tour-pad-right', 'tour-pad-bottom']) {
    const el = rootEl.querySelector<HTMLElement>(`#${id}`);
    if (el) el.hidden = hidden;
  }
}

function layoutPads(hole: { top: number; left: number; width: number; height: number }): void {
  if (!rootEl) return;
  const top = rootEl.querySelector<HTMLElement>('#tour-pad-top')!;
  const left = rootEl.querySelector<HTMLElement>('#tour-pad-left')!;
  const right = rootEl.querySelector<HTMLElement>('#tour-pad-right')!;
  const bottom = rootEl.querySelector<HTMLElement>('#tour-pad-bottom')!;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const holeBottom = hole.top + hole.height;
  const holeRight = hole.left + hole.width;

  setPadsHidden(false);
  Object.assign(top.style, { top: '0px', left: '0px', width: `${vw}px`, height: `${Math.max(0, hole.top)}px` });
  Object.assign(bottom.style, {
    top: `${holeBottom}px`,
    left: '0px',
    width: `${vw}px`,
    height: `${Math.max(0, vh - holeBottom)}px`,
  });
  Object.assign(left.style, {
    top: `${hole.top}px`,
    left: '0px',
    width: `${Math.max(0, hole.left)}px`,
    height: `${hole.height}px`,
  });
  Object.assign(right.style, {
    top: `${hole.top}px`,
    left: `${holeRight}px`,
    width: `${Math.max(0, vw - holeRight)}px`,
    height: `${hole.height}px`,
  });
}

function positionHighlightAndCard(): void {
  if (!rootEl || phase !== 'tour') return;
  const config = STEP_CONFIG[stepIndex];
  if (!config) return;

  const highlight = rootEl.querySelector<HTMLElement>('#tour-highlight');
  const card = rootEl.querySelector<HTMLElement>('#tour-card');
  const dim = rootEl.querySelector<HTMLElement>('#tour-dim');
  if (!highlight || !card || !dim) return;

  const target = document.querySelector<HTMLElement>(config.target);
  if (!target) {
    highlight.hidden = true;
    setPadsHidden(true);
    dim.classList.add('tour-dim--full');
    placeCardCentered(card);
    return;
  }

  dim.classList.remove('tour-dim--full');
  highlight.hidden = false;

  const pad = 8;
  const rect = target.getBoundingClientRect();
  const top = Math.max(8, rect.top - pad);
  const left = Math.max(8, rect.left - pad);
  const width = Math.min(window.innerWidth - left - 8, rect.width + pad * 2);
  const height = Math.min(window.innerHeight - top - 8, rect.height + pad * 2);
  const hole = { top, left, width, height };

  highlight.style.top = `${top}px`;
  highlight.style.left = `${left}px`;
  highlight.style.width = `${width}px`;
  highlight.style.height = `${height}px`;
  layoutPads(hole);

  placeCardNear(card, hole);
}

function placeCardCentered(card: HTMLElement): void {
  card.classList.add('tour-card--center');
  card.style.top = '';
  card.style.left = '';
  card.style.bottom = '';
  card.style.right = '';
  card.style.transform = '';
}

function placeCardNear(
  card: HTMLElement,
  hole: { top: number; left: number; width: number; height: number },
): void {
  card.classList.remove('tour-card--center');
  card.style.transform = '';

  const margin = 14;
  const cardWidth = Math.min(360, window.innerWidth - 24);
  card.style.width = `${cardWidth}px`;

  // Measure after width is set.
  const cardHeight = Math.min(card.offsetHeight || 180, window.innerHeight - 24);
  const spaceBelow = window.innerHeight - (hole.top + hole.height);
  const spaceAbove = hole.top;
  const preferBelow = spaceBelow >= cardHeight + margin || spaceBelow >= spaceAbove;

  let top: number;
  if (preferBelow) {
    top = hole.top + hole.height + margin;
    if (top + cardHeight > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - cardHeight - 12);
    }
  } else {
    top = hole.top - cardHeight - margin;
    if (top < 12) top = 12;
  }

  let left = hole.left + hole.width / 2 - cardWidth / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - cardWidth - 12));

  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
  card.style.bottom = 'auto';
  card.style.right = 'auto';
}

function renderLangCard(card: HTMLElement): void {
  card.classList.add('tour-card--center');
  card.setAttribute('aria-label', 'Choose a language to continue');
  card.innerHTML = `
    <div class="tour-card-top">
      <button type="button" class="tour-skip" id="tour-skip">${escapeHtml('Skip')}</button>
    </div>
    <h2 class="tour-title" id="tour-title">Choose a language to continue</h2>
    <p class="tour-body">${escapeHtml('Pick a language — the walkthrough continues in that language.')}</p>
    <div class="tour-lang-grid" role="group" aria-label="Languages">
      ${SUPPORTED_LANGS.map(
        (lang) => `
        <button type="button" class="tour-lang-btn" data-lang="${lang}">
          <span class="tour-lang-native">${escapeHtml(LANG_LABELS[lang])}</span>
          <span class="tour-lang-code">${lang.toUpperCase()}</span>
        </button>`,
      ).join('')}
    </div>
  `;

  card.querySelector('#tour-skip')?.addEventListener('click', dismissHowToGuide);
  card.querySelectorAll<HTMLButtonElement>('.tour-lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang as Lang;
      setLang(lang);
      syncLangSelect(lang);
      applyTranslations(document);
      phase = 'tour';
      stepIndex = 0;
      renderTour();
    });
  });
}

function renderStepCard(card: HTMLElement): void {
  const config = STEP_CONFIG[stepIndex]!;
  const total = STEPS.length;
  const isLast = stepIndex >= total - 1;
  card.setAttribute('aria-label', t(`help.step.${config.id}.title`));
  card.innerHTML = `
    <div class="tour-card-top">
      <span class="tour-progress">${stepIndex + 1} / ${total}</span>
      <button type="button" class="tour-skip" id="tour-skip">${escapeHtml(t('help.skip'))}</button>
    </div>
    <h2 class="tour-title">${escapeHtml(t(`help.step.${config.id}.title`))}</h2>
    <p class="tour-body">${escapeHtml(t(`help.step.${config.id}.body`))}</p>
    <div class="tour-actions">
      <button type="button" class="tour-secondary-btn" id="tour-back" ${stepIndex === 0 ? 'disabled' : ''}>
        ${escapeHtml(t('help.back'))}
      </button>
      <button type="button" class="tour-primary-btn" id="tour-next">
        ${escapeHtml(isLast ? t('help.done') : t('help.next'))}
      </button>
    </div>
  `;

  card.querySelector('#tour-skip')?.addEventListener('click', dismissHowToGuide);
  card.querySelector('#tour-back')?.addEventListener('click', () => {
    if (stepIndex <= 0) return;
    stepIndex -= 1;
    renderTour();
  });
  card.querySelector('#tour-next')?.addEventListener('click', () => {
    if (isLast) {
      dismissHowToGuide();
      return;
    }
    stepIndex += 1;
    renderTour();
  });
}

function renderTour(): void {
  const root = ensureRoot();
  const card = root.querySelector<HTMLElement>('#tour-card')!;
  const highlight = root.querySelector<HTMLElement>('#tour-highlight')!;
  const dim = root.querySelector<HTMLElement>('#tour-dim')!;

  resizeObserver?.disconnect();
  resizeObserver = null;

  if (phase === 'lang') {
    cleanupStepSideEffects();
    highlight.hidden = true;
    setPadsHidden(true);
    dim.classList.add('tour-dim--full');
    renderLangCard(card);
    requestAnimationFrame(() => {
      card.querySelector<HTMLButtonElement>('.tour-lang-btn')?.focus();
    });
    return;
  }

  dim.classList.remove('tour-dim--full');
  const config = STEP_CONFIG[stepIndex]!;
  const target = prepareStep(config);
  renderStepCard(card);

  // Allow layout (panel open / Kessler) to settle, then place the spotlight.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      positionHighlightAndCard();
      if (target && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => scheduleReposition());
        resizeObserver.observe(target);
      }
      card.querySelector<HTMLButtonElement>('#tour-next')?.focus();
    });
  });
}

/** Start guided tour. First-visit and reopen both begin with language choice. */
export function openHowToGuide(): void {
  if (rootEl) return;
  phase = 'lang';
  stepIndex = 0;
  renderTour();

  langUnsub = onLangChange(() => {
    if (!rootEl || phase !== 'tour') return;
    renderStepCard(rootEl.querySelector<HTMLElement>('#tour-card')!);
    scheduleReposition();
  });
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

  onLangChange(refreshLabel);

  if (!hasSeenGuide()) {
    window.setTimeout(() => {
      if (!hasSeenGuide() && !rootEl) openHowToGuide();
    }, 700);
  }
}
