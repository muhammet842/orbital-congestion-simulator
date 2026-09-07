# Orbital Congestion Simulator

A 3D web app for tracking satellites and space debris in Earth's orbit.

Demo: https://orbital-congestion-simulator.vercel.app

## Features

There are some filteres that lets you see the orbit more clearly and also you can search any satellite, debris or space stations from the left panel.

You can also see the telemetry data like velocity, inclination and owner countries of the satellites and debrisses from the left panel.

You can watch the close approaches satellites will lead in 24 hours.

At the bottom of the left panel, there are real historical event cards which show you real historical collusions between satellites.

It's also a real-time animation like where are morning or night onto Earth.

You can rewind or fast forward the animation from the progress bat at the bottom.

## Setup

Run "npm install" to install dependencies, then "npm run dev" to start the local server.

Other commands:
- npm run build - Build for production
- npm run preview - Preview production build
- npm run fetch-tle - Fetch fresh TLE data

## Tech Stack

Vite, TypeScript, Three.js, satellite.js, CelesTrak TLE
