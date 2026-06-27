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
import { getNowcast, type Nowcast } from "@/lib/nowcast/openmeteo";
import type { SavedLocation } from "@/store/locations";
import { readWidgetConfig, resolveWidgetLocation } from "./widgetConfigStore";
import { freshForKey, putPlace, setBinding } from "./widgetStore";
import { requestWidgetRepaint } from "./widgetBridge";

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
  /** Next-2h precip bar heights (0–100) for the banner's rain chart, or null
   *  when there's no precip (→ widget stays in its normal layout). */
  nowcastBars: number[] | null;
  /** Index of the "now" bar within nowcastBars (-1 if none). */
  nowcastNowIdx: number;
}

/** Bar heights (0–100) + the "now" index from a nowcast, or null when there's
 *  no precip in the window (→ the banner stays in its normal, non-chart layout). */
export function nowcastBarsFrom(nc: Nowcast | null): { bars: number[]; nowIdx: number } | null {
  if (!nc || !nc.intervals?.length || !nc.intervals.some((i) => i.wet)) return null;
  const ivs = nc.intervals.slice(0, 16);
  const maxMm = Math.max(0.5, ...ivs.map((i) => i.precipMm));
  const bars = ivs.map((i) => (i.wet ? Math.max(10, Math.round((i.precipMm / maxMm) * 100)) : 4));
  const nowIdx = ivs.reduce(
    (best, iv, i) => (Math.abs(iv.minutesFromNow) < Math.abs(ivs[best].minutesFromNow) ? i : best),
    0,
  );
  return { bars, nowIdx };
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
  nowcastBars: number[] | null = null,
  nowcastNowIdx = -1,
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
    nowcastBars,
    nowcastNowIdx,
  };
}

// ---- Publishing into the store ------------------------------------------
// All writes go through the catalog (widgetStore.ts). The app, the background
// task, and the on-demand ⟳ worker are all just data sources feeding the same
// newest-wins store; none of them knows or cares which widget consumes what.

const FRESH_TTL_MS = 30 * 60 * 1000;

/** The app, after pulling its ACTIVE location, publishes it as the active row. */
export async function storeAppSnapshot(loc: SavedLocation, data: WidgetWeather): Promise<void> {
  await putPlace(locationKey(loc.lat, loc.lon), data, Date.now(), true);
  requestWidgetRepaint();
}

/** Headless fetch of everything a widget displays, published into the store.
 *  Pass force=true (explicit refresh) to skip the cached row and hit the
 *  network. Also records the widget's subscription (binding) so the native
 *  render half can find this widget's row. */
export async function fetchWidgetWeather(
  widgetId: number,
  force = false,
): Promise<WidgetWeather | null> {
  const cfg = await readWidgetConfig(widgetId);
  const loc: SavedLocation | null = await resolveWidgetLocation(widgetId);
  if (!loc) return null;

  const key = locationKey(loc.lat, loc.lon);
  const followsApp = cfg.locationId === "active";
  // Subscription: a widget either follows the app ("active") or pins a key.
  await setBinding(widgetId, followsApp ? "active" : key).catch(() => {});

  // Fast path: a recently-published row for this exact location — show *that*,
  // no network call, so the widget mirrors what the app last displayed.
  if (!force) {
    const cached = await freshForKey(key, FRESH_TTL_MS);
    if (cached) return cached;
  }

  const units = await readUnits();
  const meta = await getPointMeta({ lat: loc.lat, lon: loc.lon });
  const [cur, forecast, alerts, nc] = await Promise.all([
    getCurrentConditions(meta).catch(() => null),
    getForecast(meta).catch(() => []),
    getActiveAlerts({ lat: loc.lat, lon: loc.lon }).catch(() => []),
    getNowcast({ lat: loc.lat, lon: loc.lon }).catch(() => null),
  ]);

  const ncLine = nc && (nc.precipitatingNow || nc.type !== "none") ? nc.summary : null;
  const nb = nowcastBarsFrom(nc);
  const data = buildWidgetWeather(
    loc.label,
    cur,
    forecast,
    alerts,
    units,
    ncLine,
    nb?.bars ?? null,
    nb?.nowIdx ?? -1,
  );
  // Publish newest-wins; mark active so app-following widgets resolve to it.
  await putPlace(key, data, Date.now(), followsApp).catch(() => {});
  return data;
}

/** fetchWidgetWeather with a hard timeout so the headless task can never hang. */
export async function fetchWidgetWeatherQuick(
  widgetId: number,
  timeoutMs = 6000,
  force = false,
): Promise<WidgetWeather | null> {
  return Promise.race([
    fetchWidgetWeather(widgetId, force).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}
