import type { ConditionCode } from "./condition";

export interface SkyTheme {
  /** Top→bottom gradient stops for the atmospheric background. */
  gradient: [string, string, string];
  /** Accent used for highlights, active states, glyph fills. */
  accent: string;
  /** Soft glow color placed behind the hero. */
  glow: string;
  /** Whether to use light or dark foreground text. */
  scheme: "light" | "dark";
}

/**
 * Resolve a background sky for a condition + time of day. Daytime themes are
 * luminous; night themes are deep and quiet. All keep enough contrast for
 * white/near-white text (we always render dark UIs).
 */
export function skyFor(code: ConditionCode, isDay: boolean): SkyTheme {
  if (!isDay) {
    // Night variants — deep blues/indigos.
    switch (code) {
      case "clear":
        return {
          gradient: ["#0b1430", "#0a1024", "#06070f"],
          accent: "#8fb4ff",
          glow: "#23408a",
          scheme: "dark",
        };
      case "tstorm":
        return {
          gradient: ["#171526", "#120f1d", "#070509"],
          accent: "#b89bff",
          glow: "#3a2d6b",
          scheme: "dark",
        };
      case "rain":
      case "showers":
      case "drizzle":
        return {
          gradient: ["#0e1626", "#0b1019", "#06080d"],
          accent: "#6fd0e8",
          glow: "#1f3a52",
          scheme: "dark",
        };
      case "snow":
      case "sleet":
        return {
          gradient: ["#141b2b", "#10141f", "#08090f"],
          accent: "#bfe0ff",
          glow: "#2a3b5c",
          scheme: "dark",
        };
      case "fog":
        return {
          gradient: ["#13161c", "#0f1116", "#08090c"],
          accent: "#9aa6b8",
          glow: "#2a2f3a",
          scheme: "dark",
        };
      default:
        return {
          gradient: ["#0d1320", "#0a0e18", "#06080e"],
          accent: "#8aa0c8",
          glow: "#1f2c4a",
          scheme: "dark",
        };
    }
  }

  // Daytime variants.
  switch (code) {
    case "clear":
    case "hot":
      return {
        gradient: ["#1f6fd6", "#2a86e8", "#7fc1f2"],
        accent: "#ffd166",
        glow: "#ffce5c",
        scheme: "light",
      };
    case "partly":
      return {
        gradient: ["#2c6fc0", "#4f93d6", "#a9cdec"],
        accent: "#ffd98a",
        glow: "#7fb6e6",
        scheme: "light",
      };
    case "cloudy":
      return {
        gradient: ["#46566b", "#69788d", "#9fb0c2"],
        accent: "#ffd98a",
        glow: "#8a9bb0",
        scheme: "light",
      };
    case "overcast":
    case "fog":
      return {
        gradient: ["#566173", "#737e8d", "#9aa3ae"],
        accent: "#d7e2ee",
        glow: "#7c8794",
        scheme: "light",
      };
    case "rain":
    case "showers":
    case "drizzle":
      return {
        gradient: ["#324a63", "#456079", "#6f879c"],
        accent: "#7fe3ff",
        glow: "#3f6f92",
        scheme: "light",
      };
    case "tstorm":
      return {
        gradient: ["#2a2f45", "#3c4361", "#5b6488"],
        accent: "#ffd166",
        glow: "#6a5fb0",
        scheme: "dark",
      };
    case "snow":
    case "sleet":
      return {
        gradient: ["#5b6b85", "#8094ad", "#c3d3e4"],
        accent: "#eaf4ff",
        glow: "#9fb6d2",
        scheme: "light",
      };
    case "cold":
      return {
        gradient: ["#3a5a86", "#5a7daf", "#a7c3e0"],
        accent: "#dff0ff",
        glow: "#6b94c4",
        scheme: "light",
      };
    default:
      return {
        gradient: ["#2c6fc0", "#4f93d6", "#a9cdec"],
        accent: "#ffd98a",
        glow: "#7fb6e6",
        scheme: "light",
      };
  }
}
