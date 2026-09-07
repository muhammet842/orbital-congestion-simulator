# Orbital Congestion Simulator

A small browser-based view of satellites and debris in low Earth orbit. The globe uses Three.js, while satellite positions are calculated from TLE data with `satellite.js`.

Live demo: https://orbital-congestion-simulator.vercel.app

## What it does

- Shows a 3D Earth with thousands of tracked objects.
- Filters objects by orbit layer, type, altitude, and inclination.
- Lets you search by name or NORAD ID.
- Displays basic details for a selected object.
- Finds close approaches between objects.
- Includes a small set of historical event replays.

## Run locally

Requirements: Node.js 18 or newer and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Other commands

```bash
npm run build
npm run preview
npm run fetch-tle
```

## Main technologies

- Vite
- TypeScript
- Three.js
- satellite.js
- CelesTrak TLE data
