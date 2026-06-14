/**
 * Map a RainViewer radar pixel (color scheme 4) to a coarse intensity level.
 * We don't need exact dBZ — just light → intense, plus "none".
 */
export type RainLevel = 0 | 1 | 2 | 3 | 4; // none, light, moderate, heavy, intense

export function pixelLevel([r, g, b, a]: [number, number, number, number]): RainLevel {
  if (a < 24) return 0; // transparent = no echo
  // Palettes ramp cool → warm with intensity. Use hue/brightness heuristics
  // that hold for RainViewer's blue/green/yellow/red ramps.
  if (r >= 150 && g < 90 && b < 90) return 4; // deep red
  if (r >= 180 && g >= 110 && b < 110) return 3; // orange/yellow
  if (g >= 120 && r < 150) return 2; // green/teal
  if (b >= 120 && b >= r) return 1; // blue
  // Fallback by brightness-weighted warmth.
  const warmth = r - b;
  if (warmth > 90) return 4;
  if (warmth > 30) return 3;
  if (g > 100) return 2;
  return 1;
}

export function levelWord(level: RainLevel): string {
  switch (level) {
    case 4:
      return "intense";
    case 3:
      return "heavy";
    case 2:
      return "moderate";
    case 1:
      return "light";
    default:
      return "no";
  }
}
