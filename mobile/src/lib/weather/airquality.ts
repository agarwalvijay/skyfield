/**
 * Air quality (US AQI) and UV index from Open-Meteo — free, no API key.
 * NWS exposes neither, so this is purely additive. Air quality comes from the
 * dedicated air-quality endpoint; UV from the standard forecast endpoint.
 */

import type { Coordinates } from "@/lib/nws";

// ---- AQI ---------------------------------------------------------------

export type AqiCategory = "good" | "moderate" | "usg" | "unhealthy" | "veryUnhealthy" | "hazardous";

export interface AirQuality {
  /** US EPA AQI (0–500+). */
  usAqi: number;
  category: AqiCategory;
  /** Human label, e.g. "Unhealthy for sensitive groups". */
  label: string;
  /** Pollutant driving the index, if identifiable. */
  dominant: string | null;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
}

const AQI_BANDS: { max: number; cat: AqiCategory; label: string }[] = [
  { max: 50, cat: "good", label: "Good" },
  { max: 100, cat: "moderate", label: "Moderate" },
  { max: 150, cat: "usg", label: "Unhealthy for sensitive groups" },
  { max: 200, cat: "unhealthy", label: "Unhealthy" },
  { max: 300, cat: "veryUnhealthy", label: "Very unhealthy" },
  { max: Infinity, cat: "hazardous", label: "Hazardous" },
];

export function aqiCategory(aqi: number): { category: AqiCategory; label: string } {
  const band = AQI_BANDS.find((b) => aqi <= b.max) ?? AQI_BANDS[AQI_BANDS.length - 1];
  return { category: band.cat, label: band.label };
}

/** Hex color for an AQI category (EPA-style ramp). */
export function aqiColor(cat: AqiCategory): string {
  switch (cat) {
    case "good":
      return "#3ad36b";
    case "moderate":
      return "#ffd84d";
    case "usg":
      return "#ff9f40";
    case "unhealthy":
      return "#ff5a5f";
    case "veryUnhealthy":
      return "#b06cf0";
    case "hazardous":
      return "#a23b50";
  }
}

/** Short, plain-language guidance for an AQI category. */
export function aqiAdvice(cat: AqiCategory): string {
  switch (cat) {
    case "good":
      return "Air quality is good — a great day to be outside.";
    case "moderate":
      return "Air quality is acceptable; unusually sensitive people may limit prolonged exertion.";
    case "usg":
      return "Sensitive groups should cut back on prolonged outdoor exertion.";
    case "unhealthy":
      return "Everyone may begin to feel effects; limit prolonged outdoor exertion.";
    case "veryUnhealthy":
      return "Health alert — avoid prolonged outdoor exertion.";
    case "hazardous":
      return "Emergency conditions — stay indoors.";
  }
}

interface OMAirQuality {
  current?: {
    us_aqi?: number;
    pm2_5?: number;
    pm10?: number;
    ozone?: number;
    nitrogen_dioxide?: number;
    sulphur_dioxide?: number;
    carbon_monoxide?: number;
  };
}

export async function getAirQuality(
  { lat, lon }: Coordinates,
  signal?: AbortSignal,
): Promise<AirQuality | null> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide&domains=cams_global`;

  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data: OMAirQuality = await res.json();
  const c = data.current;
  if (!c || c.us_aqi == null) return null;

  const usAqi = Math.round(c.us_aqi);
  const { category, label } = aqiCategory(usAqi);

  // Identify the most concerning pollutant by its own sub-index proxy (highest
  // concentration relative to typical "moderate" thresholds).
  const pollutants: { name: string; v: number | undefined; ref: number }[] = [
    { name: "PM2.5", v: c.pm2_5, ref: 12 },
    { name: "PM10", v: c.pm10, ref: 54 },
    { name: "Ozone", v: c.ozone, ref: 100 },
    { name: "NO₂", v: c.nitrogen_dioxide, ref: 100 },
    { name: "SO₂", v: c.sulphur_dioxide, ref: 75 },
    { name: "CO", v: c.carbon_monoxide, ref: 4400 },
  ];
  let dominant: string | null = null;
  let worst = -Infinity;
  for (const p of pollutants) {
    if (p.v == null) continue;
    const ratio = p.v / p.ref;
    if (ratio > worst) {
      worst = ratio;
      dominant = p.name;
    }
  }

  return {
    usAqi,
    category,
    label,
    dominant,
    pm25: c.pm2_5 ?? null,
    pm10: c.pm10 ?? null,
    ozone: c.ozone ?? null,
  };
}

// ---- UV index ----------------------------------------------------------

export type UvCategory = "low" | "moderate" | "high" | "veryHigh" | "extreme";

export interface UvIndex {
  /** UV index right now. */
  now: number;
  /** Today's peak UV. */
  max: number;
  /** Epoch ms of today's peak, if known. */
  peakTime: number | null;
  category: UvCategory;
  label: string;
}

export function uvCategory(uv: number): { category: UvCategory; label: string } {
  if (uv < 3) return { category: "low", label: "Low" };
  if (uv < 6) return { category: "moderate", label: "Moderate" };
  if (uv < 8) return { category: "high", label: "High" };
  if (uv < 11) return { category: "veryHigh", label: "Very high" };
  return { category: "extreme", label: "Extreme" };
}

export function uvColor(cat: UvCategory): string {
  switch (cat) {
    case "low":
      return "#3ad36b";
    case "moderate":
      return "#ffd84d";
    case "high":
      return "#ff9f40";
    case "veryHigh":
      return "#ff5a5f";
    case "extreme":
      return "#b06cf0";
  }
}

/** Minutes to sunburn for unprotected fair skin, roughly. null when negligible. */
export function uvBurnMinutes(uv: number): number | null {
  if (uv < 3) return null;
  // ~ "Type II skin" rule of thumb: 60 * (4 / (3*UV)) hours → minutes.
  return Math.round((200 / uv) * 0.6);
}

export function uvAdvice(cat: UvCategory): string {
  switch (cat) {
    case "low":
      return "No protection needed.";
    case "moderate":
      return "Wear sunglasses; use SPF 30 on bright days.";
    case "high":
      return "SPF 30+, hat and shade around midday.";
    case "veryHigh":
      return "Extra protection — SPF 30+, shade, cover up.";
    case "extreme":
      return "Avoid sun midday; SPF 50+, full cover.";
  }
}

interface OMForecastUv {
  current?: { time?: number; uv_index?: number };
  hourly?: { time: number[]; uv_index: number[] };
}

export async function getUvIndex(
  { lat, lon }: Coordinates,
  signal?: AbortSignal,
): Promise<UvIndex | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=uv_index&hourly=uv_index&forecast_days=1&timeformat=unixtime`;

  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data: OMForecastUv = await res.json();

  const now = Math.max(0, data.current?.uv_index ?? 0);

  // Today's peak from the hourly series.
  let max = now;
  let peakTime: number | null = null;
  const h = data.hourly;
  if (h?.time?.length) {
    for (let i = 0; i < h.time.length; i++) {
      const uv = h.uv_index[i] ?? 0;
      if (uv > max) {
        max = uv;
        peakTime = h.time[i] * 1000;
      }
    }
  }

  const { category, label } = uvCategory(now);
  return { now: Math.round(now * 10) / 10, max: Math.round(max * 10) / 10, peakTime, category, label };
}
