// news-image-20261118-entry
// A program that draws one image summing up the world's news of
// Wednesday 18 November 2026: a six-panel editorial infographic
// (Trump in Manila, the Crimea bridge, drones over Bahrain,
// Nvidia's $115.8B quarter, Dhoni's IPL farewell, Cyclone Akvan)
// rendered procedurally with Node's standard library only.
// Writes /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png),
// 1024x1024 PNG, fully deterministic: two runs, same bytes.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- colors
type RGB = [number, number, number];
const PAPER: RGB = [247, 242, 231];
const PANEL_BG: RGB = [255, 253, 247];
const INK: RGB = [26, 26, 26];
const SUB: RGB = [74, 74, 68];
const RED: RGB = [178, 38, 30];
const WHITE: RGB = [255, 255, 255];
const NAVY: RGB = [31, 58, 95];
const MAROON: RGB = [122, 28, 22];
const BROWN: RGB = [138, 90, 43];
const GREEN: RGB = [34, 110, 52];
const GOLD: RGB = [242, 194, 0];
const TEAL: RGB = [15, 118, 110];

// ---------------------------------------------------------------- framebuffer
const fb = new Uint8Array(W * H * 3);

function set(x: number, y: number, c: RGB): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w));
  const y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      fb[i] = c[0];
      fb[i + 1] = c[1];
      fb[i + 2] = c[2];
    }
  }
}

function hline(x: number, y: number, w: number, c: RGB): void {
  fillRect(x, y, w, 1, c);
}

function vline(x: number, y: number, h: number, c: RGB): void {
  fillRect(x, y, 1, h, c);
}

function border(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

// Bresenham line, with square brush of side w for thickness.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, w = 1): void {
  let ax = Math.round(x0);
  let ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const dy = Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx - dy;
  const half = Math.floor(w / 2);
  for (;;) {
    fillRect(ax - half, ay - half, w, w, c);
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      ax += sx;
    }
    if (e2 < dx) {
      err += dx;
      ay += sy;
    }
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  const x0 = Math.max(0, Math.ceil(cx - rx));
  const x1 = Math.min(W - 1, Math.floor(cx + rx));
  const y0 = Math.max(0, Math.ceil(cy - ry));
  const y1 = Math.min(H - 1, Math.floor(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const t = (y - cy) / ry;
    if (t < -1 || t > 1) continue;
    const half = rx * Math.sqrt(1 - t * t);
    fillRect(Math.ceil(cx - half), y, Math.floor(cx + half) - Math.ceil(cx - half) + 1, 1, c);
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  fillEllipse(cx, cy, r, r, c);
}

function circleOutline(cx: number, cy: number, r: number, c: RGB, w = 2): void {
  const steps = Math.max(24, Math.floor(2 * Math.PI * r));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    fillRect(Math.round(cx + r * Math.cos(a)) - Math.floor(w / 2), Math.round(cy + r * Math.sin(a)) - Math.floor(w / 2), w, w, c);
  }
}

// Arc from angle a0 to a1 (radians), drawn as a thick polyline of dots.
function arc(cx: number, cy: number, r: number, a0: number, a1: number, c: RGB, w = 3): void {
  const steps = Math.max(8, Math.floor(Math.abs(a1 - a0) * r));
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    fillRect(Math.round(cx + r * Math.cos(a)) - Math.floor(w / 2), Math.round(cy + r * Math.sin(a)) - Math.floor(w / 2), w, w, c);
  }
}

function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const pts: Array<[number, number]> = [
    [x0, y0],
    [x1, y1],
    [x2, y2],
  ].sort((a, b) => a[1] - b[1]);
  const [ax, ay] = pts[0];
  const [bx, by] = pts[1];
  const [cx, cy] = pts[2];
  const lerp = (y: number, xA: number, yA: number, xB: number, yB: number): number =>
    yB === yA ? xA : xA + ((y - yA) * (xB - xA)) / (yB - yA);
  const yTop = Math.max(0, Math.ceil(ay));
  const yBot = Math.min(H - 1, Math.floor(cy));
  for (let y = yTop; y <= yBot; y++) {
    let xa: number;
    let xb: number;
    if (y < by) {
      xa = lerp(y, ax, ay, bx, by);
      xb = lerp(y, ax, ay, cx, cy);
    } else {
      xa = lerp(y, bx, by, cx, cy);
      xb = lerp(y, ax, ay, cx, cy);
    }
    const xL = Math.max(0, Math.ceil(Math.min(xa, xb)));
    const xR = Math.min(W - 1, Math.floor(Math.max(xa, xb)));
    if (xR >= xL) fillRect(xL, y, xR - xL + 1, 1, c);
  }
}

// Small starburst (explosion / interception flash) at (cx, cy).
function starburst(cx: number, cy: number, r: number, c: RGB): void {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * 2 * Math.PI;
    line(cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a), c, 3);
  }
  fillCircle(cx, cy, Math.max(3, r / 3), c);
}

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(fb.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows, 5 bits each (bit 4 = leftmost column).
const FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  "3": [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0b01100, 0b01100],
  ",": [0, 0, 0, 0, 0b01100, 0b00100, 0b01000],
  ":": [0, 0b01100, 0b01100, 0, 0b01100, 0b01100, 0],
  ";": [0, 0b01100, 0b01100, 0, 0b01100, 0b00100, 0b01000],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  "-": [0, 0, 0, 0b01110, 0, 0, 0],
  "/": [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  "%": [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  $: [0b00100, 0b01111, 0b10100, 0b01110, 0b00101, 0b11110, 0b00100],
  "&": [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101],
  "!": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  "?": [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100],
  "(": [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ")": [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  "+": [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0],
  "=": [0, 0, 0b11111, 0, 0b11111, 0, 0],
  "|": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  "\u00b7": [0, 0, 0, 0b01100, 0b01100, 0, 0], // middle dot
};

function drawGlyph(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const rows = FONT[ch];
  if (!rows) return;
  for (let r = 0; r < 7; r++) {
    const bits = rows[r];
    for (let col = 0; col < 5; col++) {
      if ((bits >> (4 - col)) & 1) {
        fillRect(x + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}

function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return text.length * 6 * scale - scale;
}

function drawText(x: number, y: number, text: string, scale: number, c: RGB): void {
  for (let i = 0; i < text.length; i++) {
    drawGlyph(x + i * 6 * scale, y, text[i], scale, c);
  }
}

function drawTextCentered(cx: number, y: number, text: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, c);
}

// Greedy word wrap; returns lines that fit within maxW pixels.
function wrap(text: string, maxW: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- illustrations
// Each draws inside its zone (x, y, w, h) = (panelX, panelY + 30, 314, 170).

function artManila(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [165, 205, 235]); // sky
  // sun with rays
  fillCircle(x + 268, y + 34, 20, [250, 214, 120]);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * 2 * Math.PI;
    line(
      x + 268 + 25 * Math.cos(a), y + 34 + 25 * Math.sin(a),
      x + 268 + 35 * Math.cos(a), y + 34 + 35 * Math.sin(a),
      [250, 214, 120], 3,
    );
  }
  // clouds
  fillEllipse(x + 36, y + 30, 30, 9, WHITE);
  fillEllipse(x + 86, y + 46, 24, 8, WHITE);
  fillEllipse(x + 224, y + 88, 28, 8, WHITE);
  // aeroplane, flying right
  const cx = x + 150;
  const cy = y + 62;
  fillTriangle(cx - 58, cy - 10, cx - 38, cy - 10, cx - 52, cy - 34, NAVY); // tail fin
  fillTriangle(cx + 4, cy - 8, cx + 28, cy - 8, cx + 12, cy - 30, NAVY); // upper wing
  fillEllipse(cx, cy, 62, 13, NAVY); // fuselage
  fillTriangle(cx + 62, cy - 13, cx + 62, cy + 13, cx + 84, cy, NAVY); // nose
  fillTriangle(cx - 6, cy + 8, cx + 26, cy + 8, cx + 2, cy + 42, NAVY); // lower wing
  fillRect(cx - 54, cy - 6, 10, 12, RED); // tail stripe
  for (let i = 0; i < 5; i++) fillRect(cx - 42 + i * 16, cy - 4, 6, 3, WHITE); // windows
  // skyline
  const bldgs: Array<[number, number, number]> = [
    [12, 24, 40], [42, 18, 56], [66, 28, 34], [232, 22, 48], [260, 26, 36], [292, 16, 44],
  ];
  for (const [bx, bw, bh] of bldgs) {
    fillRect(x + bx, y + h - 10 - bh, bw, bh, NAVY);
    fillRect(x + bx + 4, y + h - 10 - bh + 8, 3, 4, [250, 214, 120]);
    fillRect(x + bx + bw - 9, y + h - 10 - bh + 18, 3, 4, [250, 214, 120]);
  }
  fillRect(x, y + h - 10, w, 10, NAVY); // ground
}

function artBridge(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, 110, [216, 224, 230]); // sky
  fillRect(x, y + 110, w, 60, [58, 110, 150]); // sea
  const cx = x + 157;
  const cy = y + 100;
  // smoke above the break
  fillCircle(cx - 17, y + 22, 9, [150, 150, 150]);
  fillCircle(cx + 15, y + 18, 11, [150, 150, 150]);
  fillCircle(cx, y + 8, 8, [170, 170, 170]);
  // broken arch rib (gap at the top centre)
  arc(cx, cy, 64, Math.PI, Math.PI + 1.05, [52, 52, 52], 5);
  arc(cx, cy, 64, 2 * Math.PI - 1.05, 2 * Math.PI, [52, 52, 52], 5);
  // hangers from arch to deck
  vline(cx - 53, y + 64, 22, [52, 52, 52]);
  vline(cx + 53, y + 64, 22, [52, 52, 52]);
  // explosion at the break
  starburst(cx, y + 40, 16, [255, 176, 0]);
  starburst(cx, y + 40, 9, [230, 100, 20]);
  // deck
  fillRect(x, y + 86, w, 10, [52, 52, 52]);
  // pillars into the sea
  fillRect(x + 30, y + 96, 8, 74, [52, 52, 52]);
  fillRect(x + w - 38, y + 96, 8, 74, [52, 52, 52]);
  // fallen span sinking in the strait
  fillTriangle(cx - 20, y + 118, cx + 30, y + 126, cx + 10, y + 152, [40, 40, 40]);
  arc(cx + 5, y + 124, 16, 0, Math.PI, WHITE, 2);
  // waves
  fillRect(x + 20, y + 130, 40, 2, WHITE);
  fillRect(x + 250, y + 140, 44, 2, WHITE);
  fillRect(x + 90, y + 158, 36, 2, WHITE);
}

function drawDrone(dx: number, dy: number): void {
  const c: RGB = [40, 40, 40];
  line(dx - 7, dy - 7, dx + 7, dy + 7, c, 2);
  line(dx - 7, dy + 7, dx + 7, dy - 7, c, 2);
  fillCircle(dx, dy, 3, c);
}

function artRadar(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [232, 196, 138]); // sand sky
  fillRect(x, y + 136, w, 34, [120, 84, 50]); // ground
  fillRect(x + 18, y + 112, 26, 24, [74, 52, 32]); // base buildings
  fillRect(x + 52, y + 120, 18, 16, [74, 52, 32]);
  fillRect(x + 270, y + 116, 30, 20, [74, 52, 32]);
  const cx = x + 108;
  const cy = y + 76;
  // dish seen face-on: concentric rings on its mast
  fillRect(cx - 5, cy + 44, 10, 14, [70, 70, 70]); // mast to the ground
  fillCircle(cx, cy, 46, [210, 210, 210]);
  circleOutline(cx, cy, 46, [60, 60, 60], 3);
  circleOutline(cx, cy, 30, [60, 60, 60], 2);
  line(cx, cy, cx + 32, cy - 32, [60, 60, 60], 2); // struts
  line(cx, cy, cx - 32, cy - 32, [60, 60, 60], 2);
  fillCircle(cx, cy, 7, [60, 60, 60]); // feed
  // radar beam sweeping up-right
  line(cx, cy, cx + 78, cy - 56, RED, 3);
  fillCircle(cx + 78, cy - 56, 4, RED);
  // drones and interceptions
  drawDrone(x + 228, y + 30);
  drawDrone(x + 266, y + 56);
  drawDrone(x + 208, y + 64);
  starburst(x + 244, y + 44, 11, [255, 176, 0]);
  starburst(x + 278, y + 76, 9, [255, 176, 0]);
}

function artChip(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [16, 26, 18]); // dark board
  // chip
  fillRect(x + 18, y + 30, 110, 110, [30, 60, 34]);
  border(x + 18, y + 30, 110, 110, 3, [120, 200, 130]);
  fillRect(x + 46, y + 58, 54, 54, [20, 40, 24]);
  border(x + 46, y + 58, 54, 54, 2, [120, 200, 130]);
  fillCircle(x + 73, y + 85, 6, [120, 200, 130]);
  for (let i = 0; i < 6; i++) {
    const px = x + 30 + i * 16;
    fillRect(px, y + 18, 4, 12, [180, 200, 120]); // top pins
    fillRect(px, y + 140, 4, 12, [180, 200, 120]); // bottom pins
    const py = y + 42 + i * 16;
    fillRect(x + 6, py, 12, 4, [180, 200, 120]); // left pins
    fillRect(x + 128, py, 12, 4, [180, 200, 120]); // right pins
  }
  // rising bars and arrow
  const base = y + 150;
  fillRect(x + 170, base, 130, 2, [200, 200, 200]);
  fillRect(x + 180, base - 44, 26, 44, [46, 160, 67]);
  fillRect(x + 220, base - 72, 26, 72, [46, 160, 67]);
  fillRect(x + 260, base - 104, 26, 104, [46, 160, 67]);
  line(x + 180, y + 98, x + 222, y + 70, WHITE, 3);
  line(x + 222, y + 70, x + 262, y + 40, WHITE, 3);
  line(x + 262, y + 40, x + 296, y + 24, WHITE, 3);
  fillTriangle(x + 296, y + 24, x + 282, y + 22, x + 292, y + 36, WHITE); // arrowhead
}

function artJersey(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [46, 125, 60]); // green field
  fillRect(x, y + h - 34, w, 2, WHITE); // crease line
  // stumps, bottom left
  fillRect(x + 34, y + h - 64, 4, 30, [250, 214, 120]);
  fillRect(x + 42, y + h - 64, 4, 30, [250, 214, 120]);
  fillRect(x + 50, y + h - 64, 4, 30, [250, 214, 120]);
  fillRect(x + 34, y + h - 68, 20, 3, [250, 214, 120]);
  // red ball, bottom right
  fillCircle(x + 272, y + h - 48, 9, [200, 30, 30]);
  arc(x + 272, y + h - 48, 5, 0.5, 2.5, WHITE, 2);
  // the No. 7 jersey, centre
  const jx = x + 107;
  const jy = y + 28;
  fillTriangle(jx, jy, jx, jy + 38, x + 76, jy + 24, GOLD); // left sleeve
  fillTriangle(jx + 100, jy, jx + 100, jy + 38, x + 238, jy + 24, GOLD); // right sleeve
  fillRect(jx, jy, 100, 118, GOLD); // body
  line(jx + 30, jy, jx + 50, jy + 16, INK, 3); // collar V
  line(jx + 70, jy, jx + 50, jy + 16, INK, 3);
  fillRect(jx, jy + 118, 100, 4, INK); // hem
  drawGlyph(x + 135, y + 55, "7", 9, INK); // the number
  drawTextCentered(x + 157, y + 126, "CSK", 2, INK);
}

function artCyclone(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [13, 60, 90]); // deep sea blue
  const cx = x + 128;
  const cy = y + 82;
  // spiral arms
  for (let k = 0; k < 6; k++) {
    const r = 14 + k * 13;
    const a0 = k * 0.9;
    arc(cx, cy, r, a0, a0 + 4.4, k % 2 === 0 ? WHITE : [140, 200, 230], 4);
  }
  fillCircle(cx, cy, 9, WHITE); // eye
  fillCircle(cx, cy, 4, [13, 60, 90]);
  // rain streaks, top right
  for (let i = 0; i < 6; i++) {
    line(x + 210 + i * 14, y + 14, x + 202 + i * 14, y + 30, [180, 220, 240], 2);
  }
  // coastline, bottom right, with the landfall marker
  fillTriangle(x + w - 90, y + h, x + w - 30, y + h - 70, x + w - 6, y + h, [198, 168, 118]);
  fillTriangle(x + w - 30, y + h - 70, x + w - 6, y + h - 46, x + w - 6, y + h, [198, 168, 118]);
  fillCircle(x + w - 26, y + h - 34, 5, [220, 60, 40]);
  circleOutline(x + w - 26, y + h - 34, 9, WHITE, 2);
}

// ---------------------------------------------------------------- layout
type Panel = {
  kicker: string;
  kc: RGB;
  kt: RGB;
  headline: string;
  sub: string;
  art: (x: number, y: number, w: number, h: number) => void;
};

const PANELS: Panel[] = [
  {
    kicker: "ASIA",
    kc: NAVY,
    kt: WHITE,
    headline: "TRUMP LANDS IN MANILA",
    sub: "QUAD SUMMIT HELD. MARCOS TODAY. XI AND PUTIN NEXT.",
    art: artManila,
  },
  {
    kicker: "UKRAINE",
    kc: MAROON,
    kt: WHITE,
    headline: "CRIMEA BRIDGE FALLS",
    sub: "SECOND STRIKE IN TWO DAYS DROPS ROAD ARCH. KYIV BRIDGES HIT.",
    art: artBridge,
  },
  {
    kicker: "THE GULF",
    kc: BROWN,
    kt: WHITE,
    headline: "DRONES OVER BAHRAIN",
    sub: "IRAN TARGETS US RADAR. BAHRAIN SAYS ALL INTERCEPTED.",
    art: artRadar,
  },
  {
    kicker: "TECH",
    kc: GREEN,
    kt: WHITE,
    headline: "NVIDIA'S $115.8B QUARTER",
    sub: "REVENUE DOUBLES. BOARD: HUANG WILL NOT RETURN.",
    art: artChip,
  },
  {
    kicker: "SPORT",
    kc: GOLD,
    kt: INK,
    headline: "DHONI RETIRES FROM IPL",
    sub: "CSK LEGEND, 45, ENDS PLAYING CAREER. BECOMES MENTOR.",
    art: artJersey,
  },
  {
    kicker: "WEATHER",
    kc: TEAL,
    kt: WHITE,
    headline: "CYCLONE AKVAN GROWS",
    sub: "SEVERE STORM NEARS ANDHRA COAST. LANDFALL DUE FRIDAY.",
    art: artCyclone,
  },
];

const FOOTER: string[] = [
  "ALSO TODAY: UK SANCTIONS ISRAELI SETTLEMENT FIRMS",
  "CANADA AND CHINA EXTEND TRADE DEALS \u00b7 LATVIA APPROVES KULBERGS CABINET",
  "HUAWEI JURY TO BEGIN DELIBERATIONS \u00b7 GAZA: WFP ONE HOT MEAL EVERY TWO DAYS",
];

function drawPanel(px: number, py: number, p: Panel): void {
  fillRect(px, py, 314, 393, PANEL_BG);
  border(px, py, 314, 393, 2, INK);
  fillRect(px, py, 314, 30, p.kc);
  drawText(px + 14, py + 8, p.kicker, 2, p.kt);
  p.art(px, py + 30, 314, 170);
  const hl = wrap(p.headline, 286, 4);
  let hy = py + 200 + 14;
  for (const ln of hl) {
    drawTextCentered(px + 157, hy, ln, 4, INK);
    hy += 33;
  }
  const sl = wrap(p.sub, 286, 2);
  let sy = hy + 10;
  for (const ln of sl) {
    drawTextCentered(px + 157, sy, ln, 2, SUB);
    sy += 18;
  }
}

function main(): void {
  fillRect(0, 0, W, H, PAPER);
  // masthead
  drawTextCentered(512, 30, "THE WORLD IN ONE DAY", 2, RED);
  drawTextCentered(512, 56, "WEDNESDAY 18 NOVEMBER 2026", 5, INK);
  fillRect(24, 104, 976, 3, RED);
  fillRect(24, 110, 976, 1, INK);
  // grid: 2 rows x 3 columns
  const colX = [24, 355, 686];
  const rowY = [126, 535];
  for (let i = 0; i < PANELS.length; i++) {
    drawPanel(colX[i % 3], rowY[Math.floor(i / 3)], PANELS[i]);
  }
  // footer strip
  fillRect(24, 944, 976, 2, INK);
  let fy = 956;
  for (const ln of FOOTER) {
    drawTextCentered(512, fy, ln, 2, INK);
    fy += 18;
  }
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG();
  writeFileSync(join(outDir, "entry.png"), png);
  console.log(`wrote ${join(outDir, "entry.png")} (${png.length} bytes)`);
}

main();
