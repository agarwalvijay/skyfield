/**
 * Tide predictions from NOAA CO-OPS (Tides & Currents) — free, no API key.
 * Only meaningful near the coast: we find the nearest tide-prediction station
 * and, if it's within range, return the upcoming high/low tides. Inland
 * locations get null so the UI can hide the card.
 */

import type { Coordinates } from "@/lib/nws";

export interface TideEvent {
  time: number; // epoch ms
  type: "high" | "low";
  /** Height in feet (MLLW datum). */
  heightFt: number;
}

export interface Tides {
  stationName: string;
  stationId: string;
  /** Distance from the requested point to the station, km. */
  distanceKm: number;
  events: TideEvent[];
}

interface CoopsStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** Show tides only when a station is within this distance. */
const MAX_STATION_KM = 80;

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// The station list rarely changes; cache it for the session.
let stationCache: CoopsStation[] | null = null;

async function loadStations(signal?: AbortSignal): Promise<CoopsStation[]> {
  if (stationCache) return stationCache;
  const url =
    "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions";
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("tide stations unavailable");
  const data = await res.json();
  stationCache = (data.stations ?? []).map((s: { id: string; name: string; lat: number; lng: number }) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
  }));
  return stationCache!;
}

function nearestStation(
  stations: CoopsStation[],
  lat: number,
  lon: number,
): { station: CoopsStation; km: number } | null {
  let best: CoopsStation | null = null;
  let bestKm = Infinity;
  for (const s of stations) {
    const km = haversineKm(lat, lon, s.lat, s.lng);
    if (km < bestKm) {
      bestKm = km;
      best = s;
    }
  }
  return best ? { station: best, km: bestKm } : null;
}

function yyyymmdd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export async function getTides(
  { lat, lon }: Coordinates,
  signal?: AbortSignal,
): Promise<Tides | null> {
  let near: { station: CoopsStation; km: number } | null = null;
  try {
    const stations = await loadStations(signal);
    near = nearestStation(stations, lat, lon);
  } catch {
    return null;
  }
  if (!near || near.km > MAX_STATION_KM) return null;

  const begin = yyyymmdd(new Date());
  const url =
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=skyfield` +
    `&datum=MLLW&interval=hilo&units=english&time_zone=lst_ldt&format=json` +
    `&station=${near.station.id}&begin_date=${begin}&range=48`;

  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  const preds: { t: string; v: string; type: string }[] = data.predictions ?? [];
  if (!preds.length) return null;

  const now = Date.now();
  const events: TideEvent[] = preds
    .map((p) => ({
      // CO-OPS returns local station time as "YYYY-MM-DD HH:mm"; treat as local.
      time: new Date(p.t.replace(" ", "T")).getTime(),
      type: p.type === "H" ? ("high" as const) : ("low" as const),
      heightFt: parseFloat(p.v),
    }))
    .filter((e) => e.time >= now - 3600_000)
    .slice(0, 4);

  if (!events.length) return null;
  return {
    stationName: near.station.name,
    stationId: near.station.id,
    distanceKm: Math.round(near.km),
    events,
  };
}
