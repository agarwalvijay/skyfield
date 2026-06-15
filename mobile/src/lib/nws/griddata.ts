import { nwsFetch } from "./client";
import type { PointMeta } from "./types";

/**
 * Raw NWS gridpoint data — the numeric series behind the text forecast.
 * Supplies metrics the hourly forecast endpoint lacks: sky cover (cloud %),
 * quantitative precipitation (QPF), and snowfall amount.
 *
 * Values arrive as { validTime: "2026-06-12T18:00:00+00:00/PT6H", value }
 * spans; we expand each span into per-hour buckets keyed by epoch-hour so the
 * UI can join them against hourly forecast periods.
 */

interface GridValue {
  validTime: string;
  value: number | null;
}

interface GridDataResponse {
  properties: {
    skyCover?: { values: GridValue[] };
    quantitativePrecipitation?: { uom?: string; values: GridValue[] };
    snowfallAmount?: { uom?: string; values: GridValue[] };
    apparentTemperature?: { values: GridValue[] };
    windGust?: { values: GridValue[] };
  };
}

/** Per-hour series keyed by epoch hour (Date.parse / 3_600_000). */
export interface GridSeries {
  /** Cloud cover, percent. */
  skyCover: Map<number, number>;
  /** Liquid precipitation per hour, millimeters. */
  qpfMm: Map<number, number>;
  /** Snowfall per hour, millimeters. */
  snowMm: Map<number, number>;
  /** Feels-like temperature, °C. */
  apparentC: Map<number, number>;
  /** Wind gusts, km/h. */
  gustKmh: Map<number, number>;
}

/** Parse the duration half of a validTime into whole hours (min 1). */
function durationHours(validTime: string): number {
  const dur = validTime.split("/")[1] ?? "PT1H";
  const m = dur.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?)?/);
  const days = m?.[1] ? parseInt(m[1], 10) : 0;
  const hours = m?.[2] ? parseInt(m[2], 10) : 0;
  return Math.max(days * 24 + hours, 1);
}

function epochHour(validTime: string): number {
  return Math.floor(Date.parse(validTime.split("/")[0]) / 3_600_000);
}

/**
 * Expand spans into an hour-keyed map. `accumulate` divides the span's value
 * evenly across its hours (for accumulation quantities like QPF); otherwise
 * each hour gets the span's value as-is (for instantaneous ones like cloud %).
 */
function expand(values: GridValue[] | undefined, accumulate: boolean): Map<number, number> {
  const out = new Map<number, number>();
  for (const v of values ?? []) {
    if (v.value == null) continue;
    const hours = durationHours(v.validTime);
    const start = epochHour(v.validTime);
    const per = accumulate ? v.value / hours : v.value;
    for (let i = 0; i < hours; i++) out.set(start + i, per);
  }
  return out;
}

export interface Accumulation {
  /** Total liquid precip over the window, mm. */
  rainMm: number;
  /** Total snowfall over the window, mm (liquid-equiv source). */
  snowMm: number;
  /** Hours scanned (the requested window, clamped to available data). */
  hours: number;
}

/** Sum upcoming QPF + snowfall over the next `hours` from now. */
export function accumulation(series: GridSeries, hours = 24): Accumulation {
  const startHour = Math.floor(Date.now() / 3_600_000);
  let rainMm = 0;
  let snowMm = 0;
  for (let h = 0; h < hours; h++) {
    rainMm += series.qpfMm.get(startHour + h) ?? 0;
    snowMm += series.snowMm.get(startHour + h) ?? 0;
  }
  return { rainMm, snowMm, hours };
}

export async function getGridSeries(meta: PointMeta, signal?: AbortSignal): Promise<GridSeries> {
  const data = await nwsFetch<GridDataResponse>(meta.forecastGridDataUrl, { signal });
  const p = data.properties;
  return {
    skyCover: expand(p.skyCover?.values, false),
    qpfMm: expand(p.quantitativePrecipitation?.values, true),
    snowMm: expand(p.snowfallAmount?.values, true),
    apparentC: expand(p.apparentTemperature?.values, false),
    gustKmh: expand(p.windGust?.values, false),
  };
}
