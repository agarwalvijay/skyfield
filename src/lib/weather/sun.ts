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
