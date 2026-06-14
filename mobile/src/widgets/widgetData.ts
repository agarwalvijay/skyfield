import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getActiveAlerts,
  getCurrentConditions,
  getForecast,
  getPointMeta,
  severityRank,
  type CurrentConditions,
  type ForecastPeriod,
  type WeatherAlert,
} from "@/lib/nws";
import { parseCondition, type ConditionCode } from "@/lib/weather/condition";
import { alertColor } from "@/lib/weather/alertColor";
import {
  degToCompass,
  displayTemp,
  displayTempF,
  displayWind,
  windUnitLabel,
  type TempUnit,
  type WindUnit,
} from "@/lib/format/units";
import { getNowcast } from "@/lib/nowcast/openmeteo";
import type { SavedLocation } from "@/store/locations";
import { resolveWidgetLocation } from "./widgetConfigStore";

/** Pre-formatted strings so widget components stay dumb. Honors app units. */
export interface WidgetWeather {
  place: string;
  temp: string; // "81°"
  condition: string;
  code: ConditionCode;
  isDay: boolean;
  hi: string;
  lo: string;
  wind: string; // "WSW 19 mph"
  humidity: string; // "42%"
  updated: string;
  alertEvent: string | null;
  alertColor: `#${string}`;
  /** Short MinuteCast line ("Rain stopping in ~40 min"), only when relevant. */
  nowcast: string | null;
}

/** App unit settings from the persisted zustand blob (headless-safe). */
async function readUnits(): Promise<{ temp: TempUnit; wind: WindUnit }> {
  try {
    const raw = await AsyncStorage.getItem("skyfield.settings");
    const s = raw ? JSON.parse(raw)?.state : null;
    return { temp: s?.temp === "C" ? "C" : "F", wind: s?.wind ?? "mph" };
  } catch {
    return { temp: "F", wind: "mph" };
  }
}

/** Coordinate key used to match a widget's location against the app snapshot. */
export function locationKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/** Pure: assemble the widget view-model from raw NWS data + units. */
export function buildWidgetWeather(
  place: string,
  cur: CurrentConditions | null,
  forecast: ForecastPeriod[],
  alerts: WeatherAlert[],
  units: { temp: TempUnit; wind: WindUnit },
  nowcast: string | null = null,
): WidgetWeather {
  const today = forecast[0];
  const hi = forecast.find((p) => p.isDaytime)?.temperature ?? null;
  const lo = forecast.find((p) => !p.isDaytime)?.temperature ?? null;
  const cond = parseCondition(
    cur?.textDescription || today?.shortForecast || "",
    cur?.icon || today?.icon,
    true,
  );
  const topAlert = [...alerts].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))[0];

  return {
    place,
    temp: `${displayTemp(cur?.temperatureC ?? null, units.temp)}°`,
    condition: cur?.textDescription || today?.shortForecast || "—",
    code: cond.code,
    isDay: cond.isDay,
    hi: `${displayTempF(hi, units.temp)}°`,
    lo: `${displayTempF(lo, units.temp)}°`,
    wind: `${degToCompass(cur?.windDirectionDeg ?? null)} ${displayWind(cur?.windSpeedKph ?? null, units.wind)} ${windUnitLabel(units.wind)}`,
    humidity: `${cur?.humidityPct != null ? Math.round(cur.humidityPct) : "--"}%`,
    updated: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    alertEvent: topAlert?.event ?? null,
    alertColor: (topAlert ? alertColor(topAlert.severity) : "#ff7a3d") as `#${string}`,
    nowcast,
  };
}

// ---- App → widget snapshot ----------------------------------------------
// The app writes what it just pulled for the active location here; widgets on
// the *same* location reuse it instantly (no network) so they match the app.

const SNAP_KEY = "skyfield.appSnapshot";
const SNAP_TTL_MS = 30 * 60 * 1000;

interface AppSnapshot {
  key: string; // locationKey of the data
  at: number; // epoch ms
  data: WidgetWeather;
}

export async function storeAppSnapshot(loc: SavedLocation, data: WidgetWeather): Promise<void> {
  const snap: AppSnapshot = { key: locationKey(loc.lat, loc.lon), at: Date.now(), data };
  await AsyncStorage.setItem(SNAP_KEY, JSON.stringify(snap));
}

async function readFreshSnapshot(key: string): Promise<WidgetWeather | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const snap: AppSnapshot = JSON.parse(raw);
    if (snap.key === key && Date.now() - snap.at < SNAP_TTL_MS) return snap.data;
    return null;
  } catch {
    return null;
  }
}

/** Headless fetch of everything a widget displays. */
export async function fetchWidgetWeather(widgetId: number): Promise<WidgetWeather | null> {
  const loc: SavedLocation | null = await resolveWidgetLocation(widgetId);
  if (!loc) return null;

  // Fast path: if the app recently pulled this exact location, show *that* —
  // so the widget mirrors what the app last displayed, with no network call.
  const cached = await readFreshSnapshot(locationKey(loc.lat, loc.lon));
  if (cached) return cached;

  const units = await readUnits();
  const meta = await getPointMeta({ lat: loc.lat, lon: loc.lon });
  const [cur, forecast, alerts, nc] = await Promise.all([
    getCurrentConditions(meta).catch(() => null),
    getForecast(meta).catch(() => []),
    getActiveAlerts({ lat: loc.lat, lon: loc.lon }).catch(() => []),
    getNowcast({ lat: loc.lat, lon: loc.lon }).catch(() => null),
  ]);

  const ncLine = nc && (nc.precipitatingNow || nc.type !== "none") ? nc.summary : null;
  return buildWidgetWeather(loc.label, cur, forecast, alerts, units, ncLine);
}

/** fetchWidgetWeather with a hard timeout so config Save can never hang. */
export async function fetchWidgetWeatherQuick(
  widgetId: number,
  timeoutMs = 6000,
): Promise<WidgetWeather | null> {
  return Promise.race([
    fetchWidgetWeather(widgetId).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}
