import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Offline regression for the 2026-06-26 ~9:19pm CDT "continuing" miss near
// Hoffman Estates, IL. Real RainViewer 0_1 tiles are saved under fixtures/;
// see CASE.md. We replay getRadarNowcast with the frame list the app had at
// 9:19 (truncated at 21:10) and Date.now pinned to 9:19, serving the saved
// tiles to fetch. Ground truth (locked): the point was wet through 21:10 then
// bone dry from 21:20 for the next hour — so the correct call is "clearing",
// not "continuing".

const H = vi.hoisted(() => ({
  HOST: "https://tilecache.rainviewer.com",
  // frames the app had at 9:19 (20:10 → 21:10)
  INPUT: [
    [1782522600, "a1197f7f2e37"], [1782523200, "17c1b2d78b0c"], [1782523800, "15ee41a6c5cc"],
    [1782524400, "92a1fc14cec1"], [1782525000, "3e97c2a21a3f"], [1782525600, "a1d2866533ad"],
    [1782526200, "1309497ccc26"],
  ] as Array<[number, string]>,
}));

vi.mock("@/lib/radar/rainviewer", async (orig) => {
  const actual = await orig<typeof import("@/lib/radar/rainviewer")>();
  return {
    ...actual,
    getRadarFrames: vi.fn(async () => ({
      host: H.HOST,
      frames: H.INPUT.map(([time, id]) => ({ time, path: `/v2/radar/${id}`, forecast: false })),
    })),
  };
});

import { getRadarNowcast } from "@/lib/nowcast/radar";
import { fetchTile } from "@/lib/radar/sampleTile";
import { pixelLevel } from "@/lib/radar/intensity";

const DIR = resolve(__dirname, "fixtures/2026-06-26-hoffman-clearing");
const meta = JSON.parse(readFileSync(resolve(DIR, "tiles.json"), "utf8"));
const NOW_MS = 1782526740000; // 2026-06-26 21:19:00 CDT

const origFetch = globalThis.fetch;
function mockFetch(url: unknown) {
  const m = String(url).match(/\/v2\/radar\/([a-z0-9]+)\//);
  if (m) return Promise.resolve(new Response(readFileSync(resolve(DIR, "tiles", `${m[1]}.png`))));
  return origFetch(url as string);
}

async function pointLevel(id: string): Promise<number> {
  const tile = await fetchTile(`${H.HOST}/v2/radar/${id}/256/${meta.z}/${meta.x}/${meta.y}/4/0_1.png`);
  let lvl = 0;
  if (tile) for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) {
    const l = pixelLevel(tile.at(meta.px + ox, meta.py + oy)); if (l > lvl) lvl = l;
  }
  return lvl;
}

describe("2026-06-26 hoffman clearing", () => {
  beforeEach(() => { vi.stubGlobal("fetch", mockFetch); vi.spyOn(Date, "now").mockReturnValue(NOW_MS); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("ground truth: wet through 21:10, then dry for the next hour", async () => {
    expect(await pointLevel("1309497ccc26")).toBeGreaterThanOrEqual(1); // 21:10 (app's "now")
    expect(await pointLevel("50b8dd09243c")).toBe(0); // 21:20  (+1 min) — gone
    expect(await pointLevel("e85ee850d050")).toBe(0); // 21:40
    expect(await pointLevel("76924227d209")).toBe(0); // 22:10 — still dry
  });

  it("nowcast should project clearing, not continuing", async () => {
    const nc = await getRadarNowcast({ lat: meta.point.lat, lon: meta.point.lon });
    expect(nc).toBeTruthy();
    const fut = nc!.intervals.filter((i) => i.estimated).map((i) => i.precipMm);
    // eslint-disable-next-line no-console
    console.log(`summary="${nc!.summary}"  future=[${fut}]`);
    expect(nc!.summary).not.toMatch(/continuing|building/i); // the bug
    expect(nc!.summary).toMatch(/clear|end|eas/i);            // the fix
    // motion (3,-1) recovers the NE lift; oriented+tight sampling drops the
    // projection to [1,0,0] — wet only at the stale-now tail, dry by +20.
    expect(fut).toEqual([1, 0, 0]);
  });
});
