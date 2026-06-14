import { nwsFetch } from "./client";
import type { ForecastPeriod, HourlyPeriod, PointMeta } from "./types";

interface PeriodsResponse<T> {
  properties: { updated: string; periods: T[] };
}

/** 7-day (day/night) textual forecast periods. */
export async function getForecast(
  meta: PointMeta,
  signal?: AbortSignal,
): Promise<ForecastPeriod[]> {
  const data = await nwsFetch<PeriodsResponse<ForecastPeriod>>(meta.forecastUrl, { signal });
  return data.properties.periods;
}

/** Hour-by-hour forecast (typically 156 hours). */
export async function getHourlyForecast(
  meta: PointMeta,
  signal?: AbortSignal,
): Promise<HourlyPeriod[]> {
  const data = await nwsFetch<PeriodsResponse<HourlyPeriod>>(meta.forecastHourlyUrl, { signal });
  return data.properties.periods;
}
