import { resolveSatcatOwner } from './satcatOwnerMap.mjs';

export const SATCAT_CSV_URL = 'https://celestrak.org/pub/satcat.csv';

export function splitCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

export function parseSatcatOwnerByNorad(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return new Map();

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toUpperCase());
  const noradIdx = header.indexOf('NORAD_CAT_ID');
  const ownerIdx = header.indexOf('OWNER');
  if (noradIdx < 0 || ownerIdx < 0) {
    throw new Error('satcat.csv missing NORAD_CAT_ID or OWNER column');
  }

  /** @type {Map<number, string>} */
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const norad = Number.parseInt(cols[noradIdx], 10);
    const owner = (cols[ownerIdx] ?? '').trim();
    if (!Number.isFinite(norad) || norad <= 0 || !owner) continue;
    map.set(norad, owner);
  }
  return map;
}

export function applySatcatOwners(seen, ownerByNorad) {
  let matched = 0;
  let unmatched = 0;
  let withOwner = 0;

  for (const obj of seen.values()) {
    const code = ownerByNorad.get(obj.noradId);
    if (!code) {
      unmatched++;
      continue;
    }

    const resolved = resolveSatcatOwner(code);
    if (!resolved) {
      unmatched++;
      continue;
    }

    obj.country = resolved.country;
    if (resolved.owner) {
      obj.owner = resolved.owner;
      withOwner++;
    } else {
      delete obj.owner;
    }
    matched++;
  }

  return { matched, unmatched, withOwner };
}

export async function fetchSatcatOwnerMap(fetchImpl = fetch, opts = {}) {
  const response = await fetchImpl(SATCAT_CSV_URL, {
    headers: {
      Accept: 'text/csv,*/*',
      ...(opts.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${SATCAT_CSV_URL}`);
  }
  const text = await response.text();
  return parseSatcatOwnerByNorad(text);
}
