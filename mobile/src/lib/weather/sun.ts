/**
 * Lightweight solar position math — no API needed. Used to shade actual
 * night periods on charts (the NWS `isDaytime` flag is just a fixed
 * 6am–6pm convention and can be off by 1–2 hours from real sunset).
 */

const RAD = Math.PI / 180;

/**
 * True when the sun is above the horizon (standard -0.833° refraction-adjusted
 * zenith) at the given instant and place. Accuracy ±~5 minutes, plenty for
 * day/night shading.
 */
export function isDaylight(t: Date, lat: number, lon: number): boolean {
  const start = Date.UTC(t.getUTCFullYear(), 0, 0);
  const doy = (t.getTime() - start) / 864e5;

  // Solar declination.
  const decl = -23.44 * Math.cos(RAD * (360 / 365) * (doy + 10));

  // Equation of time (minutes), corrects apparent vs mean solar time.
  const b = RAD * (360 / 365) * (doy - 81);
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);

  // Local apparent solar time in hours.
  const utcHours = t.getUTCHours() + t.getUTCMinutes() / 60 + t.getUTCSeconds() / 3600;
  const solarTime = utcHours + lon / 15 + eot / 60;
  const hourAngle = (solarTime - 12) * 15;

  const elevation =
    Math.asin(
      Math.sin(RAD * lat) * Math.sin(RAD * decl) +
        Math.cos(RAD * lat) * Math.cos(RAD * decl) * Math.cos(RAD * hourAngle),
    ) / RAD;

  return elevation > -0.833;
}

export interface MoonPhase {
  /** 0–1 through the synodic cycle (0/1 = new, 0.5 = full). */
  phase: number;
  /** Illuminated fraction, 0–1. */
  illumination: number;
  name: string;
  /** True = waxing (growing), false = waning. */
  waxing: boolean;
}

const SYNODIC = 29.530588853; // days
// A known new moon: 2000-01-06 18:14 UTC.
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14) / 864e5;

/** Moon phase for an instant — simple mean-cycle model, plenty for a label. */
export function moonPhase(t: Date = new Date()): MoonPhase {
  const days = t.getTime() / 864e5 - NEW_MOON_EPOCH;
  const phase = (((days % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const waxing = phase < 0.5;

  let name: string;
  if (phase < 0.03 || phase > 0.97) name = "New moon";
  else if (phase < 0.22) name = "Waxing crescent";
  else if (phase < 0.28) name = "First quarter";
  else if (phase < 0.47) name = "Waxing gibbous";
  else if (phase < 0.53) name = "Full moon";
  else if (phase < 0.72) name = "Waning gibbous";
  else if (phase < 0.78) name = "Last quarter";
  else name = "Waning crescent";

  return { phase, illumination, name, waxing };
}

/** Emoji for a moon phase fraction (Northern-hemisphere orientation). */
export function moonEmoji(phase: number): string {
  const i = Math.round(phase * 8) % 8;
  return ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"][i];
}

export interface SunTimes {
  sunrise: Date | null;
  sunset: Date | null;
  /** Length of daylight in minutes (0 = polar night, 1440 = midnight sun). */
  daylightMinutes: number;
}

function declAndEot(t: Date): { decl: number; eot: number; doy: number } {
  const start = Date.UTC(t.getUTCFullYear(), 0, 0);
  const doy = (t.getTime() - start) / 864e5;
  const decl = -23.44 * Math.cos(RAD * (360 / 365) * (doy + 10));
  const b = RAD * (360 / 365) * (doy - 81);
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  return { decl, eot, doy };
}

/** Sunrise/sunset (local clock via the Date) for a day + place. ±~5 min. */
export function sunTimes(day: Date, lat: number, lon: number): SunTimes {
  const noonUtc = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 12);
  const { decl, eot } = declAndEot(new Date(noonUtc));

  // Hour angle at sunrise/sunset (−0.833° refraction-adjusted horizon).
  const cosH =
    (Math.sin(RAD * -0.833) - Math.sin(RAD * lat) * Math.sin(RAD * decl)) /
    (Math.cos(RAD * lat) * Math.cos(RAD * decl));
  if (cosH > 1) return { sunrise: null, sunset: null, daylightMinutes: 0 }; // polar night
  if (cosH < -1) return { sunrise: null, sunset: null, daylightMinutes: 1440 }; // midnight sun

  const ha = Math.acos(cosH) / RAD; // degrees
  // Solar-noon UTC hours, then ± the half-day length.
  const noonUtcHours = 12 - lon / 15 - eot / 60;
  const halfDayHours = ha / 15;

  const at = (utcHours: number) => {
    const ms = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) + utcHours * 3600 * 1000;
    return new Date(ms);
  };
  return {
    sunrise: at(noonUtcHours - halfDayHours),
    sunset: at(noonUtcHours + halfDayHours),
    daylightMinutes: Math.round(halfDayHours * 2 * 60),
  };
}
