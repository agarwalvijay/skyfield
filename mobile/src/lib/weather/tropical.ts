/**
 * Active tropical cyclones from the National Hurricane Center — free, no key.
 * CurrentStorms.json lists every active Atlantic / E-Pacific / C-Pacific storm
 * with live position and motion. We surface only storms within range of the
 * viewed location so it stays quiet for everyone else (and off-season).
 */

import type { Coordinates } from "@/lib/nws";

export interface TropicalStorm {
  id: string;
  name: string;
  /** "Tropical Depression" | "Tropical Storm" | "Hurricane" | "Post-tropical" … */
  classification: string;
  /** Saffir–Simpson category 1–5, or null if not a hurricane. */
  category: number | null;
  /** Max sustained wind, mph. */
  windMph: number;
  lat: number;
  lon: number;
  /** Bearing of the storm FROM the viewed location, e.g. "SE". */
  bearing: string;
  /** Distance from the viewed location, miles. */
  distanceMi: number;
  /** Storm motion, e.g. "NW at 12 mph". */
  movement: string;
  lastUpdate: string;
}

/** Only show storms within this distance of the viewed point. */
const MAX_STORM_MI = 900;

function haversineMi(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function bearing(fromLat: number, fromLon: number, toLat: number, toLon: number): string {
  const dLon = ((toLon - fromLon) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((toLat * Math.PI) / 180);
  const x =
    Math.cos((fromLat * Math.PI) / 180) * Math.sin((toLat * Math.PI) / 180) -
    Math.sin((fromLat * Math.PI) / 180) * Math.cos((toLat * Math.PI) / 180) * Math.cos(dLon);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(((deg % 360) + 360) / 45) % 8];
}

function catFromWind(windMph: number, classification: string): number | null {
  if (!/hurricane/i.test(classification)) return null;
  if (windMph >= 157) return 5;
  if (windMph >= 130) return 4;
  if (windMph >= 111) return 3;
  if (windMph >= 96) return 2;
  return 1;
}

interface NhcStorm {
  id: string;
  name: string;
  classification: string;
  intensity: string; // knots, as string
  latitudeNumeric: number;
  longitudeNumeric: number;
  movementDir?: number;
  movementSpeed?: number | string;
  lastUpdate: string;
}

const CLASS_NAMES: Record<string, string> = {
  TD: "Tropical Depression",
  TS: "Tropical Storm",
  HU: "Hurricane",
  STD: "Subtropical Depression",
  STS: "Subtropical Storm",
  PTC: "Post-Tropical Cyclone",
  PC: "Potential Tropical Cyclone",
};

function compass(deg?: number): string {
  if (deg == null) return "";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export async function getNearbyStorms(
  { lat, lon }: Coordinates,
  signal?: AbortSignal,
): Promise<TropicalStorm[]> {
  let data: { activeStorms?: NhcStorm[] };
  try {
    const res = await fetch("https://www.nhc.noaa.gov/CurrentStorms.json", { signal });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }
  const storms = data.activeStorms ?? [];

  const out: TropicalStorm[] = [];
  for (const s of storms) {
    if (s.latitudeNumeric == null || s.longitudeNumeric == null) continue;
    const distanceMi = haversineMi(lat, lon, s.latitudeNumeric, s.longitudeNumeric);
    if (distanceMi > MAX_STORM_MI) continue;

    const windKt = parseFloat(s.intensity) || 0;
    const windMph = Math.round(windKt * 1.15078);
    const classification = CLASS_NAMES[s.classification] ?? s.classification;
    const spd = typeof s.movementSpeed === "string" ? parseFloat(s.movementSpeed) : s.movementSpeed;
    const movement =
      s.movementDir != null && spd != null ? `${compass(s.movementDir)} at ${Math.round(spd)} mph` : "—";

    out.push({
      id: s.id,
      name: s.name,
      classification,
      category: catFromWind(windMph, classification),
      windMph,
      lat: s.latitudeNumeric,
      lon: s.longitudeNumeric,
      bearing: bearing(lat, lon, s.latitudeNumeric, s.longitudeNumeric),
      distanceMi: Math.round(distanceMi),
      movement,
      lastUpdate: s.lastUpdate,
    });
  }
  return out.sort((a, b) => a.distanceMi - b.distanceMi);
}
