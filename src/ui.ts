import { getState, selectHistoricalEvent, subscribe } from './state/appState';

export interface HistoricalEventTLE {
  name: string;
  noradId: number;
  line1: string;
  line2: string;
}

export type EventType = 'collision' | 'asat' | 'docking' | 'breakup';

export interface HistoricalEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  debrisCount: string;
  eventType: EventType;
  collisionTimeUtc: string;
  objectA: HistoricalEventTLE;
  objectB: HistoricalEventTLE | null;
  altitudeKm: number;
  collisionGeo: { latDeg: number; lonDeg: number; altKm: number };
  approachA: { inclinationDeg: number; ascending: boolean };
  approachB: { inclinationDeg: number; ascending: boolean } | null;
  info: { title: string; reason: string; outcome: string };
}

export const FEATURED_HISTORICAL_EVENT_ID = 'iridium-cosmos';
export let HISTORICAL_EVENTS: HistoricalEvent[] = [];

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  collision: 'Collision',
  asat: 'ASAT',
  docking: 'Docking',
  breakup: 'Breakup',
};

export async function loadHistoricalEvents(): Promise<void> {
  const response = await fetch('/events.json');
  if (!response.ok) throw new Error(`Failed to load historical events (${response.status}).`);
  HISTORICAL_EVENTS = (await response.json()) as HistoricalEvent[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEventDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function initEventCards(container: HTMLElement): void {
  const section = document.createElement('div');
  section.className = 'event-cards';
  section.innerHTML = `
    <h2 class="panel-heading">Historical Events</h2>
    <p class="panel-lede">Replay the most significant orbital collisions and anti-satellite tests in space history.</p>
    <div class="event-accordion" id="event-accordion"></div>
  `;
  container.appendChild(section);

  const accordion = section.querySelector('#event-accordion')!;
  const renderCards = (): void => {
    const { selectedEventId } = getState();
    accordion.innerHTML = HISTORICAL_EVENTS.map((event) => `
      <button type="button"
        class="event-card${event.id === selectedEventId ? ' event-card--active' : ''}${event.id === FEATURED_HISTORICAL_EVENT_ID ? ' event-card--featured' : ''}"
        data-event-id="${event.id}"
        aria-expanded="${String(event.id === selectedEventId)}">
        <div class="event-card-top">
          <span class="event-card-title">${escapeHtml(event.title)}</span>
          <span class="event-card-type">${EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}</span>
        </div>
        <span class="event-card-date">${formatEventDate(event.date)}</span>
      </button>
    `).join('');

    accordion.querySelectorAll('.event-card').forEach((btn) => {
      btn.addEventListener('click', () => selectHistoricalEvent((btn as HTMLElement).dataset.eventId!));
    });
  };

  renderCards();
  subscribe(() => {
    const { selectedEventId } = getState();
    accordion.querySelectorAll('.event-card').forEach((btn) => {
      const id = (btn as HTMLElement).dataset.eventId;
      btn.classList.toggle('event-card--active', id === selectedEventId);
      btn.setAttribute('aria-expanded', String(id === selectedEventId));
    });
  });
}

export function getHistoricalEvent(id: string): HistoricalEvent | undefined {
  return HISTORICAL_EVENTS.find((event) => event.id === id);
}

export {
  createLayout,
  isMobileLayout,
  setTourPanel,
  MOBILE_BREAKPOINT_PX,
} from './ui/Layout';
export { initLeftPanel } from './ui/LeftPanel';
export { initRightPanel } from './ui/RightPanel';
export { initTimeControls } from './ui/TimeControls';
