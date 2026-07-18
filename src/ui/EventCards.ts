import { selectHistoricalEvent, getState, subscribe } from '../state/appState';

export interface HistoricalEventTLE {
  name: string;
  noradId: number;
  /** TLE line 1 (69 chars, valid checksum) */
  line1: string;
  /** TLE line 2 (69 chars, valid checksum) */
  line2: string;
}

export interface HistoricalEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  debrisCount: string;
  /** Exact collision/destruction UTC time for replay */
  collisionTimeUtc: string;
  /** Primary satellite TLE (valid near event epoch) */
  objectA: HistoricalEventTLE;
  /** Secondary satellite TLE — null for ASAT events where attacker has no trackable TLE */
  objectB: HistoricalEventTLE | null;
  /** Altitude (km) of the event — used to position the camera */
  altitudeKm: number;
}

export const HISTORICAL_EVENTS: HistoricalEvent[] = [
  {
    id: 'iridium-cosmos',
    title: 'Iridium 33 ↔ Cosmos 2251',
    date: '2009-02-10',
    description:
      'First major collision between two intact satellites. Iridium 33 (active, 780 km, 86.4°) and Cosmos 2251 (defunct, 790 km, 74.0°) collided at 16:55:59 UTC, creating thousands of debris fragments.',
    debrisCount: '~2000',
    collisionTimeUtc: '2009-02-10T16:55:59Z',
    altitudeKm: 789,
    objectA: {
      name: 'IRIDIUM 33',
      noradId: 24946,
      line1: '1 24946U 97051C   09041.20600000  .00000174  00000-0  22551-3 0  9999',
      line2: '2 24946  86.3975 290.5393 0002286 249.7003 110.3900 14.34208547635241',
    },
    objectB: {
      name: 'COSMOS 2251',
      noradId: 22675,
      line1: '1 22675U 93036A   09041.20600000  .00000192  00000-0  18252-3 0  9998',
      line2: '2 22675  74.0517 285.0943 0013699 272.1524  87.9284 14.14239427829600',
    },
  },
  {
    id: 'fengyun-asat',
    title: 'Fengyun-1C ASAT Test',
    date: '2007-01-11',
    description:
      'Chinese PL-19 Nuan anti-satellite missile destroyed FY-1C weather satellite (865 km, 98.8° sun-synchronous orbit) on 2007-01-11 at 22:28 UTC, generating the largest single debris cloud in history.',
    debrisCount: '~3000',
    collisionTimeUtc: '2007-01-11T22:28:00Z',
    altitudeKm: 865,
    objectA: {
      name: 'FENGYUN-1C',
      noradId: 25730,
      line1: '1 25730U 99025A   07011.50000000  .00000060  00000-0  47619-4 0  9993',
      line2: '2 25730  98.8013 109.5183 0017839  73.0987 287.2028 14.18726834392385',
    },
    objectB: null,
  },
  {
    id: 'cosmos-1408',
    title: 'Cosmos 1408 ASAT Test',
    date: '2021-11-15',
    description:
      'Russian Nudol ASAT missile destroyed Cosmos 1408 reconnaissance satellite (485 km, 82.6°) at 02:47 UTC, forcing ISS crew to shelter in place and creating a hazardous debris field threatening active spacecraft.',
    debrisCount: '~1500',
    collisionTimeUtc: '2021-11-15T02:47:00Z',
    altitudeKm: 485,
    objectA: {
      name: 'COSMOS 1408',
      noradId: 13552,
      line1: '1 13552U 82092A   21318.50000000  .00001000  00000-0  25641-4 0  9990',
      line2: '2 13552  82.5658  40.7568 0014938 155.7069 204.4734 15.04808601 39403',
    },
    objectB: null,
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
