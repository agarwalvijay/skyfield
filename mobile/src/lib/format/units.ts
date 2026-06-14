/** Unit conversion + display helpers. Pure functions, portable to RN. */

export type TempUnit = "F" | "C";
export type WindUnit = "mph" | "kmh" | "ms" | "kn";
export type PressureUnit = "inHg" | "hPa";

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function displayTemp(c: number | null, unit: TempUnit): string {
  if (c == null || Number.isNaN(c)) return "--";
  const v = unit === "F" ? cToF(c) : c;
  return `${Math.round(v)}`;
}

/** Convert a temperature already in °F (from forecast periods) to the unit. */
export function displayTempF(f: number | null, unit: TempUnit): string {
  if (f == null || Number.isNaN(f)) return "--";
  const v = unit === "C" ? ((f - 32) * 5) / 9 : f;
  return `${Math.round(v)}`;
}

export function displayWind(kph: number | null, unit: WindUnit): string {
  if (kph == null || Number.isNaN(kph)) return "--";
  switch (unit) {
    case "mph":
      return `${Math.round(kph / 1.609)}`;
    case "ms":
      return `${Math.round(kph / 3.6)}`;
    case "kn":
      return `${Math.round(kph / 1.852)}`;
    default:
      return `${Math.round(kph)}`;
  }
}

export function windUnitLabel(unit: WindUnit): string {
  return unit === "kmh" ? "km/h" : unit;
}

export function displayPressure(pa: number | null, unit: PressureUnit): string {
  if (pa == null || Number.isNaN(pa)) return "--";
  // NWS barometricPressure is in pascals.
  const hPa = pa / 100;
  if (unit === "inHg") return (hPa * 0.02953).toFixed(2);
  return `${Math.round(hPa)}`;
}

export function displayVisibility(m: number | null, imperial: boolean): string {
  if (m == null || Number.isNaN(m)) return "--";
  if (imperial) return `${(m / 1609).toFixed(1)} mi`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function displayDistance(m: number, imperial: boolean): string {
  if (imperial) return `${(m / 1609).toFixed(0)} mi`;
  return `${(m / 1000).toFixed(0)} km`;
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

export function degToCompass(deg: number | null): string {
  if (deg == null || Number.isNaN(deg)) return "--";
  return COMPASS[Math.round(deg / 22.5) % 16];
}

/** Compass label ("NW") → meteorological degrees (wind FROM direction). */
export function compassToDeg(dir: string): number | null {
  const i = COMPASS.indexOf(dir.toUpperCase());
  return i === -1 ? null : i * 22.5;
}

/** Parse the "10 to 15 mph" style string into a representative number (mph). */
export function parseWindSpeedMph(s: string): number | null {
  const nums = s.match(/\d+/g);
  if (!nums) return null;
  const vals = nums.map(Number);
  return Math.max(...vals);
}
