import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Nowcast } from "@/lib/nowcast/openmeteo";

const H = vi.hoisted(() => ({
  radar: null as Nowcast | null,
}));

vi.mock("@/lib/nowcast/radar", () => ({
  getRadarNowcast: vi.fn(async () => H.radar),
}));

import { getNowcast } from "@/lib/nowcast/openmeteo";

const NOW_MS = 1_800_000_000_000;
const NOW_S = Math.floor(NOW_MS / 1000);

function modelResponse(wetAtMin: number | null, type: "rain" | "snow" = "rain") {
  const times = Array.from({ length: 12 }, (_, i) => NOW_S + i * 15 * 60);
  const precipitation = times.map((_, i) => (wetAtMin === i * 15 ? 0.4 : 0));
  const rain = type === "rain" ? precipitation : precipitation.map(() => 0);
  const snowfall = type === "snow" ? precipitation.map((v) => (v > 0 ? 0.4 : 0)) : precipitation.map(() => 0);
  return {
    minutely_15: {
      time: times,
      precipitation,
      rain,
      snowfall,
      precipitation_probability: precipitation.map((v) => (v > 0 ? 90 : 0)),
    },
  };
}

describe("hybrid radar/model nowcast", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(NOW_MS);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    H.radar = null;
  });

  it("keeps the model outlook when radar only sees nearby precip that is not arriving", async () => {
    H.radar = {
      intervals: [
        { time: NOW_MS, minutesFromNow: 0, precipMm: 0, snowCm: 0, probability: 0, type: "none", wet: false },
      ],
      summary: "Showers nearby",
      title: "Radar nowcast",
      type: "rain",
      precipitatingNow: false,
      hasNearby: true,
      hasArriving: false,
      radarLevel: 0,
      windowMinutes: 90,
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(modelResponse(75)))));

    const nc = await getNowcast({ lat: 42, lon: -88 });

    expect(nc.title).toBe("Next 2 hours");
    expect(nc.summary).toBe("Rain starting in ~1 hr 15 min");
  });

  it("uses model precip type when radar is authoritative for active precip", async () => {
    H.radar = {
      intervals: [
        { time: NOW_MS, minutesFromNow: 0, precipMm: 3, snowCm: 0, probability: 0, type: "rain", wet: true },
        { time: NOW_MS + 600_000, minutesFromNow: 10, precipMm: 3, snowCm: 0, probability: 0, type: "rain", wet: true, estimated: true },
      ],
      summary: "Heavy rain now — continuing",
      title: "Radar nowcast",
      type: "rain",
      precipitatingNow: true,
      hasNearby: true,
      hasArriving: true,
      radarLevel: 3,
      windowMinutes: 90,
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(modelResponse(0, "snow")))));

    const nc = await getNowcast({ lat: 42, lon: -88 });

    expect(nc.title).toBe("Radar nowcast");
    expect(nc.type).toBe("snow");
    expect(nc.summary).toBe("Heavy snow now — continuing");
    expect(nc.intervals.filter((iv) => iv.wet).every((iv) => iv.type === "snow")).toBe(true);
  });
});
