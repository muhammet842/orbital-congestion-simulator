import type { TrackedObject } from '../types';

export interface ObjectPhoto {
  url: string;
  credit: string;
}

interface CuratedPhoto {
  url: string;
  credit: string;
}

interface NamePhotoRule {
  pattern: RegExp;
  photo: CuratedPhoto;
}

const THUMB = (path: string, width = 330) => {
  const filename = path.split('/').pop()!;
  const thumbFile = filename.endsWith('.webp') ? `${width}px-${filename}.png` : `${width}px-${filename}`;
  return `/images/satellites/thumbs/${thumbFile}`;
};

const LOCAL = (filename: string): string => `/images/satellites/${filename}`;

const LOCAL_FALLBACK: CuratedPhoto = {
  url: '/images/satellite-fallback.svg',
  credit: 'Generic satellite render',
};

const PHOTO_GOKTURK1: CuratedPhoto = {
  url: LOCAL('gokturk-1.png'),
  credit: 'Telespazio / TAI (artist impression)',
};

const PHOTO_GOKTURK2: CuratedPhoto = {
  url: LOCAL('gokturk-2.png'),
  credit: 'TÜBİTAK UZAY / TAI (artist impression)',
};

const PHOTO_IMECE: CuratedPhoto = {
  url: LOCAL('imece.png'),
  credit: 'TÜBİTAK UZAY (artist impression)',
};

const PHOTO_TURKSAT_5A: CuratedPhoto = {
  url: LOCAL('turksat-5a.png'),
  credit: 'Airbus Defence and Space / Türksat A.Ş. (artist impression)',
};

const PHOTO_TURKSAT_5B: CuratedPhoto = {
  url: LOCAL('turksat-5b.png'),
  credit: 'Airbus Defence and Space / Türksat A.Ş. (artist impression)',
};

const PHOTO_TURKSAT_6A: CuratedPhoto = {
  url: LOCAL('turksat-6a.png'),
  credit: 'TAI / Türksat A.Ş. (artist impression)',
};

const NORAD_PHOTOS = new Map<number, CuratedPhoto>([
  [
    25544,
    {
      url: THUMB('5/59/The_station_pictured_from_the_SpaceX_Crew_Dragon_5.jpg'),
      credit: 'NASA / SpaceX / Wikimedia Commons',
    },
  ],
  [
    20580,
    {
      url: THUMB('8/8e/STS-109-HST-s109e5700.jpg'),
      credit: 'NASA / ESA / Wikimedia Commons',
    },
  ],
  [
    48274,
    {
      url: THUMB('2/25/Chinese_Tiangong_Space_Station.jpg'),
      credit: 'CMSA / Wikimedia Commons',
    },
  ],
  [41875, PHOTO_GOKTURK1],
  [39030, PHOTO_GOKTURK2],
  [56178, PHOTO_IMECE],
  [47306, PHOTO_TURKSAT_5A],
  [50212, PHOTO_TURKSAT_5B],
  [60233, PHOTO_TURKSAT_6A],
]);

const NAME_PHOTO_RULES: NamePhotoRule[] = [
  {
    pattern: /ISS\s*\(|^ISS$/i,
    photo: NORAD_PHOTOS.get(25544)!,
  },
  {
    pattern: /\bCSS\b|TIANGONG|TIANHE|WENTIAN|MENGTIAN/i,
    photo: NORAD_PHOTOS.get(48274)!,
  },
  {
    pattern: /\bHUBBLE\b|^HST$/i,
    photo: NORAD_PHOTOS.get(20580)!,
  },
  {
    pattern: /\bSTARLINK\b/i,
    photo: {
      url: THUMB('2/29/Starlink_01.webp'),
      credit: 'SpaceX / Wikimedia Commons (3D render)',
    },
  },
  {
    pattern: /\bCYGNUS\b/i,
    photo: {
      url: THUMB('1/17/Cygnus_Enhanced_spacecraft.jpg'),
      credit: 'Northrop Grumman / NASA / Wikimedia Commons',
    },
  },
  {
    pattern: /\bPROGRESS\b/i,
    photo: {
      url: THUMB('e/e7/Progress_spacecraft.jpg'),
      credit: 'Roscosmos / Wikimedia Commons (artist impression)',
    },
  },
  {
    pattern: /\b(CREW\s*)?DRAGON\b|\bSPX[- ]?CRS\b/i,
    photo: {
      url: THUMB('9/9e/CRS-20_Dragon%E2%80%93Enhanced.jpg'),
      credit: 'SpaceX / NASA / Wikimedia Commons',
    },
  },
  {
    pattern: /\bSOYUZ\b/i,
    photo: {
      url: THUMB('f/fa/Soyuz_MS.jpg'),
      credit: 'Roscosmos / NASA / Wikimedia Commons',
    },
  },
  {
    pattern: /\bSHENZHOU\b/i,
    photo: {
      url: THUMB('8/8c/Shenzhou_spacecraft_ground_test.png'),
      credit: 'CNSA / Wikimedia Commons',
    },
  },
  {
    pattern: /\bTIANZHOU\b/i,
    photo: {
      url: THUMB('c/c9/Tianzhou_Cargo_Spaceship.jpg'),
      credit: 'CNSA / Wikimedia Commons',
    },
  },
  {
    pattern: /GÖKTÜRK-1|GOKTURK-1/i,
    photo: PHOTO_GOKTURK1,
  },
  {
    pattern: /GÖKTÜRK-2|GOKTURK-2/i,
    photo: PHOTO_GOKTURK2,
  },
  {
    pattern: /GÖKTÜRK|GOKTURK/i,
    photo: PHOTO_GOKTURK2,
  },
  {
    pattern: /\bIMECE\b|\bİMECE\b/i,
    photo: PHOTO_IMECE,
  },
  {
    pattern: /TURKSAT\s*5A|TÜRKSAT\s*5A/i,
    photo: PHOTO_TURKSAT_5A,
  },
  {
    pattern: /TURKSAT\s*5B|TÜRKSAT\s*5B/i,
    photo: PHOTO_TURKSAT_5B,
  },
  {
    pattern: /TURKSAT\s*6A|TÜRKSAT\s*6A/i,
    photo: PHOTO_TURKSAT_6A,
  },
];

let photoRequestId = 0;

function getNamePhotoRule(obj: TrackedObject): CuratedPhoto | null {
  for (const rule of NAME_PHOTO_RULES) {
    if (rule.pattern.test(obj.name)) return rule.photo;
  }
  return null;
}

export function resolveObjectPhoto(obj: TrackedObject): ObjectPhoto | null {
  if (obj.category === 'debris') return null;

  const noradPhoto = NORAD_PHOTOS.get(obj.noradId);
  if (noradPhoto) return noradPhoto;

  const namePhoto = getNamePhotoRule(obj);
  if (namePhoto) return namePhoto;

  return LOCAL_FALLBACK;
}

function renderPhotoFigure(photo: ObjectPhoto, alt: string): string {
  return `
    <figure class="object-photo">
      <img
        class="object-photo__img"
        src="${escapeAttr(photo.url)}"
        alt="${escapeAttr(alt)}"
        loading="lazy"
        decoding="async"
      />
      <figcaption class="object-photo__credit">${escapeHtml(photo.credit)}</figcaption>
    </figure>
  `;
}

export async function loadObjectPhotoInto(
  container: HTMLElement,
  obj: TrackedObject,
): Promise<void> {
  const requestId = ++photoRequestId;
  const photo = resolveObjectPhoto(obj);
  if (requestId !== photoRequestId) return;

  if (!photo?.url) {
    container.innerHTML = '';
    container.hidden = true;
    return;
  }

  container.hidden = false;
  container.innerHTML = renderPhotoFigure(photo, obj.name);

  const img = container.querySelector<HTMLImageElement>('.object-photo__img');
  if (!img) return;

  img.addEventListener('error', () => {
    if (requestId !== photoRequestId) return;

    if (img.src.includes('/images/satellite-fallback.svg')) {
      return;
    }

    img.src = LOCAL_FALLBACK.url;
    const credit = container.querySelector('.object-photo__credit');
    if (credit) credit.textContent = LOCAL_FALLBACK.credit;
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}
