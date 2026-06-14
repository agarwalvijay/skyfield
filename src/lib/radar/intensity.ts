/**
 * Map a RainViewer radar pixel (color scheme 4) to a coarse intensity level.
 * We don't need exact dBZ — just light → intense, plus "none".
 */
export type RainLevel = 0 | 1 | 2 | 3 | 4; // none, light, moderate, heavy, intense

export function pixelLevel([r, g, b, a]: [number, number, number, number]): RainLevel {
  if (a < 40) return 0; // transparent / faint anti-alias edge = no echo
  // Low-saturation pixels are NOT real precip and must be gated out before the
  // color ramp. Two culprits, both well below the real palette's saturation:
  //   • grey halos (r≈g≈b, sat <30) — smoothing/basemap bleed at echo edges
  //   • pale tan/olive haze (e.g. (218,204,147), sat ~71) — RainViewer's lowest
  //     sub-precipitation band that blankets huge "clear" areas; not in our
  //     light/mod/heavy/intense legend and not actionable rain.
  // Every genuine precip color (blue/cyan/yellow/orange/red) has sat ≥ ~100,
  // so a single <90 gate drops both without suppressing any real return.
  if (Math.max(r, g, b) - Math.min(r, g, b) < 90) return 0;

  // RainViewer color-scheme 4 ramp (calibrated from the live palette — note it
  // has NO green band): blue/cyan → yellow → orange → red.
  //   blue/cyan  (0,163,224)…(136,221,238), B ≥ R   → light
  //   yellow     (255,224,0)…                        → moderate
  //   orange     (255,129,0)…(255,159,0)             → heavy
  //   red        (193,0,0)…(242,54,0), G & B ≈ 0     → intense
  if (r >= 180 && g < 80 && b < 80) return 4; // saturated red = intense
  if (r >= 230 && b < 90) return g >= 165 ? 2 : 3; // yellow=mod, orange=heavy
  if (b >= 100 && b >= r) return 1; // blue / cyan = light
  // Anything else — pale/desaturated edge blends — is a low-confidence echo
  // edge. Never escalate an ambiguous warm-ish color to heavy; call it light.
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
