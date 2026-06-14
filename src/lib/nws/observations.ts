import { nwsFetch } from "./client";
import type { CurrentConditions, PointMeta } from "./types";

interface StationsResponse {
  features: Array<{
    properties: { stationIdentifier: string; name: string };
  }>;
}

interface QV {
  value: number | null;
  unitCode?: string;
}

interface ObservationResponse {
  properties: {
    timestamp: string;
    textDescription: string;
    icon: string;
    temperature: QV;
    dewpoint: QV;
    windDirection: QV;
    windSpeed: QV;
    windGust: QV;
    barometricPressure: QV;
    seaLevelPressure: QV;
    visibility: QV;
    relativeHumidity: QV;
    heatIndex: QV;
    windChill: QV;
    cloudLayers?: Array<{ amount: string; base: QV }>;
  };
}

/**
 * Normalize a wind quantity to km/h based on its unit code. The modern API
 * reports wmoUnit:km_h-1, but older payloads used m/s — converting blindly
 * inflates values 3.6×.
 */
function windToKph(q: QV): number | null {
  if (q.value == null) return null;
  if (q.unitCode?.includes("m_s")) return q.value * 3.6;
  if (q.unitCode?.includes("mi_h") || q.unitCode?.includes("mph")) return q.value * 1.609;
  return q.value; // km_h-1 (default)
}

const PRECIP_RE = /rain|snow|storm|drizzle|shower|sleet|thunder|ice|pellet/i;

/** Rough precipitation intensity (0–3) from a station's text description. */
function stationPrecipLevel(desc: string): number {
  const d = desc.toLowerCase();
  if (!PRECIP_RE.test(d)) return 0;
  if (/heavy|thunder|intense/.test(d)) return 3;
  if (/light|drizzle/.test(d)) return 1;
  return 2;
}

/**
 * Fetch the latest usable observation. The nearest station sometimes returns a
 * stale or null-heavy observation, so we walk the first few stations until we
 * find one reporting a temperature.
 *
 * Locations without a local station fall back to one of several ~10-mile
 * airports that disagree wildly during spotty storms. When `radarLevel` (the
 * radar intensity at the user's exact point, 0–4) shows precip, we pick the
 * candidate station whose reported intensity best matches the radar — so a
 * heavy-rain radar grabs the airport that's actually in the storm, not a
 * clear/light one nearby.
 */
export async function getCurrentConditions(
  meta: PointMeta,
  signal?: AbortSignal,
  radarLevel = 0,
): Promise<CurrentConditions | null> {
  const stations = await nwsFetch<StationsResponse>(meta.observationStationsUrl, { signal });
  const candidates = stations.features.slice(0, 4);

  const valid: CurrentConditions[] = [];
  for (const station of candidates) {
    const id = station.properties.stationIdentifier;
    try {
      const obs = await nwsFetch<ObservationResponse>(
        `/stations/${id}/observations/latest`,
        { signal },
      );
      const p = obs.properties;
      if (p.temperature.value == null) continue;

      const feelsLike = p.heatIndex.value ?? p.windChill.value ?? p.temperature.value;
      const cc: CurrentConditions = {
        stationName: station.properties.name,
        stationId: id,
        timestamp: p.timestamp,
        temperatureC: p.temperature.value,
        dewpointC: p.dewpoint.value,
        humidityPct: p.relativeHumidity.value,
        windSpeedKph: windToKph(p.windSpeed),
        windGustKph: windToKph(p.windGust),
        windDirectionDeg: p.windDirection.value,
        pressurePa: p.barometricPressure.value ?? p.seaLevelPressure.value,
        visibilityM: p.visibility.value,
        feelsLikeC: feelsLike,
        cloudLayer: p.cloudLayers?.[0]?.amount,
        textDescription: p.textDescription,
        icon: p.icon,
      };

      // No radar precip → the closest valid station wins (original behavior).
      if (radarLevel < 1) return cc;
      valid.push(cc);
    } catch {
      continue; // try the next station
    }
  }

  if (valid.length === 0) return null;
  // Pick the station whose intensity is closest to the radar; ties keep the
  // closer station (earlier in the list).
  let best = valid[0];
  let bestScore = Math.abs(stationPrecipLevel(best.textDescription) - radarLevel);
  for (const cc of valid.slice(1)) {
    const score = Math.abs(stationPrecipLevel(cc.textDescription) - radarLevel);
    if (score < bestScore) {
      bestScore = score;
      best = cc;
    }
  }
  return best;
}
