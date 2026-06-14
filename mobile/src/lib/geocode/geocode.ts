/**
 * Place search + reverse geocoding via Open-Meteo's free geocoding API
 * (no API key, CORS-enabled). Used for "add a location by name".
 */

export interface GeoResult {
  id: number;
  name: string;
  admin1?: string; // state/province
  admin2?: string; // county
  country?: string;
  countryCode?: string;
  lat: number;
  lon: number;
  timezone?: string;
}

interface OMGeocodeResponse {
  results?: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    admin1?: string;
    admin2?: string;
    country?: string;
    country_code?: string;
    timezone?: string;
  }>;
}

const US_ZIP_RE = /^(\d{5})(?:-\d{4})?$/;

interface ZippopotamResponse {
  "post code": string;
  places?: Array<{
    "place name": string;
    state: string;
    "state abbreviation": string;
    latitude: string;
    longitude: string;
  }>;
}

/**
 * Resolve a US ZIP via Zippopotam (free, CORS-enabled). Open-Meteo treats
 * ZIP-shaped queries as generic text and can match foreign postal codes
 * (e.g. 75001 → Paris, France instead of Addison, TX) or miss entirely.
 */
async function searchUsZip(zip: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal });
  if (!res.ok) return []; // 404 = unknown ZIP
  const data: ZippopotamResponse = await res.json();
  return (data.places ?? []).map((p, i) => ({
    id: Number(zip) * 10 + i,
    name: p["place name"],
    admin1: p.state,
    admin2: `ZIP ${zip}`,
    country: "United States",
    countryCode: "US",
    lat: parseFloat(p.latitude),
    lon: parseFloat(p.longitude),
  }));
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const zip = q.match(US_ZIP_RE);
  if (zip) {
    const results = await searchUsZip(zip[1], signal);
    if (results.length > 0) return results;
    // Unknown ZIP — fall through to a name search as a last resort.
  }
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    q,
  )}&count=8&language=en&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Geocoding failed");
  const data: OMGeocodeResponse = await res.json();
  return (data.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    admin1: r.admin1,
    admin2: r.admin2,
    country: r.country,
    countryCode: r.country_code,
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
  }));
}

/** Compose a short, human label like "Boulder, Colorado". */
export function placeLabel(r: Pick<GeoResult, "name" | "admin1" | "country" | "countryCode">): string {
  if (r.admin1 && r.admin1 !== r.name) return `${r.name}, ${r.admin1}`;
  if (r.country && r.countryCode !== "US") return `${r.name}, ${r.country}`;
  return r.name;
}
