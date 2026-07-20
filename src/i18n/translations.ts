export type Lang = 'en' | 'tr' | 'de' | 'ru' | 'zh';
export const SUPPORTED_LANGS: Lang[] = ['en', 'tr', 'de', 'ru', 'zh'];

export type Translations = Record<string, string>;

/* ─────────────────────────────────────────────────────────────────────────
   Flat key → string dictionary for each language.
   Keys are grouped into namespaces by prefix:
     ui.*        — left-panel static headings / labels
     stats.*     — live stats labels
     tle.*       — TLE staleness banners
     cat.*       — object-category names
     conj.*      — conjunction panel
     risk.*      — conjunction risk / verification status labels
     event_type.*— event-type badge labels
     replay.*    — collision-replay panel
     detail.*    — right-panel detail labels
     sat.*       — satellite detail labels
     event.<id>.info.*  — per-event background card
───────────────────────────────────────────────────────────────────────── */

const en: Translations = {
  // ── Left panel headings ───────────────────────────────────────────────
  'ui.search_objects':    'Search Objects',
  'ui.search_ph':         'Name, NORAD, country, or operator',
  'ui.orbit_layers':      'Orbit Layers',
  'ui.display_options':   'Display Options',
  'ui.color_by_function': 'Color by Function',
  'ui.cbf_hint':          'Starlink · Stations · Active · Debris',
  'ui.object_categories': 'Object Categories',
  'ui.live_stats':        'Live Stats',
  'ui.close_approach':    'Close Approach Alerts (Next 24h)',
  'ui.historical_events': 'Historical Events',
  'ui.advanced_filters':  'Advanced Filters',

  // ── Advanced filters ──────────────────────────────────────────────────
  'filter.altitude':      'Altitude',
  'filter.inclination':   'Inclination',
  'filter.reset':         'Reset Filters',
  'filter.objects_shown': '{n} objects shown',
  'ui.recent_launches':   'Show only recently launched (last 14 days)',
  'badge.new_launch':     'NEW',
  'badge.new_launch_title': 'First seen in the catalog within the last 14 days',

  // ── Live stats ────────────────────────────────────────────────────────
  'stats.mode':         'Mode',
  'stats.utc_time':     'UTC time',
  'stats.sim_time':     'Simulated time (UTC)',
  'stats.total':        'Total objects',
  'stats.leo':          'LEO',
  'stats.avg_alt':      'Avg altitude',
  'stats.tle_updated':  'TLE data updated',

  // ── Object categories ─────────────────────────────────────────────────
  'cat.active':   'Active',
  'cat.debris':   'Debris',
  'cat.stations': 'Stations',

  // ── TLE staleness banners ─────────────────────────────────────────────
  'tle.critical': 'TLE data is {n} days old — LEO positions may be off by hundreds of km. Run npm run fetch-tle.',
  'tle.warn':     'TLE data is {n} days old — LEO accuracy degrading. Run npm run fetch-tle.',

  // ── Compact duration units (used for "close approach in {t}") ─────────
  'unit.h_m': '{h}h {m}m',
  'unit.m_s': '{m}m {s}s',
  'unit.s':   '{s}s',

  // ── Conjunction panel ─────────────────────────────────────────────────
  'conj.empty': 'No crossing-orbit close approaches predicted in the next 24 hours (LEO, 0.1–3 km, relative speed ≥ 50 m/s). Co-orbiting stacks such as ISS or CSS modules are excluded.',
  'conj.alert':       '{a} vs {b} — {km} km close approach!',
  'conj.alert_in':    '{a} vs {b} — {km} km in {t}',
  'conj.more_one':    '+{n} more critical close approach',
  'conj.more_other':  '+{n} more critical close approaches',
  'conj.heading':           'Conjunction Verification',
  'conj.cpa_event':         'CPA Event (T+0)',
  'conj.sim_time':          'Sim Time',
  'conj.time_to_cpa':       'Time to CPA',
  'conj.live_separation':   'Live Separation',
  'conj.cpa_minimum':       'CPA Minimum',
  'conj.relative_velocity': 'Relative Velocity',
  'conj.risk_assessment':   'Risk Assessment',
  'conj.return_global':     'Return to Global View',
  'conj.t_minus':           'T−{s}s to CPA',
  'conj.t_plus':            'T+{s}s past CPA',
  'conj.hint_rewound':      'Timeline rewound to T−{s}s. Press Play or LIVE to verify.',
  'conj.hint_unavailable':  'Propagation unavailable at current simulation time.',
  'conj.hint_confirmed':    'Closest approach {km} km — within collision threshold.',
  'conj.hint_averted':      'Closest approach {km} km — collision avoided.',
  'conj.hint_approaching':  'Simulation ongoing… Tracking live separation and relative velocity.',
  'conj.hint_paused':       'Simulation paused. Press Play or LIVE to run verification.',
  'conj.colocated_prefix':       'Co-located catalog entries share the same orbit ephemeris (e.g. ISS modules).',
  'conj.colocated_appears_with': '{name} appears with: {names}.',
  'conj.colocated_suffix':       'They occupy the same propagated position in this simulator.',
  'conj.coorbiting_note':   'These vehicles are on nearly identical orbits (relative speed < 50 m/s). This is co-orbiting proximity — not a hypervelocity crossing event.',

  // ── Conjunction risk / status labels ────────────────────────────────────
  'risk.no':          'NO RISK',
  'risk.low':         'LOW RISK',
  'risk.monitoring':  'MONITORING',
  'risk.critical':    'CRITICAL RISK',
  'risk.pending':     'PENDING',
  'risk.approaching': 'APPROACHING',
  'risk.confirmed':   'COLLISION CONFIRMED',
  'risk.averted':     'COLLISION AVERTED',
  'risk.unavailable': 'UNAVAILABLE',

  // ── Event type badges ─────────────────────────────────────────────────
  'event_type.collision': 'Collision',
  'event_type.asat':      'ASAT',
  'event_type.docking':   'Docking',
  'event_type.breakup':   'Breakup',

  // ── Right panel — detail view ─────────────────────────────────────────
  'detail.historical':    'Historical Event',
  'detail.debris':        'Debris generated',
  'detail.why':           'Why Did It Happen?',
  'detail.outcome':       'Outcome & Impact',

  // ── Replay panel ──────────────────────────────────────────────────────
  'replay.heading.collision': 'Collision Replay',
  'replay.heading.asat':      'ASAT Replay',
  'replay.heading.docking':   'Docking Replay',
  'replay.heading.breakup':   'Breakup Replay',
  'replay.tti.collision':     'Time to Impact',
  'replay.tti.asat':          'Time to Impact',
  'replay.tti.docking':       'Time to Dock',
  'replay.tti.breakup':       'Time to Event',
  'replay.separation':        'Separation',
  'replay.sim_time':          'Sim Time',
  'replay.return':            'Return to Global View',
  'replay.complete':          'Replay complete — press ↺ to restart',
  'replay.impact_label':      'IMPACT',
  'replay.dock_label':        'DOCK',
  'replay.banner.collision':  '💥 COLLISION',
  'replay.banner.asat':       '💥 INTERCEPT',
  'replay.banner.docking':    '🔗 DOCKED',
  'replay.banner.breakup':    '💥 BREAKUP',
  'replay.asat_missile':      'ASAT Missile',

  // ── Satellite detail labels ───────────────────────────────────────────
  'sat.altitude':    'Altitude',
  'sat.velocity':    'Velocity',
  'sat.inclination': 'Inclination',
  'sat.latitude':    'Latitude',
  'sat.longitude':   'Longitude',
  'sat.period':      'Period',
  'sat.type':        'Type',
  'sat.operator':    'Operator',

  // ── Event info cards (per-event, per-language) ────────────────────────
  'event.iridium-cosmos.info.title':
    'The First Major Satellite Collision in History',
  'event.iridium-cosmos.info.reason':
    'Entirely accidental. One active (Iridium 33) and one defunct (Cosmos 2251) satellite crossed the same orbital plane at hypervelocity — roughly 11.6 km/s relative speed — with neither party aware of the impending impact.',
  'event.iridium-cosmos.info.outcome':
    'A defining turning point of the space age that demonstrated how critical tracking of active satellites and uncontrolled debris truly is. The ~2,000 trackable fragments generated continued to threaten low Earth orbit for decades after the event.',

  'event.fengyun-asat.info.title':
    'Chinese Anti-Satellite Missile Test',
  'event.fengyun-asat.info.reason':
    "Deliberately planned by the People's Liberation Army to demonstrate the capability of its ground-launched kinetic interceptor (SC-19 / KT-2 missile) to destroy satellites in low Earth orbit.",
  'event.fengyun-asat.info.outcome':
    'Created the largest artificial debris cloud in history. More than 3,000 large trackable fragments continue to orbit and actively threaten operational spacecraft. The event provoked strong international condemnation and renewed calls for an ASAT test ban.',

  'event.cosmos-1408.info.title':
    'Russian Anti-Satellite Missile Test',
  'event.cosmos-1408.info.reason':
    "Deliberately planned to demonstrate the capability of Russia's A-235 Nudol (PL-19) ballistic missile defence system to kinetically intercept and destroy satellites in low Earth orbit.",
  'event.cosmos-1408.info.outcome':
    "The debris cloud crossed directly through the International Space Station's orbital altitude, forcing the crew to shelter in escape capsules for several hours. The test drew widespread international condemnation and intensified pressure to ban destructive ASAT tests.",

  'event.usa-193-burnt-frost.info.title':
    'Operation Burnt Frost',
  'event.usa-193-burnt-frost.info.reason':
    "Deliberately executed to prevent the uncontrolled re-entry of a failed NRO reconnaissance satellite over populated areas and to destroy its approximately 450 kg toxic hydrazine propellant tank before it could reach the ground.",
  'event.usa-193-burnt-frost.info.outcome':
    'An SM-3 missile fired from the USS Lake Erie cruiser successfully intercepted the satellite at 247 km altitude. Because of the low intercept altitude, the vast majority of the debris fragments re-entered the atmosphere and burned up within weeks, leaving minimal long-term debris.',

  'event.cerise-ariane-debris.info.title':
    'First Confirmed Debris-on-Satellite Collision',
  'event.cerise-ariane-debris.info.reason':
    "Entirely accidental. The active French military microsatellite Cerise encountered a piece of debris — a fragment of the Ariane 3 H-10 upper stage launched nine years earlier — that was still drifting untracked in the same orbital shell.",
  'event.cerise-ariane-debris.info.outcome':
    "The first officially confirmed collision between an operational satellite and a catalogued piece of man-made space debris. The impact severed Cerise's gravity-gradient stabilisation boom. The event became a landmark case in raising international awareness of the orbital debris hazard.",

  'event.mev1-intelsat901.info.title':
    'First Commercial In-Space Docking',
  'event.mev1-intelsat901.info.reason':
    'A commercial servicing vehicle (MEV-1) was deliberately sent to slowly approach and dock with Intelsat 901 — a communications satellite that had nearly exhausted its propellant but whose electronics remained fully functional — in order to extend its operational life.',
  'event.mev1-intelsat901.info.outcome':
    "The first successful commercial on-orbit servicing and life-extension mission in spaceflight history. Zero explosions, zero debris. After docking, the combined stack was repositioned to a new GEO slot, adding five years to Intelsat 901's operational lifetime.",

  'event.kosmos-2499-breakup.info.title':
    'Mysterious Orbital Fragmentation',
  'event.kosmos-2499-breakup.info.reason':
    "Without any external impact or missile strike, the satellite suddenly broke apart on orbit — most likely due to an internal pressure failure, such as a battery or propellant tank rupture. Russia made no official statement explaining the cause.",
  'event.kosmos-2499-breakup.info.outcome':
    "Part of Russia's classified manoeuvring satellite programme, the vehicle abruptly split into dozens of pieces, leaving behind a difficult-to-track debris cloud. The event reignited concerns about on-orbit manoeuvrable inspector or co-orbital weapon satellites and their fragmentation risk.",
};

// ── TURKISH ────────────────────────────────────────────────────────────────
const tr: Translations = {
  'ui.search_objects':    'Nesne Ara',
  'ui.search_ph':         'İsim, NORAD, ülke veya operatör',
  'ui.orbit_layers':      'Yörünge Katmanları',
  'ui.display_options':   'Görüntüleme Seçenekleri',
  'ui.color_by_function': 'Fonksiyona Göre Renklendir',
  'ui.cbf_hint':          'Starlink · İstasyonlar · Aktif · Enkaz',
  'ui.object_categories': 'Nesne Kategorileri',
  'ui.live_stats':        'Canlı İstatistikler',
  'ui.close_approach':    'Yakın Geçiş Uyarıları (Önümüzdeki 24 Saat)',
  'ui.advanced_filters':  'Gelişmiş Filtreler',
  'filter.altitude':      'İrtifa',
  'filter.inclination':   'Eğim Açısı',
  'filter.reset':         'Filtreleri Sıfırla',
  'filter.objects_shown': '{n} nesne gösteriliyor',
  'ui.recent_launches':   'Sadece son 14 gündeki yeni fırlatmaları göster',
  'badge.new_launch':     'YENİ',
  'badge.new_launch_title': 'Son 14 gün içinde kataloğa eklendi',

  'stats.mode':        'Mod',
  'stats.utc_time':    'UTC saati',
  'stats.sim_time':    'Simülasyon zamanı (UTC)',
  'stats.total':       'Toplam nesne',
  'stats.leo':         'AYY',
  'stats.avg_alt':     'Ort. irtifa',
  'stats.tle_updated': 'TLE güncelleme tarihi',

  'cat.active':   'Aktif',
  'cat.debris':   'Enkaz',
  'cat.stations': 'İstasyon',

  'tle.critical': 'TLE verisi {n} gün eski — AYY konumları yüzlerce km sapıyor. npm run fetch-tle komutunu çalıştırın.',
  'tle.warn':     'TLE verisi {n} gün eski — AYY doğruluğu azalıyor. npm run fetch-tle komutunu çalıştırın.',

  'unit.h_m': '{h}sa {m}dk',
  'unit.m_s': '{m}dk {s}sn',
  'unit.s':   '{s}sn',

  'conj.empty': 'Önümüzdeki 24 saat içinde kesişen yörüngeli yakın geçiş öngörülmedi (AYY, 0.1–3 km, göreli hız ≥ 50 m/s). ISS veya CSS gibi eş yörüngeli modüller hariç tutulmuştur.',
  'conj.alert':       '{a} - {b} arası {km} km yakın geçiş!',
  'conj.alert_in':    '{a} - {b} arası {km} km — {t} sonra',
  'conj.more_one':    '+{n} kritik yakın geçiş daha',
  'conj.more_other':  '+{n} kritik yakın geçiş daha',
  'conj.heading':           'Yakın Geçiş Doğrulama',
  'conj.cpa_event':         'En Yakın Nokta (T+0)',
  'conj.sim_time':          'Simülasyon Zamanı',
  'conj.time_to_cpa':       'En Yakın Noktaya Kalan Süre',
  'conj.live_separation':   'Anlık Mesafe',
  'conj.cpa_minimum':       'Minimum Mesafe (CPA)',
  'conj.relative_velocity': 'Göreli Hız',
  'conj.risk_assessment':   'Risk Değerlendirmesi',
  'conj.return_global':     'Genel Görünüme Dön',
  'conj.t_minus':           "CPA'ya T−{s}sn",
  'conj.t_plus':            "CPA'dan T+{s}sn sonra",
  'conj.hint_rewound':      "Zaman çizelgesi T−{s}sn'ye alındı. Doğrulamak için Oynat veya CANLI'ya basın.",
  'conj.hint_unavailable':  'Şu anki simülasyon zamanında yörünge hesaplaması yapılamıyor.',
  'conj.hint_confirmed':    'En yakın mesafe {km} km — çarpışma eşiğinin içinde.',
  'conj.hint_averted':      'En yakın mesafe {km} km — çarpışma önlendi.',
  'conj.hint_approaching':  'Simülasyon sürüyor… Anlık mesafe ve göreli hız takip ediliyor.',
  'conj.hint_paused':       "Simülasyon duraklatıldı. Doğrulamayı başlatmak için Oynat veya CANLI'ya basın.",
  'conj.colocated_prefix':       'Eş konumlu katalog kayıtları aynı yörünge verisini paylaşıyor (örn. ISS modülleri).',
  'conj.colocated_appears_with': '{name} şu kayıtlarla birlikte görünüyor: {names}.',
  'conj.colocated_suffix':       'Bu simülatörde aynı hesaplanmış konumu paylaşıyorlar.',
  'conj.coorbiting_note':   'Bu araçlar neredeyse aynı yörüngede (göreli hız < 50 m/s). Bu, yüksek hızlı bir kesişme değil, eş yörüngeli bir yakınlıktır.',

  'risk.no':          'RİSK YOK',
  'risk.low':         'DÜŞÜK RİSK',
  'risk.monitoring':  'İZLENİYOR',
  'risk.critical':    'KRİTİK RİSK',
  'risk.pending':     'BEKLEMEDE',
  'risk.approaching': 'YAKLAŞIYOR',
  'risk.confirmed':   'ÇARPIŞMA ONAYLANDI',
  'risk.averted':     'ÇARPIŞMA ÖNLENDİ',
  'risk.unavailable': 'KULLANILAMIYOR',

  'event_type.collision': 'Çarpışma',
  'event_type.asat':      'ASAT',
  'event_type.docking':   'Kenetlenme',
  'event_type.breakup':   'Dağılma',

  'detail.historical': 'Tarihsel Olay',
  'detail.debris':     'Oluşan enkaz',
  'detail.why':        'Neden Yaşandı?',
  'detail.outcome':    'Sonuç ve Etkileri',

  'replay.heading.collision': 'Çarpışma Tekrarı',
  'replay.heading.asat':      'ASAT Tekrarı',
  'replay.heading.docking':   'Kenetlenme Tekrarı',
  'replay.heading.breakup':   'Dağılma Tekrarı',
  'replay.tti.collision':     'Çarpışmaya Kalan Süre',
  'replay.tti.asat':          'Çarpışmaya Kalan Süre',
  'replay.tti.docking':       'Kenetlenmeye Kalan Süre',
  'replay.tti.breakup':       'Olaya Kalan Süre',
  'replay.separation':        'Mesafe',
  'replay.sim_time':          'Sim. Zamanı',
  'replay.return':            'Global Görünüme Dön',
  'replay.complete':          'Tekrar tamamlandı — yeniden başlatmak için ↺ tuşuna basın',
  'replay.impact_label':      'ÇARPIŞMA',
  'replay.dock_label':        'KENET.',
  'replay.banner.collision':  '💥 ÇARPIŞMA',
  'replay.banner.asat':       '💥 İSABET',
  'replay.banner.docking':    '🔗 KENETLENDI',
  'replay.banner.breakup':    '💥 DAĞILDI',
  'replay.asat_missile':      'ASAT Füzesi',

  'sat.altitude':    'İrtifa',
  'sat.velocity':    'Hız',
  'sat.inclination': 'Eğim',
  'sat.latitude':    'Enlem',
  'sat.longitude':   'Boylam',
  'sat.period':      'Periyot',
  'sat.type':        'Tür',
  'sat.operator':    'Operatör',

  'event.iridium-cosmos.info.title':
    'Tarihteki İlk Büyük Uydu Çarpışması',
  'event.iridium-cosmos.info.reason':
    'Tamamen kazara gerçekleşti. Biri aktif (Iridium 33), diğeri işlevsiz (Cosmos 2251) iki uydu, birbirinden habersiz olarak aynı yörünge düzlemini yaklaşık 11,6 km/s göreli hızla kesti.',
  'event.iridium-cosmos.info.outcome':
    'Kontrolsüz uzay çöplerinin ve aktif uyduların takibinin ne kadar kritik olduğunu dünyaya gösteren uzay çağının en büyük dönüm noktası kazasıdır. Oluşan ~2.000 takip edilebilir enkaz parçası on yıllar boyunca alçak Dünya yörüngesini tehdit etmeye devam etti.',

  'event.fengyun-asat.info.title':
    'Çin Anti-Uydu Füze Testi',
  'event.fengyun-asat.info.reason':
    'Çin Halk Kurtuluş Ordusu\'nun yerden fırlatılan kinetik sistemlerle (SC-19 / KT-2 füzesi) alçak yörüngedeki uyduları imha etme kapasitesini test etmek amacıyla bilerek planlandı.',
  'event.fengyun-asat.info.outcome':
    'Tarihin en büyük yapay uzay çöpü bulutunu oluşturan olaydır. 3.000\'den fazla büyük boyutlu enkaz parçası hâlâ aktif uyduları tehdit etmektedir. Olay, uluslararası ASAT testi yasağı taleplerine yol açtı.',

  'event.cosmos-1408.info.title':
    'Rusya Anti-Uydu Füze Testi',
  'event.cosmos-1408.info.reason':
    'Rusya\'nın A-235 Nudol (PL-19) balistik füze savunma sisteminin alçak Dünya yörüngesindeki uyduları kinetik olarak vurma yeteneğini test etmek amacıyla bilerek planlandı.',
  'event.cosmos-1408.info.outcome':
    'Oluşan enkaz bulutu Uluslararası Uzay İstasyonu\'nun yörüngesini doğrudan kesti; mürettebat saatler boyunca sığınak kapsüllerine geçmek zorunda kaldı. Olay uluslararası arenada büyük kınama ve ASAT testlerinin yasaklanması yönünde baskılara neden oldu.',

  'event.usa-193-burnt-frost.info.title':
    'Burnt Frost Operasyonu',
  'event.usa-193-burnt-frost.info.reason':
    'Arızalı NRO casus uydusunun kontrolsüzce Dünya\'ya düşmesini önlemek ve içindeki yaklaşık 450 kg toksik hidrazin yakıt tankını kalabalık bölgeler üzerinde imha etmek amacıyla bilerek planlandı.',
  'event.usa-193-burnt-frost.info.outcome':
    'USS Lake Erie kruvazöründen fırlatılan SM-3 füzesi uyduyu 247 km irtifada başarıyla vurdu. Alçak irtifa sayesinde enkaz parçalarının büyük çoğunluğu birkaç hafta içinde atmosferde yanarak yok oldu.',

  'event.cerise-ariane-debris.info.title':
    'İlk Tescilli Uzay Çöpü Çarpışması',
  'event.cerise-ariane-debris.info.reason':
    'Tamamen kazara gerçekleşti. Aktif Fransız askeri uydusu Cerise, 9 yıl önce fırlatılan bir Ariane 3 roketinin enkaz parçasıyla aynı yörünge kabuğunda karşılaştı.',
  'event.cerise-ariane-debris.info.outcome':
    'Uzay tarihinde bir uydunun kataloglanmış uzay çöpüyle çarpışmasının resmi olarak tescillendiği ilk olaydır. Cerise\'in stabilizasyon anteni koptu. Bu olay uzay çöpü tehlikesini kamuoyunun gündemine taşıdı.',

  'event.mev1-intelsat901.info.title':
    'Yörüngede İlk Ticari Kenetlenme',
  'event.mev1-intelsat901.info.reason':
    'Yakıtı biten ancak elektroniği çalışır durumdaki Intelsat 901\'in servis ömrünü uzatmak için ticari servis aracı MEV-1 tarafından yavaşça yaklaşıp kenetlendi.',
  'event.mev1-intelsat901.info.outcome':
    'Uzay tarihindeki ilk başarılı ticari yörüngede servis operasyonudur. Sıfır patlama, sıfır enkaz. Kenetlenen ikili yeni bir GEO slotuna taşındı ve Intelsat 901\'in ömrü 5 yıl uzatıldı.',

  'event.kosmos-2499-breakup.info.title':
    'Gizemli Yörünge Dağılması',
  'event.kosmos-2499-breakup.info.reason':
    'Dışarıdan herhangi bir etki olmaksızın uydu, büyük ihtimalle bir batarya veya yakıt tankı arızasından kaynaklanan iç basınç nedeniyle aniden parçalandı. Rusya resmi bir açıklama yapmadı.',
  'event.kosmos-2499-breakup.info.outcome':
    'Rusya\'nın gizli manevra uyduları programından olan araç aniden düzinelerce parçaya ayrılarak takibi güç bir enkaz bulutu bıraktı. Olay, uzayda manevra yapabilen askeri uyduların tehlikelerine ilişkin kaygıları yeniden alevlendirdi.',
};

// ── GERMAN ─────────────────────────────────────────────────────────────────
const de: Translations = {
  'ui.search_objects':    'Objekte suchen',
  'ui.search_ph':         'Name, NORAD, Land oder Betreiber',
  'ui.orbit_layers':      'Umlaufbahnschichten',
  'ui.display_options':   'Anzeigeoptionen',
  'ui.color_by_function': 'Nach Funktion einfärben',
  'ui.cbf_hint':          'Starlink · Stationen · Aktiv · Trümmer',
  'ui.object_categories': 'Objektkategorien',
  'ui.live_stats':        'Live-Statistiken',
  'ui.close_approach':    'Nahflug-Warnungen (nächste 24 Std)',
  'ui.advanced_filters':  'Erweiterte Filter',
  'filter.altitude':      'Höhe',
  'filter.inclination':   'Neigung',
  'filter.reset':         'Filter zurücksetzen',
  'filter.objects_shown': '{n} Objekte angezeigt',
  'ui.recent_launches':   'Nur kürzlich gestartete anzeigen (letzte 14 Tage)',
  'badge.new_launch':     'NEU',
  'badge.new_launch_title': 'In den letzten 14 Tagen zum Katalog hinzugefügt',

  'stats.mode':        'Modus',
  'stats.utc_time':    'UTC-Zeit',
  'stats.sim_time':    'Simulierte Zeit (UTC)',
  'stats.total':       'Gesamtobjekte',
  'stats.leo':         'LEO',
  'stats.avg_alt':     'Mittlere Höhe',
  'stats.tle_updated': 'TLE-Daten aktualisiert',

  'cat.active':   'Aktiv',
  'cat.debris':   'Trümmer',
  'cat.stations': 'Stationen',

  'tle.critical': 'TLE-Daten sind {n} Tage alt — LEO-Positionen können um Hunderte von km abweichen. npm run fetch-tle ausführen.',
  'tle.warn':     'TLE-Daten sind {n} Tage alt — LEO-Genauigkeit nimmt ab. npm run fetch-tle ausführen.',

  'unit.h_m': '{h} Std {m} Min',
  'unit.m_s': '{m} Min {s} Sek',
  'unit.s':   '{s} Sek',

  'conj.empty': 'Für die nächsten 24 Stunden wurden keine kreuzenden Nahflüge vorhergesagt (LEO, 0,1–3 km, Relativgeschwindigkeit ≥ 50 m/s). Ko-orbitale Module wie ISS oder CSS sind ausgeschlossen.',
  'conj.alert':       '{a} vs {b} — {km} km enge Annäherung!',
  'conj.alert_in':    '{a} vs {b} — {km} km in {t}',
  'conj.more_one':    '+{n} weitere kritische Annäherung',
  'conj.more_other':  '+{n} weitere kritische Annäherungen',
  'conj.heading':           'Konjunktionsverifizierung',
  'conj.cpa_event':         'CPA-Ereignis (T+0)',
  'conj.sim_time':          'Simulationszeit',
  'conj.time_to_cpa':       'Zeit bis CPA',
  'conj.live_separation':   'Aktuelle Distanz',
  'conj.cpa_minimum':       'CPA-Minimum',
  'conj.relative_velocity': 'Relativgeschwindigkeit',
  'conj.risk_assessment':   'Risikobewertung',
  'conj.return_global':     'Zur Gesamtansicht zurückkehren',
  'conj.t_minus':           'T−{s}s bis CPA',
  'conj.t_plus':            'T+{s}s nach CPA',
  'conj.hint_rewound':      'Zeitleiste auf T−{s}s zurückgesetzt. Drücke Play oder LIVE zur Verifizierung.',
  'conj.hint_unavailable':  'Bahnberechnung zur aktuellen Simulationszeit nicht verfügbar.',
  'conj.hint_confirmed':    'Nächste Annäherung {km} km — innerhalb der Kollisionsschwelle.',
  'conj.hint_averted':      'Nächste Annäherung {km} km — Kollision vermieden.',
  'conj.hint_approaching':  'Simulation läuft… Live-Distanz und Relativgeschwindigkeit werden verfolgt.',
  'conj.hint_paused':       'Simulation pausiert. Drücke Play oder LIVE, um die Verifizierung zu starten.',
  'conj.colocated_prefix':       'Gemeinsam positionierte Katalogeinträge nutzen dieselbe Bahnephemeride (z. B. ISS-Module).',
  'conj.colocated_appears_with': '{name} erscheint zusammen mit: {names}.',
  'conj.colocated_suffix':       'Sie belegen in diesem Simulator dieselbe berechnete Position.',
  'conj.coorbiting_note':   'Diese Objekte befinden sich auf nahezu identischen Bahnen (Relativgeschwindigkeit < 50 m/s). Dies ist eine Ko-Orbitalnähe — kein Hochgeschwindigkeits-Kreuzungsereignis.',

  'risk.no':          'KEIN RISIKO',
  'risk.low':         'GERINGES RISIKO',
  'risk.monitoring':  'ÜBERWACHUNG',
  'risk.critical':    'KRITISCHES RISIKO',
  'risk.pending':     'AUSSTEHEND',
  'risk.approaching': 'ANNÄHERUNG',
  'risk.confirmed':   'KOLLISION BESTÄTIGT',
  'risk.averted':     'KOLLISION VERMIEDEN',
  'risk.unavailable': 'NICHT VERFÜGBAR',

  'event_type.collision': 'Kollision',
  'event_type.asat':      'ASAT',
  'event_type.docking':   'Andocken',
  'event_type.breakup':   'Zerfall',

  'detail.historical': 'Historisches Ereignis',
  'detail.debris':     'Erzeugte Trümmer',
  'detail.why':        'Warum ist es passiert?',
  'detail.outcome':    'Folgen & Auswirkungen',

  'replay.heading.collision': 'Kollisions-Wiedergabe',
  'replay.heading.asat':      'ASAT-Wiedergabe',
  'replay.heading.docking':   'Andock-Wiedergabe',
  'replay.heading.breakup':   'Zerfall-Wiedergabe',
  'replay.tti.collision':     'Zeit bis zur Kollision',
  'replay.tti.asat':          'Zeit bis zum Einschlag',
  'replay.tti.docking':       'Zeit bis zum Andocken',
  'replay.tti.breakup':       'Zeit bis zum Ereignis',
  'replay.separation':        'Abstand',
  'replay.sim_time':          'Sim.-Zeit',
  'replay.return':            'Zur Globalansicht',
  'replay.complete':          'Wiedergabe abgeschlossen — ↺ zum Neustart drücken',
  'replay.impact_label':      'EINSCHLAG',
  'replay.dock_label':        'ANDOCKEN',
  'replay.banner.collision':  '💥 KOLLISION',
  'replay.banner.asat':       '💥 ABGEFANGEN',
  'replay.banner.docking':    '🔗 ANGEDOCKT',
  'replay.banner.breakup':    '💥 ZERFALL',
  'replay.asat_missile':      'ASAT-Rakete',

  'sat.altitude':    'Höhe',
  'sat.velocity':    'Geschwindigkeit',
  'sat.inclination': 'Neigung',
  'sat.latitude':    'Breitengrad',
  'sat.longitude':   'Längengrad',
  'sat.period':      'Umlaufzeit',
  'sat.type':        'Typ',
  'sat.operator':    'Betreiber',

  'event.iridium-cosmos.info.title':
    'Die erste große Satellitenkollision der Geschichte',
  'event.iridium-cosmos.info.reason':
    'Vollständig unbeabsichtigt. Ein aktiver (Iridium 33) und ein defekter (Cosmos 2251) Satellit kreuzten dieselbe Orbitalebene mit Überschallgeschwindigkeit — etwa 11,6 km/s Relativgeschwindigkeit — ohne dass eine der Parteien von dem bevorstehenden Aufprall wusste.',
  'event.iridium-cosmos.info.outcome':
    'Ein entscheidender Wendepunkt des Weltraumzeitalters, der zeigte, wie wichtig die Verfolgung aktiver Satelliten und unkontrollierter Trümmer ist. Die ~2.000 verfolgbaren Trümmerfragmente bedrohten die erdnahe Umlaufbahn noch Jahrzehnte nach dem Ereignis.',

  'event.fengyun-asat.info.title':
    'Chinesischer Anti-Satelliten-Raketentest',
  'event.fengyun-asat.info.reason':
    'Absichtlich geplant von der Volksbefreiungsarmee, um die Fähigkeit ihres bodengestützten kinetischen Abfangraketen (SC-19/KT-2) zur Vernichtung von Satelliten in der erdnahen Umlaufbahn zu demonstrieren.',
  'event.fengyun-asat.info.outcome':
    'Erzeugte die größte künstliche Trümmerwolke in der Geschichte. Mehr als 3.000 große verfolgbare Fragmente bedrohen weiterhin aktiv Betriebssatelliten. Das Ereignis löste internationale Verurteilung und erneuerte Forderungen nach einem ASAT-Testverbot aus.',

  'event.cosmos-1408.info.title':
    'Russischer Anti-Satelliten-Raketentest',
  'event.cosmos-1408.info.reason':
    'Absichtlich durchgeführt, um die Fähigkeit des russischen A-235-Nudol-Raketensystems (PL-19) zur kinetischen Zerstörung von Satelliten in der erdnahen Umlaufbahn zu demonstrieren.',
  'event.cosmos-1408.info.outcome':
    'Die Trümmerwolke durchquerte direkt die Umlaufbahn der Internationalen Raumstation und zwang die Besatzung, sich stundenlang in Rettungskapseln zu flüchten. Der Test zog weitreichende internationale Verurteilung und erhöhten Druck für ein ASAT-Testverbot nach sich.',

  'event.usa-193-burnt-frost.info.title':
    'Operation Burnt Frost',
  'event.usa-193-burnt-frost.info.reason':
    'Absichtlich durchgeführt, um den unkontrollierten Wiedereintritt eines ausgefallenen NRO-Aufklärungssatelliten über bewohnten Gebieten zu verhindern und seinen ca. 450 kg schweren giftigen Hydrazin-Treibstofftank zu zerstören.',
  'event.usa-193-burnt-frost.info.outcome':
    'Eine SM-3-Rakete vom Kreuzer USS Lake Erie traf den Satelliten erfolgreich in 247 km Höhe. Aufgrund der geringen Abfanghöhe traten die meisten Trümmerfragmente innerhalb weniger Wochen in die Atmosphäre ein und verbrannten.',

  'event.cerise-ariane-debris.info.title':
    'Erste bestätigte Trümmer-Satelliten-Kollision',
  'event.cerise-ariane-debris.info.reason':
    'Vollständig unbeabsichtigt. Der aktive französische Militärsatellit Cerise begegnete einem Trümmerstück — einem Fragment der neun Jahre zuvor gestarteten Ariane-3-Oberstufe — das noch unkatalogisiert in derselben Orbitalhülle trieb.',
  'event.cerise-ariane-debris.info.outcome':
    'Die erste offiziell bestätigte Kollision zwischen einem operativen Satelliten und einem katalogisierten Weltraumtrümmerstück. Der Aufprall trennte Cerise\'s Schweregradient-Stabilisierungsausleger. Das Ereignis sensibilisierte die Öffentlichkeit für die Weltraumtrümmergefahr.',

  'event.mev1-intelsat901.info.title':
    'Erstes kommerzielles Andocken im Weltraum',
  'event.mev1-intelsat901.info.reason':
    'Ein kommerzielles Serviceraumschiff (MEV-1) wurde gezielt ausgesandt, um langsam an Intelsat 901 — einen Kommunikationssatelliten mit fast leerem Treibstofftank — anzudocken und dessen Betriebsdauer zu verlängern.',
  'event.mev1-intelsat901.info.outcome':
    'Die erste erfolgreiche kommerzielle On-Orbit-Service- und Lebensverlängerungsmission in der Raumfahrtgeschichte. Keine Explosionen, keine Trümmer. Nach dem Andocken wurde das verbundene System in einen neuen GEO-Slot verlagert und verlängerte Intelsat 901\'s Lebensdauer um fünf Jahre.',

  'event.kosmos-2499-breakup.info.title':
    'Mysteriöser Orbital-Zerfall',
  'event.kosmos-2499-breakup.info.reason':
    'Ohne äußere Einwirkung zerbrach der Satellit auf der Umlaufbahn — höchstwahrscheinlich durch ein internes Druckversagen wie ein Batterie- oder Treibstofftankdefekt. Russland machte keine offizielle Erklärung.',
  'event.kosmos-2499-breakup.info.outcome':
    'Teil des russischen geheimen Manövriersatellitenprogramms, zerbrach das Fahrzeug plötzlich in Dutzende von Stücken und hinterließ eine schwer zu verfolgende Trümmerwolke. Das Ereignis entfachte erneut Bedenken über Inspektions- und Ko-Orbital-Waffensatelliten.',
};

// ── RUSSIAN ────────────────────────────────────────────────────────────────
const ru: Translations = {
  'ui.search_objects':    'Поиск объектов',
  'ui.search_ph':         'Название, NORAD, страна или оператор',
  'ui.orbit_layers':      'Орбитальные слои',
  'ui.display_options':   'Параметры отображения',
  'ui.color_by_function': 'Раскраска по функции',
  'ui.cbf_hint':          'Starlink · Станции · Активные · Обломки',
  'ui.object_categories': 'Категории объектов',
  'ui.live_stats':        'Статистика в реальном времени',
  'ui.close_approach':    'Предупреждения о сближении (следующие 24 ч)',
  'ui.advanced_filters':  'Расширенные фильтры',
  'filter.altitude':      'Высота',
  'filter.inclination':   'Наклонение',
  'filter.reset':         'Сбросить фильтры',
  'filter.objects_shown': 'Показано объектов: {n}',
  'ui.recent_launches':   'Показывать только недавние запуски (14 дней)',
  'badge.new_launch':     'НОВ',
  'badge.new_launch_title': 'Впервые обнаружен в каталоге за последние 14 дней',

  'stats.mode':        'Режим',
  'stats.utc_time':    'Время UTC',
  'stats.sim_time':    'Модельное время (UTC)',
  'stats.total':       'Всего объектов',
  'stats.leo':         'НОО',
  'stats.avg_alt':     'Средняя высота',
  'stats.tle_updated': 'TLE обновлено',

  'cat.active':   'Активные',
  'cat.debris':   'Обломки',
  'cat.stations': 'Станции',

  'tle.critical': 'TLE-данные устарели на {n} дней — позиции НОО могут отличаться на сотни км. Выполните npm run fetch-tle.',
  'tle.warn':     'TLE-данные устарели на {n} дней — точность НОО снижается. Выполните npm run fetch-tle.',

  'unit.h_m': '{h} ч {m} мин',
  'unit.m_s': '{m} мин {s} с',
  'unit.s':   '{s} с',

  'conj.empty': 'На ближайшие 24 часа пересекающихся сближений не спрогнозировано (НОО, 0,1–3 км, скорость ≥ 50 м/с). Совместно орбитальные модули, такие как МКС или CSS, исключены.',
  'conj.alert':       '{a} и {b} — сближение на {km} км!',
  'conj.alert_in':    '{a} и {b} — сближение на {km} км через {t}',
  'conj.more_one':    '+{n} ещё критическое сближение',
  'conj.more_other':  '+{n} ещё критических сближений',
  'conj.heading':           'Проверка сближения',
  'conj.cpa_event':         'Событие CPA (T+0)',
  'conj.sim_time':          'Время симуляции',
  'conj.time_to_cpa':       'Время до CPA',
  'conj.live_separation':   'Текущее расстояние',
  'conj.cpa_minimum':       'Минимум CPA',
  'conj.relative_velocity': 'Относительная скорость',
  'conj.risk_assessment':   'Оценка риска',
  'conj.return_global':     'Вернуться к общему виду',
  'conj.t_minus':           'T−{s}с до CPA',
  'conj.t_plus':            'T+{s}с после CPA',
  'conj.hint_rewound':      'Шкала времени возвращена к T−{s}с. Нажмите Play или LIVE для проверки.',
  'conj.hint_unavailable':  'Расчёт орбиты недоступен для текущего времени симуляции.',
  'conj.hint_confirmed':    'Минимальное расстояние {km} км — в пределах порога столкновения.',
  'conj.hint_averted':      'Минимальное расстояние {km} км — столкновение избежано.',
  'conj.hint_approaching':  'Симуляция продолжается… Отслеживание текущего расстояния и относительной скорости.',
  'conj.hint_paused':       'Симуляция на паузе. Нажмите Play или LIVE, чтобы начать проверку.',
  'conj.colocated_prefix':       'Совместно расположенные записи каталога используют одну и ту же орбитальную эфемериду (например, модули МКС).',
  'conj.colocated_appears_with': '{name} отображается вместе с: {names}.',
  'conj.colocated_suffix':       'В этом симуляторе они занимают одну и ту же рассчитанную позицию.',
  'conj.coorbiting_note':   'Эти объекты находятся почти на одной орбите (относительная скорость < 50 м/с). Это совместная орбитальная близость, а не гиперскоростное пересечение.',

  'risk.no':          'НЕТ РИСКА',
  'risk.low':         'НИЗКИЙ РИСК',
  'risk.monitoring':  'МОНИТОРИНГ',
  'risk.critical':    'КРИТИЧЕСКИЙ РИСК',
  'risk.pending':     'ОЖИДАНИЕ',
  'risk.approaching': 'СБЛИЖЕНИЕ',
  'risk.confirmed':   'СТОЛКНОВЕНИЕ ПОДТВЕРЖДЕНО',
  'risk.averted':     'СТОЛКНОВЕНИЕ ИЗБЕЖАНО',
  'risk.unavailable': 'НЕДОСТУПНО',

  'event_type.collision': 'Столкновение',
  'event_type.asat':      'АСПО',
  'event_type.docking':   'Стыковка',
  'event_type.breakup':   'Разрушение',

  'detail.historical': 'Историческое событие',
  'detail.debris':     'Создано обломков',
  'detail.why':        'Почему это произошло?',
  'detail.outcome':    'Итоги и последствия',

  'replay.heading.collision': 'Воспроизведение столкновения',
  'replay.heading.asat':      'Воспроизведение АСПО',
  'replay.heading.docking':   'Воспроизведение стыковки',
  'replay.heading.breakup':   'Воспроизведение разрушения',
  'replay.tti.collision':     'До столкновения',
  'replay.tti.asat':          'До перехвата',
  'replay.tti.docking':       'До стыковки',
  'replay.tti.breakup':       'До события',
  'replay.separation':        'Расстояние',
  'replay.sim_time':          'Модельное время',
  'replay.return':            'Вернуться к глобальному виду',
  'replay.complete':          'Воспроизведение завершено — нажмите ↺ для перезапуска',
  'replay.impact_label':      'УДАР',
  'replay.dock_label':        'СТЫКОВКА',
  'replay.banner.collision':  '💥 СТОЛКНОВЕНИЕ',
  'replay.banner.asat':       '💥 ПЕРЕХВАТ',
  'replay.banner.docking':    '🔗 СОСТЫКОВАНЫ',
  'replay.banner.breakup':    '💥 РАЗРУШЕНИЕ',
  'replay.asat_missile':      'АСПО-ракета',

  'sat.altitude':    'Высота',
  'sat.velocity':    'Скорость',
  'sat.inclination': 'Наклонение',
  'sat.latitude':    'Широта',
  'sat.longitude':   'Долгота',
  'sat.period':      'Период',
  'sat.type':        'Тип',
  'sat.operator':    'Оператор',

  'event.iridium-cosmos.info.title':
    'Первое крупное столкновение спутников в истории',
  'event.iridium-cosmos.info.reason':
    'Полностью случайное. Активный спутник (Iridium 33) и неработающий (Cosmos 2251) пересекли одну орбитальную плоскость со скоростью около 11,6 км/с, не имея информации о предстоящем столкновении.',
  'event.iridium-cosmos.info.outcome':
    'Определяющий поворотный момент космической эпохи, показавший, насколько критически важно отслеживать активные спутники и неконтролируемые обломки. ~2 000 отслеживаемых фрагментов продолжали угрожать низкой орбите на протяжении десятилетий.',

  'event.fengyun-asat.info.title':
    'Китайское испытание противоспутниковой ракеты',
  'event.fengyun-asat.info.reason':
    'Преднамеренно спланировано НОАК для демонстрации способности кинетического перехватчика наземного базирования (ракета SC-19/KT-2) уничтожать спутники на низкой орбите.',
  'event.fengyun-asat.info.outcome':
    'Создало крупнейшее искусственное облако обломков в истории. Более 3 000 крупных отслеживаемых фрагментов продолжают активно угрожать действующим космическим аппаратам. Испытание вызвало широкое международное осуждение.',

  'event.cosmos-1408.info.title':
    'Российское испытание противоспутниковой ракеты',
  'event.cosmos-1408.info.reason':
    'Преднамеренно проведено для демонстрации возможности российской системы А-235 «Нудоль» (ПЛ-19) кинетически перехватывать и уничтожать спутники на низкой орбите.',
  'event.cosmos-1408.info.outcome':
    'Облако обломков прошло через орбиту МКС, вынудив экипаж укрыться в спасательных капсулах на несколько часов. Испытание вызвало широкое международное осуждение и усилило давление с требованием запрета разрушительных испытаний АСПО.',

  'event.usa-193-burnt-frost.info.title':
    'Операция «Burnt Frost»',
  'event.usa-193-burnt-frost.info.reason':
    'Преднамеренно проведена для предотвращения неконтролируемого входа в атмосферу неисправного разведывательного спутника АНР над населёнными районами и уничтожения его бака с ~450 кг токсичного гидразина.',
  'event.usa-193-burnt-frost.info.outcome':
    'Ракета SM-3, запущенная с крейсера USS Lake Erie, успешно поразила спутник на высоте 247 км. Благодаря малой высоте перехвата большинство фрагментов обломков сгорело в атмосфере в течение нескольких недель.',

  'event.cerise-ariane-debris.info.title':
    'Первое подтверждённое столкновение с космическим мусором',
  'event.cerise-ariane-debris.info.reason':
    'Полностью случайное. Активный французский военный микроспутник Cerise столкнулся с фрагментом верхней ступени Ariane 3, запущенной девять лет назад и дрейфовавшей в той же орбитальной оболочке.',
  'event.cerise-ariane-debris.info.outcome':
    'Первое официально подтверждённое столкновение действующего спутника с каталогизированным космическим мусором. Удар оторвал гравитационный стабилизатор Cerise. Событие стало поворотным в осознании проблемы космического мусора.',

  'event.mev1-intelsat901.info.title':
    'Первая коммерческая орбитальная стыковка',
  'event.mev1-intelsat901.info.reason':
    'Коммерческое сервисное судно (MEV-1) было специально отправлено для медленного сближения и стыковки со спутником Intelsat 901 — аппаратом с почти исчерпанным запасом топлива, но полностью рабочей электроникой — с целью продления его срока службы.',
  'event.mev1-intelsat901.info.outcome':
    'Первая успешная коммерческая миссия по орбитальному обслуживанию в истории космонавтики. Ноль взрывов, ноль обломков. После стыковки совместный аппарат был переведён на новую геостационарную позицию, добавив пять лет к сроку службы Intelsat 901.',

  'event.kosmos-2499-breakup.info.title':
    'Таинственное орбитальное разрушение',
  'event.kosmos-2499-breakup.info.reason':
    'Без какого-либо внешнего воздействия спутник внезапно разрушился на орбите — по всей видимости, из-за внутреннего сбоя давления, например, из-за разрыва батареи или топливного бака. Россия не сделала официального заявления.',
  'event.kosmos-2499-breakup.info.outcome':
    'Часть засекреченной программы манёвренных спутников России, аппарат внезапно распался на десятки частей, оставив труднообнаруживаемое облако обломков. Событие вновь вызвало обеспокоенность орбитальными инспекционными и кооорбитальными оружейными спутниками.',
};

// ── CHINESE (Simplified) ───────────────────────────────────────────────────
const zh: Translations = {
  'ui.search_objects':    '搜索对象',
  'ui.search_ph':         '名称、NORAD、国家或运营商',
  'ui.orbit_layers':      '轨道层',
  'ui.display_options':   '显示选项',
  'ui.color_by_function': '按功能着色',
  'ui.cbf_hint':          'Starlink · 空间站 · 活跃 · 碎片',
  'ui.object_categories': '对象类别',
  'ui.live_stats':        '实时统计',
  'ui.close_approach':    '近距离接近警报（未来24小时）',
  'ui.advanced_filters':  '高级筛选',
  'filter.altitude':      '高度',
  'filter.inclination':   '轨道倾角',
  'filter.reset':         '重置筛选',
  'filter.objects_shown': '显示{n}个对象',
  'ui.recent_launches':   '仅显示最近发射的（最近14天）',
  'badge.new_launch':     '新',
  'badge.new_launch_title': '最近14天内首次收录到目录中',

  'stats.mode':        '模式',
  'stats.utc_time':    'UTC时间',
  'stats.sim_time':    '模拟时间 (UTC)',
  'stats.total':       '对象总数',
  'stats.leo':         '低轨道',
  'stats.avg_alt':     '平均高度',
  'stats.tle_updated': 'TLE数据更新',

  'cat.active':   '活跃',
  'cat.debris':   '碎片',
  'cat.stations': '空间站',

  'tle.critical': 'TLE数据已过期{n}天 — 低轨道位置可能偏差数百公里。请运行 npm run fetch-tle。',
  'tle.warn':     'TLE数据已过期{n}天 — 低轨道精度下降。请运行 npm run fetch-tle。',

  'unit.h_m': '{h}时{m}分',
  'unit.m_s': '{m}分{s}秒',
  'unit.s':   '{s}秒',

  'conj.empty': '未来24小时内未预测到交叉轨道的近距离接近（低轨道，0.1–3公里，相对速度 ≥ 50米/秒）。国际空间站或CSS等共轨模块已排除。',
  'conj.alert':       '{a} 与 {b} —— 近距离接近 {km} 公里！',
  'conj.alert_in':    '{a} 与 {b} —— {km} 公里，{t} 后',
  'conj.more_one':    '还有 {n} 个严重近距离接近事件',
  'conj.more_other':  '还有 {n} 个严重近距离接近事件',
  'conj.heading':           '交会验证',
  'conj.cpa_event':         '最近点事件 (T+0)',
  'conj.sim_time':          '模拟时间',
  'conj.time_to_cpa':       '距最近点时间',
  'conj.live_separation':   '实时距离',
  'conj.cpa_minimum':       '最近点最小距离',
  'conj.relative_velocity': '相对速度',
  'conj.risk_assessment':   '风险评估',
  'conj.return_global':     '返回全局视图',
  'conj.t_minus':           '距最近点 T−{s}秒',
  'conj.t_plus':            '最近点后 T+{s}秒',
  'conj.hint_rewound':      '时间轴已回退至 T−{s}秒。按播放或"实时"开始验证。',
  'conj.hint_unavailable':  '当前模拟时间无法进行轨道计算。',
  'conj.hint_confirmed':    '最近距离 {km} 公里 — 已进入碰撞阈值。',
  'conj.hint_averted':      '最近距离 {km} 公里 — 已避免碰撞。',
  'conj.hint_approaching':  '模拟进行中… 正在追踪实时距离和相对速度。',
  'conj.hint_paused':       '模拟已暂停。按播放或"实时"开始验证。',
  'conj.colocated_prefix':       '共同定位的目录条目共享相同的轨道星历（例如国际空间站模块）。',
  'conj.colocated_appears_with': '{name} 与以下对象一起出现：{names}。',
  'conj.colocated_suffix':       '在本模拟器中，它们占据相同的推算位置。',
  'conj.coorbiting_note':   '这两个物体几乎处于相同轨道（相对速度 < 50 米/秒）。这是共轨接近，并非高速交叉事件。',

  'risk.no':          '无风险',
  'risk.low':         '低风险',
  'risk.monitoring':  '监测中',
  'risk.critical':    '严重风险',
  'risk.pending':     '待定',
  'risk.approaching': '接近中',
  'risk.confirmed':   '碰撞已确认',
  'risk.averted':     '碰撞已避免',
  'risk.unavailable': '数据不可用',

  'event_type.collision': '碰撞',
  'event_type.asat':      '反卫星',
  'event_type.docking':   '对接',
  'event_type.breakup':   '解体',

  'detail.historical': '历史事件',
  'detail.debris':     '产生碎片',
  'detail.why':        '为何发生？',
  'detail.outcome':    '结果与影响',

  'replay.heading.collision': '碰撞回放',
  'replay.heading.asat':      '反卫星回放',
  'replay.heading.docking':   '对接回放',
  'replay.heading.breakup':   '解体回放',
  'replay.tti.collision':     '碰撞倒计时',
  'replay.tti.asat':          '拦截倒计时',
  'replay.tti.docking':       '对接倒计时',
  'replay.tti.breakup':       '事件倒计时',
  'replay.separation':        '距离',
  'replay.sim_time':          '模拟时间',
  'replay.return':            '返回全局视图',
  'replay.complete':          '回放完成 — 按 ↺ 重新开始',
  'replay.impact_label':      '撞击',
  'replay.dock_label':        '对接',
  'replay.banner.collision':  '💥 碰撞',
  'replay.banner.asat':       '💥 拦截成功',
  'replay.banner.docking':    '🔗 已对接',
  'replay.banner.breakup':    '💥 解体',
  'replay.asat_missile':      '反卫星导弹',

  'sat.altitude':    '高度',
  'sat.velocity':    '速度',
  'sat.inclination': '倾角',
  'sat.latitude':    '纬度',
  'sat.longitude':   '经度',
  'sat.period':      '轨道周期',
  'sat.type':        '类型',
  'sat.operator':    '运营商',

  'event.iridium-cosmos.info.title':
    '历史上首次重大卫星碰撞',
  'event.iridium-cosmos.info.reason':
    '完全偶然。一颗活跃卫星（铱星33号）和一颗失效卫星（宇宙2251号）以约11.6公里/秒的相对速度穿越同一轨道面，双方均未察觉即将发生的碰撞。',
  'event.iridium-cosmos.info.outcome':
    '这是太空时代的重要转折点，揭示了追踪活跃卫星和不受控碎片的重要性。产生的约2000个可追踪碎片片段在此后数十年间持续威胁近地轨道。',

  'event.fengyun-asat.info.title':
    '中国反卫星导弹试验',
  'event.fengyun-asat.info.reason':
    '由中国人民解放军故意策划，旨在展示地面发射动能拦截弹（SC-19/KT-2导弹）摧毁近地轨道卫星的能力。',
  'event.fengyun-asat.info.outcome':
    '制造了历史上最大的人造太空碎片云。超过3000个大型可追踪碎片至今仍在轨道上，持续威胁在轨航天器。该事件引发强烈的国际谴责。',

  'event.cosmos-1408.info.title':
    '俄罗斯反卫星导弹试验',
  'event.cosmos-1408.info.reason':
    '故意实施，旨在展示俄罗斯A-235"努多利"（PL-19）弹道导弹防御系统动能拦截近地轨道卫星的能力。',
  'event.cosmos-1408.info.outcome':
    '碎片云直接穿过国际空间站轨道，迫使宇航员数小时躲避在逃生舱中。该试验引发广泛国际谴责，并加大了禁止破坏性反卫星试验的压力。',

  'event.usa-193-burnt-frost.info.title':
    '"焦霜行动"',
  'event.usa-193-burnt-frost.info.reason':
    '故意实施，旨在防止一颗失效的国家侦察局间谍卫星在人口稠密地区失控再入，并在其到达地面前摧毁约450公斤有毒肼推进剂贮箱。',
  'event.usa-193-burnt-frost.info.outcome':
    '从"伊利湖"号巡洋舰发射的SM-3导弹在247公里高度成功击中卫星。由于拦截高度较低，绝大多数碎片在数周内再入大气层燃烧殆尽，长期遗留碎片极少。',

  'event.cerise-ariane-debris.info.title':
    '首次确认的碎片撞击卫星事件',
  'event.cerise-ariane-debris.info.reason':
    '完全偶然。活跃的法国军用微卫星"谷神星"遭遇了一块碎片——九年前发射的阿丽亚娜3号上面级的残骸——该碎片在同一轨道壳层中漂浮，未被追踪。',
  'event.cerise-ariane-debris.info.outcome':
    '首次官方确认的在轨卫星与编目人造太空碎片之间的碰撞。撞击切断了"谷神星"的重力梯度稳定杆。该事件成为提升国际社会对太空碎片危害认识的标志性案例。',

  'event.mev1-intelsat901.info.title':
    '首次商业在轨对接',
  'event.mev1-intelsat901.info.reason':
    '一艘商业服务飞船（MEV-1）被专门派遣，缓慢接近并对接燃料将尽但电子设备完好的国际卫星901号，以延长其使用寿命。',
  'event.mev1-intelsat901.info.outcome':
    '航天史上首次成功的商业在轨服务和延寿任务。零爆炸，零碎片。对接后，组合体被移至新的地球静止轨道位置，使国际卫星901号服务寿命延长了五年。',

  'event.kosmos-2499-breakup.info.title':
    '神秘的轨道解体事件',
  'event.kosmos-2499-breakup.info.reason':
    '在没有任何外部撞击或导弹打击的情况下，该卫星突然在轨道上解体——最可能的原因是内部压力故障，例如电池或推进剂贮箱破裂。俄罗斯未发表官方声明。',
  'event.kosmos-2499-breakup.info.outcome':
    '作为俄罗斯机密机动卫星计划的一部分，该飞行器突然分裂成数十个碎片，留下难以追踪的碎片云。此事件再次引发对轨道机动巡视卫星和共轨武器卫星碎裂风险的担忧。',
};

export const translations: Record<Lang, Translations> = { en, tr, de, ru, zh };
