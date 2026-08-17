// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { initEventCards, HISTORICAL_EVENTS } from './EventCards';
import { setState } from '../state/appState';

/** Reset selection so cards render without a pre-selected event. */
function resetSelection(): void {
  setState({ selectedEventId: null, selectedIndex: null });
}

beforeEach(resetSelection);

describe('initEventCards – DOM smoke', () => {
  it('mounts without throwing', () => {
    const container = document.createElement('div');
    expect(() => initEventCards(container)).not.toThrow();
  });

  it('creates one .event-card button per historical event', () => {
    const container = document.createElement('div');
    initEventCards(container);
    const cards = container.querySelectorAll('.event-card');
    expect(cards.length).toBe(HISTORICAL_EVENTS.length);
  });

  it('creates the #event-accordion and .panel-heading elements', () => {
    const container = document.createElement('div');
    initEventCards(container);
    expect(container.querySelector('#event-accordion')).not.toBeNull();
    expect(container.querySelector('.panel-heading')).not.toBeNull();
  });

  it('every card button has a data-event-id that matches a known event', () => {
    const container = document.createElement('div');
    initEventCards(container);
    const knownIds = new Set(HISTORICAL_EVENTS.map((e) => e.id));
    const buttons = container.querySelectorAll<HTMLElement>('[data-event-id]');
    for (const btn of buttons) {
      expect(knownIds.has(btn.dataset.eventId!)).toBe(true);
    }
  });

  it('cards appear in the same order as HISTORICAL_EVENTS', () => {
    const container = document.createElement('div');
    initEventCards(container);
    const rendered = Array.from(
      container.querySelectorAll<HTMLElement>('[data-event-id]'),
    ).map((btn) => btn.dataset.eventId);
    const expected = HISTORICAL_EVENTS.map((e) => e.id);
    expect(rendered).toEqual(expected);
  });

  it('no card has the active class when nothing is selected', () => {
    const container = document.createElement('div');
    initEventCards(container);
    const activeCards = container.querySelectorAll('.event-card--active');
    expect(activeCards.length).toBe(0);
  });

  it('each event type badge has the correct class suffix', () => {
    const container = document.createElement('div');
    initEventCards(container);
    for (const event of HISTORICAL_EVENTS) {
      const badge = container.querySelector<HTMLElement>(
        `[data-event-id="${event.id}"] .event-type-badge`,
      );
      expect(badge, `badge for ${event.id}`).not.toBeNull();
      expect(badge!.classList.contains(`event-type-badge--${event.eventType}`)).toBe(true);
    }
  });

  it('marks Iridium–Cosmos as the featured story', () => {
    const container = document.createElement('div');
    initEventCards(container);
    const featured = container.querySelector('[data-event-id="iridium-cosmos"]');
    expect(featured?.classList.contains('event-card--featured')).toBe(true);
    expect(container.querySelector('.event-card-kicker')).not.toBeNull();
    expect(container.querySelector('.panel-lede')).not.toBeNull();
  });
});
