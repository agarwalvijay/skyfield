/**
 * Short-term precipitation "nowcast" (MinuteCast-style) from Open-Meteo's
 * 15-minute model data — free, no API key. NWS only offers 1–6h precip blocks,
 * so this is our source for "rain starting in ~25 min / stopping in ~40 min".
 *
 * 15-minute resolution (not true 1-minute radar extrapolation), which is plenty
 * for a "is precip coming / going" readout.
 */

import type { Coordinates } from "@/lib/nws";

export type PrecipType = "rain" | "snow" | "mix" | "none";

export interface NowcastInterval {
  /** Epoch ms at the start of this 15-minute block. */
  time: number;
  /** Minutes from now to this block (can be slightly negative for the current block). */
  minutesFromNow: number;
  /** Liquid-equivalent precipitation in this block, mm. */
  precipMm: number;
  /** Snowfall in this block, cm. */
  snowCm: number;
  probability: number;
  type: PrecipType;
  wet: boolean;
  /** Projected from radar motion rather than observed. */
  estimated?: boolean;
}

export interface Nowcast {
  intervals: NowcastInterval[];
  /** Ready-to-show line, e.g. "Rain stopping in ~40 min". */
  summary: string;
  /** Dominant precip type across the window (for coloring/icon). */
  type: PrecipType;
  precipitatingNow: boolean;
  /** Window length in minutes (typically 120). */
  windowMinutes: number;
  /** Card eyebrow ("Next 2 hours" for model, "Radar · last hour" for radar). */
  title?: string;
  /** Radar saw precip near (not at) the point. */
  hasNearby?: boolean;
  /** Radar projects precip reaching the point within its short motion window. */
  hasArriving?: boolean;
  /** Current radar intensity at the point: 0 none → 4 intense (radar source only). */
  radarLevel?: number;
}

/** A block counts as "wet" at/above this liquid rate per 15 min. */
const WET_MM = 0.1;

/** Live radar (with ~30-min motion projection) is authoritative within this many
 *  minutes; the model only speaks for precip beyond it. */
const RADAR_HORIZON_MIN = 35;

interface OpenMeteoMinutely {
  time: number[];
  precipitation: number[];
  rain: number[];
  snowfall: number[];
  precipitation_probability: number[];
}

function classify(precipMm: number, rainMm: number, snowCm: number): PrecipType {
  if (precipMm < WET_MM) return "none";
  const snowy = snowCm >= 0.1;
  const rainy = rainMm >= WET_MM;
  if (snowy && rainy) return "mix";
  if (snowy) return "snow";
  return "rain";
}

function typeWord(t: PrecipType): string {
  switch (t) {
    case "snow":
      return "Snow";
    case "mix":
      return "Wintry mix";
    case "rain":
      return "Rain";
    default:
      return "Precipitation";
  }
}

function typeNoun(t: PrecipType): string {
  switch (t) {
    case "snow":
      return "snow";
    case "mix":
      return "wintry mix";
    default:
      return "rain";
  }
}

/** Humanize a minute count: "~25 min", "~1 hr", "~1 hr 30 min". */
function humanize(min: number): string {
  const m = Math.max(5, Math.round(min / 5) * 5);
  if (m < 60) return `~${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `~${h} hr` : `~${h} hr ${rem} min`;
}

/** Pick the dominant non-none type among a set of intervals. */
function dominant(intervals: NowcastInterval[]): PrecipType {
  const tally: Record<PrecipType, number> = { rain: 0, snow: 0, mix: 0, none: 0 };
  for (const i of intervals) if (i.wet) tally[i.type] += i.precipMm;
  const order: PrecipType[] = ["mix", "snow", "rain"];
  let best: PrecipType = "rain";
  let bestVal = -1;
  for (const t of order) {
    if (tally[t] > bestVal) {
      bestVal = tally[t];
      best = t;
    }
  }
  return bestVal > 0 ? best : "none";
}

function buildSummary(intervals: NowcastInterval[], windowMinutes: number): { summary: string; type: PrecipType } {
  if (intervals.length === 0) return { summary: "Nowcast unavailable", type: "none" };

  const nowWet = intervals[0].wet;

  if (nowWet) {
    const stopIdx = intervals.findIndex((iv, i) => i > 0 && !iv.wet);
    const wetRun = stopIdx === -1 ? intervals : intervals.slice(0, stopIdx);
    const type = dominant(wetRun);
    const word = typeWord(type);

    if (stopIdx === -1) {
      return { summary: `${word} for the next ${Math.round(windowMinutes / 60)} hr`, type };
    }
    const stopMin = intervals[stopIdx].minutesFromNow;
    // Does it pick back up afterward?
    const resumeIdx = intervals.findIndex((iv, i) => i > stopIdx && iv.wet);
    if (resumeIdx !== -1) {
      return {
        summary: `${word} stopping in ${humanize(stopMin)}, returning later`,
        type,
      };
    }
    return { summary: `${word} stopping in ${humanize(stopMin)}`, type };
  }

  // Dry now — when does it start?
  const startIdx = intervals.findIndex((iv) => iv.wet);
  if (startIdx !== -1) {
    const type = dominant(intervals.slice(startIdx));
    const word = typeWord(type);
    const startMin = intervals[startIdx].minutesFromNow;
    return { summary: `${word} starting in ${humanize(startMin)}`, type };
  }

  // No precip by amount — fall back to probability for a softer message.
  const maxProb = Math.max(...intervals.map((i) => i.probability));
  const hrs = Math.round(windowMinutes / 60);
  if (maxProb >= 40) return { summary: `Showers possible in the next ${hrs} hr`, type: "none" };
  return { summary: `No precipitation for the next ${hrs} hr`, type: "none" };
}

function radarArrivalWithinHorizon(radar: Nowcast): boolean {
  return radar.intervals.some((iv) => iv.estimated && iv.wet && iv.minutesFromNow <= RADAR_HORIZON_MIN);
}

function modelTypeNearRadarWindow(model: Nowcast): PrecipType {
  const nearby = model.intervals.filter((iv) => iv.minutesFromNow <= RADAR_HORIZON_MIN);
  return dominant(nearby);
}

function withModelPrecipType(radar: Nowcast, model: Nowcast): Nowcast {
  const type = modelTypeNearRadarWindow(model);
  if (type === "none" || type === "rain" || radar.type !== "rain") return radar;

  const noun = typeNoun(type);
  let summary = radar.summary
    .replace(/\brain\b/gi, noun)
    .replace(/\bshowers\b/gi, type === "snow" ? "snow" : noun);
  if (radar.hasNearby && !radar.precipitatingNow && !radar.hasArriving) {
    summary = `${typeWord(type)} nearby`;
  }

  return {
    ...radar,
    summary,
    type,
    intervals: radar.intervals.map((iv) => (iv.wet ? { ...iv, type } : iv)),
  };
}

/** Model-based nowcast (Open-Meteo 15-min). Good for the 2-hour outlook when
 *  there's nothing on radar, but blind to live convection. */
export async function getModelNowcast(
  { lat, lon }: Coordinates,
  signal?: AbortSignal,
): Promise<Nowcast> {
  // 12 blocks = 3h of headroom; we summarize/display the first ~2h.
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&minutely_15=precipitation,rain,snowfall,precipitation_probability` +
    `&forecast_minutely_15=12&timeformat=unixtime`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Nowcast unavailable");
  const data = await res.json();
  const m: OpenMeteoMinutely | undefined = data.minutely_15;
  if (!m?.time?.length) throw new Error("Nowcast unavailable");

  const now = Date.now();
  const windowMinutes = 120;

  const all: NowcastInterval[] = m.time.map((t, i) => {
    const time = t * 1000;
    const precipMm = m.precipitation[i] ?? 0;
    const rainMm = m.rain[i] ?? 0;
    const snowCm = m.snowfall[i] ?? 0;
    const type = classify(precipMm, rainMm, snowCm);
    return {
      time,
      minutesFromNow: Math.round((time - now) / 60000),
      precipMm,
      snowCm,
      probability: m.precipitation_probability[i] ?? 0,
      type,
      wet: precipMm >= WET_MM,
    };
  });

  // Keep the current block plus the next 2 hours.
  const intervals = all.filter((iv) => iv.minutesFromNow <= windowMinutes + 15);

  const { summary, type } = buildSummary(intervals, windowMinutes);
  return {
    intervals: intervals.filter((iv) => iv.minutesFromNow <= windowMinutes),
    summary,
    title: "Next 2 hours",
    type,
    precipitatingNow: intervals[0]?.wet ?? false,
    windowMinutes,
  };
}

/**
 * Radar-first nowcast: trust live radar for what's happening now/nearby (it
 * catches storms the model misses); fall back to the model for the 2-hour
 * outlook when radar is clear.
 */
export async function getNowcast(coords: Coordinates, signal?: AbortSignal): Promise<Nowcast> {
  const radarPromise = import("./radar")
    .then(({ getRadarNowcast }) => getRadarNowcast(coords, signal))
    .catch(() => null);
  const modelPromise = getModelNowcast(coords, signal).catch(() => null);
  const [radar, model] = await Promise.all([radarPromise, modelPromise]);

  if (!model) {
    if (radar) return radar; // radar reading is better than nothing
    throw new Error("Nowcast unavailable");
  }

  // Live radar wins for precip happening now or motion-projected to arrive soon;
  // the model contributes precip type so radar-driven snow/mix is not called rain.
  if (radar && (radar.precipitatingNow || radar.hasArriving || radarArrivalWithinHorizon(radar))) {
    return withModelPrecipType(radar, model);
  }

  // Radar is clear near-term. The model occasionally predicts "rain in ~20 min"
  // that the live radar (clear, with ~30-min motion projection) contradicts —
  // an edge case, but a jarring false alarm. So when radar is available, only
  // defer to the model for precip BEYOND radar's horizon; inside it, the clear
  // radar reading wins.
  if (radar) {
    const firstWet = model.intervals.find((iv) => iv.wet);
    if (firstWet && firstWet.minutesFromNow <= RADAR_HORIZON_MIN) return radar;
    if (!firstWet && radar.hasNearby) return radar;
  }
  return model;
}
