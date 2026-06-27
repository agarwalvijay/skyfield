import type { Coordinates } from "@/lib/nws";
import { getRadarFrames, type RadarFrame } from "@/lib/radar/rainviewer";
import { fetchTile, tileForPoint, type DecodedTile } from "@/lib/radar/sampleTile";
import { levelWord, pixelLevel, type RainLevel } from "@/lib/radar/intensity";
import type { Nowcast, NowcastInterval } from "./openmeteo";

const Z = 7; // RainViewer free max zoom

function tileUrl(host: string, frame: RadarFrame, x: number, y: number): string {
  // color scheme 4, NO smoothing (0_1): smoothed tiles paint soft grey halos
  // around echoes that misclassify as precip. The map display uses smoothing
  // for looks; sampling uses crisp tiles for accurate pixel→intensity.
  return `${host}${frame.path}/256/${Z}/${x}/${y}/4/0_1.png`;
}

/** Highest level in a 3×3 ring of radius `r` px around (cx, cy). Sampling a
 *  small neighborhood instead of a single pixel avoids radar gaps/noise reading
 *  as "dry" — critical when projecting whether rain will continue or clear. */
function ringMax(tile: DecodedTile, cx: number, cy: number, r: number): RainLevel {
  let max: RainLevel = 0;
  for (const ox of [-r, 0, r]) {
    for (const oy of [-r, 0, r]) {
      const lvl = pixelLevel(tile.at(cx + ox, cy + oy));
      if (lvl > max) max = lvl;
    }
  }
  return max;
}

/** Highest level among the point pixel + a ring ~20km around it. */
function neighborhoodLevel(tile: DecodedTile, px: number, py: number): RainLevel {
  return ringMax(tile, px, py, 18);
}

/**
 * Max precip level over a region ALIGNED to the storm motion: long along the
 * motion axis, narrow across it. Precip reaches a point by travelling along the
 * motion vector, so a band off to the *side* (perpendicular) moves parallel and
 * never arrives — a symmetric disk wrongly counts it (the 2026-06-26 Hoffman
 * "continuing" miss: a W–E band lifting east, ~4km north, read as rain reaching
 * the point). Elongating along-track keeps robustness to gaps/timing without the
 * perpendicular false-positives. Falls back to a tight disk when motion is
 * unknown (can't orient). `(cx,cy)` is the upwind source; px coords.
 */
function trackMax(
  tile: DecodedTile,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  alongHalf: number,
  crossHalf: number,
): RainLevel {
  const speed = Math.hypot(dx, dy);
  if (speed < 0.75) return ringMax(tile, cx, cy, crossHalf);
  const ux = dx / speed;
  const uy = dy / speed;
  const nx = -uy; // unit perpendicular to motion
  const ny = ux;
  let max: RainLevel = 0;
  for (let a = -alongHalf; a <= alongHalf; a++) {
    for (let c = -crossHalf; c <= crossHalf; c++) {
      const sx = Math.round(cx + a * ux + c * nx);
      const sy = Math.round(cy + a * uy + c * ny);
      const lvl = pixelLevel(tile.at(sx, sy));
      if (lvl > max) max = lvl;
    }
  }
  return max;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const lvlAt = (t: DecodedTile | null, x: number, y: number): number =>
  t ? pixelLevel(t.at(x, y)) : 0;

/**
 * Estimate storm motion (px per 10-min step) by block-matching the precip field
 * around the point between the two latest frames. Hardened for light/broken
 * echoes, where the real shift is small and easily lost:
 *   - FINE window sampling (every pixel, not every 2nd): a 1-px directional
 *     component (e.g. the northward lift in the 2026-06-26 Hoffman case) is only
 *     visible at full density — coarse sampling flattens it.
 *   - mass weighting: heavier echoes drive the match instead of light speckle.
 *   - only a TINY small-motion bias: enough to break exact ties toward slower
 *     motion, but not enough to erase a genuine 1-px component (the old 0.004
 *     bias did exactly that).
 * Single 10-min step (not a longer baseline): light echoes decorrelate within
 * ~20–30 min, so a longer baseline matches worse and the divide-back rounds the
 * small component away. Returns {0,0} when there's too little echo mass.
 */
function estimateMotion(
  prev: DecodedTile | null,
  now: DecodedTile | null,
  px: number,
  py: number,
): { dx: number; dy: number } {
  if (!prev || !now) return { dx: 0, dy: 0 };
  const W = 14; // half match window (~14km)
  const S = 9; // max shift searched (~60 km/h at z7)
  let best = Infinity;
  let bdx = 0;
  let bdy = 0;
  let wsumBest = 0;
  for (let sy = -S; sy <= S; sy++) {
    for (let sx = -S; sx <= S; sx++) {
      let sum = 0;
      let wsum = 0;
      for (let wy = -W; wy <= W; wy++) {
        for (let wx = -W; wx <= W; wx++) {
          const a = lvlAt(now, px + wx, py + wy);
          const b = lvlAt(prev, px + wx - sx, py + wy - sy);
          if (a === 0 && b === 0) continue;
          const w = Math.max(a, b); // mass weight: heavier echoes matter more
          const d = a - b;
          sum += w * d * d;
          wsum += w;
        }
      }
      if (wsum < 10) continue;
      const score = sum / wsum + (sx * sx + sy * sy) * 0.001; // tiny tie-break only
      if (score < best) {
        best = score;
        bdx = sx;
        bdy = sy;
        wsumBest = wsum;
      }
    }
  }
  return wsumBest >= 10 ? { dx: bdx, dy: bdy } : { dx: 0, dy: 0 };
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
    // Tight neighborhood max (not a single pixel): radar has speckle/dropouts, so
    // one dead pixel at the point shouldn't under-report intensity when the cell
    // around you is heavy. r=1 ≈ the immediate ~1–2 km.
    const level = tile ? ringMax(tile, px, py, 1) : 0;
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
      // Precip "upwind" of the point arrives in t steps. Sample a motion-aligned
      // region around that upwind source: a TIGHT ±1px along-track (just timing
      // slack — the three t-steps already cover distance along the track, and a
      // wider along-window reaches back to the point's current echo and over-
      // predicts) and ±2px across-track (ignore parallel side-bands). See
      // trackMax.
      futureLevels.push(trackMax(latestTile, px - t * dx, py - t * dy, dx, dy, 1, 2));
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
  const firstWet = futureLevels.findIndex((l) => l >= 1);
  // Only call it "clearing" when the projection goes dry AND *stays* dry through
  // the end of the window — a single dry step with rain after it is not clearing,
  // and broad/stationary rain (no clear motion) should read as "continuing".
  // clearIdx = first index of the persistent dry tail (-1 if it never settles).
  let clearIdx = -1;
  for (let i = futureLevels.length - 1; i >= 0; i--) {
    if (futureLevels[i] >= 1) break;
    clearIdx = i;
  }

  if (nowLevel >= 1) {
    precipitatingNow = true;
    const word = cap(levelWord(nowLevel));
    if (clearIdx === 0) {
      summary = `${word} rain now — clearing in ~10 min`;
    } else if (clearIdx > 0) {
      summary = `${word} rain now — easing, clearing in ~${(clearIdx + 1) * 10} min`;
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
