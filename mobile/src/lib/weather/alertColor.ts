import type { AlertSeverity } from "@/lib/nws";

/** Color coding for alerts, roughly aligned with NWS severity conventions. */
export function alertColor(severity: AlertSeverity): string {
  switch (severity) {
    case "Extreme":
      return "#ff3b54";
    case "Severe":
      return "#ff7a3d";
    case "Moderate":
      return "#ffb020";
    case "Minor":
      return "#ffd84d";
    default:
      return "#8aa0c8";
  }
}

/** Pick an emoji-free glyph hint for the alert event type. */
export function alertTone(severity: AlertSeverity): "critical" | "warning" | "info" {
  if (severity === "Extreme" || severity === "Severe") return "critical";
  if (severity === "Moderate") return "warning";
  return "info";
}
