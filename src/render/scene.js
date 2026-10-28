import { hex, mix, rgba, lerp, clamp, smooth, hash1, rr } from '../util.js';
import { drawBase, layoutBase, FLOOR_H, BAND_TOP, BAND_H } from './shell.js';

const SKY = [
  [0, '#0a0f1e', '#1b2338'],
  [4.5, '#0d1324', '#252e48'],
  [6, '#3c4a72', '#d99a7a'],
  [7.5, '#8aa3bd', '#e6d4bc'],
  [10, '#9fb6c6', '#dfe5e3'],
  [16, '#a3b6c4', '#e2e2da'],
  [18.5, '#5a6890', '#e5946a'],
  [20, '#1c2440', '#4a4560'],
  [21.5, '#0a0f1e', '#1b2338'],
  [24, '#0a0f1e', '#1b2338'],
].map(([h, a, b]) => [h, hex(a), hex(b)]);

export function skyAt(hour) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, t0, b0] = SKY[i], [h1, t1, b1] = SKY[i + 1];
    if (hour >= h0 && hour <= h1) {
      const k = (hour - h0) / (h1 - h0);
      return { top: mix(t0, t1, k), hor: mix(b0, b1, k) };
    }
  }
  return { top: SKY[0][1], hor: SKY[0][2] };
}

export function darkness(hour) {
  return 1 - smooth(4.8, 7.2, hour) + smooth(18.2, 20.8, hour);
}

const ENV = {
  rail: { ground: '#6a6f5a', far: '#6f7d78', kind: 'trees' },
  road: { ground: '#5f6458', far: '#6f7a78', kind: 'trees' },
  town: { ground: '#64645e', far: '#6c7378', kind: 'city' },
  field: { ground: '#6f7f4f', far: '#7b8a80', kind: 'hills' },
  forest: { ground: '#4f6040', far: '#55685c', kind: 'pines' },
  water: { ground: '#4d6f80', far: '#7d8c90', kind: 'sea', water: true },
  coast: { ground: '#4d6f80', far: '#7d8c90', kind: 'sea', water: true, sand: true },
  swamp: { ground: '#4a5a44', far: '#5b6a5a', kind: 'deadtrees', water: true, murky: true },
  snow: { ground: '#dfe6ea', far: '#a9b8c2', kind: 'pines', snow: true },
  desert: { ground: '#c9a874', far: '#c8a98a', kind: 'dunes' },
  mountain: { ground: '#6a6a5e', far: '#7a8590', kind: 'peaks' },
  tunnel: { ground: '#3a3836', far: '#2a2826', kind: 'tunnel' },
};

export class Scene {
  constructor(canvas) {
    this.cv = canvas;
    this.c = canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.lc = this.light.getContext('2d');
    this.fog = makeFogTexture();
    this.drops = [];
  }

  resize(W, H, dpr) {
    this.W = W; this.H = H; this.dpr = dpr;
    this.cv.width = Math.round(W * dpr);
    this.cv.height = Math.round(H * dpr);
    this.light.width = this.cv.width;
    this.light.height = this.cv.height;
    this.drops = [];
    for (let i = 0; i < 140; i++) this.drops.push({ x: Math.random() * W, y: Math.random() * H, v: 0.7 + Math.random() * 0.6 });
  }

  render(v) {
    const { c, W, H, dpr } = this;
    const { cam, def, L, hour, t } = v;
    const env = ENV[def.env] || ENV.field;
    const dark = darkness(hour);
    const sky = skyAt(hour);
    const s = cam.s;
    const toSX = x => W / 2 + (x - cam.x) * s;
    const toSY = y => H / 2 + (y - cam.y) * s;
    const gy = toSY(0);
    const fogCol = mix(sky.hor, [120, 130, 140], 0.3);
    const underground = def.support && def.support.type === 'underground';

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';

    // sky
    if (env.kind === 'tunnel') {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#141312'); g.addColorStop(1, '#2a2826');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    } else {
      const g = c.createLinearGradient(0, gy - 9 * s, 0, gy);
      g.addColorStop(0, rgba(sky.top));
      g.addColorStop(1, rgba(sky.hor));
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      if (dark > 0.5) drawStars(c, W, gy, (dark - 0.5) * 2, t);
    }

    // far layers
    c.save();
    c.translate(W / 2, gy);
    drawFar(c, env, s, cam.x, sky, dark, W, t);
    c.restore();

    // ground
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - cam.x * s), dpr * (H / 2 - cam.y * s));
    const vx0 = cam.x - W / 2 / s - 1, vx1 = cam.x + W / 2 / s + 1;
    const vy1 = cam.y + H / 2 / s + 1;
    drawGround(c, env, vx0, vx1, vy1, sky, underground, t);

    // zombies behind the base
    const zs = (v.zombies || []).slice().sort((a, b) => a.y - b.y);
    const eyes = [];
    for (const z of zs) if (z.lane !== 'front') drawZombie(c, z, env, fogCol, dark, eyes);

    // back fog
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFog(c, this.fog, W, gy, s, cam.x, t, fogCol, 0.32 - dark * 0.12, 0.25, env);

    // base
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - cam.x * s), dpr * (H / 2 - cam.y * s));
    const o = {
      t, hour, night: dark, daylight: 1 - dark, lights: [], items: v.items, people: v.people,
      powered: v.powered, rain: v.rain,
    };
    drawBase(c, L, o);
    drawFront(c, env, vx0, vx1, vy1, t, L);
    o.lights.push(...eyes);

    // weather
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (v.rain && env.kind !== 'tunnel' && !underground) drawRain(c, this.drops, W, H, env.snow, t);

    // lighting
    if (dark > 0.02) {
      const lc = this.lc;
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = 'source-over';
      lc.clearRect(0, 0, this.light.width, this.light.height);
      lc.fillStyle = `rgba(6,10,26,${0.74 * dark})`;
      lc.fillRect(0, 0, this.light.width, this.light.height);
      lc.globalCompositeOperation = 'destination-out';
      lc.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const rm of L.rooms) {
        lc.fillStyle = 'rgba(0,0,0,0.32)';
        lc.fillRect(toSX(rm.x), toSY(rm.y), rm.w * s, rm.h * s);
      }
      for (const lt of o.lights) {
        const x = toSX(lt.x), y = toSY(lt.y), r = lt.r * s;
        const g = lc.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${clamp(lt.k, 0, 1)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lc.fillStyle = g;
        lc.fillRect(x - r, y - r, r * 2, r * 2);
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(this.light, 0, 0);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalCompositeOperation = 'lighter';
      for (const lt of o.lights) {
        const x = toSX(lt.x), y = toSY(lt.y), r = lt.r * s * 0.8;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        const col = hex(lt.color);
        g.addColorStop(0, rgba(col, 0.22 * lt.k * (0.3 + dark)));
        g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
      if (o.beam) {
        const x = toSX(o.beam.x), y = toSY(o.beam.y);
        const dir = Math.cos(o.beam.a) > 0 ? 1 : -1;
        const spread = Math.abs(Math.cos(o.beam.a));
        const len = W * 1.2 * spread;
        const g = c.createLinearGradient(x, y, x + dir * len, y);
        g.addColorStop(0, `rgba(255,240,190,${0.35 * dark})`);
        g.addColorStop(1, 'rgba(255,240,190,0)');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + dir * len, y - len * 0.12); c.lineTo(x + dir * len, y + len * 0.12); c.closePath(); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    }

    // moonlit mist along the ground so the horde reads as silhouettes
    if (dark > 0.05) {
      const my = gy + 0.4 * s, mh = 2.2 * s;
      const g = c.createLinearGradient(0, my - mh, 0, my + mh);
      g.addColorStop(0, 'rgba(110,125,155,0)');
      g.addColorStop(0.5, `rgba(110,125,155,${0.3 * dark})`);
      g.addColorStop(1, 'rgba(110,125,155,0)');
      c.fillStyle = g;
      c.fillRect(0, my - mh, W, mh * 2);
    }
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - cam.x * s), dpr * (H / 2 - cam.y * s));
    for (const z of zs) if (z.lane === 'front') drawZombie(c, z, env, fogCol, dark, null, true);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    // front fog, low and thin
    drawFog(c, this.fog, W, gy + 0.6 * s, s * 1.4, cam.x * 1.3, t * 1.4, mix(fogCol, [20, 25, 40], dark * 0.6), 0.16 * (1 - dark * 0.75), 0.18, env);

    if (v.build) drawBuildOverlay(c, L, v, toSX, toSY, s);
  }
}

function drawStars(c, W, gy, k, t) {
  c.fillStyle = '#fff';
  for (let i = 0; i < 70; i++) {
    const x = hash1(i) * W, y = hash1(i + 999) * gy * 0.8;
    c.globalAlpha = k * (0.3 + 0.5 * hash1(i + 50)) * (0.7 + 0.3 * Math.sin(t * 2 + i));
    c.fillRect(x, y, 1.4, 1.4);
  }
  c.globalAlpha = 1;
}

function drawFar(c, env, s, camX, sky, dark, W, t) {
  if (env.kind === 'tunnel') return;
  const layers = [
    { p: 0.15, sc: 0.35, col: mix(hex(env.far), sky.hor, 0.6) },
    { p: 0.35, sc: 0.55, col: mix(hex(env.far), sky.hor, 0.35) },
  ];
  for (const ly of layers) {
    const k = s * ly.sc;
    const off = -camX * s * ly.p;
    c.fillStyle = rgba(mix(ly.col, [10, 14, 26], dark * 0.55));
    const x0 = Math.floor((-W / 2 - off) / k) - 4, x1 = Math.ceil((W / 2 - off) / k) + 4;
    c.beginPath();
    c.moveTo(off + x0 * k, 2);
    switch (env.kind) {
      case 'trees': case 'pines': case 'deadtrees':
        for (let i = x0; i <= x1; i++) {
          const h = (env.kind === 'pines' ? 2.6 : 2.0) + hash1(i * 7 + ly.p * 100) * 1.6;
          if (env.kind === 'pines') {
            c.lineTo(off + i * k, -0.6 * k);
            c.lineTo(off + (i + 0.5) * k, -h * k);
            c.lineTo(off + (i + 1) * k, -0.6 * k);
          } else if (env.kind === 'deadtrees') {
            c.lineTo(off + i * k, -0.5 * k);
            if (i % 3 === 0) { c.lineTo(off + (i + 0.45) * k, -0.5 * k); c.lineTo(off + (i + 0.48) * k, -h * k); c.lineTo(off + (i + 0.55) * k, -0.5 * k); }
          } else {
            c.quadraticCurveTo(off + (i + 0.5) * k, -h * k - 0.6 * k, off + (i + 1) * k, -(1.4 + hash1(i * 3) * 0.8) * k);
          }
        }
        break;
      case 'city':
        for (let i = x0; i <= x1; i++) {
          const h = 1.5 + hash1(i * 13 + ly.p * 50) * 5;
          const broken = hash1(i * 5) > 0.6;
          c.lineTo(off + i * k, -h * k);
          if (broken) c.lineTo(off + (i + 0.4) * k, -(h - 0.8) * k);
          c.lineTo(off + (i + 0.85) * k, -h * k);
          c.lineTo(off + (i + 0.85) * k, -1 * k);
        }
        break;
      case 'hills': case 'dunes':
        for (let i = x0; i <= x1; i++) {
          const h = 0.8 + hash1(i * 11 + ly.p * 30) * 1.4;
          c.quadraticCurveTo(off + (i + 0.5) * k * 2, -h * 2 * k, off + (i + 1) * k * 2, -0.5 * k);
        }
        break;
      case 'peaks':
        for (let i = x0; i <= x1; i++) {
          const h = 3 + hash1(i * 17 + ly.p * 20) * 4;
          c.lineTo(off + (i + 0.5) * k * 2, -h * k);
          c.lineTo(off + (i + 1) * k * 2, -1.5 * k);
        }
        break;
      case 'sea':
        for (let i = x0; i <= x1; i += 3) {
          const h = hash1(i * 19) > 0.55 ? 0.6 + hash1(i) * 1.5 : 0.15;
          c.lineTo(off + i * k, -0.1 * k);
          c.quadraticCurveTo(off + (i + 1.5) * k, -h * k, off + (i + 3) * k, -0.1 * k);
        }
        break;
    }
    c.lineTo(off + x1 * k, 2);
    c.closePath();
    c.fill();
  }
  // poles along the line, like the reference art
  if (env.kind === 'trees' || env.kind === 'hills') {
    const k = s * 0.75;
    const off = -camX * s * 0.6;
    c.strokeStyle = rgba(mix(hex(env.far), [30, 30, 30], 0.5 + dark * 0.3), 0.7);
    c.lineWidth = Math.max(1, k * 0.05);
    for (let i = -8; i <= 8; i++) {
      const x = off + i * 6 * k;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, -4.2 * k); c.stroke();
      c.beginPath(); c.moveTo(x - 0.5 * k, -3.8 * k); c.lineTo(x + 0.5 * k, -3.8 * k); c.stroke();
      c.beginPath(); c.moveTo(x, -3.8 * k); c.quadraticCurveTo(x + 3 * k, -3.2 * k, x + 6 * k, -3.8 * k); c.stroke();
    }
  }
  void t;
}

function drawGround(c, env, x0, x1, y1, sky, underground, t) {
  if (env.kind === 'tunnel') {
    c.fillStyle = '#2f2d2b';
    c.fillRect(x0, -9, x1 - x0, 9);
    c.fillStyle = '#3d3a36';
    for (let x = Math.floor(x0 / 6) * 6; x < x1; x += 6) {
      c.fillRect(x, -9, 0.3, 9);
      c.beginPath(); c.arc(x + 3, -6, 0.12, 0, Math.PI * 2); c.fillStyle = '#e8d8a8'; c.fill(); c.fillStyle = '#3d3a36';
    }
    c.fillStyle = '#d9d4c3';
    c.fillRect(x0, -2.2, x1 - x0, 0.06);
  }
  const g = c.createLinearGradient(0, -0.6, 0, 3);
  const gc = hex(env.ground);
  g.addColorStop(0, rgba(mix(gc, sky.hor, 0.45)));
  g.addColorStop(0.3, rgba(gc));
  g.addColorStop(1, rgba(mix(gc, [0, 0, 0], 0.35)));
  c.fillStyle = g;
  c.fillRect(x0, -0.6, x1 - x0, y1 + 0.6);
  if (env.water) {
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 0.03;
    for (let y = -0.4; y < y1; y += 0.35) {
      const ph = t * 0.6 + y * 3;
      c.beginPath();
      for (let x = x0; x < x1; x += 0.5) c.lineTo(x, y + Math.sin(x * 1.3 + ph) * 0.04);
      c.stroke();
    }
    if (env.sand) {
      c.fillStyle = '#c9b48a';
      c.fillRect(x0, 0.25, x1 - x0, y1);
    }
    // a far shoreline for the horde to walk on
    c.fillStyle = rgba(mix(hex(env.far), sky.hor, 0.3));
    c.fillRect(x0, -0.62, x1 - x0, 0.12);
  }
  if (underground) {
    c.fillStyle = '#5e4a36';
    c.fillRect(x0, 0.05, x1 - x0, y1);
    c.fillStyle = '#4e3c2c';
    for (let y = 1.2; y < y1; y += 1.3) c.fillRect(x0, y, x1 - x0, 0.35);
    for (let i = 0; i < 60; i++) {
      const rx = x0 + hash1(i) * (x1 - x0), ry = 0.4 + hash1(i + 70) * (y1 - 0.4);
      c.beginPath(); c.ellipse(rx, ry, 0.15 + hash1(i + 3) * 0.2, 0.1, 0, 0, Math.PI * 2);
      c.fillStyle = '#7a6a58'; c.fill();
    }
    c.fillStyle = '#5f7a3a';
    c.fillRect(x0, -0.05, x1 - x0, 0.12);
  }
  if (env === ENV.rail || env.kind === 'tunnel') {
    // ballast + sleepers + rails
    c.fillStyle = env.kind === 'tunnel' ? '#45423e' : '#7a776e';
    c.fillRect(x0, -0.06, x1 - x0, 0.28);
    c.fillStyle = '#4a3a2c';
    for (let x = Math.floor(x0 / 0.6) * 0.6; x < x1; x += 0.6) c.fillRect(x, -0.08, 0.35, 0.1);
    c.fillStyle = '#8a8a88';
    c.fillRect(x0, -0.1, x1 - x0, 0.05);
  }
  if (env === ENV.road || env === ENV.town) {
    c.fillStyle = env === ENV.road ? '#4a4c4a' : '#56565a';
    c.fillRect(x0, -0.05, x1 - x0, 0.8);
    c.fillStyle = 'rgba(230,200,90,0.6)';
    for (let x = Math.floor(x0 / 2) * 2; x < x1; x += 2) c.fillRect(x, 0.4, 1, 0.05);
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.02;
    for (let i = 0; i < 12; i++) {
      const cx = x0 + hash1(i + 400) * (x1 - x0);
      c.beginPath(); c.moveTo(cx, 0.05); c.lineTo(cx + 0.3, 0.25); c.lineTo(cx + 0.15, 0.45); c.lineTo(cx + 0.5, 0.6); c.stroke();
    }
  }
  if (env.snow) {
    c.fillStyle = '#eef3f6';
    c.fillRect(x0, -0.08, x1 - x0, 0.15);
  }
}

function drawFront(c, env, x0, x1, y1, t, L) {
  if (env.water && !env.sand) {
    c.fillStyle = env.murky ? 'rgba(60,75,55,0.6)' : 'rgba(55,95,115,0.55)';
    c.beginPath();
    c.moveTo(x0, y1);
    for (let x = x0; x <= x1; x += 0.25) c.lineTo(x, 0.02 + Math.sin(x * 1.7 + t * 1.2) * 0.05);
    c.lineTo(x1, y1);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(230,240,245,0.5)';
    c.lineWidth = 0.035;
    c.beginPath();
    for (let x = x0; x <= x1; x += 0.25) c.lineTo(x, 0.02 + Math.sin(x * 1.7 + t * 1.2) * 0.05);
    c.stroke();
    if (env.murky) {
      c.strokeStyle = '#4a5a3a'; c.lineWidth = 0.04;
      for (let i = 0; i < 30; i++) {
        const rx = x0 + hash1(i + 33) * (x1 - x0);
        c.beginPath(); c.moveTo(rx, 0.3); c.quadraticCurveTo(rx + 0.05, -0.2, rx + 0.12 * Math.sin(t + i), -0.5 - hash1(i) * 0.4); c.stroke();
      }
    }
  } else if (env.sand) {
    c.fillStyle = 'rgba(55,95,115,0.45)';
    c.fillRect(x0, -0.1, x1 - x0, 0.35);
    c.fillStyle = '#cdb88e';
    c.beginPath();
    c.moveTo(x0, y1);
    for (let x = x0; x <= x1; x += 0.5) c.lineTo(x, 0.45 + Math.sin(x * 0.7) * 0.08);
    c.lineTo(x1, y1);
    c.closePath();
    c.fill();
  }
  void L;
}

function drawZombie(c, z, env, fogCol, dark, eyes, front = false) {
  const k = z.scale;
  const fogAmt = (1 - z.depth) * 0.75;
  // moonlit tint so silhouettes still read once the night overlay lands
  const col = front
    ? mix([44, 48, 42], [14, 16, 22], dark)
    : mix(mix([44, 48, 42], [150, 165, 150], dark * 0.6), fogCol, fogAmt);
  const ph = z.phase;
  const sw = Math.sin(ph) * 0.13;
  c.save();
  c.translate(z.x, z.y);
  c.scale(z.dir * k, k);
  c.globalAlpha = 0.95 - fogAmt * 0.3;
  c.strokeStyle = rgba(col);
  c.fillStyle = rgba(col);
  c.lineCap = 'round';
  c.lineWidth = 0.1;
  c.beginPath(); c.moveTo(-0.03, -0.45); c.lineTo(-0.05 + sw, -0.02); c.stroke();
  c.beginPath(); c.moveTo(0.05, -0.45); c.lineTo(0.06 - sw, -0.02); c.stroke();
  c.beginPath();
  c.moveTo(-0.12, -0.45); c.lineTo(0.12, -0.45); c.lineTo(0.2, -0.88); c.lineTo(-0.04, -0.92); c.closePath();
  c.fill();
  c.lineWidth = 0.07;
  const reach = Math.sin(ph * 0.5) * 0.04;
  c.beginPath(); c.moveTo(0.12, -0.82); c.lineTo(0.42, -0.74 + reach); c.stroke();
  c.beginPath(); c.moveTo(0.08, -0.78); c.lineTo(0.38, -0.66 - reach); c.stroke();
  c.beginPath(); c.arc(0.2, -1.0, 0.1, 0, Math.PI * 2); c.fill();
  if (dark > 0.4 && z.depth > 0.6) {
    if (front) { c.shadowColor = '#d8f0a0'; c.shadowBlur = 8; }
    c.fillStyle = `rgba(215,235,170,${Math.min(1, (dark - 0.4) * 1.6)})`;
    c.beginPath(); c.arc(0.26, -1.01, front ? 0.03 : 0.018, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  if (eyes && dark > 0.4 && z.depth > 0.6) {
    eyes.push({ x: z.x + z.dir * k * 0.26, y: z.y - k * 1.01, r: 0.22 * k, color: '#d8f0a0', k: Math.min(1, (dark - 0.4) * 2) });
  }
  void env;
}

function makeFogTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d');
  for (let i = 0; i < 40; i++) {
    const x = hash1(i) * 512, y = 40 + hash1(i + 9) * 60, r = 30 + hash1(i + 4) * 50;
    for (const ox of [-512, 0, 512]) {
      const g = c.createRadialGradient(x + ox, y, 0, x + ox, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(x + ox - r, y - r, r * 2, r * 2);
    }
  }
  return cv;
}

function drawFog(c, tex, W, gy, s, camX, t, col, alpha, height, env) {
  if (env.kind === 'tunnel') alpha *= 0.5;
  const h = Math.max(60, s * 3.5);
  const w = h * 4;
  const off = (((-camX * s * 0.5 - t * 6) % w) + w) % w;
  c.save();
  c.globalAlpha = clamp(alpha, 0, 1);
  for (let x = off - w; x < W + w; x += w) c.drawImage(tex, x, gy - h * 0.75, w, h);
  c.restore();
  c.save();
  c.globalAlpha = alpha * 0.6;
  const g = c.createLinearGradient(0, gy - h * height * 3, 0, gy + h * 0.2);
  g.addColorStop(0, rgba(col, 0));
  g.addColorStop(0.6, rgba(col, 0.6));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.fillRect(0, gy - h * height * 3, W, h * height * 3 + h * 0.2);
  c.restore();
}

function drawRain(c, drops, W, H, snow, t) {
  c.save();
  if (snow) {
    c.fillStyle = 'rgba(255,255,255,0.8)';
    for (const d of drops) {
      d.y += d.v * 1.2; d.x += Math.sin(t + d.v * 10) * 0.4;
      if (d.y > H) { d.y = -5; d.x = Math.random() * W; }
      c.beginPath(); c.arc(d.x, d.y, 1.2 + d.v, 0, Math.PI * 2); c.fill();
    }
  } else {
    c.strokeStyle = 'rgba(200,215,230,0.35)';
    c.lineWidth = 1;
    c.beginPath();
    for (const d of drops) {
      d.y += d.v * 14; d.x -= d.v * 2;
      if (d.y > H) { d.y = -20; d.x = Math.random() * (W + 100); }
      c.moveTo(d.x, d.y); c.lineTo(d.x - 2.5, d.y + 14 * d.v);
    }
    c.stroke();
  }
  c.restore();
}

function drawBuildOverlay(c, L, v, toSX, toSY, s) {
  const occ = v.occ || {};
  c.save();
  c.lineWidth = 1.5;
  for (const rm of L.rooms) {
    for (let i = 0; i < rm.cols; i++) {
      for (const layer of ['wall', 'floor']) {
        const y0 = layer === 'wall' ? rm.y + BAND_TOP : rm.y + BAND_TOP + BAND_H;
        const y1 = layer === 'wall' ? rm.y + BAND_TOP + BAND_H - 0.02 : rm.fy - 0.03;
        const x = toSX(rm.x + i + 0.04), y = toSY(y0), w = (1 - 0.08) * s, h = (y1 - y0) * s;
        const key = `${rm.i}:${i}:${layer}`;
        const sel = v.sel && v.sel.f === rm.i && v.sel.c === i && v.sel.layer === layer;
        c.beginPath(); rr(c, x, y, w, h, 4);
        if (sel) {
          c.fillStyle = 'rgba(255,200,90,0.35)'; c.fill();
          c.strokeStyle = 'rgba(255,210,120,1)'; c.setLineDash([]); c.stroke();
        } else if (!occ[key]) {
          c.fillStyle = layer === 'wall' ? 'rgba(120,180,255,0.07)' : 'rgba(255,220,150,0.08)'; c.fill();
          c.strokeStyle = layer === 'wall' ? 'rgba(150,200,255,0.5)' : 'rgba(255,230,170,0.55)';
          c.setLineDash([4, 4]); c.stroke();
        }
      }
    }
  }
  c.restore();
}

// Static render used for gallery thumbnails.
export function renderThumb(cv, def, items, hour = 11) {
  const c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const L = layoutBase(def);
  const b = L.bounds;
  const env = ENV[def.env] || ENV.field;
  const s = Math.min(W / (b.maxX - b.minX + 0.6), H / (b.maxY - b.minY + 0.6));
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const sky = skyAt(hour);
  c.setTransform(1, 0, 0, 1, 0, 0);
  const gy = H / 2 + (0 - cy) * s;
  if (env.kind === 'tunnel') { c.fillStyle = '#1e1c1a'; c.fillRect(0, 0, W, H); }
  else {
    const g = c.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, rgba(sky.top)); g.addColorStop(1, rgba(sky.hor));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.translate(W / 2, gy); drawFar(c, env, s, cx, sky, 0, W, 0); c.restore();
  }
  c.setTransform(s, 0, 0, s, W / 2 - cx * s, H / 2 - cy * s);
  const vx0 = cx - W / 2 / s - 1, vx1 = cx + W / 2 / s + 1, vy1 = cy + H / 2 / s + 1;
  const underground = def.support && def.support.type === 'underground';
  drawGround(c, env, vx0, vx1, vy1, sky, underground, 0);
  drawBase(c, L, { t: 0, hour, night: 0, daylight: 1, lights: [], items, people: [], powered: true });
  drawFront(c, env, vx0, vx1, vy1, 0, L);
  void lerp; void FLOOR_H;
}

export { ENV };
