import { rr } from '../util.js';

// Procedural art for every item. Coordinates are world units (1 cell = 1 unit).
// Floor items: (x, y) is the bottom-left on the floor surface; draw upward.
// Wall items: (x, y) is the bottom-left of the wall band; band height is h.

const OUT = 'rgba(28,20,14,0.6)';
const LW = 0.022;

function R(c, x, y, w, h, fill, r = 0.03, stroke = true) {
  c.beginPath();
  rr(c, x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) { c.lineWidth = LW; c.strokeStyle = OUT; c.stroke(); }
}
function O(c, x, y, r, fill, stroke = true) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) { c.lineWidth = LW; c.strokeStyle = OUT; c.stroke(); }
}
function E(c, x, y, rx, ry, fill, stroke = true) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) { c.lineWidth = LW; c.strokeStyle = OUT; c.stroke(); }
}
function L(c, pts, stroke = OUT, lw = LW) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.lineWidth = lw;
  c.strokeStyle = stroke;
  c.stroke();
}
function glow(o, x, y, r, color, k = 1) {
  if (o.lights) o.lights.push({ x, y, r, color, k });
}
function leaves(c, x, y, n, spread, seed, cols = ['#5f9a3e', '#78b04a', '#4a7f33']) {
  for (let i = 0; i < n; i++) {
    const a = Math.sin(seed * 12.9 + i * 78.2) * 43758.5;
    const r = a - Math.floor(a);
    const r2 = (Math.sin(seed * 3.1 + i * 11.7) * 9631.1) % 1;
    O(c, x + (r - 0.5) * spread, y - Math.abs(r2) * spread * 0.6, 0.06 + r * 0.05, cols[i % cols.length], false);
  }
}
function legs(c, x1, x2, y, top) {
  L(c, [x1, y, x1, top], '#3a3a3a', 0.035);
  L(c, [x2, y, x2, top], '#3a3a3a', 0.035);
}
function blanket(c, x, y, w, h, col) {
  R(c, x, y, w, h, col, 0.06);
  c.save();
  c.globalAlpha = 0.25;
  L(c, [x + w * 0.3, y + 0.02, x + w * 0.35, y + h - 0.02], '#000', 0.015);
  L(c, [x + w * 0.65, y + 0.02, x + w * 0.6, y + h - 0.02], '#000', 0.015);
  c.restore();
}

export const SLEEP_SPOTS = {
  bedroll: (x, y) => [{ x: x + 0.24, y: y - 0.17 }],
  cot: (x, y) => [{ x: x + 0.3, y: y - 0.42 }],
  bunk: (x, y) => [{ x: x + 0.32, y: y - 0.37 }, { x: x + 0.32, y: y - 0.92 }],
  bed: (x, y) => [{ x: x + 0.32, y: y - 0.47 }, { x: x + 0.62, y: y - 0.47 }],
  sofa: (x, y) => [{ x: x + 0.35, y: y - 0.42 }],
};

export const ART = {
  bedroll(c, x, y) {
    R(c, x + 0.06, y - 0.1, 0.88, 0.1, '#55707f', 0.05);
    blanket(c, x + 0.32, y - 0.17, 0.6, 0.13, '#b5653a');
    R(c, x + 0.1, y - 0.2, 0.26, 0.1, '#efe6d6', 0.05);
  },
  cot(c, x, y, w) {
    legs(c, x + 0.15, x + w - 0.15, y, y - 0.3);
    L(c, [x + 0.15, y, x + w - 0.15, y - 0.3], '#3a3a3a', 0.025);
    L(c, [x + w - 0.15, y, x + 0.15, y - 0.3], '#3a3a3a', 0.025);
    R(c, x + 0.08, y - 0.38, w - 0.16, 0.09, '#7c8a5a', 0.03);
    blanket(c, x + 0.5, y - 0.45, w - 0.62, 0.12, '#6b7b4a');
    R(c, x + 0.12, y - 0.47, 0.32, 0.1, '#e9e0cc', 0.05);
  },
  bunk(c, x, y, w) {
    const m = '#5b6770';
    R(c, x + 0.06, y - 1.18, 0.07, 1.18, m, 0.02);
    R(c, x + w - 0.13, y - 1.18, 0.07, 1.18, m, 0.02);
    for (const ly of [y - 0.25, y - 0.8]) {
      R(c, x + 0.08, ly, w - 0.16, 0.06, m, 0.01);
      R(c, x + 0.1, ly - 0.08, w - 0.2, 0.08, '#d9d2c2', 0.03);
      blanket(c, x + 0.5, ly - 0.14, w - 0.62, 0.11, ly > y - 0.5 ? '#3f6a8a' : '#a34a3a');
      R(c, x + 0.14, ly - 0.16, 0.3, 0.09, '#f2ece0', 0.04);
    }
    for (let i = 0; i < 4; i++) L(c, [x + w - 0.3, y - 0.3 - i * 0.18, x + w - 0.13, y - 0.3 - i * 0.18], m, 0.03);
    L(c, [x + w - 0.3, y - 0.2, x + w - 0.3, y - 0.95], m, 0.03);
  },
  bed(c, x, y, w) {
    R(c, x + 0.05, y - 0.85, 0.12, 0.85, '#6b4528', 0.04);
    R(c, x + w - 0.14, y - 0.45, 0.1, 0.45, '#6b4528', 0.03);
    R(c, x + 0.1, y - 0.28, w - 0.2, 0.2, '#7a5032', 0.03);
    R(c, x + 0.12, y - 0.42, w - 0.24, 0.16, '#f0e9dc', 0.05);
    blanket(c, x + 0.55, y - 0.5, w - 0.67, 0.24, '#c97b5a');
    R(c, x + 0.17, y - 0.55, 0.3, 0.13, '#fbf6ec', 0.06);
    R(c, x + 0.45, y - 0.55, 0.27, 0.12, '#e8dcc6', 0.06);
    O(c, x + w - 0.35, y - 0.6, 0.07, '#d9c3a0');
    O(c, x + w - 0.4, y - 0.67, 0.035, '#d9c3a0');
    O(c, x + w - 0.3, y - 0.67, 0.035, '#d9c3a0');
  },
  sofa(c, x, y, w) {
    R(c, x + 0.08, y - 0.62, w - 0.16, 0.36, '#6d7f5a', 0.08);
    R(c, x + 0.05, y - 0.32, w - 0.1, 0.24, '#7d8f68', 0.06);
    R(c, x + 0.02, y - 0.45, 0.16, 0.37, '#5f704c', 0.06);
    R(c, x + w - 0.18, y - 0.45, 0.16, 0.37, '#5f704c', 0.06);
    R(c, x + w * 0.55, y - 0.66, 0.35, 0.42, '#d8cdb5', 0.05);
    R(c, x + 0.3, y - 0.5, 0.25, 0.18, '#c9884a', 0.05);
    L(c, [x + 0.12, y - 0.08, x + 0.12, y], '#3a2a1a', 0.04);
    L(c, [x + w - 0.12, y - 0.08, x + w - 0.12, y], '#3a2a1a', 0.04);
  },
  armchair(c, x, y) {
    R(c, x + 0.14, y - 0.7, 0.72, 0.42, '#8a5a3c', 0.1);
    R(c, x + 0.1, y - 0.34, 0.8, 0.24, '#9a6a48', 0.06);
    R(c, x + 0.06, y - 0.45, 0.14, 0.35, '#7a4c30', 0.06);
    R(c, x + 0.8, y - 0.45, 0.14, 0.35, '#7a4c30', 0.06);
    R(c, x + 0.45, y - 0.72, 0.3, 0.55, '#efe6d0', 0.04);
    for (let i = 0; i < 4; i++) L(c, [x + 0.48, y - 0.65 + i * 0.12, x + 0.72, y - 0.65 + i * 0.12], 'rgba(0,0,0,0.15)', 0.012);
    L(c, [x + 0.16, y - 0.1, x + 0.16, y], '#3a2a1a', 0.04);
    L(c, [x + 0.84, y - 0.1, x + 0.84, y], '#3a2a1a', 0.04);
  },
  table(c, x, y) {
    R(c, x + 0.08, y - 0.5, 0.84, 0.06, '#8a6440', 0.02);
    legs(c, x + 0.16, x + 0.84, y, y - 0.45);
    R(c, x + 0.2, y - 0.53, 0.42, 0.03, '#e8dcb8', 0.005);
    L(c, [x + 0.25, y - 0.52, x + 0.4, y - 0.525, x + 0.55, y - 0.515], '#b5302b', 0.012);
    R(c, x + 0.7, y - 0.62, 0.09, 0.1, '#e6e1d6', 0.02);
  },
  bookshelf(c, x, y) {
    R(c, x + 0.1, y - 1.12, 0.8, 1.12, '#6b4528', 0.02);
    const cols = ['#a8352b', '#2f5d8a', '#c9a227', '#3f6a4a', '#7a4a8a', '#d26a2c', '#e6dcc8'];
    for (let s = 0; s < 4; s++) {
      const sy = y - 0.08 - s * 0.27;
      R(c, x + 0.14, sy - 0.22, 0.72, 0.22, '#3a2616', 0, false);
      let bx = x + 0.16;
      let k = s * 3;
      while (bx < x + 0.8) {
        const bw = 0.05 + ((k * 37) % 5) * 0.012;
        const bh = 0.15 + ((k * 13) % 4) * 0.015;
        R(c, bx, sy - bh, bw, bh, cols[k % cols.length], 0.005, false);
        bx += bw + 0.008;
        k++;
      }
      R(c, x + 0.12, sy, 0.76, 0.03, '#7a5032', 0, false);
    }
  },
  tv(c, x, y, w, h, o) {
    R(c, x + 0.08, y - 0.38, 0.84, 0.38, '#6b4528', 0.03);
    R(c, x + 0.18, y - 0.82, 0.64, 0.46, '#3a3632', 0.06);
    const flick = o.lit ? 0.75 + 0.25 * Math.sin(o.t * 13) * Math.sin(o.t * 3.7) : 0;
    R(c, x + 0.24, y - 0.77, 0.44, 0.34, o.lit ? `rgba(${140 + flick * 60},${170 + flick * 50},${230},1)` : '#2a2e30', 0.05);
    O(c, x + 0.74, y - 0.7, 0.025, '#aaa');
    O(c, x + 0.74, y - 0.6, 0.025, '#aaa');
    L(c, [x + 0.4, y - 0.82, x + 0.3, y - 1.0], '#777', 0.015);
    L(c, [x + 0.5, y - 0.82, x + 0.62, y - 1.02], '#777', 0.015);
    if (o.lit) glow(o, x + 0.46, y - 0.6, 1.4, '#8fb8ff', 0.6 + flick * 0.3);
  },
  pet_bed(c, x, y, w, h, o) {
    E(c, x + 0.5, y - 0.08, 0.38, 0.09, '#a34a5a');
    E(c, x + 0.5, y - 0.1, 0.3, 0.06, '#e6c9a8', false);
    const br = 1 + 0.04 * Math.sin(o.t * 1.6);
    E(c, x + 0.5, y - 0.2, 0.22, 0.12 * br, '#e08a3a');
    O(c, x + 0.32, y - 0.22, 0.09, '#e08a3a');
    c.beginPath();
    c.moveTo(x + 0.26, y - 0.28); c.lineTo(x + 0.28, y - 0.36); c.lineTo(x + 0.32, y - 0.3);
    c.moveTo(x + 0.33, y - 0.3); c.lineTo(x + 0.37, y - 0.37); c.lineTo(x + 0.39, y - 0.28);
    c.fillStyle = '#e08a3a'; c.fill();
    L(c, [x + 0.28, y - 0.21, x + 0.31, y - 0.2], '#3a2a1a', 0.012);
    L(c, [x + 0.7, y - 0.15, x + 0.62, y - 0.1, x + 0.45, y - 0.1], '#c06a2a', 0.04);
    L(c, [x + 0.45, y - 0.25, x + 0.6, y - 0.28], 'rgba(160,80,30,0.6)', 0.02);
  },
  aquarium(c, x, y, w, h, o) {
    R(c, x + 0.1, y - 0.4, 0.8, 0.4, '#4a3a2c', 0.02);
    R(c, x + 0.12, y - 0.88, 0.76, 0.48, o.lit ? 'rgba(120,210,235,0.9)' : 'rgba(80,120,130,0.9)', 0.02);
    R(c, x + 0.12, y - 0.45, 0.76, 0.05, '#d9c38a', 0, false);
    for (let i = 0; i < 3; i++) L(c, [x + 0.22 + i * 0.25, y - 0.45, x + 0.2 + i * 0.25 + Math.sin(o.t + i) * 0.03, y - 0.68], '#3f8a4a', 0.03);
    for (let i = 0; i < 3; i++) {
      const fx = x + 0.5 + Math.sin(o.t * 0.7 + i * 2.1) * 0.28;
      const fy = y - 0.6 - i * 0.07;
      E(c, fx, fy, 0.05, 0.025, ['#ff8a3c', '#ffd84a', '#ff5a6a'][i], false);
    }
    R(c, x + 0.1, y - 0.9, 0.8, 0.04, '#333', 0.01);
    if (o.lit) glow(o, x + 0.5, y - 0.65, 1.1, '#7fe0ff', 0.5);
  },
  heater(c, x, y, w, h, o) {
    R(c, x + 0.2, y - 0.6, 0.6, 0.55, '#d8d2c4', 0.06);
    for (let i = 0; i < 4; i++) R(c, x + 0.27 + i * 0.13, y - 0.55, 0.08, 0.42, o.lit ? '#ff7a2a' : '#8a8274', 0.03, false);
    L(c, [x + 0.25, y - 0.05, x + 0.25, y], '#555', 0.04);
    L(c, [x + 0.75, y - 0.05, x + 0.75, y], '#555', 0.04);
    if (o.lit) glow(o, x + 0.5, y - 0.35, 1.3, '#ff8a3c', 0.7);
  },
  radio_set(c, x, y, w, h, o) {
    R(c, x + 0.06, y - 0.48, 0.88, 0.05, '#7a5032', 0.01);
    legs(c, x + 0.12, x + 0.88, y, y - 0.44);
    R(c, x + 0.14, y - 0.78, 0.6, 0.3, '#4a4f45', 0.03);
    R(c, x + 0.2, y - 0.72, 0.24, 0.1, o.lit ? '#9dff9a' : '#2a3a2a', 0.01);
    O(c, x + 0.56, y - 0.66, 0.05, '#bbb');
    O(c, x + 0.67, y - 0.66, 0.035, '#bbb');
    L(c, [x + 0.7, y - 0.78, x + 0.85, y - 1.15], '#888', 0.015);
    L(c, [x + 0.82, y - 0.5, x + 0.86, y - 0.62], '#222', 0.03);
    O(c, x + 0.87, y - 0.65, 0.03, '#222');
    if (o.lit) glow(o, x + 0.32, y - 0.67, 0.6, '#9dff9a', 0.5);
  },
  planter(c, x, y, w, h, o) {
    leaves(c, x + 0.5, y - 0.32, 14, 0.7, x * 7.1);
    R(c, x + 0.1, y - 0.3, 0.8, 0.3, '#9a6a3c', 0.02);
    L(c, [x + 0.1, y - 0.15, x + 0.9, y - 0.15], 'rgba(0,0,0,0.25)', 0.015);
  },
  hydro(c, x, y, w, h, o) {
    const fr = '#d9dcd6';
    R(c, x + 0.08, y - 1.15, 0.05, 1.15, fr, 0.01);
    R(c, x + w - 0.13, y - 1.15, 0.05, 1.15, fr, 0.01);
    for (let i = 0; i < 3; i++) {
      const ty = y - 0.15 - i * 0.36;
      leaves(c, x + w / 2, ty - 0.06, 26, w - 0.4, i * 5.3 + x, ['#7fc04a', '#a6d65a', '#5f9a3e', '#c4e08a']);
      R(c, x + 0.1, ty - 0.06, w - 0.2, 0.08, '#eef0ea', 0.04);
      for (let k = 0; k < 6; k++) O(c, x + 0.25 + k * (w - 0.5) / 5, ty - 0.02, 0.025, '#333', false);
      if (o.lit) R(c, x + 0.15, ty - 0.33, w - 0.3, 0.025, '#d8ffc0', 0.01, false);
    }
    R(c, x + 0.1, y - 0.12, 0.25, 0.12, '#4a7fa8', 0.02);
    L(c, [x + 0.22, y - 0.12, x + 0.22, y - 0.2, x + 0.11, y - 0.2], '#cfd8dc', 0.02);
    if (o.lit) glow(o, x + w / 2, y - 0.6, 1.8, '#9dff7a', 0.6);
  },
  stove(c, x, y, w, h, o) {
    R(c, x + 0.08, y - 0.48, 0.84, 0.05, '#c8a878', 0.01);
    L(c, [x + 0.15, y, x + 0.8, y - 0.44], '#555', 0.03);
    L(c, [x + 0.85, y, x + 0.2, y - 0.44], '#555', 0.03);
    R(c, x + 0.18, y - 0.58, 0.48, 0.1, '#9a9a9a', 0.02);
    O(c, x + 0.3, y - 0.6, 0.02, '#4a9aff', false);
    R(c, x + 0.32, y - 0.8, 0.26, 0.2, '#3a3a3a', 0.06);
    L(c, [x + 0.58, y - 0.72, x + 0.68, y - 0.78], '#3a3a3a', 0.03);
    c.save();
    c.globalAlpha = 0.35;
    for (let i = 0; i < 3; i++) {
      const p = (o.t * 0.4 + i / 3) % 1;
      O(c, x + 0.45 + Math.sin(p * 6 + i) * 0.05, y - 0.85 - p * 0.35, 0.03 + p * 0.05, '#ffffff', false);
    }
    c.restore();
    R(c, x + 0.7, y - 0.56, 0.08, 0.08, '#e8e0cc', 0.01);
  },
  fridge(c, x, y, w, h, o) {
    R(c, x + 0.14, y - 1.08, 0.72, 1.08, '#cfd6da', 0.05);
    R(c, x + 0.2, y - 1.0, 0.6, 0.58, o.lit ? 'rgba(225,245,255,0.95)' : 'rgba(170,185,190,0.95)', 0.02);
    const fruit = ['#e2483a', '#7fc04a', '#f0a43a', '#e2483a', '#c4d84a'];
    for (let s = 0; s < 3; s++) {
      const sy = y - 0.6 - s * 0.17;
      L(c, [x + 0.2, sy, x + 0.8, sy], '#9fb0b8', 0.012);
      for (let k = 0; k < 4; k++) O(c, x + 0.28 + k * 0.14, sy - 0.05, 0.045, fruit[(s + k) % 5], false);
    }
    R(c, x + 0.2, y - 0.38, 0.6, 0.3, '#c2cacd', 0.02);
    L(c, [x + 0.74, y - 0.3, x + 0.74, y - 0.18], '#666', 0.03);
    if (o.lit) glow(o, x + 0.5, y - 0.72, 0.7, '#dff4ff', 0.5);
  },
  pantry(c, x, y) {
    const m = '#9aa2a6';
    L(c, [x + 0.12, y, x + 0.12, y - 1.1], m, 0.04);
    L(c, [x + 0.88, y, x + 0.88, y - 1.1], m, 0.04);
    for (let s = 0; s < 4; s++) {
      const sy = y - 0.05 - s * 0.28;
      L(c, [x + 0.1, sy, x + 0.9, sy], m, 0.035);
      for (let k = 0; k < 5; k++) {
        const kind = (s * 5 + k) % 3;
        const ix = x + 0.17 + k * 0.14;
        if (kind === 0) R(c, ix, sy - 0.14, 0.11, 0.14, ['#c8452f', '#e0a526', '#3f7f4a'][(s + k) % 3], 0.02);
        else if (kind === 1) R(c, ix + 0.02, sy - 0.2, 0.07, 0.2, 'rgba(170,215,240,0.95)', 0.02);
        else R(c, ix, sy - 0.12, 0.12, 0.12, '#d8b878', 0.01);
      }
    }
  },
  rain_barrel(c, x, y, w, h, o) {
    L(c, [x + 0.5, y - 0.75, x + 0.5, y - h + 0.05], '#7a8288', 0.05);
    c.beginPath();
    c.moveTo(x + 0.3, y - 0.82); c.lineTo(x + 0.7, y - 0.82); c.lineTo(x + 0.55, y - 0.72); c.lineTo(x + 0.45, y - 0.72); c.closePath();
    c.fillStyle = '#8a9298'; c.fill();
    R(c, x + 0.18, y - 0.72, 0.64, 0.72, '#3f6f8a', 0.1);
    for (const by of [0.15, 0.55]) L(c, [x + 0.18, y - by, x + 0.82, y - by], '#2a4a5c', 0.03);
    R(c, x + 0.75, y - 0.2, 0.1, 0.05, '#888', 0.01);
    if (o.rain) {
      const p = (o.t * 2) % 1;
      O(c, x + 0.5, y - 0.75 + p * 0.03, 0.015, '#bfe6ff', false);
    }
  },
  water_jugs(c, x, y) {
    const j = 'rgba(120,180,225,0.9)';
    for (const [jx, jy] of [[0.08, 0], [0.5, 0], [0.29, 0.42]]) {
      R(c, x + jx, y - jy - 0.4, 0.4, 0.4, j, 0.08);
      R(c, x + jx + 0.14, y - jy - 0.46, 0.12, 0.07, '#2f6fb0', 0.02);
      L(c, [x + jx + 0.05, y - jy - 0.2, x + jx + 0.35, y - jy - 0.2], 'rgba(255,255,255,0.4)', 0.02);
    }
  },
  purifier(c, x, y, w, h, o) {
    R(c, x + 0.12, y - 0.3, 0.76, 0.3, '#e0e3e0', 0.03);
    R(c, x + 0.18, y - 0.26, 0.14, 0.08, o.lit ? '#6fe3ff' : '#345', 0.01);
    O(c, x + 0.45, y - 0.15, 0.025, o.lit ? '#6f6' : '#353', false);
    O(c, x + 0.55, y - 0.15, 0.025, o.lit ? '#f66' : '#533', false);
    R(c, x + 0.2, y - 1.05, 0.6, 0.72, o.lit ? 'rgba(130,225,250,0.85)' : 'rgba(110,150,160,0.85)', 0.04);
    L(c, [x + 0.2, y - 0.81, x + 0.8, y - 0.81], 'rgba(255,255,255,0.6)', 0.02);
    L(c, [x + 0.2, y - 0.57, x + 0.8, y - 0.57], 'rgba(255,255,255,0.6)', 0.02);
    if (o.lit) {
      for (let i = 0; i < 5; i++) {
        const p = (o.t * 0.3 + i / 5) % 1;
        O(c, x + 0.3 + ((i * 0.37) % 1) * 0.4, y - 0.36 - p * 0.65, 0.018, 'rgba(255,255,255,0.8)', false);
      }
      glow(o, x + 0.5, y - 0.7, 1.5, '#6fe3ff', 0.75);
    }
    L(c, [x + 0.8, y - 0.9, x + 0.92, y - 0.9, x + 0.92, y - 0.2, x + 0.88, y - 0.2], '#dfe4e6', 0.04);
  },
  fish_trap(c, x, y) {
    R(c, x + 0.12, y - 0.5, 0.76, 0.5, 'rgba(90,110,100,0.25)', 0.06);
    c.save();
    c.beginPath(); rr(c, x + 0.12, y - 0.5, 0.76, 0.5, 0.06); c.clip();
    for (let i = 0; i < 8; i++) L(c, [x + 0.12 + i * 0.1, y, x + 0.12 + i * 0.1, y - 0.5], 'rgba(60,70,60,0.6)', 0.012);
    for (let i = 0; i < 5; i++) L(c, [x + 0.12, y - i * 0.1, x + 0.88, y - i * 0.1], 'rgba(60,70,60,0.6)', 0.012);
    c.restore();
    E(c, x + 0.4, y - 0.15, 0.12, 0.05, '#9ab0b8');
    E(c, x + 0.62, y - 0.28, 0.1, 0.04, '#b8c4c8');
  },
  generator(c, x, y, w, h, o) {
    const sh = o.lit ? Math.sin(o.t * 40) * 0.006 : 0;
    O(c, x + 0.25, y - 0.08, 0.08, '#222');
    O(c, x + 0.75, y - 0.08, 0.08, '#222');
    R(c, x + 0.1 + sh, y - 0.55, 0.8, 0.42, '#c0392b', 0.05);
    R(c, x + 0.2 + sh, y - 0.48, 0.3, 0.2, '#2a2a2a', 0.02);
    R(c, x + 0.6 + sh, y - 0.66, 0.2, 0.12, '#3a3a3a', 0.02);
    L(c, [x + 0.1, y - 0.55, x + 0.9, y - 0.55], '#555', 0.035);
    if (o.lit) {
      c.save(); c.globalAlpha = 0.25;
      const p = (o.t * 0.7) % 1;
      O(c, x + 0.75, y - 0.75 - p * 0.3, 0.05 + p * 0.06, '#666', false);
      c.restore();
    }
  },
  solar(c, x, y, w, h, o) {
    L(c, [x + 0.5, y, x + 0.5, y - 0.45], '#666', 0.04);
    L(c, [x + 0.3, y, x + 0.7, y], '#666', 0.04);
    c.save();
    c.translate(x + 0.5, y - 0.6);
    c.rotate(-0.35);
    R(c, -0.42, -0.2, 0.84, 0.4, '#2b4a7a', 0.02);
    for (let i = 1; i < 4; i++) L(c, [-0.42 + i * 0.21, -0.2, -0.42 + i * 0.21, 0.2], '#8fb0d8', 0.01);
    L(c, [-0.42, 0, 0.42, 0], '#8fb0d8', 0.01);
    c.restore();
  },
  battery(c, x, y, w, h, o) {
    for (let i = 0; i < 2; i++) {
      R(c, x + 0.15, y - 0.32 - i * 0.34, 0.7, 0.3, '#2f3438', 0.03);
      for (let k = 0; k < 4; k++) O(c, x + 0.3 + k * 0.1, y - 0.17 - i * 0.34, 0.02, o.lit && k < 3 ? '#6f6' : '#353', false);
      R(c, x + 0.22, y - 0.36 - i * 0.34, 0.08, 0.04, '#c8452f', 0.01, false);
      R(c, x + 0.7, y - 0.36 - i * 0.34, 0.08, 0.04, '#333', 0.01, false);
    }
  },
  workbench(c, x, y, w, h) {
    R(c, x + 0.15, y - 1.15, w - 0.3, 0.55, '#b89a6a', 0.01);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) O(c, x + 0.25 + i * (w - 0.5) / 7, y - 1.08 + j * 0.13, 0.008, '#6a5432', false);
    L(c, [x + 0.35, y - 1.0, x + 0.35, y - 0.75], '#555', 0.03);
    L(c, [x + 0.55, y - 1.0, x + 0.7, y - 0.78], '#a33', 0.035);
    L(c, [x + 0.95, y - 1.02, x + 0.95, y - 0.8], '#777', 0.025);
    R(c, x + 0.9, y - 0.84, 0.1, 0.06, '#333', 0.01);
    O(c, x + 1.3, y - 0.9, 0.09, 'rgba(0,0,0,0)');
    R(c, x + 0.05, y - 0.52, w - 0.1, 0.08, '#7a5032', 0.02);
    legs(c, x + 0.12, x + w - 0.12, y, y - 0.44);
    R(c, x + w - 0.5, y - 0.68, 0.3, 0.16, '#5a6a7a', 0.02);
    R(c, x + 0.3, y - 0.62, 0.4, 0.1, '#888', 0.01);
    R(c, x + 0.2, y - 0.22, w - 0.4, 0.2, '#5a4030', 0.02);
  },
  crates(c, x, y) {
    for (const [cx, cy, s] of [[0.06, 0, 0.48], [0.5, 0, 0.44], [0.24, 0.48, 0.42]]) {
      R(c, x + cx, y - cy - s, s, s, '#a87b45', 0.01);
      L(c, [x + cx, y - cy - s, x + cx + s, y - cy], '#7a552c', 0.025);
      R(c, x + cx, y - cy - s, s, s, 'rgba(0,0,0,0)', 0.01);
    }
  },
  barricade(c, x, y) {
    const sb = '#b8a57a';
    for (let row = 0; row < 3; row++) {
      const n = 3 - (row === 2 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const off = row === 1 ? 0.15 : row === 2 ? 0.2 : 0;
        E(c, x + 0.2 + off + i * 0.3, y - 0.1 - row * 0.18, 0.17, 0.1, sb);
      }
    }
  },
  lookout(c, x, y, w, h, o) {
    R(c, x + 0.1, y - 0.3, 0.45, 0.3, '#5f6b4a', 0.02);
    R(c, x + 0.6, y - 0.18, 0.28, 0.18, '#3f4a3a', 0.02);
    L(c, [x + 0.35, y - 0.3, x + 0.3, y - 0.72], '#555', 0.025);
    L(c, [x + 0.35, y - 0.3, x + 0.45, y - 0.72], '#555', 0.025);
    c.save();
    c.translate(x + 0.4, y - 0.76);
    c.rotate(-0.12);
    R(c, -0.3, -0.04, 0.75, 0.07, '#2a2a2a', 0.02);
    R(c, -0.38, -0.05, 0.14, 0.12, '#6b4528', 0.03);
    R(c, -0.05, -0.1, 0.16, 0.06, '#222', 0.02);
    c.restore();
  },
  turret(c, x, y, w) {
    for (let i = 0; i < 4; i++) E(c, x + 0.25 + i * 0.5, y - 0.1, 0.27, 0.11, '#b8a57a');
    for (let i = 0; i < 3; i++) E(c, x + 0.5 + i * 0.5, y - 0.28, 0.27, 0.11, '#a8956a');
    L(c, [x + w / 2, y - 0.35, x + w / 2, y - 0.7], '#444', 0.06);
    R(c, x + w / 2 - 0.3, y - 0.85, 0.5, 0.2, '#3a3f3a', 0.04);
    R(c, x + w / 2 + 0.15, y - 0.8, 0.75, 0.07, '#2a2a2a', 0.02);
    R(c, x + w / 2 - 0.15, y - 0.72, 0.18, 0.16, '#5a6a4a', 0.02);
  },

  // ----- wall -----
  string_lights(c, x, y, w, h, o) {
    const top = y - h + 0.05;
    c.beginPath();
    c.moveTo(x, top);
    c.quadraticCurveTo(x + w / 2, top + 0.18, x + w, top);
    c.lineWidth = 0.012; c.strokeStyle = '#333'; c.stroke();
    for (let i = 0; i < 5; i++) {
      const u = (i + 0.5) / 5;
      const bx = x + u * w;
      const by = top + 0.18 * 2 * u * (1 - u) * 1.0 + 0.03;
      const tw = 0.7 + 0.3 * Math.sin(o.t * 2 + bx * 5);
      O(c, bx, by, 0.028, o.night ? `rgba(255,${200 + tw * 40},${120 + tw * 40},1)` : '#f5e6c0', false);
    }
    glow(o, x + w / 2, top + 0.1, 1.1, '#ffd28a', 0.55);
  },
  lantern(c, x, y, w, h, o) {
    const top = y - h;
    L(c, [x + 0.5, top, x + 0.5, top + 0.12], '#333', 0.015);
    c.beginPath(); c.arc(x + 0.5, top + 0.15, 0.04, Math.PI, 0); c.lineWidth = 0.015; c.strokeStyle = '#333'; c.stroke();
    R(c, x + 0.41, top + 0.18, 0.18, 0.04, '#3a3a3a', 0.01);
    R(c, x + 0.42, top + 0.22, 0.16, 0.2, 'rgba(255,200,110,0.95)', 0.03);
    O(c, x + 0.5, top + 0.32, 0.035, '#fff3c8', false);
    R(c, x + 0.4, top + 0.42, 0.2, 0.04, '#3a3a3a', 0.01);
    const fl = 0.9 + 0.1 * Math.sin(o.t * 9 + x);
    glow(o, x + 0.5, top + 0.3, 1.8, '#ffb85c', fl);
  },
  wall_lamp(c, x, y, w, h, o) {
    const cy = y - h * 0.55;
    R(c, x + 0.44, cy, 0.12, 0.18, '#7a6a4a', 0.02);
    c.beginPath();
    c.moveTo(x + 0.32, cy); c.lineTo(x + 0.68, cy); c.lineTo(x + 0.6, cy - 0.18); c.lineTo(x + 0.4, cy - 0.18); c.closePath();
    c.fillStyle = o.lit ? '#ffe9b8' : '#cfc2a0'; c.fill(); c.lineWidth = LW; c.strokeStyle = OUT; c.stroke();
    if (o.lit) glow(o, x + 0.5, cy - 0.05, 2.4, '#ffe2a8', 0.9);
  },
  shelf(c, x, y, w, h) {
    const sy = y - h * 0.35;
    R(c, x + 0.05, sy, 0.9, 0.05, '#7a5032', 0.01);
    L(c, [x + 0.15, sy + 0.05, x + 0.2, sy + 0.15], '#444', 0.02);
    L(c, [x + 0.85, sy + 0.05, x + 0.8, sy + 0.15], '#444', 0.02);
    R(c, x + 0.1, sy - 0.16, 0.12, 0.16, '#c8452f', 0.02);
    R(c, x + 0.25, sy - 0.16, 0.12, 0.16, '#e0a526', 0.02);
    R(c, x + 0.42, sy - 0.2, 0.12, 0.2, 'rgba(230,200,120,0.9)', 0.03);
    R(c, x + 0.6, sy - 0.12, 0.3, 0.12, '#d8b878', 0.01);
  },
  map(c, x, y, w, h) {
    const t = y - h + 0.06;
    R(c, x + 0.1, t, 0.8, h - 0.14, '#b08a5a', 0.02);
    R(c, x + 0.15, t + 0.05, 0.7, h - 0.24, '#e8dfc4', 0.01, false);
    L(c, [x + 0.2, t + 0.2, x + 0.4, t + 0.12, x + 0.55, t + 0.25, x + 0.8, t + 0.15], '#5a8ac0', 0.015);
    L(c, [x + 0.25, t + 0.3, x + 0.5, t + 0.32, x + 0.75, t + 0.28], '#b5302b', 0.015);
    O(c, x + 0.3, t + 0.18, 0.025, '#e2483a', false);
    O(c, x + 0.62, t + 0.22, 0.025, '#e2483a', false);
    R(c, x + 0.68, t + 0.3, 0.12, 0.1, '#f0d860', 0.005, false);
  },
  hanging_plant(c, x, y, w, h, o) {
    const top = y - h;
    L(c, [x + 0.5, top, x + 0.38, top + 0.2], '#8a7a5a', 0.01);
    L(c, [x + 0.5, top, x + 0.62, top + 0.2], '#8a7a5a', 0.01);
    for (let i = 0; i < 4; i++) {
      const vx = x + 0.32 + i * 0.12;
      const sway = Math.sin(o.t * 0.8 + i) * 0.02;
      L(c, [vx, top + 0.25, vx + sway, top + 0.45 + (i % 2) * 0.1], '#4a7f33', 0.02);
      O(c, vx + sway, top + 0.45 + (i % 2) * 0.1, 0.03, '#5f9a3e', false);
    }
    R(c, x + 0.36, top + 0.18, 0.28, 0.1, '#b5653a', 0.03);
    leaves(c, x + 0.5, top + 0.2, 10, 0.4, x * 3.3);
  },
  photos(c, x, y, w, h) {
    const t = y - h + 0.1;
    const p = [[0.12, 0.02, -0.12], [0.42, 0.0, 0.08], [0.25, 0.22, 0.05], [0.6, 0.2, -0.06]];
    for (const [px, py, rot] of p) {
      c.save();
      c.translate(x + px + 0.12, t + py + 0.13);
      c.rotate(rot);
      R(c, -0.12, -0.13, 0.24, 0.26, '#f4f1ea', 0.005);
      R(c, -0.1, -0.11, 0.2, 0.17, ['#6a7a8a', '#8a6a5a', '#5a7a6a', '#7a6a8a'][Math.floor(px * 10) % 4], 0, false);
      R(c, -0.04, -0.15, 0.08, 0.04, 'rgba(240,220,160,0.8)', 0, false);
      c.restore();
    }
  },
  clock(c, x, y, w, h, o) {
    const cx = x + 0.5, cy = y - h * 0.55;
    O(c, cx, cy, 0.17, '#f4ecd8');
    O(c, cx, cy, 0.17, 'rgba(0,0,0,0)');
    const hr = (o.hour % 12) / 12 * Math.PI * 2;
    const mn = (o.hour % 1) * Math.PI * 2;
    L(c, [cx, cy, cx + Math.sin(hr) * 0.08, cy - Math.cos(hr) * 0.08], '#222', 0.025);
    L(c, [cx, cy, cx + Math.sin(mn) * 0.13, cy - Math.cos(mn) * 0.13], '#222', 0.015);
  },
  gun_rack(c, x, y, w, h) {
    const t = y - h + 0.08;
    R(c, x + 0.1, t, 0.8, 0.06, '#6b4528', 0.01);
    R(c, x + 0.1, t + h - 0.25, 0.8, 0.06, '#6b4528', 0.01);
    for (const gx of [0.3, 0.6]) {
      R(c, x + gx, t + 0.04, 0.05, h - 0.25, '#2a2a2a', 0.01);
      R(c, x + gx - 0.03, t + h - 0.35, 0.1, 0.18, '#6b4528', 0.02);
    }
  },
  medcab(c, x, y, w, h) {
    const t = y - h + 0.08;
    R(c, x + 0.22, t, 0.56, h - 0.18, '#f2f2ee', 0.03);
    R(c, x + 0.45, t + 0.08, 0.1, h - 0.34, '#d0342b', 0, false);
    R(c, x + 0.36, t + (h - 0.18) / 2 - 0.05, 0.28, 0.1, '#d0342b', 0, false);
  },
  boards(c, x, y, w, h) {
    const t = y - h + 0.05;
    for (const [a, b] of [[0.1, -0.05], [0.25, 0.08], [0.15, 0.02]]) {
      c.save();
      c.translate(x + 0.5, t + a + 0.12);
      c.rotate(b);
      R(c, -0.48, -0.06, 0.96, 0.12, '#a5835a', 0.01);
      O(c, -0.4, 0, 0.015, '#333', false);
      O(c, 0.4, 0, 0.015, '#333', false);
      c.restore();
    }
  },
  poster(c, x, y, w, h) {
    const t = y - h + 0.06;
    c.save();
    c.translate(x + 0.5, t + (h - 0.12) / 2);
    c.rotate(0.03);
    R(c, -0.25, -(h - 0.12) / 2, 0.5, h - 0.12, '#d8c8a0', 0.005);
    O(c, 0, -0.06, 0.1, '#c0652f', false);
    R(c, -0.18, 0.08, 0.36, 0.04, '#3a3a3a', 0, false);
    R(c, -0.14, 0.14, 0.28, 0.03, '#3a3a3a', 0, false);
    c.restore();
  },
  sill_plants(c, x, y, w, h) {
    const sy = y - 0.05;
    R(c, x + 0.02, sy, 0.96, 0.05, '#9a7a52', 0.01);
    for (const px of [0.2, 0.5, 0.8]) {
      leaves(c, x + px, sy - 0.14, 7, 0.22, px * 9 + x, ['#5f9a3e', '#78b04a']);
      R(c, x + px - 0.08, sy - 0.13, 0.16, 0.13, '#b5653a', 0.02);
    }
  },
  wall_radio(c, x, y, w, h) {
    const sy = y - h * 0.3;
    R(c, x + 0.1, sy, 0.8, 0.04, '#7a5032', 0.01);
    R(c, x + 0.22, sy - 0.22, 0.48, 0.22, '#a8352b', 0.04);
    O(c, x + 0.36, sy - 0.11, 0.07, '#d8cfc0');
    R(c, x + 0.48, sy - 0.17, 0.16, 0.06, '#f0e6c8', 0.01);
    L(c, [x + 0.66, sy - 0.22, x + 0.82, sy - 0.48], '#999', 0.012);
  },
};
