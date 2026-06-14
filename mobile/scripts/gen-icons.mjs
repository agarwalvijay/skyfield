// Dependency-free PNG icon generator for the native app assets.
// Variants: full-bleed app icon, transparent adaptive foreground,
// solid background layer, white monochrome silhouette, splash mark.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

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
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

/**
 * mode: "full" (bg gradient + mark), "fg" (transparent bg, mark scaled into
 * the adaptive-icon safe zone), "mono" (white silhouette, transparent),
 * "bg" (solid background only).
 */
function render(size, mode) {
  const buf = Buffer.alloc(size * size * 4);
  // The mark occupies the center; adaptive foregrounds must fit the inner ~66%.
  const scale = mode === "fg" || mode === "mono" ? 0.62 : 1.0;
  const ox = (size * (1 - scale)) / 2;
  const m = (v) => ox + v * size * scale;

  const cx = m(0.42);
  const cy = m(0.4);
  const sunR = size * scale * 0.17;
  const top = [38, 109, 244];
  const bottomBg = [8, 10, 22];
  const topBg = [16, 24, 54];

  const cloud = [
    [0.36, 0.66, 0.13],
    [0.5, 0.6, 0.16],
    [0.64, 0.66, 0.14],
    [0.5, 0.72, 0.17],
  ].map(([x, y, r]) => [m(x), m(y), r * size * scale]);
  const cloudTopLimit = m(0.78);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let r = 0, g = 0, b = 0, a = 0;

      if (mode === "full" || mode === "bg") {
        [r, g, b] = mix(topBg, bottomBg, y / size);
        a = 255;
      }

      if (mode !== "bg") {
        const ds = Math.hypot(x - cx, y - cy);
        if (ds < sunR) {
          const col = mode === "mono" ? [255, 255, 255] : mix([180, 214, 255], top, ds / sunR);
          [r, g, b] = col;
          a = 255;
        }
        let inCloud = false;
        for (const [bx, by, br] of cloud) {
          if (Math.hypot(x - bx, y - by) < br) inCloud = true;
        }
        if (inCloud && y < cloudTopLimit) {
          [r, g, b] = mode === "mono" ? [255, 255, 255] : [233, 241, 255];
          a = 255;
        }
      }

      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    }
  }
  return buf;
}

const out = (name, size, mode) =>
  writeFileSync(
    new URL(`../assets/${name}`, import.meta.url),
    encodePNG(size, size, render(size, mode)),
  );

out("icon.png", 1024, "full");
out("android-icon-foreground.png", 512, "fg");
out("android-icon-background.png", 512, "bg");
out("android-icon-monochrome.png", 512, "mono");
out("splash-icon.png", 512, "fg");
out("favicon.png", 64, "full");
console.log("mobile icons written");
