# Orbital Congestion Simulator

A lightweight, real-time 3D orbital space debris and satellite tracking simulator built with Three.js and SGP4 TLE propagation.

> **Live Demo:** [https://orbital-congestion-simulator.vercel.app](https://orbital-congestion-simulator.vercel.app)

---

## Overview

Earth's orbit is becoming increasingly congested. **Orbital Congestion Simulator** renders thousands of active satellites and space debris fragments in real-time, accurately propagating their paths using CelesTrak Two-Line Element (TLE) data and the SGP4 orbital model.

The application allows users to explore various orbital layers, filter objects by function or type, inspect individual satellite telemetry, and replay major historical orbital collision events.

---

## Key Features

- **Interactive 3D Globe**: Real-time WebGL rendering of Earth with day/night atmospheric shaders and dynamic object rendering via Three.js.
- **SGP4 Orbital Propagation**: Computes precise satellite positions and velocity using `satellite.js` fed by static CelesTrak TLE snapshots.
- **Orbital Layers & Filters**: Dynamic filtering by altitude (LEO, MEO, GEO, HEO) and object category (Active Satellites, Space Stations, Debris).
- **Color by Function**: Instant visual separation of Starlink constellations, space stations, active payloads, and space junk.
- **Object Details & Telemetry**: Click any object to inspect its altitude, velocity, inclination, NORAD ID, country of origin, and projected ground track.
- **Close Approach Detection**: Real-time screening for close encounters and conjunction risks between orbiting objects.
- **Historical Collision Replays**: Interactive replay mode for landmark orbital events (e.g., Iridium 33 vs. Cosmos 2251 collision).
- **Kessler Future Projection**: Integrated what-if simulation panel for orbital density and chain-reaction collision risk modeling.

---

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Framework & Build** | Vite + TypeScript |
| **3D Graphics** | Three.js (WebGL) |
| **Orbital Mechanics** | `satellite.js` (SGP4/SDP4 models) + Web Workers |
| **Data Source** | CelesTrak TLE & SATCAT catalog |
| **Deployment** | Vercel |

---

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/muhammet842/orbital-congestion-simulator.git](https://github.com/muhammet842/orbital-congestion-simulator.git)
   cd orbital-congestion-simulator
