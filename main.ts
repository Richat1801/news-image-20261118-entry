// news-image-20261118 refresh entry: draws one 1024x1024 infographic that sums up
// the world news of Wednesday 18 November 2026, and writes it to entry.png.
// Node 22, standard library only, no network, fully deterministic:
// the same bytes come out of every run.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- framebuffer
const fb = new Float32Array(W * H * 3);

function setPx(x, y, c) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
    for (let xx = Math.round(x); xx < Math.round(x + w); xx++) setPx(xx, yy, c);
  }
}

function fillCircle(cx, cy, r, c) {
  for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) {
    for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r * r) setPx(xx, yy, c);
    }
  }
}

function ring(cx, cy, r, w, c) {
  const ro = r + w / 2;
  const ri = r - w / 2;
  for (let yy = Math.floor(cy - ro); yy <= Math.ceil(cy + ro); yy++) {
    for (let xx = Math.floor(cx - ro); xx <= Math.ceil(cx + ro); xx++) {
      const d = Math.hypot(xx - cx, yy - cy);
      if (d <= ro && d >= ri) setPx(xx, yy, c);
    }
  }
}

function line(x0, y0, x1, y1, w, c) {
  const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, c);
  }
}

function arc(cx, cy, r, a0, a1, w, c) {
  const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) * r * 2));
  for (let s = 0; s <= steps; s++) {
    const a = a0 + ((a1 - a0) * s) / steps;
    fillCircle(cx + r * Math.cos(a), cy + r * Math.sin(a), w / 2, c);
  }
}

// ------------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows, each row a 5-bit number, bit 4 = leftmost column.
const FONT = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],      J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],   T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10], X: [17, 10, 4, 4, 4, 10, 17],
  Y: [17, 10, 4, 4, 4, 4, 4],      Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],     '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],     '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],   '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],        '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],       "'": [4, 4, 8, 0, 0, 0, 0],
  '-': [0, 0, 0, 14, 0, 0, 0],       '%': [25, 26, 2, 4, 8, 11, 19],
  '$': [4, 15, 20, 14, 5, 30, 4],    '+': [0, 4, 4, 14, 4, 4, 0],
  '/': [1, 2, 2, 4, 8, 8, 16],       ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],     '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],        '&': [12, 18, 20, 8, 21, 18, 13],
  '!': [4, 4, 4, 4, 4, 0, 4],        '?': [14, 17, 1, 2, 4, 0, 4],
  '|': [4, 4, 4, 4, 4, 4, 4],
};

function drawChar(ch, x, y, scale, c) {
  const g = FONT[ch] || FONT[' '];
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r] & (1 << (4 - col))) fillRect(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}

function text(str, x, y, scale, c, bold) {
  const off = bold ? Math.max(1, Math.round(scale * 0.6)) : 0;
  let cx = x;
  for (const ch of str) {
    drawChar(ch, cx, y, scale, c);
    if (bold) drawChar(ch, cx + off, y, scale, c);
    cx += 6 * scale;
  }
  return cx - x;
}

function wrapText(str, maxChars) {
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur === '') cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// -------------------------------------------------------------------- colours
const BG = [13, 21, 38];
const HEADER_BG = [9, 15, 29];
const PANEL_BG = [22, 34, 58];
const PANEL_EDGE = [46, 64, 96];
const FOOTER_BG = [16, 26, 45];
const WHITE = [240, 244, 250];
const BODY = [213, 223, 238];
const GOLD = [232, 177, 60];
const DIM = [120, 138, 165];

fillRect(0, 0, W, H, BG);

// --------------------------------------------------------------------- header
fillRect(0, 0, W, 100, HEADER_BG);
fillRect(0, 97, W, 3, GOLD);
text('WEDNESDAY 18 NOVEMBER 2026', 30, 14, 5, WHITE, true);
text("THE WORLD'S NEWS IN ONE PICTURE", 32, 62, 3, GOLD, false);
// small globe at the right of the header
ring(952, 49, 26, 3, GOLD);
line(926, 49, 978, 49, 2, GOLD);
line(952, 23, 952, 75, 2, GOLD);
arc(952, 49, 13, Math.PI / 2, (3 * Math.PI) / 2, 2, GOLD);
arc(952, 49, 13, -Math.PI / 2, Math.PI / 2, 2, GOLD);

// ---------------------------------------------------------------------- icons
// Each icon draws inside a 48x48 box whose top-left corner is (x, y).
function iconSkyline(x, y, c) {
  fillRect(x + 3, y + 24, 10, 20, c);
  fillRect(x + 17, y + 12, 13, 32, c);
  fillRect(x + 34, y + 19, 11, 25, c);
  fillCircle(x + 41, y + 7, 5, c);
  line(x + 2, y + 44, x + 46, y + 44, 3, c);
}
function iconPalace(x, y, c) {
  line(x + 3, y + 17, x + 24, y + 6, 3, c);
  line(x + 24, y + 6, x + 45, y + 17, 3, c);
  line(x + 24, y + 0, x + 24, y + 6, 2, c);
  fillRect(x + 24, y + 0, 9, 5, c);
  for (const px of [10, 19, 28, 37]) line(x + px, y + 20, x + px, y + 35, 3, c);
  fillRect(x + 5, y + 37, 38, 4, c);
  fillRect(x + 2, y + 43, 44, 3, c);
}
function iconBridge(x, y, c) {
  fillRect(x + 5, y + 8, 4, 28, c);
  fillRect(x + 39, y + 8, 4, 28, c);
  line(x + 1, y + 18, x + 20, y + 18, 4, c);
  line(x + 28, y + 18, x + 47, y + 18, 4, c);
  line(x + 20, y + 18, x + 29, y + 29, 4, c); // the fallen span
  line(x + 7, y + 8, x + 20, y + 18, 2, c);
  line(x + 41, y + 8, x + 28, y + 18, 2, c);
  arc(x + 11, y + 41, 5, Math.PI, 2 * Math.PI, 2, c);
  arc(x + 24, y + 41, 5, Math.PI, 2 * Math.PI, 2, c);
  arc(x + 37, y + 41, 5, Math.PI, 2 * Math.PI, 2, c);
}
function iconTanker(x, y, c) {
  fillRect(x + 4, y + 27, 40, 7, c);
  line(x + 4, y + 34, x + 10, y + 38, 3, c);
  line(x + 44, y + 34, x + 40, y + 38, 3, c);
  fillRect(x + 7, y + 23, 28, 4, c);
  fillRect(x + 35, y + 13, 8, 10, c);
  fillRect(x + 38, y + 7, 3, 6, c);
  arc(x + 11, y + 45, 5, Math.PI, 2 * Math.PI, 2, c);
  arc(x + 24, y + 45, 5, Math.PI, 2 * Math.PI, 2, c);
  arc(x + 37, y + 45, 5, Math.PI, 2 * Math.PI, 2, c);
}
function iconChip(x, y, c) {
  line(x + 13, y + 10, x + 35, y + 10, 3, c);
  line(x + 13, y + 34, x + 35, y + 34, 3, c);
  line(x + 13, y + 10, x + 13, y + 34, 3, c);
  line(x + 35, y + 10, x + 35, y + 34, 3, c);
  fillRect(x + 20, y + 17, 8, 8, c);
  for (const o of [15, 22, 29]) {
    line(x + 5, y + o, x + 13, y + o, 3, c);
    line(x + 35, y + o, x + 43, y + o, 3, c);
    line(x + o, y + 2, x + o, y + 10, 3, c);
    line(x + o, y + 34, x + o, y + 42, 3, c);
  }
}
function iconStorm(x, y, c) {
  const cx = x + 24;
  const cy = y + 20;
  arc(cx, cy, 19, -0.4, 2.8, 4, c);
  arc(cx, cy, 12.5, 2.8, 5.9, 4, c);
  arc(cx, cy, 6, 5.9, 9.0, 4, c);
  line(x + 10, y + 40, x + 6, y + 47, 3, c);
  line(x + 22, y + 40, x + 18, y + 47, 3, c);
  line(x + 34, y + 40, x + 30, y + 47, 3, c);
}

// --------------------------------------------------------------------- panels
const PANELS = [
  {
    tag: 'APEC SUMMIT - CHINA', head: 'PUTIN LANDS, SHENZHEN', accent: GOLD, icon: iconSkyline,
    bullets: [
      "ARRIVES 2AM WED FOR APEC LEADERS' MEETING",
      'FIRST TRUMP-XI-PUTIN TALKS DUE THU',
      'AGENDA: NUCLEAR ARMS CUTS, IRAN WAR',
    ],
  },
  {
    tag: 'PHILIPPINES - US', head: "TRUMP'S STATE VISIT", accent: [96, 165, 250], icon: iconPalace,
    bullets: [
      'STATE HONORS, TALKS WITH MARCOS',
      'MANILA SEEKS CUT TO 12.5% US TARIFF',
      '2,000 MARCH VS PAX SILICA AI HUB',
    ],
  },
  {
    tag: 'UKRAINE WAR - CRIMEA', head: 'KERCH BRIDGE DOWN', accent: [224, 82, 82], icon: iconBridge,
    bullets: [
      'RECORD 1,441-DRONE BARRAGE, 2ND NIGHT',
      'FLAMINGO MISSILES DROP ARCH IN SEA',
      'TRAFFIC HALTED; 2 DEAD, REPAIRS SET',
    ],
  },
  {
    tag: 'US-IRAN WAR - GULF', head: 'US-IRAN CLASH AT SEA', accent: [224, 127, 60], icon: iconTanker,
    bullets: [
      'US SINKS 5 IRANIAN TANKERS OFF OMAN',
      'IRAN HITS 10 SHIPS, JORDAN BASE',
      'OIL TOPS $100; GULF DRONES DOWNED',
    ],
  },
  {
    tag: 'MARKETS - TECH', head: 'NVIDIA LIFTS ASIA', accent: [87, 196, 106], icon: iconChip,
    bullets: [
      'REVENUE $115.8B, UP 103% Y/Y',
      '1ST REPORT UNDER INTERIM CEO KRESS',
      '+4% AFTER HOURS; ASIA CHIPS UP',
    ],
  },
  {
    tag: 'INDIA - WEATHER', head: 'CYCLONE AKVAN NEARS', accent: [154, 127, 224], icon: iconStorm,
    bullets: [
      'IMD WED ALERT: STORM GAINING IN BAY',
      'ORANGE ALERT FOR ANDHRA COAST',
      'LANDFALL DUE FRI, 120-130 KM/H',
    ],
  },
];

const PANEL_W = 480;
const PANEL_H = 248;
const COL_X = [24, 520];
const ROW_Y = [112, 368, 624];

PANELS.forEach((p, i) => {
  const x = COL_X[i % 2];
  const y = ROW_Y[Math.floor(i / 2)];
  fillRect(x, y, PANEL_W, PANEL_H, PANEL_BG);
  line(x, y, x + PANEL_W, y, 2, PANEL_EDGE);
  line(x, y + PANEL_H, x + PANEL_W, y + PANEL_H, 2, PANEL_EDGE);
  line(x, y, x, y + PANEL_H, 2, PANEL_EDGE);
  line(x + PANEL_W, y, x + PANEL_W, y + PANEL_H, 2, PANEL_EDGE);
  fillRect(x, y, PANEL_W, 6, p.accent);
  text(p.tag, x + 18, y + 15, 2, p.accent, true);
  p.icon(x + PANEL_W - 66, y + 10, p.accent);
  text(p.head, x + 18, y + 38, 3, WHITE, true);
  line(x + 18, y + 70, x + PANEL_W - 18, y + 70, 2, PANEL_EDGE);
  let by = y + 84;
  for (const b of p.bullets) {
    fillRect(x + 18, by + 7, 7, 7, p.accent);
    const lines = wrapText(b, 23);
    lines.forEach((ln, li) => text(ln, x + 34, by + li * 24, 3, BODY, false));
    by += lines.length * 24 + 6;
  }
});

// --------------------------------------------------------------------- footer
fillRect(0, 884, W, 124, FOOTER_BG);
fillRect(0, 884, W, 3, GOLD);
text('ALSO ON WEDNESDAY', 24, 896, 2, GOLD, true);
const FOOTER_LINES = [
  'INDIA 2-1 PAKISTAN: RECORD 10TH SAFF TITLE | N. KOREA MISSILE TO SEA OF JAPAN',
  'RUSSIAN MILITARY PLANE CRASH KILLS 19 | ISRAEL: EISENKOT TO FORM GOVERNMENT',
  "UN: GAZA'S 1.7M DISPLACED FACE DEADLY WINTER COLD AS AID CALLS GROW",
];
FOOTER_LINES.forEach((ln, i) => text(ln, 24, 920 + i * 25, 2, BODY, false));

// ------------------------------------------------------------------ PNG encode
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng() {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  let o = 0;
  for (let yy = 0; yy < H; yy++) {
    raw[o++] = 0;
    for (let xx = 0; xx < W; xx++) {
      const i = (yy * W + xx) * 3;
      raw[o++] = Math.max(0, Math.min(255, Math.round(fb[i])));
      raw[o++] = Math.max(0, Math.min(255, Math.round(fb[i + 1])));
      raw[o++] = Math.max(0, Math.min(255, Math.round(fb[i + 2])));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePng());
