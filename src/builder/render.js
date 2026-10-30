import { ITEM, CAT_ICON } from './catalog.js';
import { SHELL } from './shells.js';
import { smooth, rr, clamp } from '../util.js';

// World units: one cell is 1 wide; a storey is 3 tall plus a 0.4 slab.
// y grows downward; the bottom floor's floor line is y = 0.
export const ROOM_H = 3;
export const STOREY = 3.4;
const FLOOR_BAND = 0.5;

export const darkness = h => 1 - smooth(5, 7.5, h) + smooth(18, 20.5, h);

const sprites = new Map();
export function sprite(style, id) {
  const key = `${style}/${id}`;
  if (!sprites.has(key)) {
    const img = new Image();
    img.src = `assets/sprites/${key}.${style === 'pixel' ? 'png' : 'webp'}`;
    img.onerror = () => { img.failed = true; };
    sprites.set(key, img);
  }
  const img = sprites.get(key);
  return img.complete && img.naturalWidth && !img.failed ? img : null;
}

export function layout(shellId) {
  const sh = SHELL[shellId];
  const lift = (sh.stilts || 0) * STOREY;
  const storeys = sh.floors.map((cols, f) => {
    const yb = -lift - f * STOREY;
    return { f, cols, x0: -cols / 2, yb, top: yb - ROOM_H };
  });
  const widest = Math.max(...sh.floors);
  const top = storeys[storeys.length - 1].top - 0.4;
  return {
    sh, storeys, lift, widest, top,
    bounds: { minX: -widest / 2 - 1, maxX: widest / 2 + 1, minY: top - 2.6, maxY: sh.underground ? 0.8 : 1 },
  };
}

// Where an item's box sits in world units.
export function itemBox(L, it) {
  const d = ITEM[it.id];
  const s = L.storeys[it.f];
  const x = s.x0 + it.x;
  if (d.mount === 'wall') return { x: x + (1 - Math.min(d.w, 0.9)) / 2, y: s.yb - 2.2, w: Math.min(d.w, 0.9), h: d.h };
  if (d.mount === 'roof') return { x, y: s.top - 0.4 - d.h, w: d.w, h: d.h };
  if (d.ladder) return { x: x + 0.15, y: s.yb - STOREY - 0.1, w: 0.7, h: STOREY + 0.1 - 0.2 };
  return { x, y: s.yb - 0.22 - d.h, w: d.w, h: d.h };
}

export function cellAt(L, wx, wy) {
  for (const s of L.storeys) {
    if (wy > s.top - 2.2 && wy <= s.yb && wx >= s.x0 && wx < s.x0 + s.cols) {
      const roof = s.f === L.storeys.length - 1 && wy < s.top;
      return { x: Math.floor(wx - s.x0), f: s.f, roof, wall: !roof && wy < s.yb - 1.3 };
    }
  }
  return null;
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.c = canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.lc = this.light.getContext('2d');
    this.patterns = {};
  }

  resize(W, H, dpr) {
    this.W = W; this.H = H; this.dpr = dpr;
    for (const cv of [this.cv, this.light]) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  }

  pattern(style, name) {
    const key = `${style}/${name}`;
    if (this.patterns[key]) return this.patterns[key];
    const img = sprite(style, name);
    if (!img) return null;
    return (this.patterns[key] = this.c.createPattern(img, 'repeat'));
  }

  render(v) {
    const { c, W, H, dpr } = this;
    const { L, cam, state, style, hour, t, overlay, ghost, base } = v;
    const sh = L.sh;
    const s = cam.s;
    const dark = darkness(hour);
    c.imageSmoothingEnabled = style !== 'pixel';
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    // sky and ground
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, dark > 0.5 ? '#0d1322' : '#8fa6b8');
    sky.addColorStop(1, dark > 0.5 ? '#1c2232' : '#d8dcd6');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    const toScreen = () => c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - cam.x * s), dpr * (H / 2 - cam.y * s));
    toScreen();
    const vx0 = cam.x - W / 2 / s - 2, vw = W / s + 4, vy1 = cam.y + H / 2 / s + 2;
    const groundY = sh.underground ? L.top - 0.2 : 0;
    c.fillStyle = sh.underground ? '#5a4634' : '#56603f';
    c.fillRect(vx0, groundY, vw, vy1 - groundY);
    c.fillStyle = '#6b7a45';
    c.fillRect(vx0, groundY - 0.08, vw, 0.18);
    if (sh.underground) {
      c.fillStyle = '#4b3a2b';
      for (let y = groundY + 1.5; y < vy1; y += 1.8) c.fillRect(vx0, y, vw, 0.4);
    }
    if (sh.stilts) {
      c.strokeStyle = '#4a4e4a'; c.lineWidth = 0.22;
      const s0 = L.storeys[0];
      for (const x of [s0.x0 + 0.3, 0, s0.x0 + s0.cols - 0.3]) { c.beginPath(); c.moveTo(x, s0.yb + 0.3); c.lineTo(x * 1.15, 0); c.stroke(); }
      c.lineWidth = 0.08;
      for (let y = s0.yb + 0.3; y < -0.5; y += 1.4) {
        c.beginPath(); c.moveTo(s0.x0 + 0.3, y); c.lineTo(s0.x0 + s0.cols - 0.3, y + 1.4); c.moveTo(s0.x0 + s0.cols - 0.3, y); c.lineTo(s0.x0 + 0.3, y + 1.4); c.stroke();
      }
    }

    // shell frame
    for (const st of L.storeys) {
      c.fillStyle = sh.colors.frame;
      c.fillRect(st.x0 - 0.25, st.top - 0.4, st.cols + 0.5, ROOM_H + 0.4 + (st.f === 0 ? 0.35 : 0));
    }

    // rooms
    for (const st of L.storeys) {
      const wall = this.pattern(style, 'wall');
      c.save();
      c.beginPath(); c.rect(st.x0, st.top, st.cols, ROOM_H); c.clip();
      const tileSize = style === 'pixel' ? 96 : 384;
      if (wall) {
        const k = 2.4 / tileSize;
        c.save();
        c.translate(st.x0, st.top);
        c.scale(k, k);
        c.fillStyle = wall;
        c.fillRect(0, 0, st.cols / k, ROOM_H / k);
        c.restore();
      } else {
        c.fillStyle = sh.colors.wall; c.fillRect(st.x0, st.top, st.cols, ROOM_H);
      }
      const floor = this.pattern(style, 'floor');
      c.fillStyle = sh.colors.floor;
      c.fillRect(st.x0, st.yb - FLOOR_BAND, st.cols, FLOOR_BAND);
      if (floor) {
        c.save();
        c.translate(st.x0, st.yb - FLOOR_BAND);
        const k = 1.2 / tileSize;
        c.scale(k, k);
        c.fillStyle = floor; c.fillRect(0, 0, st.cols / k, FLOOR_BAND / k);
        c.restore();
      }
      const g = c.createLinearGradient(0, st.top, 0, st.top + 0.9);
      g.addColorStop(0, 'rgba(20,14,8,0.45)'); g.addColorStop(1, 'rgba(20,14,8,0)');
      c.fillStyle = g; c.fillRect(st.x0, st.top, st.cols, 0.9);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(st.x0, st.yb - FLOOR_BAND, st.cols, 0.04);
      c.restore();
    }

    // wires along the ceilings, pipes along the floors
    this.drawLines(base.wire, L, '#f2c14e', 'wire', overlay === 'wire' || overlay === 'all');
    this.drawLines(base.pipe, L, '#5ab0e8', 'pipe', overlay === 'pipe' || overlay === 'all');

    // items: wall pieces first, then roof, then floor; back to front
    const order = { wall: 0, roof: 1, ground: 2, floor: 2 };
    const items = base.items.map((it, i) => ({ it, i })).sort((a, b) => order[ITEM[a.it.id].mount] - order[ITEM[b.it.id].mount]);
    const lights = [];
    for (const { it } of items) {
      const d = ITEM[it.id];
      const box = itemBox(L, it);
      this.drawItem(style, d, box, it.on === false && overlay ? 0.55 : 1);
      if (d.light && it.on !== false) lights.push({ x: box.x + box.w / 2, y: box.y + box.h / 2, r: d.light, k: 1 });
      if ((d.drink || d.food) && it.on) lights.push({ x: box.x + box.w / 2, y: box.y + box.h * 0.4, r: 1.0, k: 0.5 });
    }

    if (ghost) {
      const box = itemBox(L, ghost);
      c.globalAlpha = 0.7;
      this.drawItem(style, ITEM[ghost.id], box, 1);
      c.globalAlpha = 1;
      c.fillStyle = ghost.ok ? 'rgba(90,220,120,0.25)' : 'rgba(255,80,70,0.3)';
      c.fillRect(box.x, box.y, box.w, box.h);
    }

    // lighting: outside follows the sun; underground rooms are always dark
    // unless powered lamps light them.
    const outside = 0.78 * dark;
    const inside = sh.underground ? 0.72 : Math.max(0.25, 0.8 * dark);
    const lc = this.lc;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, this.light.width, this.light.height);
    lc.fillStyle = `rgba(8,12,28,${outside})`;
    lc.fillRect(0, 0, this.light.width, this.light.height);
    lc.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - cam.x * s), dpr * (H / 2 - cam.y * s));
    for (const st of L.storeys) {
      lc.clearRect(st.x0, st.top, st.cols, ROOM_H);
      lc.fillStyle = `rgba(8,10,20,${inside})`;
      lc.fillRect(st.x0, st.top, st.cols, ROOM_H);
    }
    lc.globalCompositeOperation = 'destination-out';
    const flick = 0.95 + 0.05 * Math.sin(t * 9);
    for (const l of lights) {
      const g = lc.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(0,0,0,${l.k * flick})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.light, 0, 0);
    toScreen();
    c.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const g = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.9);
      g.addColorStop(0, `rgba(255,180,90,${0.12 * l.k})`);
      g.addColorStop(1, 'rgba(255,180,90,0)');
      c.fillStyle = g;
      c.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    c.globalCompositeOperation = 'source-over';

    // status badges for anything not running
    if (overlay) {
      for (const { it } of items) {
        if (it.on !== false || !it.why || it.why === 'idle') continue;
        const box = itemBox(L, it);
        badge(c, box.x + box.w / 2, box.y - 0.15, { 'no power': '⚡', 'no wire': '⚡', 'no water': '💧', 'no pipe': '💧', 'no fuel': '⛽' }[it.why] || '!');
      }
    }
    if (v.drawCells) this.drawCells(L);
  }

  drawLines(lines, L, color, kind, strong) {
    const c = this.c;
    const yOf = st => (kind === 'wire' ? st.top + 0.18 : st.yb - FLOOR_BAND - 0.12);
    c.strokeStyle = color;
    c.lineCap = 'round';
    c.lineWidth = strong ? 0.11 : 0.05;
    c.globalAlpha = strong ? 1 : 0.6;
    c.beginPath();
    for (const key of Object.keys(lines)) {
      const [x, f] = key.split(',').map(Number);
      const st = L.storeys[f];
      if (!st) continue;
      const cx = st.x0 + x + 0.5, y = yOf(st);
      if (lines[`${x + 1},${f}`]) { c.moveTo(cx, y); c.lineTo(cx + 1, y); }
      else { c.moveTo(cx - 0.2, y); c.lineTo(cx + 0.2, y); }
      const up = L.storeys[f + 1];
      if (up && lines[`${x},${f + 1}`]) { c.moveTo(cx, y); c.lineTo(up.x0 + x + 0.5, yOf(up)); }
    }
    c.stroke();
    if (strong) {
      c.fillStyle = color;
      for (const key of Object.keys(lines)) {
        const [x, f] = key.split(',').map(Number);
        const st = L.storeys[f];
        if (!st) continue;
        c.beginPath(); c.arc(st.x0 + x + 0.5, yOf(st), 0.09, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  drawItem(style, d, box, alpha) {
    const c = this.c;
    const img = sprite(style, d.id);
    c.globalAlpha *= alpha;
    if (img) {
      const k = Math.min(box.w / img.naturalWidth, box.h / img.naturalHeight);
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      c.drawImage(img, box.x + (box.w - w) / 2, box.y + box.h - h, w, h);
    } else {
      c.fillStyle = 'rgba(60,52,44,0.85)';
      c.beginPath(); rr(c, box.x + 0.06, box.y, box.w - 0.12, box.h, 0.12); c.fill();
      c.strokeStyle = 'rgba(240,200,120,0.6)'; c.lineWidth = 0.04; c.stroke();
      c.fillStyle = '#f1ebdf';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `${clamp(Math.min(box.w, box.h) * 0.45, 0.25, 0.6)}px system-ui`;
      c.fillText(CAT_ICON[d.cat] || '▪', box.x + box.w / 2, box.y + box.h / 2 - 0.1);
      c.font = '0.17px system-ui';
      c.fillText(d.name, box.x + box.w / 2, box.y + box.h - 0.18, box.w - 0.1);
    }
    c.globalAlpha = 1;
  }

  drawCells(L) {
    const c = this.c;
    c.strokeStyle = 'rgba(255,230,170,0.35)';
    c.lineWidth = 0.025;
    c.setLineDash([0.1, 0.1]);
    for (const st of L.storeys) {
      for (let x = 0; x <= st.cols; x++) { c.beginPath(); c.moveTo(st.x0 + x, st.top); c.lineTo(st.x0 + x, st.yb); c.stroke(); }
    }
    c.setLineDash([]);
  }
}

function badge(c, x, y, icon) {
  c.fillStyle = 'rgba(200,50,40,0.9)';
  c.beginPath(); c.arc(x, y, 0.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff';
  c.font = '0.24px system-ui';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(icon, x, y + 0.01);
}
