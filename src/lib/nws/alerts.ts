import { nwsFetch } from "./client";
import type { Coordinates, WeatherAlert } from "./types";

interface AlertsResponse {
  features: Array<{
    id: string;
    geometry: WeatherAlert["geometry"];
    properties: {
      event: string;
      headline?: string;
      description: string;
      instruction?: string;
      severity: WeatherAlert["severity"];
      urgency: WeatherAlert["urgency"];
      certainty: string;
      senderName: string;
      areaDesc: string;
      effective: string;
      onset?: string;
      expires?: string;
      ends?: string;
    };
  }>;
}

/**
 * Active alerts intersecting a point. We query by point rather than zone so
 * that storm-based warnings (which are polygon, not zone, based) are caught.
 */
export async function getActiveAlerts(
  { lat, lon }: Coordinates,
  signal?: AbortSignal,
): Promise<WeatherAlert[]> {
  const data = await nwsFetch<AlertsResponse>(
    `/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
    { signal },
  );

  return data.features.map((f) => ({
    id: f.id,
    geometry: f.geometry,
    event: f.properties.event,
    headline: f.properties.headline,
    description: f.properties.description,
    instruction: f.properties.instruction,
    severity: f.properties.severity,
    urgency: f.properties.urgency,
    certainty: f.properties.certainty,
    sender: f.properties.senderName,
    areaDesc: f.properties.areaDesc,
    effective: f.properties.effective,
    onset: f.properties.onset,
    expires: f.properties.expires,
    ends: f.properties.ends,
  }));
}

/** Numeric rank for sorting (Extreme first). */
export function severityRank(s: WeatherAlert["severity"]): number {
  switch (s) {
    case "Extreme":
      return 0;
    case "Severe":
      return 1;
    case "Moderate":
      return 2;
    case "Minor":
      return 3;
    default:
      return 4;
  }
}
