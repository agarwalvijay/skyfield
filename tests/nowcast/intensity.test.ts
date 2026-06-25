import { describe, it, expect } from "vitest";
import { pixelLevel, levelWord, type RainLevel } from "@/lib/radar/intensity";

type RGBA = [number, number, number, number];

/**
 * The radar nowcast is the one real algorithm in the app, and `pixelLevel`
 * (RainViewer scheme-4 color → intensity 0–4) is its foundation: the headline
 * condition, the "rain now/coming" summary, and the widget all key off it.
 *
 * This locks the color→level mapping so a tweak to the ramp can't silently
 * regress. RGBs are calibrated from the live scheme-4 palette (see intensity.ts
 * comments); the extreme magenta/pink/white band is broad-gated.
 */
describe("pixelLevel — scheme-4 palette → intensity", () => {
  const palette: Array<[string, RGBA, RainLevel]> = [
    ["transparent (no echo)", [0, 0, 0, 0], 0],
    ["grey halo (smoothing)", [150, 150, 150, 255], 0],
    ["pale tan sub-precip", [218, 204, 147, 255], 0],
    ["blue (light)", [0, 163, 224, 255], 1],
    ["cyan (light)", [136, 221, 238, 255], 1],
    ["yellow (moderate)", [255, 224, 0, 255], 2],
    ["orange (heavy)", [255, 140, 0, 255], 3],
    ["red (intense)", [220, 0, 0, 255], 4],
    // EXTREME band, above red — the 2026-06-24 regression (previously misread):
    ["magenta (extreme)", [220, 20, 200, 255], 4],
    ["pink (extreme)", [255, 105, 180, 255], 4],
    ["white core (extreme)", [255, 255, 255, 255], 4],
  ];

  for (const [name, rgba, expected] of palette) {
    it(`${name} → ${levelWord(expected)}`, () => {
      expect(pixelLevel(rgba)).toBe(expected);
    });
  }
});

/**
 * Real-world incident regression. Screenshots + writeup:
 *   tests/nowcast/fixtures/2026-06-24-hoffman-tornado/
 *
 * A tornado-warned, torrential storm put the INTENSE (pink/white) and HEAVY
 * (red/orange) core directly over the user's location near Hoffman Estates, IL —
 * yet the headline read "Light Rain" and the nowcast "Light rain now — building."
 * Root cause: pixelLevel mapped the extreme pink/magenta band to "light" and
 * gated white cores out as "no echo". The point must read heavy-or-worse here.
 */
describe("incident: 2026-06-24 Hoffman Estates tornado-warned storm", () => {
  const overTheLocation: Array<[string, RGBA]> = [
    ["pink core", [255, 105, 180, 255]],
    ["white core", [255, 255, 255, 255]],
    ["deep red", [210, 0, 0, 255]],
    ["orange", [255, 140, 0, 255]],
  ];

  for (const [name, rgba] of overTheLocation) {
    it(`${name} reads heavy-or-worse, never "light"`, () => {
      const lvl = pixelLevel(rgba);
      expect(lvl).toBeGreaterThanOrEqual(3);
      expect(levelWord(lvl)).not.toBe("light");
    });
  }
});
