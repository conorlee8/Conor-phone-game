import { rr, shade, clamp } from '../util.js';
import { ART } from './itemArt.js';
import { ITEM_BY_ID } from '../data/items.js';
import { drawSurvivor } from './people.js';

// World units: 1 interior cell = 1 unit. y grows downward, ground is y = 0.
export const FLOOR_H = 1.3;
export const SLAB = 0.14;
export const WALL = 0.16;
export const BAND_TOP = 0.06;
export const BAND_H = 0.62;

const OUT = 'rgba(20,16,12,0.7)';
const SUP_H = {
  ground: 0.08, wheels: 0.62, rails: 0.74, hull: 0.5, stilts: 3, tree: 3, treads: 0.74,
  blocks: 0.4, balloon: 3, skids: 0.55, cable: 3.4, rig: 3, belly: 0.22, rock: 1.5,
  sub: -0.8, cliff: 0.08, ferris: 0, underground: 0,
};
const CABS = {
  van: { w: 1.15, h: 1.3 }, bus: { w: 0.55 }, truck: { w: 1.6, h: 1.5 }, semi: { w: 2.1, h: 1.95 },
  loco: { w: 1.3 }, steam: { w: 2.6, h: 1.35 }, plow: { w: 2.3, h: 1.5 },
};

export function layoutBase(def) {
  const floors = def.floors;
  const maxCols = Math.max(...floors);
  const sup = def.support || { type: 'ground' };
  const body = def.body || 'box';
  const pad = body === 'tube' ? 0.6 : body === 'dome' ? 0.9 : 0;
  const bw = maxCols + WALL * 2 + pad * 2;
  const roomsH = floors.length * (FLOOR_H + SLAB) + WALL;
  const domeExtra = body === 'dome' ? 0.7 : 0;
  const bh = roomsH + domeExtra;

  let bottom;
  if (sup.type === 'underground') bottom = bh + 0.9;
  else if (sup.type === 'wheels' && sup.big) bottom = -1.25;
  else if (sup.type === 'ferris') bottom = -(floors.length * 1.5 + 4.6);
  else bottom = -(sup.h ?? SUP_H[sup.type] ?? 0.08);

  const rooms = [];
  let y = bottom;
  floors.forEach((cols, i) => {
    const fy = y - SLAB;
    rooms.push({ i, cols, x: -cols / 2, y: fy - FLOOR_H, w: cols, h: FLOOR_H, fy });
    y = fy - FLOOR_H;
  });
  const top = y - WALL - domeExtra;
  const L = { def, rooms, bw, bh, bx: -bw / 2, top, bottom, body, pad, sup, maxCols };
  L.cab = def.cab ? { ...CABS[def.cab], type: def.cab } : null;
  if (L.cab) {
    if (!L.cab.h) L.cab.h = bh;
    L.cab.x = L.bx + bw;
  }
  const tr = rooms[rooms.length - 1];
  L.tx0 = tr.x - WALL;
  L.tx1 = tr.x + tr.w + WALL;
  L.cx = 0;

  // Bounds for the camera.
  let minX = L.bx - 0.4, maxX = L.bx + bw + 0.4 + (L.cab ? L.cab.w : 0);
  let minY = top - roofHeight(def.roof, L) - 0.3, maxY = Math.max(0.3, bottom + 0.2);
  const ex = def.extras || [];
  const t = sup.type;
  if (t === 'hull' || t === 'sub' || t === 'rig') { maxY = 1.1; minX -= 0.7; maxX += 1.4; }
  if (t === 'tree') { minX -= sup.giant ? 2.4 : 1.7; maxX += sup.giant ? 2.4 : 1.7; minY -= 1.6; }
  if (t === 'balloon') { minY = top - (sup.basket ? 4.4 : 3.2); const e = sup.basket ? 1.9 : bw * 0.95; minX = Math.min(minX, -e - 0.3); maxX = Math.max(maxX, e + 0.3); }
  if (t === 'ferris') { const R = -bottom / 2 + 0.2; minX = Math.min(minX, -R - 0.6); maxX = Math.max(maxX, R + 0.6); }
  if (t === 'rock' || t === 'cliff') { minX -= 1.4; maxX += 1.4; }
  if (t === 'cliff') minY -= 0.8;
  if (t === 'underground') { minY = Math.min(minY, -1.6); maxY = bottom + 0.4; }
  if (t === 'cable') minY -= 0.9;
  if (ex.includes('fin')) minY -= 1.4;
  if (ex.includes('windmill')) { minY -= 2.2; minX = Math.min(minX, -3.4); maxX = Math.max(maxX, 3.4); }
  if (ex.includes('mast')) minY -= 3.2;
  if (ex.includes('antenna')) minY -= 2.6;
  if (ex.includes('flare') || ex.includes('crane')) minY -= 1.6;
  if (ex.includes('awning')) minX -= 1.2;
  if (ex.includes('canopy')) maxX += 3.2;
  if (ex.includes('porch')) maxX += 1.2;
  if (ex.includes('paddlewheel') || ex.includes('propeller') || ex.includes('tailboom')) minX -= 1.6;
  if (ex.includes('rotor')) { minX -= 0.6; maxX += 0.6; minY -= 0.7; }
  if (ex.includes('columns')) { minX -= 0.4; maxX += 0.4; }
  if (ex.includes('teapot')) { minX -= 1.0; maxX += 1.4; }
  if (ex.includes('tankTurret')) maxX += 1.6;
  if (ex.includes('wings')) maxY = Math.max(maxY, 0.4);
  L.bounds = { minX, maxX, minY, maxY };
  return L;
}

function roofHeight(roof, L) {
  const tw = L.tx1 - L.tx0;
  switch (roof) {
    case 'gable': case 'glass': return tw > 6 ? 1.3 : clamp(tw * 0.32, 0.8, 1.8);
    case 'gambrel': return 1.6;
    case 'hip': return 0.7;
    case 'conical': return Math.max(1.1, tw * 0.75);
    case 'spire': return clamp(tw * 0.32, 0.8, 1.8) + 2.6;
    case 'lamp': return 1.6;
    case 'dome': case 'observatory': return tw * 0.42;
    case 'pagoda': return 1.3;
    case 'mushroom': return 1.8;
    case 'tent': return 2.8;
    case 'pediment': return 0.9;
    case 'battlement': return 0.45;
    case 'sawtooth': return 0.8;
    case 'curved': return 0.3;
    default: return 0.15;
  }
}

// ---------------------------------------------------------------------------
// Paths

function bodyPath(L) {
  const p = new Path2D();
  const { bx, bw, top, bottom, def } = L;
  const h = bottom - top;
  switch (L.body) {
    case 'tube': {
      const r = Math.min(h / 2, 1.0);
      roundRectPath(p, bx, top, bw, h, r);
      break;
    }
    case 'dome': {
      p.moveTo(bx, bottom);
      p.ellipse(0, bottom, bw / 2, h, 0, Math.PI, Math.PI * 2);
      p.closePath();
      break;
    }
    case 'taper': {
      const r0 = L.rooms[0];
      const w0 = r0.w + WALL * 2;
      const w1 = L.tx1 - L.tx0;
      p.moveTo(-w0 / 2 - 0.15, bottom);
      p.lineTo(w0 / 2 + 0.15, bottom);
      p.lineTo(w1 / 2, top);
      p.lineTo(-w1 / 2, top);
      p.closePath();
      break;
    }
    case 'tank': {
      roundRectPath(p, bx, top, bw, h, 0.2);
      p.moveTo(bx, bottom - 0.3);
      p.ellipse(0, bottom - 0.3, bw / 2, 0.75, 0, 0, Math.PI);
      break;
    }
    default: {
      const r = def.r ?? 0.05;
      L.rooms.forEach((rm, i) => {
        const last = i === L.rooms.length - 1;
        const y0 = rm.y - (last ? WALL : SLAB / 2);
        const y1 = i === 0 ? bottom : rm.fy + SLAB / 2;
        const x0 = i === 0 ? bx : rm.x - WALL;
        const w = i === 0 ? bw : rm.w + WALL * 2;
        roundRectPath(p, x0, y0, w, y1 - y0, Math.min(r, 0.6));
      });
    }
  }
  return p;
}

function roundRectPath(p, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
}

export function windowRects(rm, style) {
  const out = [];
  const { x, y, w, cols } = rm;
  switch (style) {
    case 'band':
      for (let i = 0; i < cols; i++) out.push({ x: x + i + 0.12, y: y + 0.16, w: 0.76, h: 0.52 });
      break;
    case 'few': {
      const n = Math.max(1, Math.round(cols / 2.6));
      for (let i = 0; i < n; i++) {
        const cx = x + (i + 0.5) * (w / n);
        out.push({ x: cx - 0.45, y: y + 0.18, w: 0.9, h: 0.5 });
      }
      break;
    }
    case 'grid':
      for (let i = 0; i < cols; i++) if (i % 3 !== 1) out.push({ x: x + i + 0.2, y: y + 0.16, w: 0.6, h: 0.6 });
      break;
    case 'portholes':
      for (let i = 0; i < cols; i += 2) out.push({ x: x + i + 0.5, y: y + 0.45, r: 0.18, round: true });
      break;
    case 'slits':
      for (let i = 0; i < cols; i += 2) out.push({ x: x + i + 0.25, y: y + 0.3, w: 0.6, h: 0.1 });
      break;
    case 'arched': {
      const n = Math.max(1, Math.round(cols / 2));
      for (let i = 0; i < n; i++) {
        const cx = x + (i + 0.5) * (w / n);
        out.push({ x: cx - 0.28, y: y + 0.16, w: 0.56, h: 0.72, arch: true });
      }
      break;
    }
    case 'glass':
      out.push({ x: x + 0.06, y: y + 0.06, w: w - 0.12, h: 0.92, glass: true });
      break;
  }
  return out;
}

function addWindow(p, wd) {
  if (wd.round) {
    p.moveTo(wd.x + wd.r, wd.y);
    p.arc(wd.x, wd.y, wd.r, 0, Math.PI * 2);
  } else if (wd.arch) {
    const r = wd.w / 2;
    p.moveTo(wd.x, wd.y + wd.h);
    p.lineTo(wd.x, wd.y + r);
    p.arc(wd.x + r, wd.y + r, r, Math.PI, 0);
    p.lineTo(wd.x + wd.w, wd.y + wd.h);
    p.closePath();
  } else {
    p.rect(wd.x, wd.y, wd.w, wd.h);
  }
}

// ---------------------------------------------------------------------------
// Main draw

export function drawBase(c, L, o) {
  const { def } = L;
  const col = def.col;
  o.lights = o.lights || [];
  const body = bodyPath(L);
  L._body = body;

  drawSupportBack(c, L, o);
  for (const e of def.extras || []) if (EXTRA_BACK[e]) EXTRA_BACK[e](c, L, o);

  // shell
  c.lineJoin = 'round';
  c.lineWidth = 0.09;
  c.strokeStyle = OUT;
  c.stroke(body);
  if (col.stack) {
    L.rooms.forEach((rm, i) => {
      c.save();
      c.clip(body);
      c.fillStyle = col.stack[i % col.stack.length];
      const y0 = i === L.rooms.length - 1 ? L.top - 1 : rm.y - SLAB / 2;
      const y1 = i === 0 ? L.bottom + 1 : rm.fy + SLAB / 2;
      c.fillRect(L.bx - 1, y0, L.bw + 2, y1 - y0);
      c.restore();
    });
  } else {
    c.fillStyle = col.body;
    c.fill(body);
  }
  shellTexture(c, L);
  if (col.stripe && L.body !== 'dome') {
    c.save();
    c.clip(body);
    c.fillStyle = col.stripe;
    c.fillRect(L.bx - 1, L.bottom - SLAB * 0.75, L.bw + 2, SLAB * 0.5);
    c.restore();
  }

  if (L.cab) drawCab(c, L, o);

  // interior
  for (const rm of L.rooms) drawRoom(c, L, rm, o);

  drawSupportFront(c, L, o);
  drawRoof(c, L, o);
  for (const e of def.extras || []) if (EXTRA[e]) EXTRA[e](c, L, o);
}

function shellTexture(c, L) {
  const { def } = L;
  const ws = def.wallStyle;
  c.save();
  c.clip(L._body);
  const ex = new Path2D();
  ex.rect(L.bx - 5, L.top - 5, L.bw + 10, L.bottom - L.top + 10);
  for (const rm of L.rooms) ex.rect(rm.x, rm.y, rm.w, rm.h);
  c.clip(ex, 'evenodd');
  c.strokeStyle = 'rgba(0,0,0,0.18)';
  c.lineWidth = 0.02;
  if (ws === 'logs' || ws === 'planks' || ws === 'corrugated' || def.cat === 'building') {
    const step = ws === 'logs' ? 0.16 : ws === 'brick' || ws === 'stone' ? 0.14 : 0.12;
    for (let y = L.top; y < L.bottom; y += step) {
      c.beginPath(); c.moveTo(L.bx - 1, y); c.lineTo(L.bx + L.bw + 1, y); c.stroke();
    }
  } else {
    for (let x = L.bx + 0.9; x < L.bx + L.bw; x += 1.8) {
      c.beginPath(); c.moveTo(x, L.top); c.lineTo(x, L.bottom); c.stroke();
    }
  }
  if (ws === 'stripes') {
    c.fillStyle = def.col.trim;
    for (let i = 0; i < 12; i++) {
      const y = L.top + i * 1.2;
      if (y > L.bottom) break;
      c.fillRect(L.bx - 2, y, L.bw + 4, 0.6);
    }
  }
  // top highlight
  const g = c.createLinearGradient(0, L.top, 0, L.bottom);
  g.addColorStop(0, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(0,0,0,0.18)');
  c.fillStyle = g;
  c.fillRect(L.bx - 2, L.top - 2, L.bw + 4, L.bottom - L.top + 4);
  c.restore();
}

function drawRoom(c, L, rm, o) {
  const { def } = L;
  const col = def.col;
  const wins = windowRects(rm, def.windows || 'none');
  rm.windows = wins;

  c.save();
  const roomClip = new Path2D();
  roomClip.rect(rm.x, rm.y, rm.w, rm.h);
  c.clip(roomClip);
  if (L.body === 'tube' || L.body === 'dome') c.clip(L._body);

  // back wall with window holes
  const wall = new Path2D();
  wall.rect(rm.x, rm.y, rm.w, rm.h);
  for (const wd of wins) addWindow(wall, wd);
  c.fillStyle = col.wall;
  c.fill(wall, 'evenodd');
  c.save();
  c.clip(wall, 'evenodd');
  wallTexture(c, rm, def);
  c.restore();

  // glass + frames
  for (const wd of wins) {
    const p = new Path2D();
    addWindow(p, wd);
    c.fillStyle = 'rgba(190,215,230,0.12)';
    c.fill(p);
    c.lineWidth = 0.05;
    c.strokeStyle = shade(col.trim || '#555', 0.1);
    c.stroke(p);
    if (wd.glass) {
      c.lineWidth = 0.035;
      for (let gx = wd.x + 1; gx < wd.x + wd.w - 0.1; gx += 1) {
        c.beginPath(); c.moveTo(gx, wd.y); c.lineTo(gx, wd.y + wd.h); c.stroke();
      }
      c.beginPath(); c.moveTo(wd.x, wd.y + wd.h * 0.45); c.lineTo(wd.x + wd.w, wd.y + wd.h * 0.45); c.stroke();
    } else if (!wd.round && wd.h > 0.3) {
      c.lineWidth = 0.025;
      c.beginPath(); c.moveTo(wd.x + wd.w / 2, wd.y); c.lineTo(wd.x + wd.w / 2, wd.y + wd.h); c.stroke();
    }
    if (!wd.round && !wd.glass && wd.h > 0.3) {
      c.fillStyle = shade(col.trim || '#555', 0.15);
      c.fillRect(wd.x - 0.04, wd.y + wd.h, wd.w + 0.08, 0.05);
    }
  }

  // ceiling and side shading
  const g = c.createLinearGradient(0, rm.y, 0, rm.y + 0.45);
  g.addColorStop(0, 'rgba(30,20,10,0.35)');
  g.addColorStop(1, 'rgba(30,20,10,0)');
  c.fillStyle = g;
  c.fillRect(rm.x, rm.y, rm.w, 0.45);
  for (const side of [0, 1]) {
    const sx = side ? rm.x + rm.w : rm.x;
    const sg = c.createLinearGradient(sx, 0, sx + (side ? -0.35 : 0.35), 0);
    sg.addColorStop(0, 'rgba(30,20,10,0.3)');
    sg.addColorStop(1, 'rgba(30,20,10,0)');
    c.fillStyle = sg;
    c.fillRect(side ? sx - 0.35 : sx, rm.y, 0.35, rm.h);
  }

  // floor
  c.fillStyle = col.floor;
  c.fillRect(rm.x, rm.fy - 0.07, rm.w, 0.07);
  c.strokeStyle = 'rgba(0,0,0,0.25)';
  c.lineWidth = 0.012;
  for (let fx = rm.x + 0.37; fx < rm.x + rm.w; fx += 0.61) {
    c.beginPath(); c.moveTo(fx, rm.fy - 0.07); c.lineTo(fx, rm.fy); c.stroke();
  }
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.fillRect(rm.x, rm.fy - 0.08, rm.w, 0.015);

  // items
  const items = (o.items || []).filter(it => it.f === rm.i);
  const sub = { ...o, lit: true };
  for (const it of items) {
    const d = ITEM_BY_ID[it.id];
    if (!d || d.layer !== 'wall') continue;
    const art = ART[d.id];
    sub.lit = !(d.light && d.light.powered) || o.powered;
    if (d.power < 0 && !d.light) sub.lit = o.powered;
    if (art) art(c, rm.x + it.c, rm.y + BAND_TOP + BAND_H, d.w, BAND_H, sub);
  }
  for (const it of items) {
    const d = ITEM_BY_ID[it.id];
    if (!d || d.layer !== 'floor') continue;
    const art = ART[d.id];
    sub.lit = d.power ? (d.power > 0 ? !d.solar || o.daylight > 0.3 : o.powered) : true;
    if (art) art(c, rm.x + it.c, rm.fy - 0.06, d.w, FLOOR_H, sub);
  }

  // people
  for (const p of o.people || []) if (p.f === rm.i) drawSurvivor(c, p, rm, o);

  c.restore();

  // cutaway rim
  c.lineWidth = 0.05;
  c.strokeStyle = shade(col.body, -0.35);
  c.strokeRect(rm.x - 0.025, rm.y - 0.025, rm.w + 0.05, rm.h + 0.05);
}

function wallTexture(c, rm, def) {
  const ws = def.wallStyle;
  c.strokeStyle = 'rgba(60,40,20,0.13)';
  c.lineWidth = 0.015;
  if (ws === 'logs') {
    for (let y = rm.y + 0.16; y < rm.fy; y += 0.16) { c.beginPath(); c.moveTo(rm.x, y); c.lineTo(rm.x + rm.w, y); c.stroke(); }
  } else if (ws === 'brick' || ws === 'stone') {
    const bh = ws === 'stone' ? 0.22 : 0.12;
    const bwid = ws === 'stone' ? 0.45 : 0.3;
    let row = 0;
    for (let y = rm.y; y < rm.fy; y += bh, row++) {
      c.beginPath(); c.moveTo(rm.x, y); c.lineTo(rm.x + rm.w, y); c.stroke();
      for (let x = rm.x + (row % 2) * bwid / 2; x < rm.x + rm.w; x += bwid) {
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + bh); c.stroke();
      }
    }
  } else if (ws === 'tile') {
    for (let y = rm.y; y < rm.fy; y += 0.15) { c.beginPath(); c.moveTo(rm.x, y); c.lineTo(rm.x + rm.w, y); c.stroke(); }
    for (let x = rm.x; x < rm.x + rm.w; x += 0.15) { c.beginPath(); c.moveTo(x, rm.y); c.lineTo(x, rm.fy); c.stroke(); }
  } else if (ws === 'concrete') {
    for (let x = rm.x + 1.5; x < rm.x + rm.w; x += 1.5) { c.beginPath(); c.moveTo(x, rm.y); c.lineTo(x, rm.fy); c.stroke(); }
    c.beginPath(); c.moveTo(rm.x, rm.y + 0.65); c.lineTo(rm.x + rm.w, rm.y + 0.65); c.stroke();
  } else if (def.cat === 'vehicle') {
    for (let x = rm.x + 0.5; x < rm.x + rm.w; x += 1) { c.beginPath(); c.moveTo(x, rm.y); c.lineTo(x, rm.fy); c.stroke(); }
    c.fillStyle = 'rgba(60,40,20,0.08)';
    c.fillRect(rm.x, rm.fy - 0.45, rm.w, 0.38);
  } else {
    for (let x = rm.x + 0.25; x < rm.x + rm.w; x += 0.25) { c.beginPath(); c.moveTo(x, rm.y); c.lineTo(x, rm.fy); c.stroke(); }
  }
}

// ---------------------------------------------------------------------------
// Cabs

function drawCab(c, L, o) {
  const { def } = L;
  const col = def.col;
  const cab = L.cab;
  const x0 = cab.x - 0.05;
  const b = L.bottom;
  const h = cab.h;
  const glass = 'rgba(150,180,195,0.95)';
  c.lineWidth = 0.06;
  c.strokeStyle = OUT;
  const fillStroke = (p, f) => { c.fillStyle = f; c.fill(p); c.stroke(p); };

  if (cab.type === 'van') {
    const p = new Path2D();
    p.moveTo(x0, b); p.lineTo(x0, b - h); p.lineTo(x0 + 0.35, b - h);
    p.quadraticCurveTo(x0 + 0.85, b - h + 0.15, x0 + cab.w, b - 0.5);
    p.lineTo(x0 + cab.w, b); p.closePath();
    fillStroke(p, col.body);
    const g = new Path2D();
    g.moveTo(x0 + 0.38, b - h + 0.1); g.quadraticCurveTo(x0 + 0.78, b - h + 0.22, x0 + cab.w - 0.1, b - 0.62);
    g.lineTo(x0 + 0.4, b - 0.62); g.closePath();
    fillStroke(g, glass);
    stripeAcross(c, p, col.stripe, b - 0.3);
    headlight(c, x0 + cab.w - 0.08, b - 0.3, o);
  } else if (cab.type === 'bus') {
    const p = new Path2D();
    roundRectPath(p, x0, L.top + 0.05, cab.w, b - L.top - 0.05, 0.12);
    fillStroke(p, col.body);
    const g = new Path2D();
    roundRectPath(g, x0 + 0.08, L.top + 0.2, cab.w - 0.14, Math.min(0.9, (b - L.top) * 0.55), 0.06);
    fillStroke(g, glass);
    stripeAcross(c, p, col.stripe, b - 0.35);
    headlight(c, x0 + cab.w - 0.05, b - 0.25, o);
  } else if (cab.type === 'truck' || cab.type === 'semi' || cab.type === 'plow') {
    const cw = cab.type === 'semi' ? 1.3 : 0.95;
    const hoodH = cab.type === 'semi' ? 1.0 : 0.8;
    const p = new Path2D();
    roundRectPath(p, x0 + 0.08, b - h, cw, h, 0.12);
    fillStroke(p, cab.type === 'semi' ? col.stripe || col.body : col.body);
    const hd = new Path2D();
    roundRectPath(hd, x0 + 0.08 + cw - 0.05, b - hoodH, cab.w - cw - 0.05, hoodH, 0.12);
    fillStroke(hd, cab.type === 'semi' ? col.stripe || col.body : col.body);
    const g = new Path2D();
    roundRectPath(g, x0 + cw * 0.45, b - h + 0.12, cw * 0.5, h * 0.35, 0.05);
    fillStroke(g, glass);
    c.fillStyle = '#333';
    c.fillRect(x0 + cab.w - 0.12, b - hoodH + 0.15, 0.08, hoodH - 0.3);
    headlight(c, x0 + cab.w - 0.06, b - 0.3, o);
    // exhaust stack
    c.fillStyle = '#9a9a9a';
    c.fillRect(x0 + 0.02, b - h - 0.35, 0.08, h + 0.1);
    if (cab.type === 'plow') {
      const pl = new Path2D();
      pl.moveTo(x0 + cab.w + 0.05, b - 0.75);
      pl.quadraticCurveTo(x0 + cab.w + 0.45, b - 0.4, x0 + cab.w + 0.35, b + 0.02);
      pl.lineTo(x0 + cab.w + 0.12, b + 0.02);
      pl.closePath();
      fillStroke(pl, '#e3b53a');
    }
  } else if (cab.type === 'loco') {
    const p = new Path2D();
    p.moveTo(x0, b); p.lineTo(x0, L.top + 0.05); p.lineTo(x0 + 0.7, L.top + 0.05);
    p.lineTo(x0 + cab.w, L.top + 0.6); p.lineTo(x0 + cab.w, b); p.closePath();
    fillStroke(p, col.body);
    const g = new Path2D();
    g.moveTo(x0 + 0.25, L.top + 0.2); g.lineTo(x0 + 0.68, L.top + 0.2); g.lineTo(x0 + 1.05, L.top + 0.62); g.lineTo(x0 + 0.25, L.top + 0.62); g.closePath();
    fillStroke(g, glass);
    stripeAcross(c, p, col.stripe, b - 0.45);
    headlight(c, x0 + cab.w - 0.05, b - 0.5, o);
  } else if (cab.type === 'steam') {
    const by = b - 0.65;
    const p = new Path2D();
    roundRectPath(p, x0, by - 0.55, cab.w - 0.2, 1.1, 0.5);
    fillStroke(p, '#2b2d2f');
    c.fillStyle = col.stripe;
    for (const bx of [0.6, 1.3, 2.0]) c.fillRect(x0 + bx, by - 0.55, 0.06, 1.1);
    const st = new Path2D();
    st.moveTo(x0 + cab.w - 0.75, by - 0.5); st.lineTo(x0 + cab.w - 0.85, by - 1.3); st.lineTo(x0 + cab.w - 0.35, by - 1.3); st.lineTo(x0 + cab.w - 0.45, by - 0.5); st.closePath();
    fillStroke(st, '#1d1e20');
    const dm = new Path2D();
    dm.ellipse(x0 + 1.2, by - 0.55, 0.25, 0.22, 0, Math.PI, 0);
    fillStroke(dm, col.stripe);
    const cc = new Path2D();
    cc.moveTo(x0 + cab.w - 0.2, b - 0.45); cc.lineTo(x0 + cab.w + 0.35, b + 0.05); cc.lineTo(x0 + cab.w - 0.2, b + 0.05); cc.closePath();
    fillStroke(cc, col.trim);
    headlight(c, x0 + cab.w - 0.15, by - 0.1, o);
    smoke(c, x0 + cab.w - 0.6, by - 1.35, o, 1.2);
  }
}

function stripeAcross(c, p, color, y) {
  if (!color) return;
  c.save();
  c.clip(p);
  c.fillStyle = color;
  c.fillRect(-100, y - 0.06, 200, 0.12);
  c.restore();
}

function headlight(c, x, y, o) {
  c.beginPath();
  c.arc(x, y, 0.07, 0, Math.PI * 2);
  c.fillStyle = o.night > 0.3 ? '#fff6d0' : '#e8e2c8';
  c.fill();
  if (o.night > 0.3) o.lights.push({ x: x + 0.3, y, r: 1.2, color: '#fff2c0', k: 0.5 });
}

function smoke(c, x, y, o, k = 1) {
  c.save();
  for (let i = 0; i < 5; i++) {
    const p = ((o.t || 0) * 0.25 + i / 5) % 1;
    c.globalAlpha = 0.35 * (1 - p) * k;
    c.beginPath();
    c.arc(x - p * 0.9, y - p * 1.6, 0.12 + p * 0.35, 0, Math.PI * 2);
    c.fillStyle = '#c9c9c4';
    c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------------------
// Supports

function drawSupportBack(c, L, o) {
  const { sup, def } = L;
  const col = def.col;
  const t = sup.type;
  if (t === 'stilts') {
    const legC = shade(col.trim, -0.1);
    const xs = [L.bx + 0.35, L.bx + L.bw - 0.35];
    if (L.bw > 5) xs.splice(1, 0, 0);
    c.strokeStyle = legC;
    c.lineWidth = 0.18;
    for (const x of xs) line(c, x, L.bottom, x + (x < 0 ? -0.25 : x > 0 ? 0.25 : 0), 0.05);
    c.lineWidth = 0.06;
    const n = Math.max(1, Math.round(-L.bottom / 1.4));
    for (let i = 0; i < n; i++) {
      const y0 = L.bottom + (i / n) * -L.bottom, y1 = L.bottom + ((i + 1) / n) * -L.bottom;
      for (let k = 0; k < xs.length - 1; k++) {
        line(c, xs[k], y0, xs[k + 1], y1);
        line(c, xs[k + 1], y0, xs[k], y1);
      }
    }
    // ladder
    c.lineWidth = 0.04;
    c.strokeStyle = '#6b5a44';
    const lx = L.bx + L.bw * 0.68;
    line(c, lx, L.bottom, lx, 0);
    line(c, lx + 0.3, L.bottom, lx + 0.3, 0);
    for (let y = L.bottom + 0.2; y < 0; y += 0.25) line(c, lx, y, lx + 0.3, y);
  } else if (t === 'tree') {
    const g = sup.giant;
    foliage(c, L, true);
    const tw = g ? 1.8 : 1.1;
    const p = new Path2D();
    p.moveTo(-tw / 2 - (g ? 1 : 0.6), 0.05);
    p.quadraticCurveTo(-tw / 2, -0.3, -tw / 2 + 0.05, L.bottom);
    p.lineTo(tw / 2 - 0.05, L.bottom);
    p.quadraticCurveTo(tw / 2, -0.3, tw / 2 + (g ? 1 : 0.6), 0.05);
    p.closePath();
    c.fillStyle = '#5a3f28';
    c.fill(p);
    c.lineWidth = 0.06; c.strokeStyle = OUT; c.stroke(p);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.03;
    for (let i = -2; i <= 2; i++) line(c, i * tw * 0.15, L.bottom + 0.2, i * tw * 0.18, -0.2);
    // branches holding the floor
    c.strokeStyle = '#5a3f28'; c.lineWidth = 0.22;
    line(c, -tw / 3, L.bottom + 0.9, L.bx + 0.6, L.bottom + 0.05);
    line(c, tw / 3, L.bottom + 0.9, L.bx + L.bw - 0.6, L.bottom + 0.05);
    c.fillStyle = shade(col.trim, 0);
    c.fillRect(L.bx - 0.3, L.bottom - 0.02, L.bw + 0.6, 0.14);
    if (L.rooms.length > 1) {
      c.lineWidth = 0.5;
      c.strokeStyle = '#5a3f28';
      line(c, 0, L.bottom, 0, L.top + 0.5);
    }
  } else if (t === 'blocks') {
    c.fillStyle = '#8a8a84';
    for (let x = L.bx + 0.3; x < L.bx + L.bw - 0.3; x += 1.4) {
      c.fillRect(x, L.bottom, 0.4, -L.bottom);
      c.strokeStyle = OUT; c.lineWidth = 0.03; c.strokeRect(x, L.bottom, 0.4, -L.bottom);
    }
  } else if (t === 'balloon') {
    c.strokeStyle = '#5a4a3a';
    c.lineWidth = 0.03;
    const ey = L.top - (sup.basket ? 0.9 : 0.35);
    line(c, L.bx + 0.2, L.top + 0.05, L.bx - (sup.basket ? 0.6 : -0.3), ey);
    line(c, L.bx + L.bw - 0.2, L.top + 0.05, L.bx + L.bw + (sup.basket ? 0.6 : -0.3), ey);
    // tether to ground
    c.strokeStyle = 'rgba(70,60,50,0.8)';
    line(c, L.bx + 0.4, L.bottom, L.bx - 1.2, 0);
    c.fillStyle = '#5a4a3a';
    c.fillRect(L.bx - 1.3, -0.15, 0.2, 0.2);
  } else if (t === 'cable') {
    const cy = L.top - 0.75;
    c.strokeStyle = '#2a2a2a';
    c.lineWidth = 0.05;
    line(c, -40, cy - 40 * 0.12, 40, cy + 40 * 0.12);
    line(c, -40, cy - 40 * 0.12 - 0.25, 40, cy + 40 * 0.12 - 0.25);
    c.lineWidth = 0.08;
    line(c, 0, L.top, 0, cy);
    c.beginPath(); c.arc(0, cy, 0.18, 0, Math.PI * 2); c.fillStyle = '#555'; c.fill();
  } else if (t === 'rig') {
    c.strokeStyle = '#7a7a72';
    c.lineWidth = 0.35;
    const xs = [L.bx + 0.6, L.bx + L.bw - 0.6];
    for (const x of xs) line(c, x, L.bottom, x, 1.4);
    c.lineWidth = 0.1;
    for (let y = L.bottom + 0.5; y < 1.2; y += 1.0) {
      line(c, xs[0], y, xs[1], y + 1.0);
      line(c, xs[1], y, xs[0], y + 1.0);
    }
    c.fillStyle = '#5a5a54';
    c.fillRect(L.bx - 0.4, L.bottom - 0.05, L.bw + 0.8, 0.25);
  } else if (t === 'rock' || t === 'cliff') {
    const p = new Path2D();
    if (t === 'rock') {
      p.moveTo(L.bx - 1.5, 0.3);
      p.lineTo(L.bx - 0.9, L.bottom + 0.6);
      p.lineTo(L.bx - 0.2, L.bottom + 0.05);
      p.lineTo(L.bx + L.bw + 0.3, L.bottom + 0.05);
      p.lineTo(L.bx + L.bw + 1.0, L.bottom + 0.7);
      p.lineTo(L.bx + L.bw + 1.6, 0.3);
    } else {
      p.moveTo(L.bx - 1.6, 0.3);
      p.lineTo(L.bx - 1.2, L.top - 0.3);
      p.lineTo(L.bx + 0.4, L.top - 1.0);
      p.lineTo(L.bx + L.bw * 0.6, L.top - 0.7);
      p.lineTo(L.bx + L.bw + 1.0, L.top - 0.2);
      p.lineTo(L.bx + L.bw + 1.6, 0.3);
    }
    p.closePath();
    c.fillStyle = t === 'rock' ? '#5f5a52' : '#6b6458';
    c.fill(p);
    c.lineWidth = 0.06; c.strokeStyle = OUT; c.stroke(p);
    c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 0.03;
    for (let i = 0; i < 9; i++) {
      const x = L.bx - 1 + i * (L.bw + 2) / 8;
      line(c, x, 0, x + 0.3, (t === 'rock' ? L.bottom : L.top) * 0.6);
    }
    if (t === 'cliff') {
      // campfire at the mouth
      const fx = L.bx + L.bw + 0.6;
      const fl = 0.85 + 0.15 * Math.sin((o.t || 0) * 11);
      c.fillStyle = '#4a3020';
      c.fillRect(fx - 0.25, -0.08, 0.5, 0.08);
      c.beginPath(); c.moveTo(fx - 0.15, -0.08); c.quadraticCurveTo(fx, -0.55 * fl, fx + 0.15, -0.08); c.fillStyle = '#ff9a3c'; c.fill();
      o.lights.push({ x: fx, y: -0.3, r: 2.4, color: '#ff9a3c', k: 0.9 * fl });
    }
  } else if (t === 'ferris') {
    const R = -L.bottom / 2 + 0.2;
    const cy = L.top + R - 0.05 + 0.2;
    const pivotY = L.top - 0.15;
    const cyy = pivotY + R;
    c.strokeStyle = '#d8d0c0';
    c.lineWidth = 0.08;
    c.beginPath(); c.arc(0, cyy, R, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(0, cyy, R * 0.92, 0, Math.PI * 2); c.lineWidth = 0.04; c.stroke();
    const rot = (o.t || 0) * 0.0;
    for (let i = 0; i < 12; i++) {
      const a = rot + (i / 12) * Math.PI * 2;
      line(c, 0, cyy, Math.cos(a) * R, cyy + Math.sin(a) * R);
      if (i !== 9) {
        const gx = Math.cos(a) * R, gy = cyy + Math.sin(a) * R;
        c.fillStyle = ['#d8463a', '#3a6ea5', '#6b8f2f', '#e3b53a'][i % 4];
        c.beginPath(); rr(c, gx - 0.3, gy, 0.6, 0.5, 0.15); c.fill();
      }
    }
    c.strokeStyle = '#8a8274';
    c.lineWidth = 0.18;
    line(c, 0, cyy, -R * 0.7, 0.05);
    line(c, 0, cyy, R * 0.7, 0.05);
    c.beginPath(); c.arc(0, cyy, 0.3, 0, Math.PI * 2); c.fillStyle = '#6a6458'; c.fill();
    c.strokeStyle = '#555'; c.lineWidth = 0.06;
    line(c, 0, pivotY, 0, L.top + 0.02);
    void cy;
  } else if (t === 'underground') {
    // shaft to surface
    c.fillStyle = shade(def.col.body, -0.2);
    c.fillRect(L.bx + 0.6, -0.1, 0.8, L.top + 0.2);
    c.strokeStyle = '#8a8a84'; c.lineWidth = 0.04;
    line(c, L.bx + 0.75, -0.3, L.bx + 0.75, L.top + 0.1);
    line(c, L.bx + 1.25, -0.3, L.bx + 1.25, L.top + 0.1);
    for (let y = -0.2; y < L.top; y += 0.25) line(c, L.bx + 0.75, y, L.bx + 1.25, y);
  }
}

function drawSupportFront(c, L, o) {
  const { sup, def } = L;
  const col = def.col;
  const t = sup.type;
  if (t === 'wheels') {
    const R = sup.big ? 0.78 : 0.37;
    const xs = [L.bx + 0.85 + (sup.big ? 0.2 : 0)];
    if (L.bw > 7.5) xs.push(xs[0] + R * 2.3);
    if (sup.six) xs.push(L.bx + L.bw / 2);
    const front = L.cab ? L.cab.x + L.cab.w * 0.62 : L.bx + L.bw - 0.85 - (sup.big ? 0.2 : 0);
    xs.push(front);
    if (L.cab && L.cab.type === 'semi') xs.push(L.cab.x + 0.5);
    c.fillStyle = shade(col.trim, -0.2);
    c.fillRect(L.bx + 0.2, L.bottom - 0.05, (L.cab ? L.cab.x + L.cab.w - 0.3 : L.bx + L.bw - 0.2) - L.bx - 0.2, 0.2);
    for (const x of xs) wheel(c, x, -R, R, o);
  } else if (t === 'rails') {
    c.fillStyle = '#2b2b2b';
    c.fillRect(L.bx + 0.3, L.bottom - 0.04, L.bw - 0.6 + (L.cab ? L.cab.w : 0), 0.22);
    const xs = [L.bx + 1.3, L.bx + L.bw - 1.3];
    if (L.cab) xs.push(L.cab.x + L.cab.w - 0.9);
    for (const x of xs) {
      c.fillStyle = '#3a3a3a';
      c.fillRect(x - 0.75, -0.48, 1.5, 0.22);
      wheel(c, x - 0.38, -0.25, 0.24, o, def.cab === 'steam' ? '#a8352b' : '#4a4a4a');
      wheel(c, x + 0.38, -0.25, 0.24, o, def.cab === 'steam' ? '#a8352b' : '#4a4a4a');
    }
    // couplers
    c.fillStyle = '#333';
    c.fillRect(L.bx - 0.35, L.bottom + 0.0, 0.4, 0.1);
    if (!L.cab) c.fillRect(L.bx + L.bw - 0.05, L.bottom + 0.0, 0.4, 0.1);
  } else if (t === 'hull' || t === 'sub') {
    if (t === 'hull') hull(c, L, o);
  } else if (t === 'treads') {
    const p = new Path2D();
    roundRectPath(p, L.bx - 0.2, -0.75, L.bw + 0.4 + (L.cab ? L.cab.w * 0.8 : 0), 0.75, 0.37);
    c.fillStyle = '#2a2a2a';
    c.fill(p);
    c.lineWidth = 0.05; c.strokeStyle = OUT; c.stroke(p);
    const w = L.bw + 0.4 + (L.cab ? L.cab.w * 0.8 : 0);
    const n = Math.max(3, Math.round(w / 0.75));
    for (let i = 0; i < n; i++) wheel(c, L.bx - 0.2 + 0.37 + i * (w - 0.74) / (n - 1), -0.37, 0.26, o, '#555');
  } else if (t === 'skids') {
    c.strokeStyle = '#333'; c.lineWidth = 0.07;
    line(c, L.bx + 0.8, L.bottom - 0.05, L.bx + 0.7, -0.06);
    line(c, L.bx + L.bw - 0.8, L.bottom - 0.05, L.bx + L.bw - 0.7, -0.06);
    c.lineWidth = 0.1;
    line(c, L.bx + 0.2, -0.05, L.bx + L.bw - 0.1, -0.05);
  } else if (t === 'belly') {
    c.strokeStyle = '#333'; c.lineWidth = 0.08;
    line(c, L.bx + L.bw * 0.65, L.bottom, L.bx + L.bw * 0.68 - 0.3, 0);
    c.fillStyle = '#7a6a50';
    c.beginPath(); c.ellipse(L.bx + L.bw * 0.4, 0.02, L.bw * 0.45, 0.12, 0, 0, Math.PI * 2); c.fill();
  } else if (t === 'balloon') {
    balloon(c, L, o);
  } else if (t === 'tree') {
    foliage(c, L, false);
  } else if (t === 'underground') {
    // surface hatch and vent
    c.fillStyle = '#6a6c66';
    c.beginPath(); c.ellipse(L.bx + 1.0, -0.12, 0.6, 0.25, 0, Math.PI, 0); c.fill();
    c.strokeStyle = OUT; c.lineWidth = 0.04; c.stroke();
    c.fillStyle = '#4a4c48';
    c.fillRect(L.bx + L.bw - 1.2, -0.9, 0.15, 0.9);
    c.beginPath(); c.arc(L.bx + L.bw - 1.125, -0.9, 0.18, Math.PI, 0); c.fill();
    c.fillStyle = '#5f7a3a';
    c.beginPath(); c.ellipse(L.bx + L.bw * 0.55, 0.02, 1.4, 0.18, 0, Math.PI, 0); c.fill();
  }
  if (t === 'stilts' && sup.water) {
    // nothing extra; swamp water drawn by scene
  }
}

function hull(c, L, o) {
  const { sup, def } = L;
  const col = def.col;
  const x0 = L.bx - 0.45, x1 = L.bx + L.bw + (sup.flat ? 0.4 : sup.sleek ? 1.9 : 1.3);
  const deck = L.bottom + 0.02;
  const keel = sup.flat ? 0.35 : 0.85;
  const p = new Path2D();
  if (sup.flat) {
    roundRectPath(p, x0, deck, x1 - x0, keel - deck, 0.25);
  } else {
    const sternTop = sup.wood ? deck - 0.9 : deck;
    p.moveTo(x0 - (sup.wood ? 0.35 : 0), sternTop);
    p.lineTo(x0 + 0.25, keel - 0.25);
    p.quadraticCurveTo(x0 + 0.4, keel, x0 + 1.0, keel);
    p.lineTo(x1 - 1.6, keel);
    p.quadraticCurveTo(x1 - 0.4, keel - 0.1, x1, deck - (sup.sleek ? 0.35 : 0.45));
    p.lineTo(x1 - 0.25, deck);
    p.lineTo(x0 + 0.2, deck);
    p.lineTo(x0 + 0.2, sternTop);
    p.closePath();
  }
  c.fillStyle = col.hull || col.trim;
  c.fill(p);
  c.lineWidth = 0.07; c.strokeStyle = OUT; c.stroke(p);
  c.save();
  c.clip(p);
  if (sup.wood || sup.wreck) {
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.025;
    for (let y = deck - 1; y < keel; y += 0.14) line(c, x0 - 1, y, x1 + 1, y);
  }
  c.fillStyle = col.stripe ? shade(col.stripe, 0.1) : 'rgba(255,255,255,0.6)';
  c.fillRect(x0 - 1, deck + 0.04, x1 - x0 + 2, 0.08);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(x0 - 1, 0.18, x1 - x0 + 2, 2);
  if (sup.wreck) {
    c.fillStyle = 'rgba(20,14,8,0.85)';
    c.beginPath(); c.ellipse(x0 + 2.2, keel - 0.35, 0.45, 0.22, 0.3, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  if (sup.wood) {
    for (let i = 0; i < 4; i++) {
      c.beginPath(); c.arc(x0 + 1.4 + i * (x1 - x0 - 2.8) / 3, deck + 0.3, 0.09, 0, Math.PI * 2);
      c.fillStyle = '#1a1208'; c.fill();
    }
  }
  L.hull = { x0, x1 };
}

function balloon(c, L, o) {
  const { sup, def } = L;
  const col = def.col;
  if (sup.basket) {
    const cy = L.top - 2.25, r = 1.75;
    const p = new Path2D();
    p.moveTo(-0.55, L.top - 0.9);
    p.bezierCurveTo(-r * 1.4, cy + 0.6, -r * 1.2, cy - r * 1.2, 0, cy - r);
    p.bezierCurveTo(r * 1.2, cy - r * 1.2, r * 1.4, cy + 0.6, 0.55, L.top - 0.9);
    p.closePath();
    c.fillStyle = col.envelope;
    c.fill(p);
    c.save(); c.clip(p);
    c.fillStyle = col.envelope2;
    for (let i = -3; i <= 3; i += 2) {
      c.beginPath();
      c.ellipse(i * 0.42, cy, 0.22, r * 1.4, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    c.lineWidth = 0.06; c.strokeStyle = OUT; c.stroke(p);
    const fl = 0.8 + 0.2 * Math.sin((o.t || 0) * 13);
    c.beginPath(); c.moveTo(-0.12, L.top - 0.45); c.quadraticCurveTo(0, L.top - 0.95 * fl, 0.12, L.top - 0.45);
    c.fillStyle = '#ffb84a'; c.fill();
    o.lights.push({ x: 0, y: L.top - 0.6, r: 1.8, color: '#ffaa4a', k: 0.8 * fl });
    c.strokeStyle = '#555'; c.lineWidth = 0.04;
    line(c, -0.3, L.top, -0.3, L.top - 0.4); line(c, 0.3, L.top, 0.3, L.top - 0.4);
  } else {
    const rx = L.bw * 0.95, ry = 1.35, cy = L.top - 1.75;
    const p = new Path2D();
    p.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = col.envelope;
    c.fill(p);
    c.save(); c.clip(p);
    c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 0.03;
    for (let i = -6; i <= 6; i++) { c.beginPath(); c.ellipse(0, cy, Math.abs(i) / 6 * rx, ry, 0, 0, Math.PI * 2); c.stroke(); }
    const g = c.createLinearGradient(0, cy - ry, 0, cy + ry);
    g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    c.fillStyle = g; c.fillRect(-rx, cy - ry, rx * 2, ry * 2);
    c.restore();
    c.lineWidth = 0.06; c.strokeStyle = OUT; c.stroke(p);
    const fin = new Path2D();
    fin.moveTo(-rx * 0.8, cy - 0.3); fin.lineTo(-rx - 0.5, cy - 1.0); fin.lineTo(-rx - 0.4, cy + 0.2); fin.closePath();
    c.fillStyle = shade(col.envelope, -0.15); c.fill(fin); c.stroke(fin);
  }
}

function foliage(c, L, back) {
  const g = L.sup.giant;
  const spots = [];
  const w = L.bw + (g ? 3.6 : 2.4);
  const n = g ? 16 : 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI;
    const r = 0.9 + ((i * 37) % 5) * 0.15;
    spots.push({ x: -Math.cos(a) * w / 2, y: L.top - 0.4 - Math.sin(a) * 1.3, r: r * (g ? 1.3 : 1) });
  }
  for (const side of [-1, 1]) spots.push({ x: side * (L.bw / 2 + 0.9), y: L.bottom - 0.6, r: g ? 1.2 : 0.9 });
  const cols = back ? ['#3d5a2a', '#4a6b32', '#35502a'] : ['#5f8a3a', '#6e9a44'];
  if (back) {
    spots.forEach((s, i) => {
      c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      c.fillStyle = cols[i % cols.length]; c.fill();
    });
  } else {
    spots.filter((s, i) => i % 3 === 0 && Math.abs(s.x) > L.bw / 2).forEach((s, i) => {
      c.beginPath(); c.arc(s.x * 1.05, s.y + 0.2, s.r * 0.55, 0, Math.PI * 2);
      c.fillStyle = cols[i % 2]; c.fill();
    });
  }
}

function wheel(c, x, y, r, o, hub = '#7a7a7a') {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = '#1e1e1e'; c.fill();
  c.lineWidth = 0.04; c.strokeStyle = '#111'; c.stroke();
  c.beginPath(); c.arc(x, y, r * 0.5, 0, Math.PI * 2);
  c.fillStyle = hub; c.fill();
  c.beginPath(); c.arc(x, y, r * 0.15, 0, Math.PI * 2);
  c.fillStyle = '#333'; c.fill();
}

function line(c, x0, y0, x1, y1) {
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
}

// ---------------------------------------------------------------------------
// Roofs

function drawRoof(c, L, o) {
  const { def } = L;
  const col = def.col;
  const roof = def.roof || 'flat';
  const x0 = L.tx0, x1 = L.tx1, ty = L.top, tw = x1 - x0, cx = (x0 + x1) / 2;
  const rc = col.roof;
  c.lineWidth = 0.07;
  c.strokeStyle = OUT;
  const fs = (p, f = rc) => { c.fillStyle = f; c.fill(p); c.stroke(p); };
  const shingles = (p, step = 0.18) => {
    c.save(); c.clip(p);
    c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 0.02;
    for (let y = ty + 0.2; y > ty - 4; y -= step) line(c, x0 - 2, y, x1 + 2, y);
    c.restore();
  };
  L.apex = ty;
  if (L.body === 'tube' || L.body === 'dome' || roof === 'none') return;

  switch (roof) {
    case 'flat': {
      const p = new Path2D();
      p.rect(x0 - 0.04, ty - 0.1, tw + 0.08, 0.14);
      fs(p, shade(rc, -0.1));
      break;
    }
    case 'curved': {
      const p = new Path2D();
      p.moveTo(x0 + 0.05, ty + 0.06);
      p.quadraticCurveTo(cx, ty - 0.55, x1 - 0.05, ty + 0.06);
      p.closePath();
      fs(p);
      L.apex = ty - 0.28;
      break;
    }
    case 'gable': case 'glass': case 'spire': {
      const ah = roofHeight('gable', L);
      const p = new Path2D();
      if (tw > 6) {
        p.moveTo(x0 - 0.3, ty + 0.05); p.lineTo(x0 + 1.0, ty - ah); p.lineTo(x1 - 1.0, ty - ah); p.lineTo(x1 + 0.3, ty + 0.05);
      } else {
        p.moveTo(x0 - 0.3, ty + 0.05); p.lineTo(cx, ty - ah); p.lineTo(x1 + 0.3, ty + 0.05);
      }
      p.closePath();
      if (roof === 'glass') {
        fs(p, 'rgba(200,230,215,0.55)');
        c.save(); c.clip(p); c.strokeStyle = shade(col.trim, 0); c.lineWidth = 0.04;
        for (let x = x0; x < x1; x += 0.8) line(c, x, ty, x, ty - ah);
        c.restore();
      } else {
        fs(p);
        shingles(p);
      }
      L.apex = ty - ah;
      if (roof === 'spire') {
        const bw = Math.min(1.0, tw * 0.3);
        const by = ty - ah + 0.25;
        const bel = new Path2D(); bel.rect(cx - bw / 2, by - 0.9, bw, 0.9);
        fs(bel, col.body);
        const sp = new Path2D(); sp.moveTo(cx - bw / 2 - 0.1, by - 0.9); sp.lineTo(cx, by - 2.8); sp.lineTo(cx + bw / 2 + 0.1, by - 0.9); sp.closePath();
        fs(sp);
        L.belfry = { x: cx - bw / 2, y: by - 0.9, w: bw, h: 0.9 };
        L.apex = by - 2.8;
      }
      break;
    }
    case 'hip': {
      const p = new Path2D();
      p.moveTo(x0 - 0.4, ty + 0.05); p.lineTo(x0 + tw * 0.3, ty - 0.7); p.lineTo(x1 - tw * 0.3, ty - 0.7); p.lineTo(x1 + 0.4, ty + 0.05); p.closePath();
      fs(p); shingles(p);
      L.apex = ty - 0.7;
      break;
    }
    case 'gambrel': {
      const p = new Path2D();
      p.moveTo(x0 - 0.25, ty + 0.05); p.lineTo(x0 + 0.35, ty - 0.95); p.lineTo(cx, ty - 1.6); p.lineTo(x1 - 0.35, ty - 0.95); p.lineTo(x1 + 0.25, ty + 0.05); p.closePath();
      fs(p); shingles(p, 0.22);
      L.apex = ty - 1.6;
      break;
    }
    case 'conical': {
      const h = roofHeight('conical', L);
      const p = new Path2D();
      p.moveTo(x0 - 0.25, ty + 0.05); p.lineTo(cx, ty - h); p.lineTo(x1 + 0.25, ty + 0.05); p.closePath();
      fs(p); shingles(p, 0.16);
      L.apex = ty - h;
      break;
    }
    case 'dome': case 'observatory': {
      const p = new Path2D();
      p.ellipse(cx, ty + 0.03, tw / 2 + 0.02, tw * 0.42, 0, Math.PI, 0);
      p.closePath();
      fs(p);
      if (roof === 'observatory') {
        c.fillStyle = '#2a2e38';
        c.fillRect(cx - 0.2, ty - tw * 0.42 + 0.05, 0.4, tw * 0.3);
        c.save(); c.translate(cx, ty - tw * 0.25); c.rotate(-0.6);
        c.fillStyle = '#9aa0a8'; c.fillRect(-0.1, -0.15, 1.5, 0.3); c.strokeRect(-0.1, -0.15, 1.5, 0.3);
        c.restore();
      } else {
        c.save(); c.clip(p);
        c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 0.02;
        for (let i = -4; i <= 4; i++) { c.beginPath(); c.ellipse(cx, ty, Math.abs(i) / 4 * tw / 2, tw * 0.42, 0, 0, Math.PI * 2); c.stroke(); }
        c.restore();
      }
      L.apex = ty - tw * 0.42;
      break;
    }
    case 'lamp': {
      const lw = Math.max(1.4, tw * 0.75), lh = 0.8;
      c.fillStyle = '#333';
      c.fillRect(x0 - 0.35, ty - 0.08, tw + 0.7, 0.1);
      c.strokeStyle = '#333'; c.lineWidth = 0.03;
      for (let x = x0 - 0.3; x <= x1 + 0.3; x += 0.2) line(c, x, ty - 0.08, x, ty - 0.35);
      line(c, x0 - 0.35, ty - 0.35, x1 + 0.35, ty - 0.35);
      const night = o.night || 0;
      const g = new Path2D(); g.rect(cx - lw / 2, ty - 0.08 - lh, lw, lh);
      c.lineWidth = 0.06; c.strokeStyle = OUT;
      fs(g, night > 0.2 ? '#fff1b8' : 'rgba(200,225,235,0.9)');
      c.strokeStyle = '#333'; c.lineWidth = 0.035;
      for (let x = cx - lw / 2 + lw / 3; x < cx + lw / 2 - 0.1; x += lw / 3) line(c, x, ty - 0.08 - lh, x, ty - 0.08);
      const d = new Path2D(); d.ellipse(cx, ty - 0.08 - lh, lw / 2 + 0.1, 0.55, 0, Math.PI, 0); d.closePath();
      c.strokeStyle = OUT; c.lineWidth = 0.06;
      fs(d);
      L.apex = ty - lh - 0.7;
      if (night > 0.2) {
        const a = (o.t || 0) * 0.8;
        const lx = cx, ly = ty - 0.08 - lh / 2;
        o.lights.push({ x: lx, y: ly, r: 3.5, color: '#fff1b8', k: 1 });
        o.beam = { x: lx, y: ly, a };
      }
      break;
    }
    case 'pagoda': {
      eave(c, cx, ty + 0.05, tw + 1.4, 0.9, rc);
      const p = new Path2D();
      p.moveTo(cx - tw / 2 + 0.2, ty - 0.3); p.quadraticCurveTo(cx, ty - 1.0, cx + tw / 2 - 0.2, ty - 0.3); p.closePath();
      fs(p);
      c.fillStyle = '#c9a227'; c.fillRect(cx - 0.04, ty - 1.4, 0.08, 0.6);
      L.apex = ty - 1.4;
      break;
    }
    case 'mushroom': {
      const p = new Path2D();
      p.moveTo(x0 - 1.1, ty + 0.35);
      p.bezierCurveTo(x0 - 1.0, ty - 1.9, x1 + 1.0, ty - 1.9, x1 + 1.1, ty + 0.35);
      p.quadraticCurveTo(cx, ty + 0.05, x0 - 1.1, ty + 0.35);
      fs(p);
      c.fillStyle = '#f6efe0';
      const dots = [[-0.35, -1.0, 0.22], [0.2, -1.25, 0.16], [0.42, -0.7, 0.2], [-0.15, -0.55, 0.14], [0.05, -0.95, 0.1]];
      for (const [dx, dy, r] of dots) { c.beginPath(); c.arc(cx + dx * (tw + 2), ty + dy, r, 0, Math.PI * 2); c.fill(); }
      L.apex = ty - 1.5;
      break;
    }
    case 'tent': {
      const p = new Path2D();
      p.moveTo(x0 - 0.5, ty + 0.3); p.lineTo(cx, ty - 2.7); p.lineTo(x1 + 0.5, ty + 0.3); p.closePath();
      fs(p);
      c.save(); c.clip(p);
      c.fillStyle = col.trim;
      for (let i = -6; i <= 6; i += 2) {
        c.beginPath(); c.moveTo(cx, ty - 2.7); c.lineTo(cx + i * (tw / 10), ty + 0.4); c.lineTo(cx + (i + 1) * (tw / 10), ty + 0.4); c.closePath(); c.fill();
      }
      c.restore();
      c.strokeStyle = OUT; c.stroke(p);
      for (let i = 0; i < 9; i++) {
        c.beginPath(); c.arc(x0 - 0.4 + i * (tw + 0.8) / 8, ty + 0.3, 0.12, 0, Math.PI);
        c.fillStyle = i % 2 ? col.trim : rc; c.fill();
      }
      L.apex = ty - 2.7;
      break;
    }
    case 'pediment': {
      c.fillStyle = shade(rc, -0.05);
      c.fillRect(x0 - 0.5, ty - 0.25, tw + 1.0, 0.25);
      c.strokeRect(x0 - 0.5, ty - 0.25, tw + 1.0, 0.25);
      const p = new Path2D();
      p.moveTo(x0 - 0.55, ty - 0.25); p.lineTo(cx, ty - 0.9); p.lineTo(x1 + 0.55, ty - 0.25); p.closePath();
      fs(p);
      L.apex = ty - 0.9;
      break;
    }
    case 'battlement': {
      c.fillStyle = shade(col.body, -0.05);
      for (let x = x0 - 0.1; x < x1; x += 0.6) {
        c.fillRect(x, ty - 0.42, 0.35, 0.45);
        c.strokeRect(x, ty - 0.42, 0.35, 0.45);
      }
      L.apex = ty - 0.42;
      break;
    }
    case 'sawtooth': {
      const n = Math.max(2, Math.round(tw / 1.6));
      const sw = tw / n;
      const p = new Path2D();
      p.moveTo(x0, ty + 0.02);
      for (let i = 0; i < n; i++) {
        p.lineTo(x0 + i * sw, ty - 0.75);
        p.lineTo(x0 + (i + 1) * sw, ty + 0.02);
      }
      p.closePath();
      fs(p);
      c.fillStyle = 'rgba(190,215,230,0.7)';
      for (let i = 0; i < n; i++) c.fillRect(x0 + i * sw + 0.02, ty - 0.68, 0.12, 0.66);
      L.apex = ty - 0.75;
      break;
    }
  }
}

function eave(c, cx, y, w, h, color) {
  const p = new Path2D();
  p.moveTo(cx - w / 2, y - 0.15);
  p.quadraticCurveTo(cx - w / 2 + 0.3, y + 0.05, cx - w / 2 + 0.7, y - 0.05);
  p.lineTo(cx - w / 2 + 1.0, y - h * 0.5);
  p.lineTo(cx + w / 2 - 1.0, y - h * 0.5);
  p.lineTo(cx + w / 2 - 0.7, y - 0.05);
  p.quadraticCurveTo(cx + w / 2 - 0.3, y + 0.05, cx + w / 2, y - 0.15);
  p.lineTo(cx + w / 2 - 0.5, y + 0.1);
  p.lineTo(cx - w / 2 + 0.5, y + 0.1);
  p.closePath();
  c.fillStyle = color;
  c.fill(p);
  c.lineWidth = 0.05; c.strokeStyle = OUT; c.stroke(p);
}

// ---------------------------------------------------------------------------
// Extras

const roofY = L => (L.def.roof === 'curved' ? L.top - 0.2 : L.top - 0.08);

const EXTRA_BACK = {
  wings(c, L) {
    const p = new Path2D();
    const wx = L.bx + L.bw * 0.45;
    p.moveTo(wx - 1.6, L.bottom - 0.3); p.lineTo(wx + 1.0, L.bottom - 0.3); p.lineTo(wx - 0.6, L.bottom + 0.2); p.lineTo(wx - 2.8, L.bottom + 0.2); p.closePath();
    c.fillStyle = shade(L.def.col.body, -0.25); c.fill(p);
    c.lineWidth = 0.05; c.strokeStyle = OUT; c.stroke(p);
    c.beginPath(); rr(c, wx - 1.5, L.bottom - 0.05, 1.1, 0.45, 0.2);
    c.fillStyle = shade(L.def.col.body, -0.1); c.fill(); c.stroke();
  },
  awning(c, L) {
    const x = L.bx, y = L.top + 0.35;
    const p = new Path2D();
    p.moveTo(x, y); p.lineTo(x - 1.3, y + 0.35); p.lineTo(x - 1.3, y + 0.5); p.lineTo(x, y + 0.15); p.closePath();
    c.fillStyle = L.def.col.stripe || '#c0652f'; c.fill(p);
    c.save(); c.clip(p); c.fillStyle = '#f2ece0';
    for (let i = 0; i < 6; i++) c.fillRect(x - 1.3 + i * 0.26, y - 1, 0.13, 2);
    c.restore();
    c.lineWidth = 0.04; c.strokeStyle = OUT; c.stroke(p);
    c.strokeStyle = '#777'; c.lineWidth = 0.035;
    line(c, x - 1.25, y + 0.5, x - 1.25, Math.min(0, L.bottom + 0.6));
  },
  canopy(c, L) {
    const x0 = L.bx + L.bw + 0.3, top = L.top - 0.3;
    c.fillStyle = '#d8d4ca';
    c.fillRect(x0 + 0.4, top, 0.15, -top);
    c.fillRect(x0 + 2.6, top, 0.15, -top);
    c.fillStyle = '#efefe8';
    c.fillRect(x0, top - 0.35, 3.2, 0.35);
    c.fillStyle = L.def.col.trim;
    c.fillRect(x0, top - 0.2, 3.2, 0.1);
    c.strokeStyle = OUT; c.lineWidth = 0.04; c.strokeRect(x0, top - 0.35, 3.2, 0.35);
    for (const px of [1.1, 1.9]) {
      c.fillStyle = '#c23b31'; c.fillRect(x0 + px, -0.95, 0.4, 0.95); c.strokeRect(x0 + px, -0.95, 0.4, 0.95);
      c.fillStyle = '#ddd'; c.fillRect(x0 + px + 0.08, -0.85, 0.24, 0.2);
    }
  },
  porch(c, L) {
    const rm = L.rooms[0];
    const x0 = L.bx + L.bw;
    c.fillStyle = '#8a6440';
    c.fillRect(x0, L.bottom - 0.05, 1.1, 0.12);
    c.strokeStyle = '#6b4a2e'; c.lineWidth = 0.08;
    line(c, x0 + 1.0, L.bottom, x0 + 1.0, rm.y + 0.1);
    const p = new Path2D();
    p.moveTo(x0, rm.y - 0.05); p.lineTo(x0 + 1.25, rm.y + 0.2); p.lineTo(x0 + 1.25, rm.y + 0.3); p.lineTo(x0, rm.y + 0.12); p.closePath();
    c.fillStyle = L.def.col.roof; c.fill(p); c.lineWidth = 0.04; c.strokeStyle = OUT; c.stroke(p);
    c.fillStyle = '#7a5636';
    for (let i = 0; i < 3; i++) c.fillRect(x0 + 1.1 + i * 0.2, L.bottom + i * (-L.bottom / 3), 0.2, -L.bottom / 3 + 0.02);
  },
  paddlewheel(c, L, o) {
    const x = L.bx - 0.9, y = L.bottom + 0.35, r = 1.0;
    c.save();
    c.translate(x, y);
    c.rotate((o.t || 0) * 0.3);
    c.strokeStyle = '#8a2d24'; c.lineWidth = 0.08;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      line(c, 0, 0, Math.cos(a) * r, Math.sin(a) * r);
      c.fillStyle = '#3a2a1a';
      c.save(); c.rotate(a); c.fillRect(r - 0.25, -0.08, 0.3, 0.16); c.restore();
    }
    c.restore();
  },
  mast(c, L) {
    const x = L.bx + L.bw * 0.6, y0 = L.top, y1 = L.top - 3.2;
    c.strokeStyle = '#5a3a22'; c.lineWidth = 0.12;
    line(c, x, L.bottom, x, y1);
    c.lineWidth = 0.08;
    line(c, x - 1.0, y1 + 0.6, x + 1.0, y1 + 0.6);
    line(c, x - 1.3, y1 + 1.8, x + 1.3, y1 + 1.8);
    c.strokeStyle = 'rgba(40,30,20,0.6)'; c.lineWidth = 0.02;
    line(c, x, y1, L.bx - 0.3, y0 + 0.2);
    line(c, x, y1, L.bx + L.bw + 1.2, L.bottom - 0.3);
    void y0;
  },
};

const EXTRA = {
  vents(c, L) {
    const y = roofY(L);
    c.fillStyle = shade(L.def.col.roof, -0.2);
    for (let x = L.bx + 1.2; x < L.bx + L.bw - 1; x += 2.2) {
      c.beginPath(); rr(c, x, y - 0.14, 0.5, 0.16, 0.05); c.fill();
    }
  },
  ac(c, L) {
    const y = roofY(L);
    c.fillStyle = '#e8e6e0';
    c.beginPath(); rr(c, L.bx + L.bw * 0.35, y - 0.32, 0.8, 0.34, 0.06); c.fill();
    c.lineWidth = 0.03; c.strokeStyle = OUT; c.stroke();
  },
  solar(c, L) {
    const y = roofY(L);
    for (let i = 0; i < 2; i++) {
      c.save();
      c.translate(L.bx + 1.0 + i * 1.3, y - 0.15);
      c.rotate(-0.2);
      c.fillStyle = '#2b4a7a'; c.fillRect(0, -0.12, 1.1, 0.12);
      c.restore();
    }
  },
  ladder(c, L) {
    const x = L.bx - 0.22;
    c.strokeStyle = '#555'; c.lineWidth = 0.035;
    line(c, x, L.bottom, x, L.top - 0.1);
    line(c, x + 0.18, L.bottom, x + 0.18, L.top - 0.1);
    for (let y = L.bottom - 0.15; y > L.top; y -= 0.22) line(c, x, y, x + 0.18, y);
  },
  rivets(c, L) {
    c.fillStyle = 'rgba(0,0,0,0.3)';
    for (let x = L.bx + 0.15; x < L.bx + L.bw; x += 0.3) {
      c.beginPath(); c.arc(x, L.bottom - 0.07, 0.02, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x, L.top + 0.07, 0.02, 0, Math.PI * 2); c.fill();
    }
  },
  lantern(c, L, o) {
    const x = L.bx - 0.15, y = L.top + 0.4;
    c.fillStyle = '#333'; c.fillRect(x - 0.1, y - 0.12, 0.2, 0.25);
    c.fillStyle = o.night > 0.2 ? '#ffcc66' : '#d8c890'; c.fillRect(x - 0.07, y - 0.08, 0.14, 0.16);
    if (o.night > 0.2) o.lights.push({ x, y, r: 1.4, color: '#ffbb55', k: 0.8 });
  },
  hatch(c, L) {
    c.fillStyle = shade(L.def.col.body, -0.2);
    c.beginPath(); c.ellipse(0, L.top + 0.05, 0.45, 0.25, 0, Math.PI, 0); c.fill();
    c.lineWidth = 0.04; c.strokeStyle = OUT; c.stroke();
  },
  horn(c, L) {
    const y = roofY(L);
    c.fillStyle = '#888';
    c.fillRect(L.bx + L.bw - 0.8, y - 0.2, 0.35, 0.1);
    c.fillRect(L.bx + L.bw - 0.4, y - 0.25, 0.3, 0.1);
  },
  smokestack(c, L, o) {
    const x = L.bx + L.bw * 0.55, y = roofY(L);
    c.fillStyle = L.def.col.trim;
    c.fillRect(x - 0.22, y - 1.0, 0.44, 1.0);
    c.fillStyle = '#222'; c.fillRect(x - 0.25, y - 1.08, 0.5, 0.12);
    c.lineWidth = 0.04; c.strokeStyle = OUT; c.strokeRect(x - 0.22, y - 1.0, 0.44, 1.0);
    smoke(c, x, y - 1.1, o);
  },
  smokestacks(c, L, o) {
    const y = roofY(L);
    for (const fx of [0.4, 0.6]) {
      const x = L.bx + L.bw * fx;
      c.fillStyle = '#2b2b2b'; c.fillRect(x - 0.13, y - 1.5, 0.26, 1.5);
      c.beginPath(); c.moveTo(x - 0.25, y - 1.5); c.lineTo(x + 0.25, y - 1.5); c.lineTo(x + 0.13, y - 1.35); c.lineTo(x - 0.13, y - 1.35); c.fill();
      smoke(c, x, y - 1.6, o, 0.8);
    }
  },
  turret(c, L) {
    const y = roofY(L), x = L.bx + L.bw * 0.5;
    c.fillStyle = shade(L.def.col.body, -0.15);
    c.beginPath(); rr(c, x - 0.5, y - 0.4, 1.0, 0.42, 0.15); c.fill();
    c.lineWidth = 0.04; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = '#2a2a2a'; c.fillRect(x + 0.4, y - 0.28, 1.0, 0.1);
  },
  tankTurret(c, L) {
    const x = 0, y = L.top;
    c.fillStyle = shade(L.def.col.body, -0.08);
    c.beginPath(); rr(c, x - L.bw * 0.32, y - 0.75, L.bw * 0.64, 0.8, 0.3); c.fill();
    c.lineWidth = 0.05; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = '#3a3f2c'; c.fillRect(x + L.bw * 0.3, y - 0.48, 2.2, 0.16);
    c.strokeRect(x + L.bw * 0.3, y - 0.48, 2.2, 0.16);
    c.beginPath(); c.arc(x - 0.3, y - 0.8, 0.2, Math.PI, 0); c.fillStyle = shade(L.def.col.body, -0.2); c.fill();
  },
  lightbar(c, L, o) {
    const x = L.cab ? L.cab.x + 0.3 : L.bx + L.bw - 1, y = L.cab && L.cab.h < L.bh ? L.bottom - L.cab.h : roofY(L);
    const blink = Math.sin((o.t || 0) * 6) > 0;
    c.fillStyle = blink ? '#ff3b30' : '#8a1f1a'; c.fillRect(x, y - 0.12, 0.22, 0.12);
    c.fillStyle = !blink ? '#3b82ff' : '#1a3a8a'; c.fillRect(x + 0.22, y - 0.12, 0.22, 0.12);
    if (o.night > 0.3) o.lights.push({ x: x + 0.22, y, r: 1.0, color: blink ? '#ff3b30' : '#3b82ff', k: 0.6 });
  },
  cross(c, L) {
    const x = L.bx + L.bw * 0.5, y = roofY(L) - 0.45;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 0.35, 0, Math.PI * 2); c.fill();
    c.lineWidth = 0.03; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = '#d0342b'; c.fillRect(x - 0.08, y - 0.25, 0.16, 0.5); c.fillRect(x - 0.25, y - 0.08, 0.5, 0.16);
    c.strokeStyle = '#999'; c.lineWidth = 0.05; line(c, x, y + 0.35, x, roofY(L));
  },
  cone(c, L) {
    const x = L.bx + L.bw * 0.45, y = roofY(L);
    c.beginPath(); c.moveTo(x - 0.3, y - 0.6); c.lineTo(x, y); c.lineTo(x + 0.3, y - 0.6); c.closePath();
    c.fillStyle = '#d8a860'; c.fill(); c.lineWidth = 0.04; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.arc(x, y - 0.75, 0.32, 0, Math.PI * 2); c.fillStyle = '#f2b8cf'; c.fill(); c.stroke();
    c.beginPath(); c.arc(x, y - 1.05, 0.08, 0, Math.PI * 2); c.fillStyle = '#d0342b'; c.fill();
  },
  sign(c, L, o) {
    const label = (L.def.sign || L.def.name.split(' ').pop()).toUpperCase();
    const w = Math.min(L.bw * 0.7, label.length * 0.38 + 0.5);
    const x = L.bx + L.bw * 0.5 - w / 2, y = (L.apex ?? L.top) - 0.75;
    c.fillStyle = '#2a2a2a'; c.fillRect(x + w / 2 - 0.05, y + 0.6, 0.1, (L.apex ?? L.top) - y - 0.6);
    c.beginPath(); rr(c, x, y, w, 0.6, 0.1); c.fillStyle = '#2f3438'; c.fill();
    c.lineWidth = 0.04; c.strokeStyle = OUT; c.stroke();
    const on = (o.night || 0) > 0.25;
    c.font = 'bold 0.4px system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = on ? (Math.sin((o.t || 0) * 0.7) > -0.9 ? '#ff6a8a' : '#6a2a3a') : '#e8d8c8';
    c.fillText(label, x + w / 2, y + 0.32);
    if (on) o.lights.push({ x: x + w / 2, y: y + 0.3, r: 1.8, color: '#ff6a8a', k: 0.7 });
  },
  ladderTop(c, L) {
    const y = roofY(L);
    c.strokeStyle = '#d8d8d0'; c.lineWidth = 0.05;
    line(c, L.bx + 0.2, y - 0.15, L.bx + L.bw + 0.5, y - 0.15);
    line(c, L.bx + 0.2, y - 0.35, L.bx + L.bw + 0.5, y - 0.35);
    c.lineWidth = 0.03;
    for (let x = L.bx + 0.3; x < L.bx + L.bw + 0.5; x += 0.25) line(c, x, y - 0.15, x, y - 0.35);
  },
  railing(c, L) {
    const y = L.top - 0.06;
    const x0 = L.tx0 - 0.05, x1 = L.tx1 + 0.05;
    c.strokeStyle = '#d8d8d0'; c.lineWidth = 0.035;
    line(c, x0, y - 0.4, x1, y - 0.4);
    for (let x = x0; x <= x1 + 0.01; x += 0.4) line(c, x, y, x, y - 0.4);
  },
  sill(c, L) {
    const y = L.top - 0.08;
    for (let x = L.bx + 0.5; x < L.bx + L.bw - 0.3; x += 1.3) {
      c.fillStyle = '#b5653a'; c.fillRect(x, y - 0.2, 0.3, 0.2);
      c.fillStyle = '#5f9a3e';
      c.beginPath(); c.arc(x + 0.15, y - 0.3, 0.18, 0, Math.PI * 2); c.fill();
    }
  },
  crane(c, L) {
    const x = L.bx + L.bw - 0.6, y = roofY(L);
    c.strokeStyle = '#d8a227'; c.lineWidth = 0.12;
    line(c, x, y, x, y - 1.6);
    c.lineWidth = 0.08;
    line(c, x, y - 1.5, x - 2.0, y - 0.9);
    c.strokeStyle = '#333'; c.lineWidth = 0.02;
    line(c, x - 2.0, y - 0.9, x - 2.0, y - 0.1);
    c.fillStyle = '#333'; c.fillRect(x - 2.08, y - 0.15, 0.16, 0.12);
  },
  radar(c, L, o) {
    const x = L.tx1 - 0.6, y = L.top - 0.05;
    c.strokeStyle = '#888'; c.lineWidth = 0.05; line(c, x, y, x, y - 0.8);
    const w = 0.6 * Math.abs(Math.cos((o.t || 0) * 1.5));
    c.fillStyle = '#ddd'; c.fillRect(x - w / 2, y - 0.86, w, 0.08);
  },
  tires(c, L) {
    const x0 = L.hull ? L.hull.x0 : L.bx;
    const x1 = L.hull ? L.hull.x1 : L.bx + L.bw;
    for (let x = x0 + 0.8; x < x1 - 0.8; x += 0.9) {
      c.beginPath(); c.arc(x, L.bottom + 0.35, 0.16, 0, Math.PI * 2);
      c.lineWidth = 0.07; c.strokeStyle = '#1a1a1a'; c.stroke();
    }
  },
  flag(c, L, o) {
    const x = (L.tx0 + L.tx1) / 2 + (L.def.roof === 'tent' ? 0 : 0.6);
    const y = L.apex ?? L.top;
    c.strokeStyle = '#555'; c.lineWidth = 0.04; line(c, x, y, x, y - 1.1);
    const t = o.t || 0;
    c.beginPath();
    c.moveTo(x, y - 1.1);
    c.quadraticCurveTo(x + 0.3, y - 1.15 + Math.sin(t * 3) * 0.05, x + 0.6, y - 1.1 + Math.sin(t * 3 + 1) * 0.06);
    c.lineTo(x + 0.6, y - 0.75 + Math.sin(t * 3 + 1) * 0.06);
    c.quadraticCurveTo(x + 0.3, y - 0.8 + Math.sin(t * 3) * 0.05, x, y - 0.75);
    c.closePath();
    c.fillStyle = L.def.group === 'Water' ? '#1a1a1a' : '#b5302b';
    c.fill();
  },
  sail(c, L, o) {
    const x = L.bx + L.bw * 0.6, top = L.top - 3.2;
    const b = Math.sin((o.t || 0) * 0.8) * 0.06;
    for (const [y0, y1, w] of [[top + 0.65, top + 1.75, 0.95], [top + 1.85, top + 2.9, 1.25]]) {
      c.beginPath();
      c.moveTo(x - w, y0);
      c.lineTo(x + w, y0);
      c.quadraticCurveTo(x + w + 0.2 + b, (y0 + y1) / 2, x + w, y1);
      c.lineTo(x - w, y1);
      c.quadraticCurveTo(x - w + 0.2 + b, (y0 + y1) / 2, x - w, y0);
      c.fillStyle = '#ece2c8'; c.fill();
      c.lineWidth = 0.04; c.strokeStyle = OUT; c.stroke();
    }
  },
  conning(c, L) {
    const x = L.bx + L.bw * 0.55;
    c.fillStyle = L.def.col.body;
    c.beginPath(); rr(c, x - 0.7, L.top - 1.0, 1.4, 1.1, 0.3); c.fill();
    c.lineWidth = 0.06; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = '#333'; c.lineWidth = 0.06;
    line(c, x + 0.3, L.top - 1.0, x + 0.3, L.top - 1.6);
    line(c, x + 0.3, L.top - 1.6, x + 0.55, L.top - 1.6);
  },
  propeller(c, L, o) {
    const x = L.bx - 0.25, y = (L.top + L.bottom) / 2;
    const s = Math.sin((o.t || 0) * 3);
    c.fillStyle = '#9a7a3a';
    c.beginPath(); c.ellipse(x - 0.15, y - 0.4 * s, 0.1, 0.4 * Math.abs(s) + 0.05, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(x - 0.15, y + 0.4 * s, 0.1, 0.4 * Math.abs(s) + 0.05, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#333'; c.fillRect(x - 0.3, y - 0.06, 0.4, 0.12);
  },
  fin(c, L) {
    const x = L.bx + 0.3, y = L.top + 0.2;
    const p = new Path2D();
    p.moveTo(x, y); p.lineTo(x - 0.3, y - 1.5); p.lineTo(x + 0.5, y - 1.5); p.lineTo(x + 1.6, y); p.closePath();
    c.fillStyle = L.def.col.trim; c.fill(p);
    c.lineWidth = 0.05; c.strokeStyle = OUT; c.stroke(p);
  },
  rotor(c, L, o) {
    const x = L.bx + L.bw * 0.5, y = L.top - 0.35;
    c.fillStyle = '#333'; c.fillRect(x - 0.08, y, 0.16, 0.35);
    c.fillRect(x - L.bw * 0.7, y - 0.05, L.bw * 1.4, 0.07);
  },
  tailboom(c, L) {
    const y = (L.top + L.bottom) / 2 - 0.2;
    const p = new Path2D();
    p.moveTo(L.bx + 0.3, y - 0.3); p.lineTo(L.bx - 1.6, y - 0.1); p.lineTo(L.bx - 1.6, y + 0.1); p.lineTo(L.bx + 0.3, y + 0.3); p.closePath();
    c.fillStyle = L.def.col.body; c.fill(p); c.lineWidth = 0.05; c.strokeStyle = OUT; c.stroke(p);
    c.strokeStyle = '#333'; c.lineWidth = 0.05; line(c, L.bx - 1.5, y - 0.6, L.bx - 1.5, y + 0.5);
  },
  chimney(c, L, o) {
    const x = L.tx1 - Math.min(1.2, (L.tx1 - L.tx0) * 0.25), y = L.top - 0.2;
    const h = Math.max(0.9, (y - (L.apex ?? L.top)) * 0.8 + 0.6);
    c.fillStyle = '#8a4a3a'; c.fillRect(x - 0.2, y - h, 0.4, h);
    c.lineWidth = 0.04; c.strokeStyle = OUT; c.strokeRect(x - 0.2, y - h, 0.4, h);
    c.fillStyle = '#5a3a2a'; c.fillRect(x - 0.25, y - h - 0.08, 0.5, 0.1);
    smoke(c, x, y - h - 0.2, o, 0.7);
  },
  satdish(c, L) {
    const x = L.tx0 + 0.7, y = L.top - 0.08;
    c.strokeStyle = '#888'; c.lineWidth = 0.04; line(c, x, y, x, y - 0.3);
    c.beginPath(); c.ellipse(x - 0.05, y - 0.45, 0.25, 0.12, -0.6, 0, Math.PI * 2);
    c.fillStyle = '#ddd'; c.fill(); c.lineWidth = 0.03; c.strokeStyle = OUT; c.stroke();
  },
  hayloft(c, L) {
    const x = 0, y = L.top - 0.75;
    c.fillStyle = '#5a1f18'; c.fillRect(x - 0.4, y - 0.5, 0.8, 0.6);
    c.strokeStyle = '#efe8da'; c.lineWidth = 0.04; c.strokeRect(x - 0.4, y - 0.5, 0.8, 0.6);
    line(c, x - 0.4, y - 0.5, x + 0.4, y + 0.1); line(c, x + 0.4, y - 0.5, x - 0.4, y + 0.1);
  },
  domeLines(c, L) {
    shellOnly(c, L, () => {
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.025;
      for (let i = -8; i <= 8; i++) { line(c, i * 0.7, L.bottom, i * 0.7 + 3, L.top - 2); line(c, i * 0.7, L.bottom, i * 0.7 - 3, L.top - 2); }
    });
  },
  domeBlocks(c, L) {
    shellOnly(c, L, () => {
      c.strokeStyle = 'rgba(80,110,130,0.35)'; c.lineWidth = 0.025;
      let row = 0;
      for (let y = L.bottom; y > L.top - 0.5; y -= 0.3, row++) {
        line(c, -10, y, 10, y);
        for (let x = -6 + (row % 2) * 0.3; x < 6; x += 0.6) line(c, x, y, x, y - 0.3);
      }
    });
  },
  clock(c, L, o) {
    const b = L.belfry;
    const x = b ? b.x + b.w / 2 : 0, y = b ? b.y + b.h / 2 : L.top - 0.5, r = b ? b.w * 0.38 : 0.4;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = '#f4ecd8'; c.fill();
    c.lineWidth = 0.04; c.strokeStyle = OUT; c.stroke();
    const hr = ((o.hour || 0) % 12) / 12 * Math.PI * 2, mn = ((o.hour || 0) % 1) * Math.PI * 2;
    c.strokeStyle = '#222'; c.lineWidth = 0.04;
    line(c, x, y, x + Math.sin(hr) * r * 0.5, y - Math.cos(hr) * r * 0.5);
    c.lineWidth = 0.025;
    line(c, x, y, x + Math.sin(mn) * r * 0.8, y - Math.cos(mn) * r * 0.8);
    if ((o.night || 0) > 0.3) o.lights.push({ x, y, r: 1.2, color: '#fff2c8', k: 0.5 });
  },
  windmill(c, L, o) {
    const x = 0, y = L.top - 0.4;
    c.save();
    c.translate(x, y);
    c.rotate((o.t || 0) * 0.35);
    for (let i = 0; i < 4; i++) {
      c.rotate(Math.PI / 2);
      c.fillStyle = '#5a3d26'; c.fillRect(-0.05, 0, 0.1, 3.0);
      c.fillStyle = 'rgba(236,226,200,0.92)'; c.fillRect(0.06, 0.6, 0.45, 2.3);
      c.strokeStyle = '#5a3d26'; c.lineWidth = 0.025;
      for (let k = 0.8; k < 2.9; k += 0.35) line(c, 0.06, k, 0.51, k);
      c.strokeRect(0.06, 0.6, 0.45, 2.3);
    }
    c.restore();
    c.beginPath(); c.arc(x, y, 0.18, 0, Math.PI * 2); c.fillStyle = '#3a2818'; c.fill();
  },
  antenna(c, L, o) {
    const x = L.tx1 - 1.0, y = L.top - 0.08, h = 2.8;
    c.strokeStyle = '#b5302b'; c.lineWidth = 0.05;
    line(c, x - 0.3, y, x, y - h); line(c, x + 0.3, y, x, y - h);
    for (let k = 0.3; k < h; k += 0.35) {
      const w = 0.3 * (1 - k / h);
      line(c, x - w, y - k, x + w, y - k - 0.35);
    }
    const on = Math.sin((o.t || 0) * 3) > 0.3;
    c.beginPath(); c.arc(x, y - h, 0.07, 0, Math.PI * 2); c.fillStyle = on ? '#ff4a3a' : '#7a2a20'; c.fill();
    if (on && (o.night || 0) > 0.2) o.lights.push({ x, y: y - h, r: 0.8, color: '#ff4a3a', k: 0.8 });
  },
  eaves(c, L) {
    for (let i = 0; i < L.rooms.length - 1; i++) {
      const rm = L.rooms[i];
      eave(c, 0, rm.y - SLAB * 0.3, rm.w + WALL * 2 + 1.2, 0.5, L.def.col.roof);
    }
  },
  ropeLadder(c, L) {
    const x = L.bx + 0.6;
    c.strokeStyle = '#a8865a'; c.lineWidth = 0.03;
    line(c, x, L.bottom, x - 0.05, -0.1);
    line(c, x + 0.3, L.bottom, x + 0.25, -0.1);
    c.lineWidth = 0.035;
    for (let y = L.bottom + 0.3; y < -0.1; y += 0.3) line(c, x, y, x + 0.3, y);
  },
  vines(c, L, o) {
    c.strokeStyle = '#4a7f33'; c.lineWidth = 0.035;
    for (let i = 0; i < 6; i++) {
      const x = L.bx + 0.1 + (i / 5) * (L.bw - 0.2);
      const len = 0.4 + ((i * 37) % 5) * 0.12;
      const sw = Math.sin((o.t || 0) * 0.7 + i) * 0.03;
      c.beginPath(); c.moveTo(x, L.top); c.quadraticCurveTo(x + sw, L.top + len / 2, x + sw * 2, L.top + len); c.stroke();
      c.beginPath(); c.arc(x + sw * 2, L.top + len, 0.05, 0, Math.PI * 2); c.fillStyle = '#5f9a3e'; c.fill();
    }
  },
  bell(c, L) {
    const x = (L.tx0 + L.tx1) / 2 - (L.def.roof === 'spire' ? 0 : 0.8);
    if (L.def.roof === 'spire' && L.belfry) {
      const b = L.belfry;
      c.fillStyle = '#c9a227';
      c.beginPath(); c.moveTo(b.x + b.w / 2 - 0.15, b.y + b.h - 0.1); c.quadraticCurveTo(b.x + b.w / 2, b.y + 0.2, b.x + b.w / 2 + 0.15, b.y + b.h - 0.1); c.fill();
      return;
    }
    const y = L.top - 0.08;
    c.fillStyle = L.def.col.trim; c.fillRect(x - 0.35, y - 0.9, 0.7, 0.9);
    c.strokeStyle = OUT; c.lineWidth = 0.04; c.strokeRect(x - 0.35, y - 0.9, 0.7, 0.9);
    c.fillStyle = '#c9a227';
    c.beginPath(); c.moveTo(x - 0.18, y - 0.2); c.quadraticCurveTo(x, y - 0.85, x + 0.18, y - 0.2); c.fill();
  },
  helipad(c, L, o) {
    const y = L.top - 0.06;
    c.fillStyle = '#5a5a58'; c.fillRect(L.tx0 + 0.3, y - 0.08, 2.0, 0.1);
    for (let i = 0; i < 4; i++) {
      c.beginPath(); c.arc(L.tx0 + 0.4 + i * 0.6, y - 0.1, 0.04, 0, Math.PI * 2);
      c.fillStyle = (o.night || 0) > 0.3 ? '#9dff9a' : '#6a8a6a'; c.fill();
    }
  },
  columns(c, L) {
    for (const x of [L.bx - 0.3, L.bx + L.bw + 0.05]) {
      c.fillStyle = '#e8e2d0'; c.fillRect(x, L.top - 0.05, 0.28, L.bottom - L.top + 0.05);
      c.strokeStyle = OUT; c.lineWidth = 0.03; c.strokeRect(x, L.top - 0.05, 0.28, L.bottom - L.top + 0.05);
      c.strokeStyle = 'rgba(0,0,0,0.15)';
      line(c, x + 0.09, L.top, x + 0.09, L.bottom); line(c, x + 0.19, L.top, x + 0.19, L.bottom);
    }
  },
  flare(c, L, o) {
    const x = L.tx0 + 0.5, y = L.top - 0.05;
    c.strokeStyle = '#8a8a84'; c.lineWidth = 0.1; line(c, x, y, x - 0.6, y - 1.6);
    const fl = 0.8 + 0.2 * Math.sin((o.t || 0) * 9);
    c.beginPath(); c.moveTo(x - 0.75, y - 1.6); c.quadraticCurveTo(x - 0.6, y - 2.2 * fl - 0.2, x - 0.45, y - 1.6);
    c.fillStyle = '#ff9a3c'; c.fill();
    o.lights.push({ x: x - 0.6, y: y - 1.8, r: 2.5, color: '#ff8a3c', k: 0.8 * fl });
  },
  teapot(c, L) {
    const col = L.def.col;
    const b = L.bottom;
    const p = new Path2D();
    p.moveTo(L.bx + L.bw - 0.4, b - 0.5);
    p.quadraticCurveTo(L.bx + L.bw + 0.7, b - 0.4, L.bx + L.bw + 1.3, b - 1.7);
    p.lineTo(L.bx + L.bw + 1.0, b - 1.75);
    p.quadraticCurveTo(L.bx + L.bw + 0.5, b - 0.9, L.bx + L.bw - 0.3, b - 1.1);
    p.closePath();
    c.fillStyle = col.body; c.fill(p); c.lineWidth = 0.06; c.strokeStyle = OUT; c.stroke(p);
    c.beginPath(); c.arc(L.bx - 0.15, b - L.bh * 0.5, 0.65, Math.PI * 0.5, Math.PI * 1.5);
    c.lineWidth = 0.22; c.strokeStyle = col.trim; c.stroke();
    c.beginPath(); c.ellipse(0, L.top + 0.05, 0.9, 0.22, 0, Math.PI, 0); c.fillStyle = col.trim; c.fill();
    c.beginPath(); c.arc(0, L.top - 0.25, 0.14, 0, Math.PI * 2); c.fill();
  },
};

function shellOnly(c, L, fn) {
  c.save();
  c.clip(L._body);
  const ex = new Path2D();
  ex.rect(-50, -50, 100, 100);
  for (const rm of L.rooms) ex.rect(rm.x - 0.03, rm.y - 0.03, rm.w + 0.06, rm.h + 0.06);
  c.clip(ex, 'evenodd');
  fn();
  c.restore();
}

// ---------------------------------------------------------------------------
// Hit testing

export function hitCell(L, x, y) {
  for (const rm of L.rooms) {
    if (x >= rm.x && x < rm.x + rm.w && y >= rm.y && y <= rm.fy) {
      const col = Math.floor(x - rm.x);
      const layer = y < rm.y + BAND_TOP + BAND_H - 0.12 ? 'wall' : 'floor';
      return { f: rm.i, c: col, layer, rm };
    }
  }
  return null;
}
