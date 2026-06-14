/** Domain types for the NWS data we consume. Kept UI-agnostic + portable. */

export interface Coordinates {
  lat: number;
  lon: number;
}

/** Resolved metadata for a point — the entry point into all NWS data. */
export interface PointMeta {
  gridId: string; // WFO, e.g. "MTR"
  gridX: number;
  gridY: number;
  forecastUrl: string;
  forecastHourlyUrl: string;
  forecastGridDataUrl: string;
  observationStationsUrl: string;
  /** Public zone id used for alerts, e.g. "CAZ006". */
  forecastZone: string;
  county: string;
  fireWeatherZone: string;
  /** Human place label from the relativeLocation property. */
  city?: string;
  state?: string;
  timeZone: string;
  radarStation?: string;
}

export interface ForecastPeriod {
  number: number;
  name: string; // "This Afternoon", "Tonight", "Monday"
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: "F" | "C";
  /** e.g. "10 mph", "5 to 10 mph". */
  windSpeed: string;
  windDirection: string; // "NW"
  /** NWS day/night icon URL (we mostly map to our own glyphs). */
  icon: string;
  shortForecast: string; // "Sunny"
  detailedForecast: string;
  probabilityOfPrecipitation?: { value: number | null };
}

export interface HourlyPeriod {
  number: number;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: "F" | "C";
  windSpeed: string;
  windDirection: string;
  icon: string;
  shortForecast: string;
  probabilityOfPrecipitation?: { value: number | null };
  dewpoint?: { value: number | null; unitCode: string };
  relativeHumidity?: { value: number | null };
}

/** Normalized current conditions assembled from the latest station observation. */
export interface CurrentConditions {
  stationName?: string;
  stationId?: string;
  timestamp: string;
  /** All temps in °C from the API; UI converts. null when unavailable. */
  temperatureC: number | null;
  dewpointC: number | null;
  humidityPct: number | null;
  windSpeedKph: number | null;
  windGustKph: number | null;
  windDirectionDeg: number | null;
  /** hPa / millibars. */
  pressurePa: number | null;
  visibilityM: number | null;
  /** "Apparent" feels-like in °C if provided. */
  feelsLikeC: number | null;
  cloudLayer?: string;
  textDescription: string;
  icon: string;
}

/** Minimal GeoJSON geometry shape (Polygon / MultiPolygon for alert areas). */
export interface GeoGeometry {
  type: string;
  coordinates: unknown;
}

export type AlertSeverity = "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
export type AlertUrgency = "Immediate" | "Expected" | "Future" | "Past" | "Unknown";

export interface WeatherAlert {
  id: string;
  event: string; // "Tornado Warning"
  headline?: string;
  description: string;
  instruction?: string;
  severity: AlertSeverity;
  urgency: AlertUrgency;
  certainty: string;
  sender: string;
  areaDesc: string;
  effective: string;
  onset?: string;
  expires?: string;
  ends?: string;
  /** GeoJSON geometry (Polygon/MultiPolygon) when the alert is geo-tagged. */
  geometry?: GeoGeometry | null;
}

export interface ForecastDiscussion {
  wfo: string;
  issuanceTime: string;
  /** Raw monospace AFD text. */
  text: string;
  productName: string;
}
