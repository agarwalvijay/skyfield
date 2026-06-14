import { parseCondition, type Condition, type ConditionCode } from "./condition";

/**
 * The condition we actually display. Station observations come from a distant
 * (~10 mi) airport that's often stale and unrepresentative during spotty
 * storms, so when the radar shows precipitation at the user's exact point we
 * drive the headline/glyph/sky from radar instead. Temperature etc. still come
 * from the station (radar can't measure them).
 */
export function effectiveCondition(opts: {
  textDescription?: string;
  icon?: string;
  temperatureC?: number | null;
  /** Radar intensity at the exact point: 0 none → 4 intense. */
  radarLevel?: number;
  isDayHint: boolean;
}): Condition {
  const { radarLevel = 0, temperatureC, isDayHint } = opts;

  if (radarLevel >= 1) {
    const snow = temperatureC != null && temperatureC <= 0.5;
    const noun = snow ? "Snow" : "Rain";
    const word = radarLevel >= 3 ? "Heavy " : radarLevel <= 1 ? "Light " : "";
    const code: ConditionCode = snow ? "snow" : "rain";
    return { code, isDay: isDayHint, label: `${word}${noun}` };
  }

  return parseCondition(opts.textDescription ?? "", opts.icon, isDayHint);
}
