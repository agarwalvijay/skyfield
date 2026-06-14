// Dependency-free PNG icon generator for the PWA.
// Rasterizes a simple "sun + cloud over night sky" mark and writes PNGs.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function render(size, pad = 0) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size * 0.42;
  const cy = size * 0.4;
  const sunR = size * (0.17 - pad * 0.02);
  const top = [38, 109, 244];
  const bottomBg = [8, 10, 22];
  const topBg = [16, 24, 54];

  // cloud geometry (rounded blob)
  const cloud = [
    [0.36, 0.66, 0.13],
    [0.5, 0.6, 0.16],
    [0.64, 0.66, 0.14],
    [0.5, 0.72, 0.17],
  ].map(([x, y, r]) => [x * size, y * size, r * size]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // vertical bg gradient
      const t = y / size;
      let [r, g, b] = mix(topBg, bottomBg, t);
      let a = 255;

      // sun (radial gradient)
      const ds = Math.hypot(x - cx, y - cy);
      if (ds < sunR) {
        const tt = ds / sunR;
        const col = mix([180, 214, 255], top, tt);
        [r, g, b] = col;
      }

      // cloud (white, drawn over)
      let inCloud = false;
      for (const [bx, by, br] of cloud) {
        if (Math.hypot(x - bx, y - by) < br) inCloud = true;
      }
      // flat bottom for cloud
      if (inCloud && y < size * 0.78) {
        [r, g, b] = [233, 241, 255];
      }

      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    }
  }
  return buf;
}

mkdirSync(new URL("../public/icons/", import.meta.url), { recursive: true });
const out = (name, size, pad) =>
  writeFileSync(
    new URL(`../public/icons/${name}`, import.meta.url),
    encodePNG(size, size, render(size, pad)),
  );

out("icon-192.png", 192, 0);
out("icon-512.png", 512, 0);
out("icon-maskable.png", 512, 1.2); // extra safe-zone padding
console.log("icons written");
