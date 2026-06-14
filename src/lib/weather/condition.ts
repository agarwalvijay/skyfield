/**
 * Maps NWS icon tokens + shortForecast text into a small set of condition
 * codes that drive our glyphs and dynamic "sky" backgrounds.
 */

export type ConditionCode =
  | "clear"
  | "partly"
  | "cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "showers"
  | "tstorm"
  | "snow"
  | "sleet"
  | "wind"
  | "hot"
  | "cold";

export interface Condition {
  code: ConditionCode;
  isDay: boolean;
  label: string;
}

/** NWS icon URLs look like .../icons/land/day/tsra_hi,40?size=medium */
function tokenFromIcon(icon?: string): { token?: string; isDay?: boolean } {
  if (!icon) return {};
  try {
    const m = icon.match(/\/icons\/land\/(day|night)\/([a-z_]+)/i);
    if (!m) return {};
    return { isDay: m[1] === "day", token: m[2] };
  } catch {
    return {};
  }
}

function codeFromToken(token: string): ConditionCode | null {
  if (token.startsWith("tsra") || token.includes("tsra")) return "tstorm";
  if (token.includes("blizzard")) return "snow";
  if (token.startsWith("snow") || token === "snow") return "snow";
  if (token.includes("sleet") || token.includes("fzra") || token.includes("ip")) return "sleet";
  if (token.includes("rain_showers") || token.includes("shra")) return "showers";
  if (token.includes("rain")) return "rain";
  if (token.includes("fog") || token.includes("haze") || token.includes("smoke")) return "fog";
  if (token.includes("wind")) return "wind";
  if (token === "ovc") return "overcast";
  if (token === "bkn") return "cloudy";
  if (token === "sct" || token === "few") return "partly";
  if (token === "skc" || token === "clear") return "clear";
  if (token === "hot") return "hot";
  if (token === "cold") return "cold";
  return null;
}

function codeFromText(text: string): ConditionCode {
  const t = text.toLowerCase();
  if (t.includes("thunder") || t.includes("tstorm")) return "tstorm";
  if (t.includes("snow") || t.includes("flurr") || t.includes("blizzard")) return "snow";
  if (t.includes("sleet") || t.includes("freezing") || t.includes("ice")) return "sleet";
  if (t.includes("shower")) return "showers";
  if (t.includes("drizzle")) return "drizzle";
  if (t.includes("rain")) return "rain";
  if (t.includes("fog") || t.includes("haze") || t.includes("smoke") || t.includes("mist"))
    return "fog";
  if (t.includes("wind") || t.includes("breezy")) return "wind";
  if (t.includes("overcast")) return "overcast";
  if (t.includes("cloud")) {
    if (t.includes("partly") || t.includes("mostly sunny") || t.includes("few")) return "partly";
    if (t.includes("mostly")) return "cloudy";
    return "cloudy";
  }
  if (t.includes("sunny") || t.includes("clear")) {
    return t.includes("partly") || t.includes("mostly") ? "partly" : "clear";
  }
  return "partly";
}

export function parseCondition(
  shortForecast: string,
  icon?: string,
  isDayHint?: boolean,
): Condition {
  const { token, isDay } = tokenFromIcon(icon);
  const code = (token && codeFromToken(token)) || codeFromText(shortForecast || "");
  return {
    code,
    isDay: isDay ?? isDayHint ?? true,
    label: shortForecast || "",
  };
}
