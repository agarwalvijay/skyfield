import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DecodedTile } from "@/lib/radar/sampleTile";

const H = vi.hoisted(() => ({
  HOST: "https://tilecache.rainviewer.com",
  NOW_MS: 1_800_000_600_000,
  tiles: new Map<string, DecodedTile | null>(),
}));

vi.mock("@/lib/radar/rainviewer", () => ({
  getRadarFrames: vi.fn(async () => ({
    host: H.HOST,
    frames: [
      { time: Math.floor(H.NOW_MS / 1000) - 600, path: "/v2/radar/prev", forecast: false },
      { time: Math.floor(H.NOW_MS / 1000), path: "/v2/radar/now", forecast: false },
    ],
  })),
}));

vi.mock("@/lib/radar/sampleTile", async (orig) => {
  const actual = await orig<typeof import("@/lib/radar/sampleTile")>();
  return {
    ...actual,
    fetchTile: vi.fn(async (url: string) => {
      const id = String(url).match(/\/v2\/radar\/([^/]+)\//)?.[1];
      return id ? (H.tiles.get(id) ?? null) : null;
    }),
  };
});

import { getRadarNowcast } from "@/lib/nowcast/radar";
import { tileForPoint } from "@/lib/radar/sampleTile";

const POINT = { lat: 41.883, lon: -87.633 };
const pointPx = tileForPoint(POINT.lat, POINT.lon, 7);

const COLORS: Record<number, [number, number, number, number]> = {
  0: [0, 0, 0, 0],
  1: [0, 163, 224, 255],
  2: [255, 224, 0, 255],
  3: [255, 140, 0, 255],
};

function blankTile(): number[][] {
  return Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 0));
}

function drawBlob(grid: number[][], cx: number, cy: number, level = 2, radius = 3) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 0 || y < 0 || x >= 256 || y >= 256) continue;
      if (Math.hypot(x - cx, y - cy) <= radius) grid[y][x] = level;
    }
  }
}

function tileFrom(grid: number[][]): DecodedTile {
  return {
    width: 256,
    height: 256,
    at(px: number, py: number) {
      if (px < 0 || py < 0 || px >= 256 || py >= 256) return COLORS[0];
      return COLORS[grid[py][px] ?? 0];
    },
  };
}

describe("radar motion detection", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(H.NOW_MS);
    H.tiles.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    H.tiles.clear();
  });

  it("detects an incoming nearby echo even when the point itself is dry", async () => {
    const prev = blankTile();
    const now = blankTile();
    drawBlob(prev, pointPx.px - 24, pointPx.py, 2);
    drawBlob(now, pointPx.px - 16, pointPx.py, 2);
    H.tiles.set("prev", tileFrom(prev));
    H.tiles.set("now", tileFrom(now));

    const nc = await getRadarNowcast(POINT);
    const future = nc!.intervals.filter((iv) => iv.estimated).map((iv) => iv.precipMm);

    expect(nc!.precipitatingNow).toBe(false);
    expect(nc!.hasArriving).toBe(true);
    expect(nc!.summary).toMatch(/reaching you in ~20 min/i);
    expect(future).toEqual([0, 2, 0]);
  });

  it("does not turn a nearby echo moving away from the point into an arrival", async () => {
    const prev = blankTile();
    const now = blankTile();
    drawBlob(prev, pointPx.px - 12, pointPx.py, 2);
    drawBlob(now, pointPx.px - 18, pointPx.py, 2);
    H.tiles.set("prev", tileFrom(prev));
    H.tiles.set("now", tileFrom(now));

    const nc = await getRadarNowcast(POINT);
    const future = nc!.intervals.filter((iv) => iv.estimated);

    expect(nc!.precipitatingNow).toBe(false);
    expect(nc!.hasNearby).toBe(true);
    expect(nc!.hasArriving).toBe(false);
    expect(nc!.summary).toBe("Showers nearby");
    expect(future).toEqual([]);
  });
});
