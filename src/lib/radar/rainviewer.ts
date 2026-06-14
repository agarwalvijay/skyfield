/**
 * RainViewer free radar tiles. Provides global animated precipitation radar
 * with past frames (~2h) and nowcast frames (~30m forecast), no API key.
 * Returns tile URL templates suitable for a MapLibre raster source.
 */

const META_URL = "https://api.rainviewer.com/public/weather-maps.json";

export interface RadarFrame {
  /** Unix seconds. */
  time: number;
  /** Path fragment used to build tile URLs. */
  path: string;
  /** True for forecast (nowcast) frames. */
  forecast: boolean;
}

interface RainViewerMeta {
  host: string;
  radar: {
    past: Array<{ time: number; path: string }>;
    nowcast: Array<{ time: number; path: string }>;
  };
}

export interface RadarData {
  host: string;
  frames: RadarFrame[];
}

let cache: { data: RadarData; fetchedAt: number } | null = null;

/** Fetch the available radar frames (cached ~2 min). */
export async function getRadarFrames(signal?: AbortSignal): Promise<RadarData> {
  if (cache && Date.now() - cache.fetchedAt < 120_000) return cache.data;

  const res = await fetch(META_URL, { signal });
  if (!res.ok) throw new Error("Radar metadata unavailable");
  const meta: RainViewerMeta = await res.json();

  const frames: RadarFrame[] = [
    ...meta.radar.past.map((f) => ({ ...f, forecast: false })),
    ...meta.radar.nowcast.map((f) => ({ ...f, forecast: true })),
  ];
  const data: RadarData = { host: meta.host, frames };
  cache = { data, fetchedAt: Date.now() };
  return data;
}

/**
 * Build a tile URL template for a frame.
 * colorScheme: 4 = "Universal Blue" (clean), 2 = classic NWS-like.
 * smooth/snow flags improve appearance.
 */
export function radarTileUrl(
  host: string,
  frame: RadarFrame,
  opts: { color?: number; smooth?: boolean; snow?: boolean; size?: 256 | 512 } = {},
): string {
  const color = opts.color ?? 4;
  const smooth = opts.smooth === false ? 0 : 1;
  const snow = opts.snow === false ? 0 : 1;
  const size = opts.size ?? 256;
  return `${host}${frame.path}/${size}/{z}/{x}/{y}/${color}/${smooth}_${snow}.png`;
}
