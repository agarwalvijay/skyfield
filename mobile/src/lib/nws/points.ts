import { nwsFetch } from "./client";
import type { Coordinates, PointMeta } from "./types";

interface PointsResponse {
  properties: {
    gridId: string;
    gridX: number;
    gridY: number;
    forecast: string;
    forecastHourly: string;
    forecastGridData: string;
    observationStations: string;
    forecastZone: string;
    county: string;
    fireWeatherZone: string;
    timeZone: string;
    radarStation?: string;
    relativeLocation?: {
      properties?: { city?: string; state?: string };
    };
  };
}

/** Round to 4 decimals — NWS rejects higher precision with a 301 redirect. */
function trim(n: number): string {
  return n.toFixed(4).replace(/\.?0+$/, "");
}

/** Extract the zone id (e.g. "CAZ006") from a forecastZone URL. */
function zoneId(url: string): string {
  return url.split("/").pop() ?? url;
}

/**
 * Resolve a lat/lon into the NWS grid + the set of URLs used for everything
 * downstream. This is the mandatory first call for any location.
 */
export async function getPointMeta(
  { lat, lon }: Coordinates,
  signal?: AbortSignal,
): Promise<PointMeta> {
  const data = await nwsFetch<PointsResponse>(`/points/${trim(lat)},${trim(lon)}`, { signal });
  const p = data.properties;
  return {
    gridId: p.gridId,
    gridX: p.gridX,
    gridY: p.gridY,
    forecastUrl: p.forecast,
    forecastHourlyUrl: p.forecastHourly,
    forecastGridDataUrl: p.forecastGridData,
    observationStationsUrl: p.observationStations,
    forecastZone: zoneId(p.forecastZone),
    county: zoneId(p.county),
    fireWeatherZone: zoneId(p.fireWeatherZone),
    city: p.relativeLocation?.properties?.city,
    state: p.relativeLocation?.properties?.state,
    timeZone: p.timeZone,
    radarStation: p.radarStation,
  };
}
