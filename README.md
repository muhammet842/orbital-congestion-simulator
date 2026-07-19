# Orbital Congestion Simulator

> Real-time 3D visualization of Earth orbit congestion using CelesTrak TLE data and SGP4 orbital propagation.

## What it does

Orbital Congestion Simulator renders thousands of satellites and debris fragments orbiting Earth in real time. It uses Two-Line Element (TLE) data from CelesTrak and propagates each object with the SGP4 algorithm via [satellite.js](https://github.com/shashwatak/satellite-js).

Explore orbit layers (LEO, MEO, GEO, HEO), filter by congestion type, click any object to inspect its orbital parameters, and scrub through time to see how the orbital environment evolves.

## Why it matters

Earth orbit is increasingly crowded. More than 27,000 tracked objects share near-Earth space, and collisions like Iridium 33–Cosmos 2251 demonstrated the Kessler Syndrome risk — where one collision creates debris that triggers more collisions. Operators like SpaceX perform hundreds of collision-avoidance maneuvers each year. This simulator makes that invisible traffic visible.

## Tech stack

| Layer | Technology |
|-------|------------|
| Build | Vite 6 + TypeScript (strict) |
| 3D | Three.js |
| Orbital mechanics | satellite.js (SGP4) |
| Data | CelesTrak TLE (static JSON) |
| Deploy | Vercel / GitHub Pages |

## Getting started

```bash
git clone https://github.com/your-username/orbital-congestion-simulator.git
cd orbital-congestion-simulator
npm install
npm run fetch-tle
npm run dev
```

Open `http://localhost:5173` in your browser.

## Data source

TLE data is fetched from [CelesTrak](https://celestrak.org/):

- Active satellites (capped at 7,000 — Starlink/OneWeb sub-capped to leave room for other constellations)
- Debris catalog (capped at 3,000 — Cosmos 2251, Fengyun-1C, Iridium 33, analyst objects)
- Space stations (ISS, Tiangong, etc.)

Output: `public/data/tle.json` — up to **10,000 objects**, deduplicated by NORAD ID.

A [GitHub Actions workflow](.github/workflows/tle-refresh.yml) refreshes this dataset automatically twice a week (Monday & Thursday) and commits the result, so the deployed app stays under the in-app 3-day staleness warning threshold. To refresh it manually:

```bash
npm run fetch-tle
```

## Orbital mechanics

Each object is propagated with **SGP4** (Simplified General Perturbations 4), the standard model used by NORAD for TLE-based prediction. Positions are computed in Earth-Centered Inertial (ECI) coordinates and scaled for Three.js display (1 unit = Earth radius).

Orbit layers are classified by altitude and eccentricity:

| Layer | Altitude |
|-------|----------|
| LEO | &lt; 2,000 km |
| MEO | 2,000 – ~32,000 km |
| GEO | ~35,786 km ± 500 km |
| HEO | High eccentricity (&gt; 0.25) |

## Earth texture

Earth texture sourced from [NASA Visible Earth](https://visibleearth.nasa.gov/) (Blue Marble). Stored locally at `public/textures/earth.jpg`.

## Stardance / NASA

Built for the [Hack Club Stardance](https://stardance.hackclub.com/) competition in collaboration with NASA themes on space sustainability and orbital debris awareness.

## License

MIT
