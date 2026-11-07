// Draws the living station: the painting plus everything that moves on it.
// Every effect is a pure function of the time `t` (seconds) and the world's
// state, so the same moment can be drawn again at any size: on screen, or
// twice for the closed-screen and open-screen wallpaper clips.
import { HULL, SHAFT, TANKS, STEAM, ZONES } from '../data/world.js';

const TAU = Math.PI * 2;

// Cheap repeatable noise.
function hash(a, b = 0) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const glowCache = new Map();
function glowSprite(rgb) {
  const key = rgb.map(c => Math.round(c / 32)).join(',');
  if (glowCache.has(key)) return glowCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const [r, gg, b] = rgb;
  grad.addColorStop(0, `rgba(${Math.min(255, r + 60)},${Math.min(255, gg + 60)},${Math.min(255, b + 60)},0.9)`);
  grad.addColorStop(0.25, `rgba(${r},${gg},${b},0.45)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(key, c);
  return c;
}

// Twinkling stars, over the painting and the open sky past its edges (a tall
// phone screen shows more sky than the painting holds).
const SKY = { x0: -700, y0: -1500, x1: 2524, y1: 2780 };
let skyStars = null;
function stars() {
  if (skyStars) return skyStars;
  skyStars = [];
  for (let i = 0; skyStars.length < 420 && i < 8000; i++) {
    const x = SKY.x0 + hash(i, 1) * (SKY.x1 - SKY.x0), y = SKY.y0 + hash(i, 2) * (SKY.y1 - SKY.y0);
    if (Math.hypot(x - HULL.x, y - HULL.y) < HULL.r + 8) continue;
    skyStars.push({ x, y, ph: hash(i, 3) * TAU, sp: 0.4 + hash(i, 4) * 1.6, big: hash(i, 5) > 0.85 });
  }
  return skyStars;
}

// Faint still stars beyond the painting, like the painted ones.
let outerStars = null;
function farStars() {
  if (outerStars) return outerStars;
  outerStars = [];
  for (let i = 0; outerStars.length < 900 && i < 20000; i++) {
    const x = SKY.x0 + hash(i, 71) * (SKY.x1 - SKY.x0), y = SKY.y0 + hash(i, 72) * (SKY.y1 - SKY.y0);
    if (x >= 0 && x <= 1824 && y >= 0 && y <= 1280) continue;
    outerStars.push({ x, y, a: 0.25 + hash(i, 73) * 0.6, s: hash(i, 74) > 0.9 ? 2 : 1.2 });
  }
  return outerStars;
}

function hullPath(ctx, r = HULL.r - 26) {
  ctx.beginPath();
  ctx.arc(HULL.x, HULL.y, r, 0, TAU);
}

/**
 * Draw the world into ctx.
 *  view:  {sx, sy, sw, sh} — the part of the painting to show, in painting pixels
 *  out:   {w, h} — output size in canvas pixels
 *  look:  per-frame state from the simulation (see app.js lookFor)
 *  opts:  {ui: true} draws the care hints that should never be in a wallpaper
 */
export function drawWorld(ctx, img, lights, view, out, t, look, opts = {}) {
  const k = out.w / view.sw;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = look.sky || '#05070d';
  ctx.fillRect(0, 0, out.w, out.h);
  ctx.setTransform(k, 0, 0, k, -view.sx * k, -view.sy * k);
  if (look.sky) {
    ctx.fillStyle = '#dfe4f2';
    for (const s of farStars()) {
      if (s.x < view.sx - 4 || s.x > view.sx + view.sw + 4 || s.y < view.sy - 4 || s.y > view.sy + view.sh + 4) continue;
      ctx.globalAlpha = s.a;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(img, 0, 0);
  if (look.agents && look.sprites) drawAgents(ctx, look.agents, look.sprites, opts.selected);

  const { power, overall, zones, night } = look;

  // Whole-station mood: darker as power falls, greyer as morale falls, a touch dimmer at night.
  const dim = Math.max(0, (60 - power) / 60) * 0.55 + (night ? 0.12 : 0);
  if (dim > 0.01) {
    ctx.save(); hullPath(ctx, HULL.r - 10); ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(40,46,80,${Math.min(0.85, dim)})`;
    ctx.fillRect(HULL.x - HULL.r, HULL.y - HULL.r, HULL.r * 2, HULL.r * 2);
    ctx.restore();
  }
  const grey = Math.max(0, (50 - look.fun) / 50) * 0.5;
  if (grey > 0.01) {
    ctx.save(); hullPath(ctx, HULL.r - 10); ctx.clip();
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = grey;
    ctx.fillStyle = 'hsl(0,0%,50%)';
    ctx.fillRect(HULL.x - HULL.r, HULL.y - HULL.r, HULL.r * 2, HULL.r * 2);
    ctx.restore();
  }

  // Places that need you look it; places left too long shut down.
  for (const z of ZONES) {
    const s = zones[z.id];
    if (!s) continue;
    const [x0, y0, x1, y1] = z.box;
    if (s.dark) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(3,5,10,0.84)';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      const on = (t * 0.9 + hash(z.box[0])) % 1 < 0.5;
      if (on) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8;
        ctx.drawImage(glowSprite([255, 40, 30]), x0 + 6, y0 + 6, 22, 22);
        ctx.globalAlpha = 1;
      }
    } else if (s.level < 45) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(8,10,22,${((45 - s.level) / 45) * 0.55})`;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  // Lamps, lanterns, screens and antenna beacons.
  ctx.globalCompositeOperation = 'lighter';
  const pf = Math.max(0, Math.min(1, power / 100));
  for (let i = 0; i < lights.length; i++) {
    const L = lights[i];
    let a;
    if (L.k === 'beacon') {
      a = (t * 0.7 + hash(i, 9)) % 1 < 0.14 ? 1 : 0.12;
    } else {
      const zone = L.z ? zones[L.z] : null;
      if (zone && zone.dark) continue;
      if (pf < hash(i, 7) * 0.55) continue;            // lights drop out one by one as power falls
      a = 0.42 + 0.1 * Math.sin(t * (0.8 + hash(i, 8)) + i);
      const shaky = (1 - pf) * 0.5 + (zone && zone.level < 45 ? 0.35 : 0);
      if (shaky > 0 && hash(Math.floor(t * 14), i) < shaky * 0.35) a *= 0.15;
      if (night) a *= 1.15;
      a *= 0.55 + 0.45 * pf;
    }
    ctx.globalAlpha = Math.min(1, a);
    const r = L.r * (L.k === 'beacon' ? 2.2 : 2.6);
    ctx.drawImage(glowSprite(L.c), L.x - r, L.y - r, r * 2, r * 2);
  }

  // Elevator cars gliding up and down the glass shaft.
  for (let e = 0; e < 2; e++) {
    const p = 0.5 + 0.5 * Math.sin(t * (0.16 + e * 0.05) + e * 2.1);
    const y = SHAFT.y0 + 40 + p * (SHAFT.y1 - SHAFT.y0 - 120);
    const x = (SHAFT.x0 + SHAFT.x1) / 2;
    ctx.globalAlpha = 0.35 * (0.4 + 0.6 * pf);
    ctx.drawImage(glowSprite([170, 220, 255]), x - 30, y - 46, 60, 92);
  }

  // Bubbles in the office fish tanks (the original painting only).
  if (look.classic && !(zones.office && zones.office.dark)) {
    ctx.globalCompositeOperation = 'source-over';
    const [bx0, by0, bx1, by1] = TANKS;
    for (let i = 0; i < 16; i++) {
      const sp = 0.06 + hash(i, 11) * 0.08;
      const p = (t * sp + hash(i, 12)) % 1;
      const x = bx0 + hash(i, 13) * (bx1 - bx0) + Math.sin(t * 2 + i) * 1.5;
      const y = by1 - p * (by1 - by0);
      ctx.globalAlpha = 0.55 * (1 - p * 0.6);
      ctx.strokeStyle = '#dff6ff';
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(x, y, 0.9 + hash(i, 14) * 1.6, 0, TAU); ctx.stroke();
    }
  }

  // Steam over the dumpling baskets, only while there's food to cook.
  if (look.classic && look.food > 25 && !(zones.dumpling && zones.dumpling.dark)) {
    ctx.globalCompositeOperation = 'lighter';
    const [sx0, sy0, sx1] = STEAM;
    for (let i = 0; i < 12; i++) {
      const p = (t * 0.18 + hash(i, 21)) % 1;
      const x = sx0 + hash(i, 22) * (sx1 - sx0) + Math.sin(t * 0.8 + i) * 4 * p;
      const y = sy0 + 20 - p * 46;
      ctx.globalAlpha = 0.16 * Math.sin(p * Math.PI);
      const r = 6 + p * 12;
      ctx.drawImage(glowSprite([235, 235, 235]), x - r, y - r, r * 2, r * 2);
    }
  }

  // Stale air: dust drifting through the station.
  if (look.air < 40) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#d8d0b0';
    const n = Math.round((40 - look.air) * 2.2);
    for (let i = 0; i < n; i++) {
      const x = HULL.x - HULL.r * 0.8 + hash(i, 31) * HULL.r * 1.6 + Math.sin(t * 0.3 + i) * 12;
      const y = HULL.y - HULL.r * 0.85 + ((hash(i, 32) + t * 0.01 * (0.5 + hash(i, 33))) % 1) * HULL.r * 1.6;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t + i);
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }

  // Sky: twinkling stars, a shuttle now and then, the odd shooting star.
  ctx.globalCompositeOperation = 'lighter';
  for (const s of stars()) {
    const tw = Math.pow(Math.max(0, Math.sin(t * s.sp + s.ph)), 6);
    if (tw < 0.05) continue;
    ctx.globalAlpha = tw * (s.big ? 0.9 : 0.6);
    const r = s.big ? 7 : 4;
    ctx.drawImage(glowSprite([220, 230, 255]), s.x - r, s.y - r, r * 2, r * 2);
  }
  const lap = 26, n = Math.floor(t / lap), lp = (t % lap) / 9;
  if (lp < 1) {
    const dir = hash(n, 41) > 0.5 ? 1 : -1;
    const y = 40 + hash(n, 42) * 240;
    const x = dir > 0 ? -60 + lp * 1940 : 1880 - lp * 1940;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(glowSprite([120, 200, 255]), x - dir * 22 - 10, y - 10, 20, 20);
    ctx.globalAlpha = 0.8;
    ctx.drawImage(glowSprite([255, 250, 240]), x - 5, y - 5, 10, 10);
  }
  const sl = 41, sn = Math.floor(t / sl), sp = (t % sl);
  if (sp < 0.9) {
    const x0 = 100 + hash(sn, 51) * 1500, y0 = 20 + hash(sn, 52) * 150;
    const len = sp / 0.9;
    ctx.globalAlpha = 0.7 * (1 - len);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + len * 140, y0 + len * 50); ctx.stroke();
  }

  // Thriving: sparkles and a warm glow around the hull.
  if (overall >= 75) {
    for (let i = 0; i < 26; i++) {
      const tw = Math.pow(Math.max(0, Math.sin(t * (0.7 + hash(i, 61)) + hash(i, 62) * TAU)), 10);
      if (tw < 0.05) continue;
      const a = hash(i, 63) * TAU, d = hash(i, 64) * (HULL.r - 60);
      ctx.globalAlpha = tw * 0.8;
      ctx.drawImage(glowSprite([255, 236, 170]), HULL.x + Math.cos(a) * d - 8, HULL.y + Math.sin(a) * d - 8, 16, 16);
    }
  }

  // In trouble: a slow red alarm pulse at the hull's edge.
  if (overall < 25) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18 + 0.18 * Math.sin(t * 2.4);
    ctx.strokeStyle = 'rgb(255,50,40)';
    ctx.lineWidth = 26;
    hullPath(ctx, HULL.r - 18); ctx.stroke();
  }

  // Care hints, on screen only: a marker on every place you can look after,
  // and a soft pulse around the ones that need you.
  if (opts.ui) {
    const px = (opts.px || 1) / k;                       // one screen pixel, in painting pixels
    ctx.globalCompositeOperation = 'source-over';
    for (const z of ZONES) {
      const s = zones[z.id];
      if (!s) continue;
      const mx = z.box[0] + 16 * px, my = z.box[1] + 16 * px;
      const low = s.dark || s.level < 40;
      const r = (low ? 9 + 2 * Math.sin(t * 4) : 7) * px;
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = s.dark ? '#ff6b5e' : (opts.colors && opts.colors[z.meter]) || '#ffffff';
      ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.fill();
      ctx.lineWidth = 2 * px; ctx.strokeStyle = 'rgba(5,7,13,0.9)'; ctx.stroke();
      if (low) {
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 4);
        ctx.strokeStyle = s.dark ? '#ff6b5e' : '#ffb45e';
        ctx.beginPath(); ctx.arc(mx, my, r + 6 * px, 0, TAU); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const z of ZONES) {
      const s = zones[z.id];
      if (!s || (!s.dark && s.level >= 40) || (opts.focus && opts.focus !== z.meter)) continue;
      const [x0, y0, x1, y1] = z.box;
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 3);
      ctx.strokeStyle = s.dark ? '#ff6b5e' : '#ffb45e';
      ctx.lineWidth = 3 / k * 2;
      ctx.setLineDash([10 / k * 2, 7 / k * 2]);
      ctx.strokeRect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4);
      ctx.setLineDash([]);
    }
    if (opts.focus) {
      for (const z of ZONES) {
        if (z.meter !== opts.focus) continue;
        const [x0, y0, x1, y1] = z.box;
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#7fdcc9';
        ctx.lineWidth = 3 / k * 2;
        ctx.strokeRect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4);
      }
    }
    if (opts.after) { ctx.globalCompositeOperation = 'source-over'; opts.after(ctx, px); }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// Tag each light with the zone it sits in, so a dark zone's lights go out.
export function assignZones(lights) {
  for (const L of lights) {
    const z = ZONES.find(z => L.x >= z.box[0] && L.x <= z.box[2] && L.y >= z.box[1] && L.y <= z.box[3]);
    if (z) L.z = z.id;
  }
  return lights;
}

// The residents, drawn into the painting so the station's lighting and mood
// fall on them like everything else.
function drawAgents(ctx, agents, sprites, selected) {
  ctx.globalCompositeOperation = 'source-over';
  for (const a of agents) {
    const sp = sprites[a.sprite];
    if (!sp || !sp.img.complete) continue;
    const f = sp.frames[a.frame] || sp.frames.stand || sp.frames.sit || Object.values(sp.frames)[0];
    if (!f) continue;
    const sc = a.scale || 1;
    const w = f[2] / sp.res * sc, h = f[3] / sp.res * sc;
    const fx = a.x, fy = a.y - a.bob;
    if (!a.glass && a.kind !== 'robot' && a.kind !== 'prop') {
      ctx.globalAlpha = 0.32 * a.alpha;
      ctx.fillStyle = '#05070d';
      ctx.beginPath(); ctx.ellipse(a.x, a.y + 0.5, w * 0.36, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = a.alpha;
    ctx.save();
    ctx.translate(fx, fy);
    if (a.flip) ctx.scale(-1, 1);
    ctx.drawImage(sp.img, f[0], f[1], f[2], f[3], -w / 2, -h, w, h);
    ctx.restore();
    if (selected && selected === a.id) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#7fdcc9';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(a.x, a.y + 1, w * 0.5, 4, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
