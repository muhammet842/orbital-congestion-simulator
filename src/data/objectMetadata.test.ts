import { describe, expect, it } from 'vitest';
import { enrichRecord, inferMetadata, isTurkishSatellite } from './objectMetadata';

describe('inferMetadata', () => {
  it('prioritizes the featured NORAD ID override above name matching', () => {
    // 41875 = GOKTURK-1, hardcoded in FEATURED_OVERRIDES regardless of name text.
    expect(inferMetadata('SOME UNRELATED NAME', 'active', 41875)).toEqual({
      country: 'Türkiye 🇹🇷',
      owner: 'TSK / TAI',
    });
  });

  it('matches well-known constellations by name', () => {
    expect(inferMetadata('STARLINK-3938', 'active', 999999)).toEqual({
      country: 'USA 🇺🇸',
      owner: 'SpaceX',
    });
  });

  it('falls back to an unclassified operator for unrecognized active satellites', () => {
    expect(inferMetadata('RANDOM-SAT-9999', 'active', 999999)).toEqual({
      country: 'Unknown 🌐',
      owner: 'Commercial / state operator (unclassified)',
    });
  });

  it('falls back to a generic catalogued fragment for unrecognized debris', () => {
    expect(inferMetadata('UNKNOWN FRAGMENT', 'debris', 999999)).toEqual({
      country: 'Unknown 🌐',
      owner: 'Catalogued debris fragment',
    });
  });

  it('attributes Russian-named debris to Roscosmos via the generic name rule', () => {
    // Note: the debris-specific "COSMOS 2251 (collision debris)" branch in
    // inferMetadata is currently unreachable — any name containing "COSMOS"
    // is already intercepted by the broader NAME_RULES entry first.
    expect(inferMetadata('COSMOS 2251 DEB', 'debris', 1)).toEqual({
      country: 'Russia 🇷🇺',
      owner: 'Roscosmos',
    });
  });

  it('gives stations a default international attribution when unmatched', () => {
    expect(inferMetadata('UNKNOWN STATION MODULE', 'stations', 999999)).toEqual({
      country: 'International 🌍',
      owner: 'Space Agency Consortium',
    });
  });
});

describe('isTurkishSatellite', () => {
  it('recognizes the Turkish flag label', () => {
    expect(isTurkishSatellite('Türkiye 🇹🇷')).toBe(true);
  });

  it('recognizes the English spelling', () => {
    expect(isTurkishSatellite('Turkey')).toBe(true);
  });

  it('rejects other countries', () => {
    expect(isTurkishSatellite('USA 🇺🇸')).toBe(false);
    expect(isTurkishSatellite('')).toBe(false);
  });
});

describe('enrichRecord', () => {
  it('infers country/owner when the record has none', () => {
    const record = { name: 'STARLINK-3938', category: 'active' as const, noradId: 1 };
    const enriched = enrichRecord(record);
    expect(enriched.country).toBe('USA 🇺🇸');
    expect(enriched.owner).toBe('SpaceX');
  });

  it('preserves an existing non-empty country/owner instead of overriding it', () => {
    const record = {
      name: 'STARLINK-3938',
      category: 'active' as const,
      noradId: 1,
      country: 'Custom Country',
      owner: 'Custom Owner',
    };
    const enriched = enrichRecord(record);
    expect(enriched.country).toBe('Custom Country');
    expect(enriched.owner).toBe('Custom Owner');
  });

  it('treats a blank/whitespace-only country as missing and infers instead', () => {
    const record = {
      name: 'STARLINK-3938',
      category: 'active' as const,
      noradId: 1,
      country: '   ',
      owner: '',
    };
    const enriched = enrichRecord(record);
    expect(enriched.country).toBe('USA 🇺🇸');
    expect(enriched.owner).toBe('SpaceX');
  });
});
