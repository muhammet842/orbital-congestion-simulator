/**
 * CelesTrak SATCAT OWNER / source codes → UI country + owner labels.
 * Source list: https://celestrak.org/satcat/sources.php
 *
 * `countryOnly: true` → write `country` into tle.json but leave `owner`
 * unset so name heuristics (SpaceX, Türksat, …) can still fill the operator.
 * Org / consortium codes set both fields from SATCAT.
 */

/** @typedef {{ country: string, owner: string, countryOnly?: boolean }} SatcatOwnerMeta */

/** @type {Record<string, SatcatOwnerMeta>} */
export const SATCAT_OWNER_MAP = {
  // ── Countries / states ──────────────────────────────────────────────
  ALG: { country: 'Algeria 🇩🇿', owner: 'Algeria', countryOnly: true },
  ANG: { country: 'Angola 🇦🇴', owner: 'Angola', countryOnly: true },
  ARGN: { country: 'Argentina 🇦🇷', owner: 'Argentina', countryOnly: true },
  ARM: { country: 'Armenia 🇦🇲', owner: 'Republic of Armenia', countryOnly: true },
  ASRA: { country: 'Austria 🇦🇹', owner: 'Austria', countryOnly: true },
  AUS: { country: 'Australia 🇦🇺', owner: 'Australia', countryOnly: true },
  AZER: { country: 'Azerbaijan 🇦🇿', owner: 'Azerbaijan', countryOnly: true },
  BEL: { country: 'Belgium 🇧🇪', owner: 'Belgium', countryOnly: true },
  BELA: { country: 'Belarus 🇧🇾', owner: 'Belarus', countryOnly: true },
  BERM: { country: 'Bermuda 🇧🇲', owner: 'Bermuda', countryOnly: true },
  BGD: { country: 'Bangladesh 🇧🇩', owner: 'Bangladesh', countryOnly: true },
  BHR: { country: 'Bahrain 🇧🇭', owner: 'Bahrain', countryOnly: true },
  BHUT: { country: 'Bhutan 🇧🇹', owner: 'Bhutan', countryOnly: true },
  BOL: { country: 'Bolivia 🇧🇴', owner: 'Bolivia', countryOnly: true },
  BRAZ: { country: 'Brazil 🇧🇷', owner: 'Brazil', countryOnly: true },
  BUL: { country: 'Bulgaria 🇧🇬', owner: 'Bulgaria', countryOnly: true },
  BWA: { country: 'Botswana 🇧🇼', owner: 'Botswana', countryOnly: true },
  CA: { country: 'Canada 🇨🇦', owner: 'Canada', countryOnly: true },
  CHLE: { country: 'Chile 🇨🇱', owner: 'Chile', countryOnly: true },
  CIS: { country: 'Russia 🇷🇺', owner: 'CIS / Roscosmos', countryOnly: true },
  COL: { country: 'Colombia 🇨🇴', owner: 'Colombia', countryOnly: true },
  CRI: { country: 'Costa Rica 🇨🇷', owner: 'Costa Rica', countryOnly: true },
  CZCH: { country: 'Czech Republic 🇨🇿', owner: 'Czech Republic', countryOnly: true },
  DEN: { country: 'Denmark 🇩🇰', owner: 'Denmark', countryOnly: true },
  DJI: { country: 'Djibouti 🇩🇯', owner: 'Djibouti', countryOnly: true },
  ECU: { country: 'Ecuador 🇪🇨', owner: 'Ecuador', countryOnly: true },
  EGYP: { country: 'Egypt 🇪🇬', owner: 'Egypt', countryOnly: true },
  EST: { country: 'Estonia 🇪🇪', owner: 'Estonia', countryOnly: true },
  ETH: { country: 'Ethiopia 🇪🇹', owner: 'Ethiopia', countryOnly: true },
  FIN: { country: 'Finland 🇫🇮', owner: 'Finland', countryOnly: true },
  FR: { country: 'France 🇫🇷', owner: 'France', countryOnly: true },
  GER: { country: 'Germany 🇩🇪', owner: 'Germany', countryOnly: true },
  GHA: { country: 'Ghana 🇬🇭', owner: 'Ghana', countryOnly: true },
  GREC: { country: 'Greece 🇬🇷', owner: 'Greece', countryOnly: true },
  GUAT: { country: 'Guatemala 🇬🇹', owner: 'Guatemala', countryOnly: true },
  HRV: { country: 'Croatia 🇭🇷', owner: 'Croatia', countryOnly: true },
  HUN: { country: 'Hungary 🇭🇺', owner: 'Hungary', countryOnly: true },
  IND: { country: 'India 🇮🇳', owner: 'India', countryOnly: true },
  INDO: { country: 'Indonesia 🇮🇩', owner: 'Indonesia', countryOnly: true },
  IRAN: { country: 'Iran 🇮🇷', owner: 'Iran', countryOnly: true },
  IRAQ: { country: 'Iraq 🇮🇶', owner: 'Iraq', countryOnly: true },
  IRL: { country: 'Ireland 🇮🇪', owner: 'Ireland', countryOnly: true },
  ISRA: { country: 'Israel 🇮🇱', owner: 'Israel', countryOnly: true },
  IT: { country: 'Italy 🇮🇹', owner: 'Italy', countryOnly: true },
  JPN: { country: 'Japan 🇯🇵', owner: 'Japan', countryOnly: true },
  KAZ: { country: 'Kazakhstan 🇰🇿', owner: 'Kazakhstan', countryOnly: true },
  KEN: { country: 'Kenya 🇰🇪', owner: 'Kenya', countryOnly: true },
  LAOS: { country: 'Laos 🇱🇦', owner: 'Laos', countryOnly: true },
  LKA: { country: 'Sri Lanka 🇱🇰', owner: 'Sri Lanka', countryOnly: true },
  LTU: { country: 'Lithuania 🇱🇹', owner: 'Lithuania', countryOnly: true },
  LUXE: { country: 'Luxembourg 🇱🇺', owner: 'Luxembourg', countryOnly: true },
  MA: { country: 'Morocco 🇲🇦', owner: 'Morocco', countryOnly: true },
  MALA: { country: 'Malaysia 🇲🇾', owner: 'Malaysia', countryOnly: true },
  MCO: { country: 'Monaco 🇲🇨', owner: 'Monaco', countryOnly: true },
  MDA: { country: 'Moldova 🇲🇩', owner: 'Moldova', countryOnly: true },
  MEX: { country: 'Mexico 🇲🇽', owner: 'Mexico', countryOnly: true },
  MMR: { country: 'Myanmar 🇲🇲', owner: 'Myanmar', countryOnly: true },
  MNE: { country: 'Montenegro 🇲🇪', owner: 'Montenegro', countryOnly: true },
  MNG: { country: 'Mongolia 🇲🇳', owner: 'Mongolia', countryOnly: true },
  MUS: { country: 'Mauritius 🇲🇺', owner: 'Mauritius', countryOnly: true },
  NETH: { country: 'Netherlands 🇳🇱', owner: 'Netherlands', countryOnly: true },
  NIG: { country: 'Nigeria 🇳🇬', owner: 'Nigeria', countryOnly: true },
  NKOR: { country: 'North Korea 🇰🇵', owner: 'North Korea', countryOnly: true },
  NOR: { country: 'Norway 🇳🇴', owner: 'Norway', countryOnly: true },
  NPL: { country: 'Nepal 🇳🇵', owner: 'Nepal', countryOnly: true },
  NZ: { country: 'New Zealand 🇳🇿', owner: 'New Zealand', countryOnly: true },
  PAKI: { country: 'Pakistan 🇵🇰', owner: 'Pakistan', countryOnly: true },
  PERU: { country: 'Peru 🇵🇪', owner: 'Peru', countryOnly: true },
  POL: { country: 'Poland 🇵🇱', owner: 'Poland', countryOnly: true },
  POR: { country: 'Portugal 🇵🇹', owner: 'Portugal', countryOnly: true },
  PRC: { country: 'China 🇨🇳', owner: "People's Republic of China", countryOnly: true },
  PRY: { country: 'Paraguay 🇵🇾', owner: 'Paraguay', countryOnly: true },
  QAT: { country: 'Qatar 🇶🇦', owner: 'Qatar', countryOnly: true },
  ROC: { country: 'Taiwan 🇹🇼', owner: 'Taiwan', countryOnly: true },
  ROM: { country: 'Romania 🇷🇴', owner: 'Romania', countryOnly: true },
  RP: { country: 'Philippines 🇵🇭', owner: 'Philippines', countryOnly: true },
  RWA: { country: 'Rwanda 🇷🇼', owner: 'Rwanda', countryOnly: true },
  SAFR: { country: 'South Africa 🇿🇦', owner: 'South Africa', countryOnly: true },
  SAUD: { country: 'Saudi Arabia 🇸🇦', owner: 'Saudi Arabia', countryOnly: true },
  SDN: { country: 'Sudan 🇸🇩', owner: 'Sudan', countryOnly: true },
  SEN: { country: 'Senegal 🇸🇳', owner: 'Senegal', countryOnly: true },
  SING: { country: 'Singapore 🇸🇬', owner: 'Singapore', countryOnly: true },
  SKOR: { country: 'South Korea 🇰🇷', owner: 'South Korea', countryOnly: true },
  SLB: { country: 'Solomon Islands 🇸🇧', owner: 'Solomon Islands', countryOnly: true },
  SPN: { country: 'Spain 🇪🇸', owner: 'Spain', countryOnly: true },
  // Present on live records (e.g. MARINA 69920) but not yet on sources.php.
  SVK: { country: 'Slovakia 🇸🇰', owner: 'Slovakia', countryOnly: true },
  SVN: { country: 'Slovenia 🇸🇮', owner: 'Slovenia', countryOnly: true },
  SWED: { country: 'Sweden 🇸🇪', owner: 'Sweden', countryOnly: true },
  SWTZ: { country: 'Switzerland 🇨🇭', owner: 'Switzerland', countryOnly: true },
  THAI: { country: 'Thailand 🇹🇭', owner: 'Thailand', countryOnly: true },
  TUN: { country: 'Tunisia 🇹🇳', owner: 'Tunisia', countryOnly: true },
  TURK: { country: 'Türkiye 🇹🇷', owner: 'Türkiye', countryOnly: true },
  UAE: { country: 'UAE 🇦🇪', owner: 'United Arab Emirates', countryOnly: true },
  UK: { country: 'United Kingdom 🇬🇧', owner: 'United Kingdom', countryOnly: true },
  UKR: { country: 'Ukraine 🇺🇦', owner: 'Ukraine', countryOnly: true },
  URY: { country: 'Uruguay 🇺🇾', owner: 'Uruguay', countryOnly: true },
  US: { country: 'USA 🇺🇸', owner: 'United States', countryOnly: true },
  VAT: { country: 'Vatican City 🇻🇦', owner: 'Vatican City', countryOnly: true },
  VENZ: { country: 'Venezuela 🇻🇪', owner: 'Venezuela', countryOnly: true },
  VTNM: { country: 'Vietnam 🇻🇳', owner: 'Vietnam', countryOnly: true },
  ZWE: { country: 'Zimbabwe 🇿🇼', owner: 'Zimbabwe', countryOnly: true },

  // ── Organizations / consortia / commercial operators ────────────────
  AB: {
    country: 'International 🌍',
    owner: 'Arab Satellite Communications Organization',
  },
  ABS: { country: 'International 🌍', owner: 'Asia Broadcast Satellite' },
  AC: {
    country: 'International 🌍',
    owner: 'Asia Satellite Telecommunications Company (ASIASAT)',
  },
  CHBZ: { country: 'International 🌍', owner: 'China / Brazil' },
  CHTU: { country: 'International 🌍', owner: 'China / Türkiye' },
  ESA: { country: 'Europe 🇪🇺', owner: 'European Space Agency' },
  ESRO: { country: 'Europe 🇪🇺', owner: 'European Space Research Organization' },
  EUME: {
    country: 'Europe 🇪🇺',
    owner: 'EUMETSAT',
  },
  EUTE: {
    country: 'Europe 🇪🇺',
    owner: 'EUTELSAT',
  },
  FGER: { country: 'Europe 🇪🇺', owner: 'France / Germany' },
  FRIT: { country: 'Europe 🇪🇺', owner: 'France / Italy' },
  GLOB: { country: 'USA 🇺🇸', owner: 'Globalstar' },
  GRSA: { country: 'International 🌍', owner: 'Greece / Saudi Arabia' },
  IM: {
    country: 'International 🌍',
    owner: 'INMARSAT',
  },
  IRID: { country: 'USA 🇺🇸', owner: 'Iridium' },
  ISRO: { country: 'India 🇮🇳', owner: 'ISRO' },
  ISS: {
    country: 'International 🌍',
    owner: 'International Space Station',
  },
  ITSO: {
    country: 'International 🌍',
    owner: 'INTELSAT',
  },
  NATO: {
    country: 'International 🌍',
    owner: 'NATO',
  },
  NICO: { country: 'International 🌍', owner: 'New ICO' },
  O3B: { country: 'Luxembourg 🇱🇺', owner: 'O3b Networks' },
  ORB: { country: 'USA 🇺🇸', owner: 'ORBCOMM' },
  PRES: {
    country: 'International 🌍',
    owner: "China / ESA",
  },
  RASC: { country: 'International 🌍', owner: 'RascomStar-QAF' },
  SEAL: { country: 'International 🌍', owner: 'Sea Launch' },
  SES: { country: 'Luxembourg 🇱🇺', owner: 'SES' },
  SGJP: { country: 'International 🌍', owner: 'Singapore / Japan' },
  STCT: { country: 'International 🌍', owner: 'Singapore / Taiwan' },
  TBD: { country: 'Unknown 🌐', owner: 'To Be Determined' },
  TMMC: { country: 'International 🌍', owner: 'Turkmenistan / Monaco' },
  UNK: { country: 'Unknown 🌐', owner: 'Unknown' },
  USBZ: { country: 'International 🌍', owner: 'United States / Brazil' },
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

  // Newer / rare codes not yet on sources.php — show the code, not "Unknown".
  return {
    ownerCode: code,
    country: `${code} 🌐`,
    owner: undefined,
  };
}
