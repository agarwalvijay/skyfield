import type { ForecastPeriod } from "@/lib/nws";

export interface DailyDay {
  key: string;
  /** "Monday", "This Afternoon" → trimmed to the day. */
  name: string;
  day?: ForecastPeriod;
  night?: ForecastPeriod;
  high: number | null;
  low: number | null;
  pop: number;
}

/** Collapse NWS day/night periods into one entry per calendar day. */
export function groupDaily(periods: ForecastPeriod[]): DailyDay[] {
  const map = new Map<string, DailyDay>();
  for (const p of periods) {
    const key = new Date(p.startTime).toDateString();
    const existing =
      map.get(key) ?? ({ key, name: "", high: null, low: null, pop: 0 } as DailyDay);
    if (p.isDaytime) {
      existing.day = p;
      existing.high = p.temperature;
      existing.name = p.name;
    } else {
      existing.night = p;
      existing.low = p.temperature;
      if (!existing.name) existing.name = p.name.replace(/ Night$/, "");
    }
    existing.pop = Math.max(existing.pop, p.probabilityOfPrecipitation?.value ?? 0);
    map.set(key, existing);
  }
  return Array.from(map.values());
}

/** Min low / max high across the set, for drawing relative range bars. */
export function rangeBounds(days: DailyDay[]): { gMin: number; gMax: number } {
  let gMin = Infinity;
  let gMax = -Infinity;
  for (const d of days) {
    if (d.low != null) gMin = Math.min(gMin, d.low);
    if (d.high != null) gMax = Math.max(gMax, d.high);
  }
  if (!isFinite(gMin)) gMin = 0;
  if (!isFinite(gMax)) gMax = 1;
  return { gMin, gMax };
}
