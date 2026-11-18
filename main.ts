// "The World on Wednesday 18 November 2026" — six-panel editorial infographic.
// Fully procedural: own PNG encoder, float framebuffer, 5x7 bitmap font.
// Node 22 stdlib only, deterministic, no network.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

// ---------------- PNG encoder ----------------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------- framebuffer ----------------
type RGB = [number, number, number];
const W = 1024;
const H = 1024;
const fb = new Uint8Array(W * H * 3);
function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  fb[i] = c[0]; fb[i + 1] = c[1]; fb[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) px(xx, yy, c);
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) px(x, y, c);
    }
  }
}
function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  const ro = r + t / 2;
  const ri = r - t / 2;
  for (let y = Math.floor(cy - ro); y <= Math.ceil(cy + ro); y++) {
    for (let x = Math.floor(cx - ro); x <= Math.ceil(cx + ro); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= ro && d >= ri) px(x, y, c);
    }
  }
}
function line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    disc(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, t / 2, c);
  }
}
function vgrad(x: number, y: number, w: number, h: number, top: RGB, bot: RGB): void {
  for (let yy = 0; yy < h; yy++) {
    const f = yy / Math.max(1, h - 1);
    const c: RGB = [
      Math.round(top[0] + (bot[0] - top[0]) * f),
      Math.round(top[1] + (bot[1] - top[1]) * f),
      Math.round(top[2] + (bot[2] - top[2]) * f),
    ];
    rect(x, y + yy, w, 1, c);
  }
}

// ---------------- 5x7 bitmap font ----------------
// Each glyph: 7 rows, 5 bits (bit 4 = leftmost pixel).
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x06, 0x04, 0, 0x04],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
};
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r] & (1 << (4 - col))) rect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, Math.round(cx - textWidth(s, scale) / 2), y, scale, c);
}

// ---------------- palette ----------------
const INK: RGB = [20, 28, 46];
const PAPER: RGB = [250, 246, 236];
const WHITE: RGB = [255, 255, 255];
const RED: RGB = [198, 48, 38];
const BLUE: RGB = [38, 84, 160];
const GOLD: RGB = [224, 164, 42];
const TEAL: RGB = [24, 128, 128];
const GREEN: RGB = [56, 140, 70];
const NAVY: RGB = [18, 34, 66];
const SKY: RGB = [150, 196, 232];
const SEA: RGB = [36, 96, 150];
const SAND: RGB = [232, 208, 160];
const GREY: RGB = [120, 128, 140];

// A panel: picture area on top, label area below.
function panel(x: number, y: number, w: number, h: number, bg: RGB, accent: RGB): void {
  rect(x, y, w, h, bg);
  rect(x, y, w, 6, accent);
  rect(x, y + h - 2, w, 2, [210, 205, 190]);
  rect(x + w - 2, y, 2, h, [210, 205, 190]);
  rect(x, y, 2, h, [210, 205, 190]);
}
function panelTitle(x: number, y: number, w: number, s: string, accent: RGB): void {
  rect(x, y, 10, 22, accent);
  drawText(s, x + 16, y + 2, 2, INK);
}
function panelBody(x: number, y: number, lines: string[]): void {
  lines.forEach((ln, i) => drawText(ln, x, y + i * 13, 1, [52, 58, 72]));
}

// 1 — Manila: skyline, four Quad flags, a plane.
function picManila(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [246, 196, 110], [250, 232, 190]);
  disc(x + w - 70, y + 34, 26, [255, 214, 90]);
  // skyline
  rect(x + 8, y + h - 62, 34, 62, [90, 96, 110]);
  rect(x + 48, y + h - 84, 30, 84, [70, 76, 92]);
  rect(x + 84, y + h - 52, 40, 52, [104, 110, 124]);
  rect(x + 130, y + h - 96, 26, 96, [60, 66, 84]);
  rect(x + 162, y + h - 58, 46, 58, [96, 102, 118]);
  rect(x + 214, y + h - 76, 30, 76, [76, 82, 98]);
  // plane: side-view jet, fuselage + tail + wings
  line(x + 296, y + 30, x + 392, y + 30, 7, WHITE);
  disc(x + 394, y + 30, 5, WHITE);
  line(x + 300, y + 30, x + 300, y + 12, 5, WHITE);
  line(x + 344, y + 30, x + 330, y + 54, 5, WHITE);
  line(x + 308, y + 30, x + 296, y + 50, 4, WHITE);
  // four Quad flags on poles
  const flags: RGB[][] = [
    [[178, 34, 52], [255, 255, 255], [178, 34, 52]],
    [[255, 255, 255], [188, 0, 45], [255, 255, 255]],
    [[255, 153, 51], [255, 255, 255], [19, 136, 8]],
    [[0, 0, 139], [255, 255, 255], [255, 0, 0]],
  ];
  flags.forEach((f, i) => {
    const fx = x + 250 + i * 56;
    const fy = y + h - 46;
    line(fx, fy - 34, fx, fy, 3, [60, 50, 40]);
    rect(fx + 2, fy - 34, 40, 9, f[0]);
    rect(fx + 2, fy - 25, 40, 9, f[1]);
    rect(fx + 2, fy - 16, 40, 9, f[2]);
  });
}

// 2 — Crimea bridge: sea, broken deck, fallen arch, smoke.
function picBridge(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [168, 190, 210], [214, 224, 232]);
  // sea
  rect(x, y + h - 58, w, 58, SEA);
  for (let i = 0; i < 6; i++) line(x + 20 + i * 76, y + h - 40 + (i % 2) * 14, x + 70 + i * 76, y + h - 40 + (i % 2) * 14, 3, [120, 180, 220]);
  // bridge deck, broken in the middle
  rect(x + 6, y + 78, 190, 12, [96, 100, 108]);
  rect(x + 6, y + 90, 10, 34, [96, 100, 108]);
  rect(x + 186, y + 90, 10, 34, [96, 100, 108]);
  rect(x + 296, y + 78, 190, 12, [96, 100, 108]);
  rect(x + 296, y + 90, 10, 34, [96, 100, 108]);
  rect(x + 476, y + 90, 10, 34, [96, 100, 108]);
  // standing arch on the right span
  line(x + 330, y + 78, x + 386, y + 30, 6, [150, 40, 40]);
  line(x + 442, y + 78, x + 386, y + 30, 6, [150, 40, 40]);
  // fallen arch in the water, tilted
  line(x + 210, y + h - 52, x + 268, y + h - 8, 8, [150, 40, 40]);
  line(x + 268, y + h - 8, x + 292, y + h - 46, 8, [150, 40, 40]);
  // smoke over the gap
  disc(x + 236, y + 62, 16, [90, 90, 96]);
  disc(x + 252, y + 48, 20, [110, 110, 118]);
  disc(x + 272, y + 60, 14, [80, 80, 88]);
  // fire on the deck edge
  disc(x + 196, y + 76, 9, [240, 120, 30]);
  disc(x + 292, y + 76, 8, [240, 160, 40]);
}

// 3 — US-Iran: radar dish, drones, sea with an island.
function picRadar(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [30, 44, 74], [74, 92, 130]);
  // stars
  for (const [sx, sy] of [[40, 18], [120, 30], [210, 14], [330, 26], [420, 16], [70, 48], [300, 44]] as const)
    disc(x + sx, y + sy, 2, WHITE);
  // sea
  rect(x, y + h - 34, w, 34, [22, 68, 110]);
  // island (Qeshm) with fire
  rect(x + 300, y + h - 52, 130, 20, [90, 78, 60]);
  disc(x + 340, y + h - 56, 10, [240, 120, 30]);
  disc(x + 366, y + h - 58, 13, [240, 170, 50]);
  disc(x + 352, y + h - 70, 8, [120, 120, 120]);
  // radar dish on a base, left
  rect(x + 60, y + h - 96, 16, 62, [150, 158, 168]);
  line(x + 68, y + h - 96, x + 30, y + h - 128, 5, [180, 188, 198]);
  line(x + 68, y + h - 96, x + 106, y + h - 128, 5, [180, 188, 198]);
  line(x + 30, y + h - 128, x + 106, y + h - 128, 5, [180, 188, 198]);
  disc(x + 68, y + h - 112, 4, RED); // feed at the dish focus
  // sweeping beam
  line(x + 68, y + h - 100, x + 210, y + 30, 3, [120, 220, 120]);
  // drones: small crosses in the sky
  for (const [dx, dy] of [[240, 44], [300, 66], [380, 40]] as const) {
    line(x + dx - 12, y + dy, x + dx + 12, y + dy, 4, [230, 230, 230]);
    line(x + dx, y + dy - 8, x + dx, y + dy + 8, 4, [230, 230, 230]);
    disc(x + dx, y + dy, 4, RED);
  }
}

// 4 — APEC Shenzhen: towers + APEC banner.
function picApec(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [206, 226, 244], [240, 238, 228]);
  // towers
  rect(x + 20, y + h - 96, 44, 96, [58, 88, 140]);
  rect(x + 72, y + h - 124, 36, 124, [40, 66, 112]);
  rect(x + 116, y + h - 78, 52, 78, [70, 100, 150]);
  rect(x + 176, y + h - 140, 30, 140, [34, 56, 100]);
  rect(x + 214, y + h - 88, 48, 88, [64, 92, 142]);
  rect(x + 270, y + h - 110, 38, 110, [44, 70, 116]);
  rect(x + 316, y + h - 70, 56, 70, [76, 104, 152]);
  rect(x + 380, y + h - 100, 40, 100, [50, 78, 128]);
  rect(x + 428, y + h - 82, 44, 82, [66, 96, 144]);
  // lit windows
  for (let i = 0; i < 9; i++) {
    const wx = x + 26 + i * 48;
    const wy = y + h - 60 - (i % 3) * 22;
    rect(wx, wy, 8, 10, GOLD);
  }
  // spire on the tallest tower
  line(x + 191, y + h - 140, x + 191, y + h - 158, 4, [34, 56, 100]);
  disc(x + 191, y + h - 160, 4, RED);
  // banner
  rect(x + 120, y + 12, 252, 34, RED);
  drawText("APEC 2026", x + 138, y + 20, 2, WHITE);
}

// 5 — Cyclone Akvan: spiral over the sea.
function picCyclone(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [70, 84, 110], [150, 164, 186]);
  // sea
  rect(x, y + h - 30, w, 30, [30, 80, 130]);
  // spiral arms
  const cx = x + w / 2;
  const cy = y + 74;
  for (let a = 0; a < 3; a++) {
    const start = a * 2.1;
    for (let t = 0; t < 5.4; t += 0.12) {
      const r = 8 + t * 11;
      const ang = start + t;
      disc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.82, 6 - t * 0.7, WHITE);
    }
  }
  disc(cx, cy, 10, [40, 52, 70]);
  // rain streaks
  for (let i = 0; i < 8; i++) {
    const rx = x + 24 + i * 58;
    line(rx, y + 8, rx - 10, y + 30, 3, [200, 214, 230]);
  }
  // waves
  for (let i = 0; i < 5; i++) line(x + 16 + i * 92, y + h - 16, x + 64 + i * 92, y + h - 16, 3, [140, 190, 230]);
}

// 6 — Dhoni: stumps, bat, ball on green.
function picCricket(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [120, 190, 110], [70, 140, 80]);
  // pitch
  rect(x + 60, y + 30, 372, h - 60, SAND);
  // stumps
  for (let i = 0; i < 3; i++) rect(x + 110 + i * 16, y + 52, 8, 44, GOLD);
  rect(x + 108, y + 46, 48, 6, GOLD);
  // bails flying off
  rect(x + 168, y + 38, 14, 4, GOLD);
  // bat, angled
  line(x + 300, y + 130, x + 380, y + 44, 16, [190, 150, 100]);
  line(x + 380, y + 44, x + 404, y + 20, 8, [120, 84, 50]);
  // red ball mid-air
  disc(x + 420, y + 60, 16, RED);
  disc(x + 414, y + 54, 5, [255, 120, 110]);
  // motion lines
  line(x + 330, y + 96, x + 300, y + 96, 3, WHITE);
  line(x + 336, y + 110, x + 308, y + 110, 3, WHITE);
  // "7" on the pitch — his shirt number
  drawText("7", x + 210, y + 96, 4, [30, 90, 40]);
}

// ---------------- layout ----------------
function main(): void {
  rect(0, 0, W, H, PAPER);
  // header
  rect(0, 0, W, 76, NAVY);
  drawTextCentered("THE WORLD ON WEDNESDAY", W / 2, 10, 3, WHITE);
  drawTextCentered("18 NOVEMBER 2026", W / 2, 40, 3, GOLD);
  rect(0, 76, W, 4, GOLD);

  const PW = 500;
  const PH = 260;
  const GX = 8;
  const GY = 84;
  const cols = [GX, GX + PW + 8];
  const rows = [GY, GY + PH + 8, GY + 2 * (PH + 8)];

  // 1 — Manila / Quad
  panel(cols[0], rows[0], PW, PH, WHITE, BLUE);
  picManila(cols[0], rows[0], PW, 150);
  panelTitle(cols[0] + 10, rows[0] + 162, PW, "TRUMP LANDS IN MANILA", BLUE);
  panelBody(cols[0] + 10, rows[0] + 192, [
    "Quad summit, first in 2 years",
    "Meets Marcos today, then on to",
    "Shenzhen for Xi-Putin talks",
  ]);

  // 2 — Crimea bridge
  panel(cols[1], rows[0], PW, PH, WHITE, RED);
  picBridge(cols[1], rows[0], PW, 150);
  panelTitle(cols[1] + 10, rows[0] + 162, PW, "CRIMEA BRIDGE DOWN", RED);
  panelBody(cols[1] + 10, rows[0] + 192, [
    "Ukraine strike collapses road arch",
    "Russia hits Kyiv bridges in reply",
    "Biggest drone barrage of the war",
  ]);

  // 3 — US-Iran escalation
  panel(cols[0], rows[1], PW, PH, WHITE, TEAL);
  picRadar(cols[0], rows[1], PW, 150);
  panelTitle(cols[0] + 10, rows[1] + 162, PW, "US-IRAN ESCALATION", TEAL);
  panelBody(cols[0] + 10, rows[1] + 192, [
    "Iran drones target US radar in",
    "Bahrain; US hits Qeshm Island",
    "in the Strait of Hormuz",
  ]);

  // 4 — APEC Shenzhen
  panel(cols[1], rows[1], PW, PH, WHITE, GOLD);
  picApec(cols[1], rows[1], PW, 150);
  panelTitle(cols[1] + 10, rows[1] + 162, PW, "APEC OPENS IN SHENZHEN", GOLD);
  panelBody(cols[1] + 10, rows[1] + 192, [
    "Xi hosts world leaders; Canada",
    "and China extend trade deals",
    "Trump-Xi-Putin talks Thursday",
  ]);

  // 5 — Cyclone Akvan
  panel(cols[0], rows[2], PW, PH, WHITE, SEA);
  picCyclone(cols[0], rows[2], PW, 150);
  panelTitle(cols[0] + 10, rows[2] + 162, PW, "CYCLONE AKVAN BUILDS", SEA);
  panelBody(cols[0] + 10, rows[2] + 192, [
    "Severe storm strengthens in the",
    "Bay of Bengal; warnings out",
    "along the Indian coast",
  ]);

  // 6 — Dhoni
  panel(cols[1], rows[2], PW, PH, WHITE, GREEN);
  picCricket(cols[1], rows[2], PW, 150);
  panelTitle(cols[1] + 10, rows[2] + 162, PW, "DHONI BOWS OUT", GREEN);
  panelBody(cols[1] + 10, rows[2] + 192, [
    "Cricket great retires from the",
    "IPL; becomes Chennai mentor",
    "after a glittering career",
  ]);

  // footer strip
  rect(0, 888, W, H - 888, NAVY);
  drawText("ALSO: UK SANCTIONS FIRMS OVER WEST BANK SETTLEMENTS", 24, 906, 2, WHITE);
  drawText("BAIDU CHIEF WARNS OF AN AI BUBBLE AS APEC LEADERS MEET", 24, 936, 2, [220, 222, 228]);
  drawText("TRUMP BACKS HUANG RETURN; NVIDIA BOARD SAYS NO", 24, 966, 2, [220, 222, 228]);

  const out = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/entry.png`, encodePNG(W, H, fb));
}
main();
