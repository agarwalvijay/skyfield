# Skyfield

> **Native app:** the Expo/React Native port (Android widgets + background
> alert notifications) lives in [`mobile/`](mobile/README.md). This README
> covers the web PWA.

A modern, hyperlocal weather app powered by the U.S. National Weather Service —
a feature-parity (and better) replacement for "NOAA Weather Unofficial," built
as an installable PWA with a data layer designed to port to React Native.

## Features

- **Hyperlocal point forecast** — NWS gridpoint forecast for your exact GPS
  coordinates, not the nearest city.
- **Current conditions** — temp, feels-like, wind/gusts, humidity, dew point,
  pressure, visibility from the nearest reporting station (walks to the next
  station if the closest one is stale).
- **Hourly forecast** — 150+ hours with temperature curve graph, precipitation
  probability bars, wind, and condition glyphs, grouped by day.
- **7-day forecast** — day/night pairs with relative temperature-range bars and
  expandable detailed narratives.
- **Animated radar** — RainViewer precipitation frames (≈2h history) over a
  dark MapLibre basemap, with play/pause + scrubbable timeline and **active
  alert polygons drawn on the map**.
- **Severe weather alerts** — live banner, full alert reader (description,
  timing, preparedness actions), color-coded by severity.
- **Area Forecast Discussion** — the raw AFD narrative from your local WFO.
- **Locations** — GPS + unlimited saved places (Open-Meteo geocoding search).
- **Units** — °F/°C, mph/kmh/ms/kn, inHg/hPa, mi/km, 12/24h clock.
- **Living sky** — background gradient, glow, stars, and precipitation veils
  that respond to the actual conditions and time of day.
- **PWA** — installable, offline app shell, NWS responses cached.

## Stack

Vite · React 18 · TypeScript · TanStack Query · Zustand · MapLibre GL ·
Motion · vite-plugin-pwa. No API keys required (NWS, RainViewer, CARTO
basemap, and Open-Meteo geocoding are all free/public).

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build to dist/
npm run preview    # serve the production build
```

`node scripts/verify.mjs` drives the app in headless Chrome (geolocated to
Boulder, CO) and screenshots every tab to /tmp/skyfield-*.png.

`node scripts/storm-probe.mjs "lat,lon"` screenshots the Now + Radar screens
at any coordinate.

## Architecture notes

- `src/lib/` is platform-agnostic (plain fetch + pure functions) so it can be
  reused verbatim in a future React Native port; React-specific code lives in
  `src/hooks`, `src/store` (Zustand persists to localStorage), and components.
- NWS flow: `/points/{lat,lon}` resolves grid metadata once (cached 24h), then
  forecast/hourly/observations/AFD hang off it. Alerts query by point so
  polygon-based storm warnings are caught, not just zone alerts.
- RainViewer free tiles only exist through z7; the radar source caps `maxzoom`
  and MapLibre overscales. All animation frames are persistent layers toggled
  via opacity (0.005 for hidden — a true 0 makes MapLibre skip tile loading).

Weather data © NOAA/NWS (public domain). Radar © RainViewer. Basemap ©
OpenStreetMap contributors, © CARTO. Not affiliated with NOAA or the NWS.
