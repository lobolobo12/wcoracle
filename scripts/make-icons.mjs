#!/usr/bin/env node
/* Generate WCoracle PNG icons with zero dependencies (Node zlib only).
 * Draws a crystal-ball / football motif matching icons/icon.svg.
 * Usage: node scripts/make-icons.mjs   ->  icons/icon-{180,192,512}.png */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---- tiny PNG encoder ------------------------------------------------------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---- drawing ---------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
function draw(N) {
  const buf = Buffer.alloc(N * N * 4);
  const R = 0.22 * N;                 // corner radius
  const cx = 0.5 * N, oy = 0.46 * N, orad = 0.30 * N;
  const hx = 0.42 * N, hy = 0.36 * N; // orb highlight focus
  const set = (x, y, r, g, b, a = 255) => { const i = (y * N + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a; };

  // football "seam" dots inside the orb (dark pentagacon-ish blobs)
  const seams = [[0.50, 0.40], [0.50, 0.30], [0.61, 0.36], [0.39, 0.36], [0.585, 0.55], [0.415, 0.55]].map(([a, b]) => [a * N, b * N]);

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // rounded-rect mask
      const dx = Math.max(R - x, x - (N - R), 0), dy = Math.max(R - y, y - (N - R), 0);
      if (dx * dx + dy * dy > R * R) { set(x, y, 0, 0, 0, 0); continue; }

      // background radial gradient (top-center bright -> dark edges)
      const bd = Math.hypot(x - cx, y - 0.36 * N) / (0.75 * N);
      let col = mix(mix([36, 49, 104], [18, 25, 53], Math.min(1, bd * 1.4)), [11, 16, 32], Math.min(1, Math.max(0, bd - 0.4) * 1.6));

      // gold base ellipse
      const be = ((x - cx) / (0.24 * N)) ** 2 + ((y - 0.79 * N) / (0.05 * N)) ** 2;
      if (be < 1) col = mix([245, 177, 58], [255, 232, 154], Math.max(0, 1 - be));

      // orb
      const od = Math.hypot(x - cx, y - oy);
      if (od < orad + 3) {
        const edge = Math.min(1, Math.max(0, (orad - od) / 3)); // AA at rim
        const hl = Math.hypot(x - hx, y - hy) / (orad * 1.25);   // 0 at highlight
        let oc = mix([188, 208, 255], [42, 63, 143], Math.min(1, hl));
        oc = mix(oc, [90, 140, 255], 0.15);
        // seam dots
        for (const [sxv, syv] of seams) { if (Math.hypot(x - sxv, y - syv) < 0.045 * N) oc = mix(oc, [11, 16, 32], 0.8); }
        // glossy top highlight
        const gh = ((x - 0.41 * N) / (0.09 * N)) ** 2 + ((y - 0.37 * N) / (0.06 * N)) ** 2;
        if (gh < 1) oc = mix(oc, [255, 255, 255], (1 - gh) * 0.5);
        col = mix(col, oc, edge);
        // gold rim
        if (od > orad - 2 && od < orad + 1) col = mix(col, [255, 232, 154], 0.5);
      }

      // sparkles
      for (const [sxv, syv, s] of [[0.77 * N, 0.24 * N, 0.03 * N], [0.23 * N, 0.59 * N, 0.022 * N]]) {
        const m = (Math.abs(x - sxv) + Math.abs(y - syv));
        if (m < s) col = mix(col, [255, 232, 154], Math.max(0, 1 - m / s));
      }

      set(x, y, Math.round(col[0]), Math.round(col[1]), Math.round(col[2]), 255);
    }
  }
  return buf;
}

mkdirSync(join(ROOT, "icons"), { recursive: true });
for (const N of [180, 192, 512]) {
  writeFileSync(join(ROOT, "icons", `icon-${N}.png`), encodePNG(N, N, draw(N)));
  console.log("wrote icons/icon-" + N + ".png");
}
