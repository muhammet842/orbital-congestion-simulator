/**
 * CelesTrak SATCAT OWNER / source codes â†’ UI country + owner labels.
 * Source list: https://celestrak.org/satcat/sources.php
 *
 * `countryOnly: true` â†’ write `country` into tle.json but leave `owner`
 * unset so name heuristics (SpaceX, TÃ¼rksat, â€¦) can still fill the operator.
 * Org / consortium codes set both fields from SATCAT.
 */

/** @typedef {{ country: string, owner: string, countryOnly?: boolean }} SatcatOwnerMeta */

/** @type {Record<string, SatcatOwnerMeta>} */
export const SATCAT_OWNER_MAP = {
  // â”€â”€ Countries / states â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ALG: { country: 'Algeria Ÿ‡¿', owner: 'Algeria', countryOnly: true },
  ANG: { country: 'Angola Ÿ‡´', owner: 'Angola', countryOnly: true },
  ARGN: { country: 'Argentina Ÿ‡·', owner: 'Argentina', countryOnly: true },
  ARM: { country: 'Armenia Ÿ‡²', owner: 'Republic of Armenia', countryOnly: true },
  ASRA: { country: 'Austria Ÿ‡¹', owner: 'Austria', countryOnly: true },
  AUS: { country: 'Australia Ÿ‡º', owner: 'Australia', countryOnly: true },
  AZER: { country: 'Azerbaijan Ÿ‡¿', owner: 'Azerbaijan', countryOnly: true },
  BEL: { country: 'Belgium Ÿ‡ª', owner: 'Belgium', countryOnly: true },
  BELA: { country: 'Belarus Ÿ‡¾', owner: 'Belarus', countryOnly: true },
  BERM: { country: 'Bermuda Ÿ‡²', owner: 'Bermuda', countryOnly: true },
  BGD: { country: 'Bangladesh Ÿ‡©', owner: 'Bangladesh', countryOnly: true },
  BHR: { country: 'Bahrain Ÿ‡­', owner: 'Bahrain', countryOnly: true },
  BHUT: { country: 'Bhutan Ÿ‡¹', owner: 'Bhutan', countryOnly: true },
  BOL: { country: 'Bolivia Ÿ‡´', owner: 'Bolivia', countryOnly: true },
  BRAZ: { country: 'Brazil Ÿ‡·', owner: 'Brazil', countryOnly: true },
  BUL: { country: 'Bulgaria Ÿ‡¬', owner: 'Bulgaria', countryOnly: true },
  BWA: { country: 'Botswana Ÿ‡¼', owner: 'Botswana', countryOnly: true },
  CA: { country: 'Canada Ÿ‡¦', owner: 'Canada', countryOnly: true },
  CHLE: { country: 'Chile Ÿ‡±', owner: 'Chile', countryOnly: true },
  CIS: { country: 'Russia Ÿ‡º', owner: 'CIS / Roscosmos', countryOnly: true },
  COL: { country: 'Colombia Ÿ‡´', owner: 'Colombia', countryOnly: true },
  CRI: { country: 'Costa Rica Ÿ‡·', owner: 'Costa Rica', countryOnly: true },
  CZCH: { country: 'Czech Republic Ÿ‡¿', owner: 'Czech Republic', countryOnly: true },
  DEN: { country: 'Denmark Ÿ‡°', owner: 'Denmark', countryOnly: true },
  DJI: { country: 'Djibouti Ÿ‡¯', owner: 'Djibouti', countryOnly: true },
  ECU: { country: 'Ecuador Ÿ‡¨', owner: 'Ecuador', countryOnly: true },
  EGYP: { country: 'Egypt Ÿ‡¬', owner: 'Egypt', countryOnly: true },
  EST: { country: 'Estonia Ÿ‡ª', owner: 'Estonia', countryOnly: true },
  ETH: { country: 'Ethiopia Ÿ‡¹', owner: 'Ethiopia', countryOnly: true },
  FIN: { country: 'Finland Ÿ‡®', owner: 'Finland', countryOnly: true },
  FR: { country: 'France Ÿ‡·', owner: 'France', countryOnly: true },
  GER: { country: 'Germany Ÿ‡ª', owner: 'Germany', countryOnly: true },
  GHA: { country: 'Ghana Ÿ‡­', owner: 'Ghana', countryOnly: true },
  GREC: { country: 'Greece Ÿ‡·', owner: 'Greece', countryOnly: true },
  GUAT: { country: 'Guatemala Ÿ‡¹', owner: 'Guatemala', countryOnly: true },
  HRV: { country: 'Croatia Ÿ‡·', owner: 'Croatia', countryOnly: true },
  HUN: { country: 'Hungary Ÿ‡º', owner: 'Hungary', countryOnly: true },
  IND: { country: 'India Ÿ‡³', owner: 'India', countryOnly: true },
  INDO: { country: 'Indonesia Ÿ‡©', owner: 'Indonesia', countryOnly: true },
  IRAN: { country: 'Iran Ÿ‡·', owner: 'Iran', countryOnly: true },
  IRAQ: { country: 'Iraq Ÿ‡¶', owner: 'Iraq', countryOnly: true },
  IRL: { country: 'Ireland Ÿ‡ª', owner: 'Ireland', countryOnly: true },
  ISRA: { country: 'Israel Ÿ‡±', owner: 'Israel', countryOnly: true },
  IT: { country: 'Italy Ÿ‡¹', owner: 'Italy', countryOnly: true },
  JPN: { country: 'Japan Ÿ‡µ', owner: 'Japan', countryOnly: true },
  KAZ: { country: 'Kazakhstan Ÿ‡¿', owner: 'Kazakhstan', countryOnly: true },
  KEN: { country: 'Kenya Ÿ‡ª', owner: 'Kenya', countryOnly: true },
  LAOS: { country: 'Laos Ÿ‡¦', owner: 'Laos', countryOnly: true },
  LKA: { country: 'Sri Lanka Ÿ‡°', owner: 'Sri Lanka', countryOnly: true },
  LTU: { country: 'Lithuania Ÿ‡¹', owner: 'Lithuania', countryOnly: true },
  LUXE: { country: 'Luxembourg Ÿ‡º', owner: 'Luxembourg', countryOnly: true },
  MA: { country: 'Morocco Ÿ‡¦', owner: 'Morocco', countryOnly: true },
  MALA: { country: 'Malaysia Ÿ‡¾', owner: 'Malaysia', countryOnly: true },
  MCO: { country: 'Monaco Ÿ‡¨', owner: 'Monaco', countryOnly: true },
  MDA: { country: 'Moldova Ÿ‡©', owner: 'Moldova', countryOnly: true },
  MEX: { country: 'Mexico Ÿ‡½', owner: 'Mexico', countryOnly: true },
  MMR: { country: 'Myanmar Ÿ‡²', owner: 'Myanmar', countryOnly: true },
  MNE: { country: 'Montenegro Ÿ‡ª', owner: 'Montenegro', countryOnly: true },
  MNG: { country: 'Mongolia Ÿ‡³', owner: 'Mongolia', countryOnly: true },
  MUS: { country: 'Mauritius Ÿ‡º', owner: 'Mauritius', countryOnly: true },
  NETH: { country: 'Netherlands Ÿ‡±', owner: 'Netherlands', countryOnly: true },
  NIG: { country: 'Nigeria Ÿ‡¬', owner: 'Nigeria', countryOnly: true },
  NKOR: { country: 'North Korea Ÿ‡µ', owner: 'North Korea', countryOnly: true },
  NOR: { country: 'Norway Ÿ‡´', owner: 'Norway', countryOnly: true },
  NPL: { country: 'Nepal Ÿ‡µ', owner: 'Nepal', countryOnly: true },
  NZ: { country: 'New Zealand Ÿ‡¿', owner: 'New Zealand', countryOnly: true },
  PAKI: { country: 'Pakistan Ÿ‡°', owner: 'Pakistan', countryOnly: true },
  PERU: { country: 'Peru Ÿ‡ª', owner: 'Peru', countryOnly: true },
  POL: { country: 'Poland Ÿ‡±', owner: 'Poland', countryOnly: true },
  POR: { country: 'Portugal Ÿ‡¹', owner: 'Portugal', countryOnly: true },
  PRC: { country: 'China Ÿ‡³', owner: "People's Republic of China", countryOnly: true },
  PRY: { country: 'Paraguay Ÿ‡¾', owner: 'Paraguay', countryOnly: true },
  QAT: { country: 'Qatar Ÿ‡¦', owner: 'Qatar', countryOnly: true },
  ROC: { country: 'Taiwan Ÿ‡¼', owner: 'Taiwan', countryOnly: true },
  ROM: { country: 'Romania Ÿ‡´', owner: 'Romania', countryOnly: true },
  RP: { country: 'Philippines Ÿ‡­', owner: 'Philippines', countryOnly: true },
  RWA: { country: 'Rwanda Ÿ‡¼', owner: 'Rwanda', countryOnly: true },
  SAFR: { country: 'South Africa Ÿ‡¦', owner: 'South Africa', countryOnly: true },
  SAUD: { country: 'Saudi Arabia Ÿ‡¦', owner: 'Saudi Arabia', countryOnly: true },
  SDN: { country: 'Sudan Ÿ‡©', owner: 'Sudan', countryOnly: true },
  SEN: { country: 'Senegal Ÿ‡³', owner: 'Senegal', countryOnly: true },
  SING: { country: 'Singapore Ÿ‡¬', owner: 'Singapore', countryOnly: true },
  SKOR: { country: 'South Korea Ÿ‡·', owner: 'South Korea', countryOnly: true },
  SLB: { country: 'Solomon Islands Ÿ‡§', owner: 'Solomon Islands', countryOnly: true },
  SPN: { country: 'Spain Ÿ‡¸', owner: 'Spain', countryOnly: true },
  // Present on live records (e.g. MARINA 69920) but not yet on sources.php.
  SVK: { country: 'Slovakia Ÿ‡°', owner: 'Slovakia', countryOnly: true },
  SVN: { country: 'Slovenia Ÿ‡®', owner: 'Slovenia', countryOnly: true },
  SWED: { country: 'Sweden Ÿ‡ª', owner: 'Sweden', countryOnly: true },
  SWTZ: { country: 'Switzerland Ÿ‡­', owner: 'Switzerland', countryOnly: true },
  THAI: { country: 'Thailand Ÿ‡­', owner: 'Thailand', countryOnly: true },
  TUN: { country: 'Tunisia Ÿ‡³', owner: 'Tunisia', countryOnly: true },
  TURK: { country: 'TÃ¼rkiye Ÿ‡·', owner: 'TÃ¼rkiye', countryOnly: true },
  UAE: { country: 'UAE Ÿ‡ª', owner: 'United Arab Emirates', countryOnly: true },
  UK: { country: 'United Kingdom Ÿ‡§', owner: 'United Kingdom', countryOnly: true },
  UKR: { country: 'Ukraine Ÿ‡¦', owner: 'Ukraine', countryOnly: true },
  URY: { country: 'Uruguay Ÿ‡¾', owner: 'Uruguay', countryOnly: true },
  US: { country: 'USA Ÿ‡¸', owner: 'United States', countryOnly: true },
  VAT: { country: 'Vatican City Ÿ‡¦', owner: 'Vatican City', countryOnly: true },
  VENZ: { country: 'Venezuela Ÿ‡ª', owner: 'Venezuela', countryOnly: true },
  VTNM: { country: 'Vietnam Ÿ‡³', owner: 'Vietnam', countryOnly: true },
  ZWE: { country: 'Zimbabwe Ÿ‡¼', owner: 'Zimbabwe', countryOnly: true },

  // â”€â”€ Organizations / consortia / commercial operators â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  AB: {
    country: 'International ,
    owner: 'Arab Satellite Communications Organization',
  },
  ABS: { country: 'International , owner: 'Asia Broadcast Satellite' },
  AC: {
    country: 'International ,
    owner: 'Asia Satellite Telecommunications Company (ASIASAT)',
  },
  CHBZ: { country: 'International , owner: 'China / Brazil' },
  CHTU: { country: 'International , owner: 'China / TÃ¼rkiye' },
  ESA: { country: 'Europe Ÿ‡º', owner: 'European Space Agency' },
  ESRO: { country: 'Europe Ÿ‡º', owner: 'European Space Research Organization' },
  EUME: {
    country: 'Europe Ÿ‡º',
    owner: 'EUMETSAT',
  },
  EUTE: {
    country: 'Europe Ÿ‡º',
    owner: 'EUTELSAT',
  },
  FGER: { country: 'Europe Ÿ‡º', owner: 'France / Germany' },
  FRIT: { country: 'Europe Ÿ‡º', owner: 'France / Italy' },
  GLOB: { country: 'USA Ÿ‡¸', owner: 'Globalstar' },
  GRSA: { country: 'International , owner: 'Greece / Saudi Arabia' },
  IM: {
    country: 'International ,
    owner: 'INMARSAT',
  },
  IRID: { country: 'USA Ÿ‡¸', owner: 'Iridium' },
  ISRO: { country: 'India Ÿ‡³', owner: 'ISRO' },
  ISS: {
    country: 'International ,
    owner: 'International Space Station',
  },
  ITSO: {
    country: 'International ,
    owner: 'INTELSAT',
  },
  NATO: {
    country: 'International ,
    owner: 'NATO',
  },
  NICO: { country: 'International , owner: 'New ICO' },
  O3B: { country: 'Luxembourg Ÿ‡º', owner: 'O3b Networks' },
  ORB: { country: 'USA Ÿ‡¸', owner: 'ORBCOMM' },
  PRES: {
    country: 'International ,
    owner: "China / ESA",
  },
  RASC: { country: 'International , owner: 'RascomStar-QAF' },
  SEAL: { country: 'International , owner: 'Sea Launch' },
  SES: { country: 'Luxembourg Ÿ‡º', owner: 'SES' },
  SGJP: { country: 'International , owner: 'Singapore / Japan' },
  STCT: { country: 'International , owner: 'Singapore / Taiwan' },
  TBD: { country: 'Unknown , owner: 'To Be Determined' },
  TMMC: { country: 'International , owner: 'Turkmenistan / Monaco' },
  UNK: { country: 'Unknown , owner: 'Unknown' },
  USBZ: { country: 'International , owner: 'United States / Brazil' },
};

/**
 * @param {string | null | undefined} ownerCode
 * @returns {{ country: string, owner?: string, ownerCode: string } | null}
 */
export function resolveSatcatOwner(ownerCode) {
  if (!ownerCode || typeof ownerCode !== 'string') return null;
  const code = ownerCode.trim().toUpperCase();
  if (!code) return null;

  const mapped = SATCAT_OWNER_MAP[code];
  if (mapped) {
    return {
      ownerCode: code,
      country: mapped.country,
      owner: mapped.countryOnly ? undefined : mapped.owner,
    };
  }

  // Newer / rare codes not yet on sources.php â€” show the code, not "Unknown".
  return {
    ownerCode: code,
    country: `${code} ,
    owner: undefined,
  };
}
