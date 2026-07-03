# Orbital Congestion Simulator — Cursor Proje Spesifikasyonu

> **Bu dosya Cursor Agent için ana rehberdir.** Projeyi sıfırdan inşa ederken bu belgeye sadık kal. Belirsiz kalan noktalarda buradaki kararları uygula; burada yazmayan özellikleri ekleme.

---

## 0. Cursor'a talimat (önce bunu oku)

Sen bu repoyu **sıfırdan** inşa eden bir frontend geliştiricisin. Hedef: Stardance (Hack Club × NASA) yarışması için ship edilebilir, canlı demo'lu bir **3D yörünge trafik simülatörü**.

**Kurallar:**
1. **Backend yok** — sadece Vite + TypeScript + Three.js + satellite.js
2. **ML / AI yok** — collision risk modeli, LLM, sklearn vb. ekleme
3. **NEO API yok** — bu proje uzay çöpü/uydu (TLE), asteroit değil
4. **MVP önce** — Faz 1 bitmeden Faz 2'ye geçme
5. Her faz sonunda `npm run build` hatasız çalışmalı
6. Kod İngilizce (değişken/fonksiyon adları), UI metinleri İngilizce (uluslararası README için)

**Başlangıç komutu (Faz 1):**
```bash
npm create vite@latest . -- --template vanilla-ts
npm install three satellite.js
npm install -D @types/three
```

---

## 1. Proje özeti

| Alan | Değer |
|------|-------|
| **Proje adı** | Orbital Congestion Simulator |
| **Kısa ad** | orbital-congestion-simulator |
| **Amaç** | Dünya yörüngesindeki uydu ve uzay enkazını gerçek TLE verisiyle 3D'de göstermek; LEO/MEO/GEO yoğunluğunu ve uzay kirliliği riskini görsel anlatmak |
| **Hedef kitle** | Stardance reviewer'ları, öğrenciler, genel meraklılar |
| **Deploy** | Vercel (static) veya GitHub Pages |
| **Repo dili** | README İngilizce; bu spec Türkçe (referans) |

**Tek cümle pitch (README'de kullan):**
> Real-time 3D visualization of Earth orbit congestion using CelesTrak TLE data and SGP4 orbital propagation.

---

## 2. Teknoloji yığını

| Katman | Teknoloji | Not |
|--------|-----------|-----|
| Build | Vite 5+ | vanilla-ts template |
| Dil | TypeScript (strict) | `tsconfig.json` strict mode |
| 3D | three ^0.170 | WebGL renderer |
| Orbital | satellite.js ^5 | SGP4 propagasyon |
| Stil | CSS (custom properties) | Tailwind ekleme — gerek yok |
| Veri | Statik JSON | `public/data/tle.json` |
| Deploy | Vercel | `vercel.json` opsiyonel |

**Kullanma:**
- React, Vue, Angular
- Backend (Express, FastAPI, serverless)
- ML kütüphaneleri
- Mapbox, Cesium (ağır alternatifler)
- NASA NEO API

---

## 3. Mimari

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                     │
│                                                          │
│  fetch('/data/tle.json')                                 │
│         │                                                │
│         ▼                                                │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐ │
│  │ TLE Parser  │───▶│ OrbitalEngine│───▶│ ThreeScene  │ │
│  │             │    │ (satellite.js)│    │ (Three.js)  │ │
│  └─────────────┘    └──────────────┘    └─────────────┘ │
│         │                   │                   │       │
│         └───────────────────┴───────────────────┘       │
│                             │                            │
│                    ┌────────▼────────┐                   │
│                    │   AppState + UI  │                   │
│                    │  (panels, time)  │                   │
│                    └─────────────────┘                   │
└─────────────────────────────────────────────────────────┘

Build time (Node script):
  CelesTrak URL ──▶ scripts/fetch-tle.mjs ──▶ public/data/tle.json
```

**Veri akışı:**
1. Build veya `npm run fetch-tle` → CelesTrak'tan TLE indir → JSON'a yaz
2. Sayfa açılınca JSON fetch et
3. Her obje için `satellite.twoline2satrec()` → satrec
4. Her frame'de `satellite.propagate(satrec, date)` → ECI pozisyon
5. ECI → Three.js world koordinatına scale et → noktaları güncelle

---

## 4. Klasör yapısı (hedef)

```
orbital-congestion-simulator/
├── CURSOR_PROJECT_SPEC.md      # Bu dosya
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── vercel.json                 # SPA fallback (opsiyonel)
├── public/
│   ├── data/
│   │   └── tle.json            # Git'e commit edilir
│   └── textures/
│       └── earth.jpg           # NASA Blue Marble veya eşdeğeri
├── scripts/
│   └── fetch-tle.mjs           # TLE indirme script'i
└── src/
    ├── main.ts                 # Entry point
    ├── style.css               # Global stiller
    ├── types/
    │   └── index.ts            # Tüm TypeScript tipleri
    ├── data/
    │   └── tleLoader.ts        # JSON fetch + parse
    ├── orbital/
    │   ├── propagator.ts       # SGP4 wrapper
    │   ├── classify.ts         # LEO/MEO/GEO/HEO sınıflandırma
    │   └── conjunction.ts      # Yakın geçiş (Faz 2)
    ├── scene/
    │   ├── Earth.ts            # Dünya mesh + texture
    │   ├── OrbitalPoints.ts    # THREE.Points / InstancedMesh
    │   ├── OrbitTrail.ts       # Seçili obje yörünge izi (Faz 2)
    │   └── SceneManager.ts     # Renderer, camera, controls, loop
    ├── ui/
    │   ├── Layout.ts           # DOM iskeleti oluştur
    │   ├── LeftPanel.ts        # Filtreler + istatistik
    │   ├── RightPanel.ts       # Obje detayı + conjunction list
    │   ├── TimeControls.ts     # Play/pause/speed slider
    │   └── EventCards.ts       # Tarihsel olaylar (Faz 2)
    └── state/
        └── appState.ts         # Merkezi state (pub/sub veya basit object)
```

---

## 5. Veri kaynağı ve TLE formatı

### 5.1 CelesTrak URL'leri

Script şu kaynaklardan veri çeksin (birleştir, dedupe NORAD ID ile):

```
https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle
https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle
https://celestrak.org/NORAD/elements/gp.php?GROUP=debris&FORMAT=tle
```

**Limit:** Toplam **max 3000 obje** (performans). Öncelik sırası: debris → active → stations. Limit dolunca dur.

### 5.2 `tle.json` şeması

```json
{
  "fetchedAt": "2026-06-23T12:00:00.000Z",
  "source": "celestrak.org",
  "count": 2847,
  "objects": [
    {
      "noradId": 25544,
      "name": "ISS (ZARYA)",
      "line1": "1 25544U 98067A   ...",
      "line2": "2 25544  51.6416 ...",
      "category": "stations"
    }
  ]
}
```

### 5.3 `scripts/fetch-tle.mjs`

- Node 18+ native fetch kullan
- 3 URL'den sırayla çek, parse et, NORAD ID ile dedupe
- `public/data/tle.json` yaz
- Console'a: `Fetched N objects at <ISO date>`
- `package.json`'a script ekle: `"fetch-tle": "node scripts/fetch-tle.mjs"`

**Önemli:** CelesTrak tarayıcıdan CORS vermeyebilir; bu yüzden **build-time fetch**, runtime'da değil.

---

## 6. Orbital hesap detayları

### 6.1 Koordinat sistemi

- `satellite.js` → `eci` (Earth-Centered Inertial), km cinsinden
- Three.js sahnesinde: **1 unit = 1 km** (başlangıç) veya scale factor `EARTH_RADIUS_KM = 6371`
- Dünya yarıçapı Three.js'te: `6371` birim (veya normalize: `1` birim = Dünya yarıçapı, objeler `(x/6371, y/6371, z/6371) * ORBIT_SCALE`)

**Önerilen scale:**
```typescript
const EARTH_RADIUS_KM = 6371;
const ORBIT_DISPLAY_SCALE = 1 / EARTH_RADIUS_KM; // normalized coords
// position.three = eci * ORBIT_DISPLAY_SCALE
```

### 6.2 Yörünge katmanı sınıflandırma (`classify.ts`)

```typescript
type OrbitLayer = 'LEO' | 'MEO' | 'GEO' | 'HEO';

function classifyOrbit(altitudeKm: number, eccentricity: number): OrbitLayer {
  if (eccentricity > 0.25) return 'HEO';
  if (altitudeKm < 2000) return 'LEO';
  if (altitudeKm < 35786 * 0.9) return 'MEO'; // ~32207 km altı
  if (Math.abs(altitudeKm - 35786) < 500) return 'GEO';
  return 'HEO';
}
```

Yükseklik: `satellite.gmst + eci` sonrası `satellite.eciToGeodetic` veya velocity'den hesap — `satellite.js` `eciToGeodetic(eci, gmst)` kullan.

### 6.3 Renk paleti

| Katman | Hex | Three.js Color |
|--------|-----|----------------|
| LEO | `#22d3ee` | cyan |
| MEO | `#facc15` | yellow |
| GEO | `#fb923c` | orange |
| HEO | `#a78bfa` | purple |
| Selected | `#ffffff` | white, size ×2 |

### 6.4 Zaman simülasyonu

```typescript
interface TimeState {
  current: Date;        // simülasyon zamanı
  speed: number;        // 1, 10, 100, 1000
  playing: boolean;
}
```

- `requestAnimationFrame` loop
- Her frame: `current += deltaMs * speed`
- "Now" butonu: `current = new Date()`

---

## 7. Three.js sahne spesifikasyonu

### 7.1 SceneManager

- `PerspectiveCamera` FOV 45, position `(0, 0, 3)` (normalized) veya `(0, 0, 25000)` (km scale — birini seç, tutarlı kal)
- `WebGLRenderer` antialias true, `setPixelRatio(Math.min(devicePixelRatio, 2))`
- `OrbitControls` (three/examples/jsm/controls/OrbitControls) — import et
- Arka plan: `#050510`
- Ambient + directional light (Dünya için yeterli)

### 7.2 Earth

- `SphereGeometry(1, 64, 64)` (normalized scale)
- Texture: `public/textures/earth.jpg` — NASA Visible Earth veya similar (README'de kaynak belirt)
- Hafif `MeshPhongMaterial` veya `MeshStandardMaterial`
- Yavaş dönüş opsiyonel (`rotation.y += 0.0001`) — simülasyon zamanına bağlama

### 7.3 OrbitalPoints (performans kritik)

**MVP:** `THREE.Points` + `BufferGeometry` + `PointsMaterial`

- `position`: Float32Array(count × 3)
- `color`: Float32Array(count × 3) — katman rengi
- Her frame sadece `position` attribute güncelle, `needsUpdate = true`
- `size: 2`, `sizeAttenuation: true`, `transparent: true`, `opacity: 0.85`

**Hedef:** 3000 obje @ 60 FPS

**Seçim (raycasting):**
- `Raycaster` + `Points` — threshold `0.05`
- Veya: ekranda en yakın N nokta brute-force (basit MVP)

### 7.4 OrbitTrail (Faz 2)

- Seçili obje için gelecek 90 dakika boyunca 1 dk aralıklı pozisyonlar
- `THREE.Line` veya `Line2`
- Katman renginin %50 opacity versiyonu

---

## 8. UI spesifikasyonu

### 8.1 Layout (CSS Grid)

```
grid-template:
  "header header header" 48px
  "left   scene  right"  1fr
  "time   time   time"   64px
```

- Sol panel: 280px
- Sağ panel: 300px
- Orta: flex 1, canvas full bleed
- Mobil (<768px): paneller collapse / bottom sheet — Faz 2, MVP'de desktop-first kabul edilebilir

### 8.2 Header

```
🛰 Orbital Congestion Simulator          [GitHub ↗]
```

### 8.3 Sol panel içeriği

**Orbit Layers** (toggle checkbox, default hepsi açık):
- LEO / MEO / GEO / HEO

**Object Categories** (Faz 2, MVP'de sadece istatistik):
- Active / Debris / Stations sayıları

**Live Stats:**
```
Total objects:    2,847
LEO:              78%
Avg altitude:     612 km
Data updated:     23 Jun 2026
```

**Historical Events** (Faz 2 — accordion):
- Iridium 33 ↔ Cosmos 2251 (Feb 2009)
- Fengyun-1C ASAT (Jan 2007)
- Cosmos 1408 (Nov 2021)

Tıklanınca sağ panelde olay açıklaması + ilgili bölgeye zoom (opsiyonel).

### 8.4 Sağ panel — varsayılan

```
Select an object
Click any point in the 3D view to inspect orbital parameters.
```

**Seçili obje:**
```
NORAD 25544
ISS (ZARYA)
─────────────────
Altitude:    420 km
Velocity:    7.66 km/s
Layer:       LEO
Category:    stations
Inclination: 51.6°
─────────────────
[ Show orbit trail ]  (Faz 2)
```

### 8.5 Alt time bar

```
[ ⏮ ] [ ▶/⏸ ] [ ⏭ ]   ────●────────   14:32:05 UTC   23 Jun 2026   [ Now ]
Speed: [1x] [10x] [100x] [1000x]
```

- ⏮/⏭: ±1 saat atlama
- Slider: ±7 gün aralığı (TLE epoch'a yakın tut)

### 8.2 Stil rehberi

```css
:root {
  --bg-deep: #050510;
  --panel-bg: rgba(12, 16, 32, 0.85);
  --panel-border: rgba(255, 255, 255, 0.08);
  --text-primary: #e2e8f0;
  --text-muted: #94a3b8;
  --accent: #22d3ee;
  --warning: #fbbf24;
  --font: 'Segoe UI', system-ui, sans-serif;
}
```

- Paneller: `backdrop-filter: blur(12px)`, border-radius 8px
- Scrollbar ince, koyu tema

---

## 9. State yönetimi

Basit pub/sub — framework yok:

```typescript
// src/state/appState.ts
interface AppState {
  objects: TrackedObject[];
  filteredIndices: number[];
  selectedIndex: number | null;
  layerFilters: Record<OrbitLayer, boolean>;
  time: TimeState;
  stats: { total: number; leoPercent: number; avgAltitude: number };
}

type Listener = () => void;
// getState(), setState(partial), subscribe(fn)
```

UI modülleri `subscribe` ile güncellenir. Three.js loop ayrı çalışır.

---

## 10. TypeScript tipleri

```typescript
// src/types/index.ts

export type OrbitLayer = 'LEO' | 'MEO' | 'GEO' | 'HEO';
export type ObjectCategory = 'stations' | 'active' | 'debris';

export interface TleRecord {
  noradId: number;
  name: string;
  line1: string;
  line2: string;
  category: ObjectCategory;
}

export interface TleDataset {
  fetchedAt: string;
  source: string;
  count: number;
  objects: TleRecord[];
}

export interface TrackedObject extends TleRecord {
  satrec: satellite.SatRec;
  layer: OrbitLayer;
  color: [number, number, number]; // 0-1 RGB
}

export interface ObjectSnapshot {
  noradId: number;
  name: string;
  altitudeKm: number;
  velocityKmS: number;
  layer: OrbitLayer;
  category: ObjectCategory;
  inclinationDeg: number;
  positionEci: { x: number; y: number; z: number };
}

export interface ConjunctionEvent {
  objectA: string;
  objectB: string;
  distanceKm: number;
  time: Date;
}
```

---

## 11. Uygulama fazları

### Faz 1 — MVP (önce bunu bitir)

- [ ] Vite + TS proje iskeleti
- [ ] `scripts/fetch-tle.mjs` + en az 1000 objelik `tle.json`
- [ ] `tleLoader.ts` — fetch + satrec oluştur
- [ ] `propagator.ts` — pozisyon/hız/altitude hesap
- [ ] `classify.ts` — katman + renk
- [ ] `SceneManager` + `Earth` + `OrbitalPoints`
- [ ] `Layout` + sol/sağ panel + time bar (temel)
- [ ] Katman filtreleri çalışır
- [ ] Raycast ile obje seçimi + detay paneli
- [ ] Play/pause + speed + Now
- [ ] `npm run build` ✓
- [ ] README (İngilizce) + screenshot

**Faz 1 bitti kriteri:** Tarayıcıda Dünya + hareketli noktalar + filtre + seçim + zaman kontrolü.

### Faz 2 — Polish

- [ ] `conjunction.ts` — LEO alt kümesinde saatte bir tarama, eşik 10 km, max 5 uyarı
- [ ] `OrbitTrail.ts` — seçili obje
- [ ] `EventCards.ts` — 3 tarihsel olay
- [ ] Loading ekranı ("Loading orbital data…")
- [ ] Empty/error state (JSON yüklenemezse)
- [ ] FPS counter (dev mode, `?debug=1`)

### Faz 3 — Ship

- [ ] Vercel deploy
- [ ] README GIF (kayıt veya placeholder)
- [ ] `fetchedAt` tarihi UI'da göster
- [ ] GitHub repo public

---

## 12. Conjunction algoritması (Faz 2)

```typescript
const THRESHOLD_KM = 10;
const CHECK_INTERVAL_MS = 60_000; // sim time between checks
const MAX_RESULTS = 5;
const SUBSET = 'LEO'; // sadece LEO filtreli objeler
```

Brute-force O(n²) — n ≈ 2000 LEO obje max. Her 60 sim-dakikada bir kontrol, sonuçları cache'le. UI'da liste.

**Yapma:** Web Worker'a taşı (Faz 3 bonus), MVP'de main thread yeterli küçük n ile.

---

## 13. Tarihsel olaylar (statik içerik)

```typescript
export const HISTORICAL_EVENTS = [
  {
    id: 'iridium-cosmos',
    title: 'Iridium 33 ↔ Cosmos 2251',
    date: '2009-02-10',
    description: 'First major collision between two intact satellites. Created thousands of debris fragments and demonstrated the Kessler Syndrome risk.',
    debrisCount: '~2000',
  },
  {
    id: 'fengyun-asat',
    title: 'Fengyun-1C ASAT Test',
    date: '2007-01-11',
    description: 'Chinese anti-satellite missile test destroyed FY-1C, generating the largest debris cloud in history at the time.',
    debrisCount: '~3000',
  },
  {
    id: 'cosmos-1408',
    title: 'Cosmos 1408 Destruction',
    date: '2021-11-15',
    description: 'Russian ASAT test destroyed Cosmos 1408, forcing ISS crew to shelter in place.',
    debrisCount: '~1500',
  },
];
```

Tıklanınca modal veya sağ panelde göster. 3D'de özel animasyon Faz 3 bonus — zorunlu değil.

---

## 14. Performans gereksinimleri

| Metrik | Hedef |
|--------|-------|
| Obje sayısı | 2000–3000 |
| FPS | ≥ 55 (orta GPU) |
| İlk yükleme | < 3 sn (JSON + texture) |
| JSON boyutu | < 2 MB |
| Draw calls | Mümkün olduğunca az (Points = 1 call) |

**Optimizasyonlar:**
- `renderer.setPixelRatio(Math.min(dpr, 2))`
- Filtre değişince geometry'yi yeniden oluşturma — sadece `visible` mask veya draw range
- Propagation: sadece görünür/filtreli objeler (Faz 2)

---

## 15. Hata yönetimi

| Durum | Davranış |
|-------|----------|
| `tle.json` 404 | Tam ekran: "Orbital data not found. Run: npm run fetch-tle" |
| Boş objects array | "No orbital objects loaded." |
| Geçersiz TLE satırı | Skip + console.warn, diğerlerine devam |
| propagate null döner | O objeyi atla (epoch dışı) |

---

## 16. README şablonu (İngilizce)

README.md şunları içermeli:

1. **Title + badge** (Live Demo link)
2. **Screenshot/GIF**
3. **What it does** — 2 paragraf
4. **Why it matters** — Kessler, 27k+ tracked objects, SpaceX maneuvers stat
5. **Tech stack** tablosu
6. **Getting started:**
   ```bash
   git clone ...
   npm install
   npm run fetch-tle
   npm run dev
   ```
7. **Data source** — CelesTrak, TLE format, update instructions
8. **Orbital mechanics** — SGP4, satellite.js kısa açıklama
9. **Stardance / NASA** — Hack Club Stardance submission notu
10. **License** — MIT

---

## 17. Deploy (Vercel)

```json
// vercel.json (opsiyonel)
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Vite default `dist/` — Vercel otomatik algılar.

**Canlı URL README'ye ekle.**

---

## 18. package.json scripts (hedef)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "fetch-tle": "node scripts/fetch-tle.mjs"
  }
}
```

---

## 19. Test checklist (manuel)

Cursor her faz sonunda şunları doğrulasın:

1. [ ] `npm run fetch-tle` → `public/data/tle.json` oluşuyor
2. [ ] `npm run dev` → localhost açılıyor, hata yok
3. [ ] Dünya texture yükleniyor
4. [ ] Noktalar görünüyor ve hareket ediyor (play basılı)
5. [ ] LEO filtresi kapatılınca cyan noktalar kayboluyor
6. [ ] Noktaya tıklanınca sağ panel doluyor
7. [ ] Speed 100x ile hareket hızlanıyor
8. [ ] Now butonu gerçek zamana dönüyor
9. [ ] `npm run build` → `dist/` hatasız
10. [ ] Production preview'da aynı davranış

---

## 20. Yapılmayacaklar listesi (kesin)

- ❌ Python / FastAPI / Express backend
- ❌ scikit-learn / TensorFlow / collision ML modeli
- ❌ NASA NEO / NeoWs API
- ❌ Kullanıcı auth / database
- ❌ 30.000+ obje render
- ❌ Cesium / Unity / Unreal
- ❌ React (Vite vanilla-ts yeterli)
- ❌ Gereksiz dependency (lodash, moment.js vb.)
- ❌ Placeholder "lorem ipsum" — gerçek veri ve anlamlı metin

---

## 21. Cursor'a faz faz prompt önerisi

Kullanıcı bu spec'i Cursor'a verip şu sırayla çalıştırabilir:

**Prompt 1 — İskelet:**
> CURSOR_PROJECT_SPEC.md Faz 1'e göre projeyi oluştur: Vite vanilla-ts, klasör yapısı, fetch-tle script, boş SceneManager.

**Prompt 2 — Orbital:**
> tleLoader, propagator, classify modüllerini spec'teki tiplere göre yaz. OrbitalPoints ile entegre et.

**Prompt 3 — UI:**
> Layout, sol/sağ panel, time controls. appState pub/sub. Spec'teki CSS değişkenlerini kullan.

**Prompt 4 — Polish + ship:**
> Faz 2 conjunction + orbit trail + README + build doğrula.

---

## 22. Dünya texture kaynağı

README'de belirt:

- NASA Visible Earth: https://visibleearth.nasa.gov/
- Alternatif: `https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg` (dev only — production'da local kopyala)

Dosya: `public/textures/earth.jpg` (~500KB–2MB)

---

*Spec versiyonu: 1.0 — 23 Haziran 2026*
