# Orbital Congestion Simulator

> Real-time 3D visualization of Earth orbit congestion using CelesTrak TLE data and SGP4 orbital propagation.

**Live demo:** [https://orbital-congestion-simulator.vercel.app](https://orbital-congestion-simulator.vercel.app)

![Orbital Congestion Simulator](docs/screenshot-en.png)

## What it does

Orbital Congestion Simulator renders thousands of satellites and debris fragments orbiting Earth in real time. It uses Two-Line Element (TLE) data from CelesTrak and propagates each object with the SGP4 algorithm via [satellite.js](https://github.com/shashwatak/satellite-js).

Explore orbit layers (LEO, MEO, GEO, HEO), filter by congestion type, click any object to inspect its orbital parameters, and scrub through time to see how the orbital environment evolves.

## Features

- **Live 3D globe** with instanced orbital points and day/night shading
- **Orbit layers & filters** — LEO / MEO / GEO / HEO, satellites / stations / debris, search
- **Object details** — altitude, velocity, country/owner, orbit trail, ground track, footprint
- **Close-approach alerts** — next-24h scanning with verification UI
- **Historical event replays** — seven landmark collisions, ASAT tests, docking, and breakups
- **Kessler “Future Projection”** — interactive what-if debris growth panel
- **Satellite Spotter** — mobile sky guide using device sensors
- **Interactive how-to tour** — language gate + spotlight walkthrough (header `?`)
- **i18n** — English, Turkish, German, Russian, Chinese
- **Deep links** — `?object=<NORAD>` / `?event=<id>`
- **Admin analytics overlay** (optional Firebase RTDB) — local PIN, visitor metrics
- **Automated TLE refresh** — GitHub Actions twice weekly (TLE + SATCAT country join)

## Why it matters

Earth orbit is increasingly crowded. More than 27,000 tracked objects share near-Earth space, and collisions like Iridium 33–Cosmos 2251 demonstrated the Kessler Syndrome risk — where one collision creates debris that triggers more collisions. Operators like SpaceX perform hundreds of collision-avoidance maneuvers each year. This simulator makes that invisible traffic visible.

## Tech stack

| Layer | Technology |
|-------|------------|
| Build | Vite 6 + TypeScript (strict) |
| 3D | Three.js |
| Orbital mechanics | satellite.js (SGP4) |
| Data | CelesTrak TLE + SATCAT (static `tle.json`) |
| Deploy | [Vercel](https://orbital-congestion-simulator.vercel.app) |

## Getting started

```bash
git clone https://github.com/muhammet842/orbital-congestion-simulator.git
cd orbital-congestion-simulator
npm install
npm run fetch-tle
npm run dev
```

Open `http://localhost:5173` in your browser.

## How to use

On first visit the app asks you to **choose a language**, then walks through the UI step by step with on-screen highlights (globe, search/filters, details, close approaches, historical events, time bar, Future Projection). Use **Skip** anytime; reopen the tour with the **?** button in the header.

Deep links: `?object=<NORAD>` and `?event=<id>`.

## Data source

Orbital elements and catalog metadata come from [CelesTrak](https://celestrak.org/):

- **TLE / GP** — active satellites (capped at 7,000 — Starlink/OneWeb sub-capped), debris (capped at 5,000 — Cosmos 2251, Fengyun-1C, Iridium 33, Cosmos 1408, analyst objects, then other trackable `DEB` fragments), and stations (ISS, Tiangong, etc.)
- **SATCAT** — one download of [`satcat.csv`](https://celestrak.org/pub/satcat.csv) joined by NORAD ID so each object can carry a **country** (and organization **owner** when SATCAT’s `OWNER` is an agency/consortium code). Name-based heuristics in `objectMetadata.ts` remain the fallback when SATCAT has no match or only supplies a country code (so operators like SpaceX can still come from the name).

Output: `public/data/tle.json` — up to **12,000 objects**, deduplicated by NORAD ID.

A [GitHub Actions workflow](.github/workflows/tle-refresh.yml) runs `npm run fetch-tle` twice a week (Monday & Thursday), which refreshes TLEs **and** re-joins SATCAT, then commits `public/data/tle.json` so the deployed app stays under the in-app 3-day staleness warning. Manual refresh:

```bash
npm run fetch-tle
```

### “NEW” objects filter

Objects can carry a `firstSeenAt` stamp when they first appear in an automated fetch relative to the previous catalog snapshot. The UI filter **“New to this catalog”** uses that stamp — it means **first seen in this app’s TLE list within the last 14 days**, not the physical launch or formation date (and not SATCAT `LAUNCH_DATE`). Stamps accumulate across refreshes; a cold/empty baseline does not mark the whole catalog as new. See [docs/NEW_OBJECTS.md](docs/NEW_OBJECTS.md).

## Orbital mechanics

Each object is propagated with **SGP4** (Simplified General Perturbations 4), the standard model used by NORAD for TLE-based prediction. Positions are computed in Earth-Centered Inertial (ECI) coordinates and scaled for Three.js display (1 unit = Earth radius).

Orbit layers are classified by altitude and eccentricity:

| Layer | Altitude |
|-------|----------|
| LEO | &lt; 2,000 km |
| MEO | 2,000 – ~32,000 km |
| GEO | ~35,786 km ± 500 km |
| HEO | High eccentricity (&gt; 0.25) |

## 3D models

`public/models/sat_leo.glb` is the bundled LEO satellite mesh. Stations, cargo craft, cubesats, and debris use **distinct procedural silhouettes** (see `SatelliteModelLoader`) so types stay visually readable without multi‑MB artist GLBs. Dropping additional `.glb` files at the paths in `modelResolver.ts` and marking them as bundled will take priority automatically.

## Earth texture

Earth texture sourced from [NASA Visible Earth](https://visibleearth.nasa.gov/) (Blue Marble). Stored locally at `public/textures/earth.jpg`.

## Ops & admin

- Firebase rules and deploy notes: [firebase/README.md](firebase/README.md)
- Feature / architecture notes: [docs/FEATURES.md](docs/FEATURES.md)
- Operations checklist (TLE refresh, Firebase publish): [docs/OPERATIONS.md](docs/OPERATIONS.md)

The admin overlay (Ctrl+Shift+A) is a **local debug panel**. The PIN is hashed on-device (SHA-256); it is not remote authentication.

## Stardance / NASA

Built for the [Hack Club Stardance](https://stardance.hackclub.com/) competition in collaboration with NASA themes on space sustainability and orbital debris awareness.

## License

MIT
