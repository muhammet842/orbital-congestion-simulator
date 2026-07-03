import { selectHistoricalEvent, getState, subscribe } from '../state/appState';

export interface HistoricalEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  debrisCount: string;
}

export const HISTORICAL_EVENTS: HistoricalEvent[] = [
  {
    id: 'iridium-cosmos',
    title: 'Iridium 33 ↔ Cosmos 2251',
    date: '2009-02-10',
    description:
      'First major collision between two intact satellites. Created thousands of debris fragments and demonstrated the Kessler Syndrome risk.',
    debrisCount: '~2000',
  },
  {
    id: 'fengyun-asat',
    title: 'Fengyun-1C ASAT Test',
    date: '2007-01-11',
    description:
      'Chinese anti-satellite missile test destroyed FY-1C, generating the largest debris cloud in history at the time.',
    debrisCount: '~3000',
  },
  {
    id: 'cosmos-1408',
    title: 'Cosmos 1408 Destruction',
    date: '2021-11-15',
    description:
      'Russian ASAT test destroyed Cosmos 1408, forcing ISS crew to shelter in place.',
    debrisCount: '~1500',
  },
];

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
    <div class="event-accordion" id="event-accordion"></div>
  `;
  container.appendChild(section);

  const accordion = section.querySelector('#event-accordion')!;

  accordion.innerHTML = HISTORICAL_EVENTS.map(
    (event) => `
      <button
        type="button"
        class="event-card"
        data-event-id="${event.id}"
        aria-expanded="false"
      >
        <span class="event-card-title">${event.title}</span>
        <span class="event-card-date">${formatEventDate(event.date)}</span>
      </button>
    `,
  ).join('');

  accordion.querySelectorAll('.event-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.eventId!;
      selectHistoricalEvent(id);
    });
  });

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
  return HISTORICAL_EVENTS.find((e) => e.id === id);
}
