# Orbital Congestion Simulator

Orbital Congestion Simulator is an interactive, browser-based 3D visualization engine built to track, analyze, and simulate the growing density of artificial objects in Earth's orbit. By processing orbital elements in real time, the application delivers an intuitive view of active satellites, inactive hardware, and space debris currently surrounding the planet.

Live Demo: [https://orbital-congestion-simulator.vercel.app](https://orbital-congestion-simulator.vercel.app)


### Core Features

* **Real-Time 3D Globe Visualization**
  Renders thousands of tracked objects in low Earth orbit and beyond using custom WebGL shaders and Three.js scene management.

* **Orbital Mechanics & Propagation**
  Calculates precise object coordinates on the fly using Simplified General Perturbations (SGP4) models powered by satellite.js and CelesTrak TLE datasets.

* **Dynamic Filtering & Search**
  Instantly isolate objects by orbit types (LEO, MEO, GEO, HEO) or operational categories (Active Satellites, Space Debris, Space Stations). Includes instant search by object name or NORAD catalog ID.

* **Conjunction Detection & Historical Replays**
  Identifies close approaches between orbiting bodies and includes interactive time-line replays for notable historical space events and collisions.


### Tech Stack

* **Frontend Framework:** Vite, TypeScript, HTML5
* **Graphics & Rendering:** Three.js, WebGL
* **Orbital Physics:** satellite.js (SGP4/SDP4 propagation)
* **Data Source:** CelesTrak Two-Line Element (TLE) Sets


### Getting Started

#### Prerequisites

* Node.js (v18.0.0 or higher)
* npm (v9.0.0 or higher)

#### Installation

1. Clone the repository:
   git clone [https://github.com/your-username/orbital-congestion-simulator.git](https://github.com/your-username/orbital-congestion-simulator.git)
   cd orbital-congestion-simulator

2. Install dependencies:
   npm install

3. Start the development server:
   npm run dev


### Available Scripts

* npm run dev — Launches the Vite development server with hot module replacement.
* npm run build — Compiles TypeScript types and builds optimized production assets to the dist directory.
* npm run preview — Serves the built production files locally for testing.
* npm run fetch-tle — Fetches and updates the local TLE cache directly from CelesTrak.


### License

Distributed under the MIT License. See LICENSE for more information.