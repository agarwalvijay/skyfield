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

interface Motion {
  dx: number;
  dy: number;
  confidence: number;
  mass: number;
  centerX: number;
  centerY: number;
  source: "local" | "nearby" | "none";
}

interface Candidate {
  x: number;
  y: number;
  level: RainLevel;
  distance: number;
}

/**
 * Estimate storm motion (px per 10-min step) by block-matching a precip field
 * between the two latest frames. Hardened for light/broken echoes, where the
 * real shift is small and easily lost:
 *   - FINE window sampling (every pixel, not every 2nd): a 1-px directional
 *     component (e.g. the northward lift in the 2026-06-26 Hoffman case) is only
 *     visible at full density — coarse sampling flattens it.
 *   - mass weighting: heavier echoes drive the match instead of light speckle.
 *   - only a TINY small-motion bias: enough to break exact ties toward slower
 *     motion, but not enough to erase a genuine 1-px component (the old 0.004
 *     bias did exactly that).
 * Single 10-min step (not a longer baseline): light echoes decorrelate within
 * ~20–30 min, so a longer baseline matches worse and the divide-back rounds
 * small components away.
 */
function matchMotion(
  prev: DecodedTile | null,
  now: DecodedTile | null,
  cx: number,
  cy: number,
  half: number,
  search: number,
): Motion {
  const none = { dx: 0, dy: 0, confidence: 0, mass: 0, centerX: cx, centerY: cy, source: "none" as const };
  if (!prev || !now) return none;
  let best = Infinity;
  let second = Infinity;
  let bdx = 0;
  let bdy = 0;
  let wsumBest = 0;
  for (let sy = -search; sy <= search; sy++) {
    for (let sx = -search; sx <= search; sx++) {
      let sum = 0;
      let wsum = 0;
      for (let wy = -half; wy <= half; wy++) {
        for (let wx = -half; wx <= half; wx++) {
          const a = lvlAt(now, cx + wx, cy + wy);
          const b = lvlAt(prev, cx + wx - sx, cy + wy - sy);
          if (a === 0 && b === 0) continue;
          const weight = Math.max(a, b); // mass weight: heavier echoes matter more
          const d = a - b;
          sum += weight * d * d;
          wsum += weight;
        }
      }
      if (wsum < 10) continue;
      const score = sum / wsum + (sx * sx + sy * sy) * 0.001; // tiny tie-break only
      if (score < best) {
        second = best;
        best = score;
        bdx = sx;
        bdy = sy;
        wsumBest = wsum;
      } else if (score < second) {
        second = score;
      }
    }
  }
  if (wsumBest < 10 || !Number.isFinite(best)) return none;

  const separation = Number.isFinite(second) ? (second - best) / Math.max(second, 0.001) : 0;
  const massConfidence = Math.min(1, wsumBest / 80);
  const confidence = Math.max(0, Math.min(1, separation * massConfidence));
  return { dx: bdx, dy: bdy, confidence, mass: wsumBest, centerX: cx, centerY: cy, source: "local" };
}

function estimateAtCenter(
  prev: DecodedTile | null,
  now: DecodedTile | null,
  cx: number,
  cy: number,
  w: number,
): Motion {
  let motion = matchMotion(prev, now, cx, cy, w, 9);
  const hitSearchEdge = Math.abs(motion.dx) === 9 || Math.abs(motion.dy) === 9;
  if (hitSearchEdge) {
    const wider = matchMotion(prev, now, cx, cy, w, 14);
    if (wider.confidence > motion.confidence * 1.15) motion = wider;
  }
  return motion;
}

function nearbyCandidates(tile: DecodedTile, px: number, py: number): Candidate[] {
  const candidates: Candidate[] = [];
  const radius = 48;
  const step = 4;
  for (let y = py - radius; y <= py + radius; y += step) {
    for (let x = px - radius; x <= px + radius; x += step) {
      const distance = Math.hypot(x - px, y - py);
      if (distance > radius) continue;
      const level = ringMax(tile, x, y, 1);
      if (level === 0) continue;
      candidates.push({ x, y, level, distance });
    }
  }
  return candidates
    .sort((a, b) => b.level * 24 - b.distance - (a.level * 24 - a.distance))
    .slice(0, 14);
}

function aimingScore(motion: Motion, px: number, py: number, level: RainLevel): number {
  const speed2 = motion.dx * motion.dx + motion.dy * motion.dy;
  if (speed2 < 0.75 * 0.75) return -Infinity;

  const vx = px - motion.centerX;
  const vy = py - motion.centerY;
  const stepsToPoint = (vx * motion.dx + vy * motion.dy) / speed2;
  if (stepsToPoint <= 0 || stepsToPoint > 4.25) return -Infinity;

  const speed = Math.sqrt(speed2);
  const crossTrack = Math.abs(vx * motion.dy - vy * motion.dx) / speed;
  if (crossTrack > 9) return -Infinity;

  return motion.confidence * 100 + level * 16 - crossTrack * 5 - Math.abs(stepsToPoint - 2) * 3;
}

function estimateMotion(
  prev: DecodedTile | null,
  now: DecodedTile | null,
  px: number,
  py: number,
  nowLevel: RainLevel,
): Motion {
  const none = { dx: 0, dy: 0, confidence: 0, mass: 0, centerX: px, centerY: py, source: "none" as const };
  if (!prev || !now) return none;

  const local = estimateAtCenter(prev, now, px, py, 14);
  if (nowLevel > 0 && (local.mass >= 10 || local.confidence > 0)) return { ...local, source: "local" };
  if (local.confidence >= 0.08 && local.mass >= 20) return { ...local, source: "local" };

  let best: { motion: Motion; score: number } | null = null;
  for (const c of nearbyCandidates(now, px, py)) {
    const motion = estimateAtCenter(prev, now, c.x, c.y, 12);
    if (motion.mass < 10 || motion.confidence < 0.02) continue;
    const score = aimingScore(motion, px, py, c.level);
    if (!Number.isFinite(score)) continue;
    if (!best || score > best.score) best = { motion: { ...motion, source: "nearby" }, score };
  }

  return best?.motion ?? none;
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

  // Last ~hour at 10-min cadence (newest = "now"). RainViewer also exposes
  // vendor forecast frames, but the summary below is driven by our local
  // motion projection; mixing both creates duplicate future bars and can make
  // the UI imply a longer radar horizon than the algorithm actually trusts.
  const recent = past.slice(-7);
  const frames = recent;

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
  const { dx, dy } = estimateMotion(prevTile, latestTile, px, py, nowLevel);
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
    hasArriving: firstWet >= 0,
    radarLevel: nowLevel,
    windowMinutes: 90,
  };
}
