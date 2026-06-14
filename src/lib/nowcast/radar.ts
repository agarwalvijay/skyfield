import type { Coordinates } from "@/lib/nws";
import { getRadarFrames, type RadarFrame } from "@/lib/radar/rainviewer";
import { fetchTile, tileForPoint, type DecodedTile } from "@/lib/radar/sampleTile";
import { levelWord, pixelLevel, type RainLevel } from "@/lib/radar/intensity";
import type { Nowcast, NowcastInterval } from "./openmeteo";

const Z = 7; // RainViewer free max zoom

function tileUrl(host: string, frame: RadarFrame, x: number, y: number): string {
  // color scheme 4, smooth, no snow flag
  return `${host}${frame.path}/256/${Z}/${x}/${y}/4/1_1.png`;
}

/** Highest level among the point pixel + a ring ~20km around it. */
function neighborhoodLevel(tile: DecodedTile, px: number, py: number): RainLevel {
  let max: RainLevel = 0;
  const offsets = [-18, 0, 18];
  for (const dx of offsets) {
    for (const dy of offsets) {
      const lvl = pixelLevel(tile.at(px + dx, py + dy));
      if (lvl > max) max = lvl;
    }
  }
  return max;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const lvlAt = (t: DecodedTile | null, x: number, y: number): number =>
  t ? pixelLevel(t.at(x, y)) : 0;

/**
 * Estimate storm motion (px per 10-min frame) by finding the shift that best
 * aligns the precip field around the point between two frames. Returns {0,0}
 * when there's no usable signal.
 */
function estimateMotion(
  prev: DecodedTile | null,
  now: DecodedTile | null,
  px: number,
  py: number,
): { dx: number; dy: number } {
  if (!prev || !now) return { dx: 0, dy: 0 };
  const W = 14; // half window
  const S = 9; // max shift searched (~60 km/h at z7)
  let best = Infinity;
  let bdx = 0;
  let bdy = 0;
  let signal = 0;
  for (let sy = -S; sy <= S; sy++) {
    for (let sx = -S; sx <= S; sx++) {
      let sum = 0;
      let cnt = 0;
      for (let wy = -W; wy <= W; wy += 2) {
        for (let wx = -W; wx <= W; wx += 2) {
          const a = lvlAt(now, px + wx, py + wy);
          const b = lvlAt(prev, px + wx - sx, py + wy - sy);
          if (a === 0 && b === 0) continue;
          const d = a - b;
          sum += d * d;
          cnt++;
        }
      }
      if (cnt < 6) continue;
      // Normalize, with a mild bias toward smaller motion to break ties.
      const score = sum / cnt + (sx * sx + sy * sy) * 0.004;
      if (score < best) {
        best = score;
        bdx = sx;
        bdy = sy;
        signal = cnt;
      }
    }
  }
  return signal > 0 ? { dx: bdx, dy: bdy } : { dx: 0, dy: 0 };
}

/**
 * Radar-based nowcast: samples the live radar at the user's location over the
 * last hour. Catches storms the forecast model misses, with directional
 * language (intensity + trend + nearby) rather than precise timing.
 */
export async function getRadarNowcast(
  { lat, lon }: Coordinates,
  signal?: AbortSignal,
): Promise<Nowcast | null> {
  const radar = await getRadarFrames(signal);
  const past = radar.frames.filter((f) => !f.forecast);
  if (past.length === 0) return null;

  // Last ~hour at 10-min cadence (newest = "now"), plus any forecast frames.
  const recent = past.slice(-7);
  const future = radar.frames.filter((f) => f.forecast);
  const frames = [...recent, ...future];

  const { x, y, px, py } = tileForPoint(lat, lon, Z);
  const now = Date.now();

  const tiles = await Promise.all(
    frames.map((f) => fetchTile(tileUrl(radar.host, f, x, y), signal).catch(() => null)),
  );
  if (tiles.every((t) => t === null)) return null;

  const intervals: NowcastInterval[] = frames.map((f, i) => {
    const tile = tiles[i];
    const level = tile ? pixelLevel(tile.at(px, py)) : 0;
    return {
      time: f.time * 1000,
      minutesFromNow: Math.round((f.time * 1000 - now) / 60000),
      precipMm: level, // 0–4 intensity used as bar height
      snowCm: 0,
      probability: 0,
      type: level > 0 ? "rain" : "none",
      wet: level > 0,
    };
  });

  // "Now" = the most recent observed (non-forecast) frame.
  const nowIdx = recent.length - 1;
  const nowLevel = (intervals[nowIdx]?.precipMm ?? 0) as RainLevel;
  // ~30 min ago for trend.
  const prevIdx = Math.max(0, nowIdx - 3);
  const prevLevel = (intervals[prevIdx]?.precipMm ?? 0) as RainLevel;
  const trend = nowLevel - prevLevel;

  const latestTile = tiles[nowIdx];
  const prevTile = tiles[Math.max(0, nowIdx - 1)];
  const nearby = latestTile ? neighborhoodLevel(latestTile, px, py) : 0;
  const hasNearby = nearby > 0;

  // ---- Future via radar motion (advect the current field along its motion) ----
  const { dx, dy } = estimateMotion(prevTile, latestTile, px, py);
  const futureLevels: RainLevel[] = [];
  if (latestTile && (dx !== 0 || dy !== 0 || nowLevel > 0)) {
    for (let t = 1; t <= 3; t++) {
      // Precip currently "upwind" of the point arrives at the point in t steps.
      futureLevels.push(pixelLevel(latestTile.at(px - t * dx, py - t * dy)) as RainLevel);
    }
    futureLevels.forEach((level, k) => {
      const min = (k + 1) * 10;
      intervals.push({
        time: now + min * 60000,
        minutesFromNow: min,
        precipMm: level,
        snowCm: 0,
        probability: 0,
        type: level > 0 ? "rain" : "none",
        wet: level > 0,
        estimated: true,
      });
    });
  }

  // ---- Summary: present + projected near futureLevels ----
  let summary: string;
  let precipitatingNow = false;
  const firstDry = futureLevels.findIndex((l) => l < 1);
  const firstWet = futureLevels.findIndex((l) => l >= 1);

  if (nowLevel >= 1) {
    precipitatingNow = true;
    const word = cap(levelWord(nowLevel));
    if (futureLevels.length && futureLevels.every((l) => l < 1)) {
      const mins = (firstDry + 1) * 10;
      summary = `${word} rain now — clearing in ~${mins} min`;
    } else if (firstDry > 0) {
      summary = `${word} rain now — easing, clearing in ~${(firstDry + 1) * 10} min`;
    } else if (trend >= 1 || (futureLevels.length && futureLevels[futureLevels.length - 1] > nowLevel)) {
      summary = `${word} rain now — building`;
    } else if (trend <= -1) {
      summary = `${word} rain now — slowly easing`;
    } else {
      summary = `${word} rain now — continuing`;
    }
  } else if (firstWet >= 0) {
    const arriving = futureLevels[firstWet];
    summary = `${cap(levelWord(arriving))} rain reaching you in ~${(firstWet + 1) * 10} min`;
    precipitatingNow = false;
  } else if (nearby >= 1) {
    summary = nearby >= 3 ? "Heavy showers nearby" : "Showers nearby";
  } else {
    summary = "No rain on radar right now";
  }

  return {
    intervals,
    summary,
    title: "Radar nowcast",
    type: nowLevel >= 1 || nearby >= 1 || firstWet >= 0 ? "rain" : "none",
    precipitatingNow,
    hasNearby,
    radarLevel: nowLevel,
    windowMinutes: 90,
  };
}
