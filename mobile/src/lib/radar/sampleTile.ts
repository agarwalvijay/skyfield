import pako from "pako";

/** Web-Mercator tile + in-tile pixel for a coordinate at a given zoom. */
export function tileForPoint(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const xt = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yt = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n;
  const x = Math.floor(xt);
  const y = Math.floor(yt);
  return { x, y, px: Math.floor((xt - x) * 256), py: Math.floor((yt - y) * 256) };
}

/** A decoded RGBA tile you can sample pixels from. */
export interface DecodedTile {
  width: number;
  height: number;
  /** RGBA at (px,py); returns [0,0,0,0] when out of bounds. */
  at(px: number, py: number): [number, number, number, number];
}

const TILE_CACHE_TTL_MS = 12 * 60 * 1000;
const TILE_CACHE_MAX = 80;
const tileCache = new Map<string, { tile: DecodedTile | null; fetchedAt: number }>();

function rememberTile(url: string, tile: DecodedTile | null): DecodedTile | null {
  tileCache.set(url, { tile, fetchedAt: Date.now() });
  while (tileCache.size > TILE_CACHE_MAX) {
    const oldest = tileCache.keys().next().value;
    if (!oldest) break;
    tileCache.delete(oldest);
  }
  return tile;
}

/**
 * Minimal PNG decoder (8-bit, non-interlaced, RGB/RGBA) good enough for
 * RainViewer radar tiles. Pure JS (pako for inflate) so it runs in RN too.
 */
export function decodePng(buf: Uint8Array): DecodedTile | null {
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  let i = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Uint8Array[] = [];
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  while (i < buf.length) {
    const len = view.getUint32(i);
    const type = String.fromCharCode(buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7]);
    const start = i + 8;
    if (type === "IHDR") {
      width = view.getUint32(start);
      height = view.getUint32(start + 4);
      bitDepth = buf[start + 8];
      colorType = buf[start + 9];
    } else if (type === "IDAT") {
      idat.push(buf.subarray(start, start + len));
    } else if (type === "IEND") {
      break;
    }
    i = start + len + 4; // skip data + CRC
  }

  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) return null;
  const channels = colorType === 6 ? 4 : 3;

  // Concatenate IDAT and inflate.
  let total = 0;
  for (const c of idat) total += c.length;
  const comp = new Uint8Array(total);
  let o = 0;
  for (const c of idat) {
    comp.set(c, o);
    o += c.length;
  }
  let raw: Uint8Array;
  try {
    raw = pako.inflate(comp);
  } catch {
    return null;
  }

  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  let pos = 0;
  for (let r = 0; r < height; r++) {
    const filter = raw[pos++];
    const rowStart = r * stride;
    const prevStart = (r - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[pos++];
      const a = x >= channels ? out[rowStart + x - channels] : 0;
      const b = r > 0 ? out[prevStart + x] : 0;
      const c = r > 0 && x >= channels ? out[prevStart + x - channels] : 0;
      let recon = v;
      switch (filter) {
        case 1:
          recon = v + a;
          break;
        case 2:
          recon = v + b;
          break;
        case 3:
          recon = v + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          recon = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
      }
      out[rowStart + x] = recon & 255;
    }
  }

  return {
    width,
    height,
    at(px: number, py: number) {
      if (px < 0 || py < 0 || px >= width || py >= height) return [0, 0, 0, 0];
      const idx = py * stride + px * channels;
      return [out[idx], out[idx + 1], out[idx + 2], channels === 4 ? out[idx + 3] : 255];
    },
  };
}

/** Fetch + decode a single radar tile. */
export async function fetchTile(url: string, signal?: AbortSignal): Promise<DecodedTile | null> {
  const cached = tileCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < TILE_CACHE_TTL_MS) return cached.tile;
  if (cached) tileCache.delete(url);

  const res = await fetch(url, { signal });
  if (!res.ok) return rememberTile(url, null);
  const buf = new Uint8Array(await res.arrayBuffer());
  return rememberTile(url, decodePng(buf));
}
