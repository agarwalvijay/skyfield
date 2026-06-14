import type { ConditionCode } from "@/lib/weather/condition";

/**
 * Raw SVG markup for the Skyfield weather glyphs — same geometry as
 * WeatherGlyph.tsx but emitted as strings for SvgWidget (RemoteViews can't
 * host react-native-svg).
 */

const CLOUD = "#eef3fb";
const CLOUD_DIM = "#cdd8e8";
const RAIN = "#8fd4f5";
const SNOW = "#eaf4ff";

const cloudPath = (x: number, y: number, fill: string, scale: number) =>
  `<path transform="translate(${x} ${y}) scale(${scale})" d="M20 44 q-9 0 -9 -9 q0 -8 8 -9 q1.5 -9 11 -9 q10 0 11 10 q8 0 8 8 q0 9 -9 9 z" fill="${fill}"/>`;

const sun = (accent: string) => {
  let rays = "";
  for (let i = 0; i < 8; i++) {
    rays += `<rect x="31" y="6" width="2" height="6" rx="1" fill="${accent}" transform="rotate(${i * 45} 32 26)"/>`;
  }
  return `<circle cx="32" cy="26" r="11" fill="${accent}"/>${rays}`;
};

const moon = (accent: string) =>
  `<path d="M40 16 a14 14 0 1 0 6 18 a11 11 0 0 1 -6 -18 z" fill="${accent}" opacity="0.95"/>`;

export function glyphSvg(code: ConditionCode, isDay: boolean, accent = "#ffd166"): string {
  let body: string;
  switch (code) {
    case "clear":
    case "hot":
    case "cold":
      body = isDay ? sun(accent) : moon(accent);
      break;
    case "partly":
      body = `<g transform="translate(8 -4) scale(0.8)">${isDay ? sun(accent) : moon(accent)}</g>${cloudPath(6, 8, CLOUD, 0.95)}`;
      break;
    case "cloudy":
      body = `${cloudPath(-2, -2, CLOUD_DIM, 0.75)}${cloudPath(4, 6, CLOUD, 1)}`;
      break;
    case "overcast":
    case "fog":
      body =
        cloudPath(2, 2, CLOUD, 1) +
        (code === "fog"
          ? `<g stroke="${CLOUD_DIM}" stroke-width="2.4" stroke-linecap="round" opacity="0.85"><line x1="14" y1="50" x2="44" y2="50"/><line x1="18" y1="56" x2="50" y2="56"/></g>`
          : "");
      break;
    case "drizzle":
    case "rain":
    case "showers": {
      const y2 = code === "showers" ? 58 : 54;
      body =
        cloudPath(2, -2, CLOUD, 1) +
        [18, 28, 38]
          .map(
            (x) =>
              `<line x1="${x}" y1="46" x2="${x - 3}" y2="${y2}" stroke="${RAIN}" stroke-width="2.6" stroke-linecap="round"/>`,
          )
          .join("");
      break;
    }
    case "tstorm":
      body =
        cloudPath(2, -2, CLOUD_DIM, 1) +
        `<path d="M30 44 l8 0 l-5 7 l7 0 l-12 13 l3 -10 l-6 0 z" fill="${accent}"/>`;
      break;
    case "snow":
      body =
        cloudPath(2, -2, CLOUD, 1) +
        [18, 28, 38].map((x) => `<circle cx="${x}" cy="52" r="2.4" fill="${SNOW}"/>`).join("");
      break;
    case "sleet":
      body =
        cloudPath(2, -2, CLOUD, 1) +
        `<line x1="20" y1="46" x2="17" y2="54" stroke="${RAIN}" stroke-width="2.6" stroke-linecap="round"/>` +
        `<line x1="38" y1="46" x2="35" y2="54" stroke="${RAIN}" stroke-width="2.6" stroke-linecap="round"/>` +
        `<circle cx="29" cy="54" r="2.2" fill="${SNOW}"/>`;
      break;
    case "wind":
      body = `<g stroke="${CLOUD}" stroke-width="3" stroke-linecap="round" fill="none"><path d="M10 24 h24 a5 5 0 1 0 -5 -5"/><path d="M10 34 h32 a5 5 0 1 1 -5 5"/><path d="M10 44 h18 a4 4 0 1 1 -4 4"/></g>`;
      break;
    default:
      body = isDay ? sun(accent) : moon(accent);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;
}
