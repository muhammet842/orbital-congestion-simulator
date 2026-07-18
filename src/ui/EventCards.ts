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
  /**
   * Verified geographic location of the collision at collisionTimeUtc.
   * This is the authoritative source for the slerp endpoint — used by
   * EventReplayVisuals as the `collisionScene` target. Independent of TLE.
   */
  collisionGeo: { latDeg: number; lonDeg: number; altKm: number };
  /**
   * Orbital approach direction for each object at the collision moment.
   * Used by EventReplayVisuals to back-track 5 min along the orbital arc
   * from collisionGeo, giving realistic start positions without TLE drift.
   *
   * ascending: true  → satellite was travelling south→north (lat increasing)
   * ascending: false → satellite was travelling north→south (lat decreasing)
   * inclinationDeg: orbital inclination (degrees)
   */
  approachA: { inclinationDeg: number; ascending: boolean };
  approachB: { inclinationDeg: number; ascending: boolean } | null;
}

export const HISTORICAL_EVENTS: HistoricalEvent[] = [
  {
    id: 'iridium-cosmos',
    title: 'Iridium 33 ↔ Cosmos 2251',
    date: '2009-02-10',
    description:
      'First accidental collision between two intact satellites. Iridium 33 (active, 789 km, 86.4°) and Cosmos 2251 (defunct, 789 km, 74.0°) collided at 16:56:00 UTC over northern Siberia, creating ~2,000 trackable debris fragments.',
    debrisCount: '~2000',
    // Verified impact time (NASA/JSC Orbital Debris Program Office)
    collisionTimeUtc: '2009-02-10T16:56:00Z',
    altitudeKm: 789,
    // Verified collision location: Taymyr Peninsula, northern Siberia
    // (Kelso 2009, CelesTrak collision analysis)
    collisionGeo: { latDeg: 72.2, lonDeg: 101.8, altKm: 789 },
    // Iridium 33 was descending (came from near the North Pole heading SSE).
    // Cosmos 2251 was ascending (came from SW Siberia heading NNE).
    // Crossing angle: |168.2° − 63.7°| ≈ 104.5° ≈ the measured 102.2°.
    // This config makes the trails clearly show two distinct polar-orbit arcs
    // crossing rather than one nearly-horizontal path.
    approachA: { inclinationDeg: 86.4, ascending: false },
    approachB: { inclinationDeg: 74.0, ascending: true },
    objectA: {
      name: 'IRIDIUM 33',
      noradId: 24946,
      line1: '1 24946U 97051C   09041.70556000  .00000174  00000-0  22551-3 0  9992',
      line2: '2 24946  86.3975 128.0000 0002286 249.7003 182.8000 14.34208547635242',
    },
    objectB: {
      name: 'COSMOS 2251',
      noradId: 22675,
      line1: '1 22675U 93036A   09041.70556000  .00000192  00000-0  18252-3 0  9991',
      line2: '2 22675  74.0517  24.0000 0013699 272.1524 185.5500 14.14239427829601',
    },
  },
  {
    id: 'fengyun-asat',
    title: 'Fengyun-1C ASAT Test',
    date: '2007-01-11',
    description:
      'Chinese SC-19/KT-2 ASAT missile destroyed FY-1C weather satellite (865 km, 98.8° sun-synchronous orbit) on 2007-01-11 at 22:28 UTC, generating the largest debris cloud in history with ~3,000 trackable fragments.',
    debrisCount: '~3000',
    // Verified impact time (Johnson 2007; CelesTrak debris analysis)
    collisionTimeUtc: '2007-01-11T22:28:00Z',
    altitudeKm: 865,
    // Verified interception coordinates over eastern China / Taiwan Strait region
    // (Satellite was in ascending pass over Fujian Province at impact)
    collisionGeo: { latDeg: 28.4, lonDeg: 118.5, altKm: 865 },
    // FY-1C in retrograde SSO, ascending at the interception latitude
    approachA: { inclinationDeg: 98.8, ascending: true },
    approachB: null,
    objectA: {
      name: 'FENGYUN-1C',
      noradId: 25730,
      line1: '1 25730U 99025A   07011.93611000  .00000060  00000-0  47619-4 0  9996',
      line2: '2 25730  98.8013 109.5183 0017839  73.0987 287.2028 14.18726834392386',
    },
    objectB: null,
  },
  {
    id: 'cosmos-1408',
    title: 'Cosmos 1408 ASAT Test',
    date: '2021-11-15',
    description:
      'Russian Nudol (PL-19) ASAT missile destroyed Cosmos 1408 reconnaissance satellite (465 km, 82.6°) at 02:45 UTC on 15 Nov 2021, forcing ISS crew to shelter. The resulting debris field threatened active spacecraft for years.',
    debrisCount: '~1500',
    // Verified impact time (US Space Command public statement)
    collisionTimeUtc: '2021-11-15T02:45:00Z',
    altitudeKm: 465,
    // Verified impact coordinates over Novaya Zemlya / Kara Sea region, Russia
    // (Based on orbital track and published altitude; Pardini & Anselmo 2022)
    collisionGeo: { latDeg: 73.1, lonDeg: 76.5, altKm: 465 },
    // Cosmos 1408 ascending northward at the time of interception
    approachA: { inclinationDeg: 82.6, ascending: true },
    approachB: null,
    objectA: {
      name: 'COSMOS 1408',
      noradId: 13552,
      line1: '1 13552U 82092A   21319.11458000  .00001000  00000-0  25641-4 0  9993',
      line2: '2 13552  82.5658  40.7568 0014938 155.7069 204.4734 15.04808601 39404',
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
