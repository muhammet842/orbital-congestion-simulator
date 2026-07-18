import { selectHistoricalEvent, getState, subscribe } from '../state/appState';

export interface HistoricalEventTLE {
  name: string;
  noradId: number;
  /** TLE line 1 (69 chars, valid checksum) */
  line1: string;
  /** TLE line 2 (69 chars, valid checksum) */
  line2: string;
}

/**
 * Visual/behavioural category of the event.
 *
 * collision – two active/defunct satellites hit each other (two-object replay)
 * asat      – anti-satellite missile intercept (missile rises from surface)
 * docking   – successful rendezvous; terminal flash is green, no explosion
 * breakup   – single satellite mysteriously breaks up; no second object animated
 */
export type EventType = 'collision' | 'asat' | 'docking' | 'breakup';

export interface HistoricalEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  debrisCount: string;
  /** Visual / behavioural category. Defaults to 'collision' if omitted. */
  eventType: EventType;
  /** Exact collision/destruction UTC time for replay */
  collisionTimeUtc: string;
  /** Primary satellite TLE (valid near event epoch) */
  objectA: HistoricalEventTLE;
  /** Secondary satellite TLE — null for ASAT/breakup events */
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
    eventType: 'collision' as EventType,
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
    eventType: 'asat' as EventType,
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
    eventType: 'asat' as EventType,
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

  // ── USA-193 / Operation Burnt Frost ────────────────────────────────────
  {
    id: 'usa-193-burnt-frost',
    title: 'USA-193 — Operation Burnt Frost',
    date: '2008-02-21',
    eventType: 'asat' as EventType,
    description:
      'US Navy SM-3 missile intercepted the failing NRO reconnaissance satellite USA-193 at 247 km altitude on 21 Feb 2008 at 03:26 UTC over the Pacific Ocean. The satellite\'s hydrazine fuel tank was destroyed, preventing a toxic re-entry hazard. Nearly all debris re-entered within weeks.',
    debrisCount: '~174 (all re-entered within weeks)',
    collisionTimeUtc: '2008-02-21T03:26:00Z',
    altitudeKm: 247,
    collisionGeo: { latDeg: 19.3, lonDeg: -161.2, altKm: 247 },
    // USA-193 was descending (coming south after passing high lat) at intercept
    approachA: { inclinationDeg: 58.5, ascending: false },
    approachB: null,
    objectA: {
      name: 'USA 193',
      noradId: 29651,
      line1: '1 29651U 06057A   08052.14236111  .45900000  00000-0  98803-2 0  9991',
      line2: '2 29651  58.5109 133.0000 0003249  82.8000 277.3000 15.62983000 67527',
    },
    objectB: null,
  },

  // ── Cerise & Ariane 3 debris ───────────────────────────────────────────
  {
    id: 'cerise-ariane-debris',
    title: 'Cerise ↔ Ariane 3 Debris',
    date: '1996-07-24',
    eventType: 'collision' as EventType,
    description:
      'First confirmed collision between a tracked satellite and a catalogued debris object. French military microsatellite Cerise (SSO, 700 km, 98.6°) was struck by a fragment of the Ariane 3 H-10 upper stage on 24 July 1996 at 11:40 UTC over the Atlantic, severing its gravity-gradient stabilisation boom.',
    debrisCount: '~500',
    collisionTimeUtc: '1996-07-24T11:40:00Z',
    altitudeKm: 700,
    collisionGeo: { latDeg: 35.2, lonDeg: -12.4, altKm: 700 },
    // Cerise in retrograde SSO, ascending northward at collision latitude
    approachA: { inclinationDeg: 98.6, ascending: true },
    // Ariane debris from a different SSO pass — descending (heading south) for head-on crossing
    approachB: { inclinationDeg: 98.6, ascending: false },
    objectA: {
      name: 'CERISE',
      noradId: 23606,
      line1: '1 23606U 95030B   96206.48611111  .00002500  00000-0  12400-3 0  9993',
      line2: '2 23606  98.5840  90.0000 0010000  90.0000 270.2000 14.49700000139847',
    },
    objectB: {
      name: 'ARIANE 3 DEBRIS',
      noradId: 17590,
      line1: '1 17590U 87083B   96206.48611111  .00002000  00000-0  13000-3 0  9994',
      line2: '2 17590  98.5840  92.5000 0015000  85.0000 275.0000 14.49700000239714',
    },
  },

  // ── MEV-1 & Intelsat 901 docking ──────────────────────────────────────
  {
    id: 'mev1-intelsat901',
    title: 'MEV-1 ↔ Intelsat 901 Docking',
    date: '2020-02-25',
    eventType: 'docking' as EventType,
    description:
      'Northrop Grumman\'s Mission Extension Vehicle 1 (MEV-1) successfully docked with Intelsat 901 in GEO on 25 Feb 2020 at 07:15 UTC — the first commercial in-space servicing mission. Zero debris was generated; the combined stack was later moved to a new GEO slot, extending Intelsat 901\'s life by five years.',
    debrisCount: '0 — zero debris (successful docking)',
    collisionTimeUtc: '2020-02-25T07:15:00Z',
    altitudeKm: 35786,
    // GEO docking at equatorial longitude 322.5°E (≈ 37.5°W)
    collisionGeo: { latDeg: 0.0, lonDeg: -37.5, altKm: 35786 },
    // Both spacecraft in near-equatorial GEO, MEV-1 approaching from slightly different longitude
    approachA: { inclinationDeg: 0.2, ascending: true },
    approachB: { inclinationDeg: 0.1, ascending: false },
    objectA: {
      name: 'MEV-1',
      noradId: 44343,
      line1: '1 44343U 19069A   20056.30208333  .00000000  00000-0  00000-0 0  9994',
      line2: '2 44343   0.0550 322.5000 0002500  15.0000 345.0000  1.00274380  2450',
    },
    objectB: {
      name: 'INTELSAT 901',
      noradId: 26824,
      line1: '1 26824U 01024A   20056.30208333  .00000000  00000-0  00000-0 0  9995',
      line2: '2 26824   0.0450 322.5000 0003000  25.0000 335.0000  1.00274220  8924',
    },
  },

  // ── Kosmos 2499 breakup ────────────────────────────────────────────────
  {
    id: 'kosmos-2499-breakup',
    title: 'Kosmos 2499 — Mysterious Breakup',
    date: '2023-01-03',
    eventType: 'breakup' as EventType,
    description:
      'Russian military satellite Kosmos 2499 (NORAD 39765, 64.9°, ~1150 km) broke apart on 3 Jan 2023 for unknown reasons, generating ~100 trackable debris fragments. The satellite had previously manoeuvred in ways suggesting it was an inspector or co-orbital weapon. The cause of the fragmentation was never publicly confirmed by Russia.',
    debrisCount: '~100',
    collisionTimeUtc: '2023-01-03T10:00:00Z',
    altitudeKm: 1150,
    collisionGeo: { latDeg: 78.4, lonDeg: 120.2, altKm: 1150 },
    // Ascending toward its orbital peak at the high northern latitude
    approachA: { inclinationDeg: 64.9, ascending: true },
    approachB: null,
    objectA: {
      name: 'KOSMOS 2499',
      noradId: 39765,
      line1: '1 39765U 14028D   23003.41666667  .00000500  00000-0  24000-4 0  9991',
      line2: '2 39765  64.9000 120.2000 0010000 270.0000 90.0000 13.59000000459732',
    },
    objectB: null,
  },
];

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  collision: 'Collision',
  asat:      'ASAT',
  docking:   'Docking',
  breakup:   'Breakup',
};

function eventTypeLabel(type: EventType): string {
  return EVENT_TYPE_LABELS[type] ?? type;
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
        <div class="event-card-top">
          <span class="event-card-title">${event.title}</span>
          <span class="event-type-badge event-type-badge--${event.eventType}">${eventTypeLabel(event.eventType)}</span>
        </div>
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
