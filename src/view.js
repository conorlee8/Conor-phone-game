import { clamp, hash1, smooth } from './util.js';

// Draws a base's painting full-screen and layers the living parts on top:
// drifting fog, rain, night falling with warm windows, and the dust burst
// when a stage is built.

const images = new Map();
export function art(name) {
  if (!images.has(name)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = `assets/bases/${name}.webp`;
    images.set(name, img);
  }
  return images.get(name);
}
const ready = img => img && img.complete && img.naturalWidth > 0;

export const darkness = hour => 1 - smooth(5, 7.5, hour) + smooth(18, 20.5, hour);

export class View {
  constructor(canvas) {
    this.cv = canvas;
    this.c = canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.lc = this.light.getContext('2d');
    this.fog = makeFog();
    this.drops = [];
    this.dust = [];
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.fade = null;
  }

  resize(W, H, dpr) {
    this.W = W; this.H = H; this.dpr = dpr;
    for (const cv of [this.cv, this.light]) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    this.drops = Array.from({ length: 160 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 0.6 + Math.random() * 0.7 }));
  }

  // Cover the screen with the painting; pan and pinch move within it.
  frame(base) {
    const [iw, ih] = base.size;
    // Wide paintings on a tall screen would crop to a sliver, so show most of
    // their width instead and let a blurred backdrop fill the rest.
    const cover = Math.max(this.W / iw, this.H / ih);
    const wide = (this.W / (iw * (base.show || 1)));
    const s = Math.min(cover, Math.max(wide, this.H * 0.42 / ih)) * this.zoom;
    const maxX = Math.max(0, (iw * s - this.W) / 2), maxY = Math.max(0, (ih * s - this.H) / 2);
    const fx = (iw / 2 - base.focus[0]) * s, fy = (ih / 2 - base.focus[1]) * s * 0.4;
    const ox = clamp(fx + this.pan.x, -maxX, maxX), oy = clamp(fy + this.pan.y, -maxY, maxY);
    this.pan.x = ox - fx;
    this.pan.y = oy - fy;
    return { s, x: this.W / 2 - (iw * s) / 2 + ox, y: this.H / 2 - (ih * s) / 2 + oy };
  }

  // Start the dust-and-crossfade when a base changes stage.
  transition(from, to, base) {
    this.fade = { from, to, t: 0 };
    const f = this.frame(base);
    for (const g of base.glow.slice(0, 1)) {
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random();
        this.dust.push({
          x: f.x + (g.x + Math.cos(a) * g.rx * r) * f.s,
          y: f.y + (g.y + Math.sin(a) * g.ry * r) * f.s,
          vx: Math.cos(a) * (20 + Math.random() * 60), vy: -10 - Math.random() * 40,
          r: 6 + Math.random() * 18, life: 1,
        });
      }
    }
  }

  render({ base, stage, hour, t, dt, rain, snow }) {
    const { c, W, H, dpr } = this;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#0e1219';
    c.fillRect(0, 0, W, H);
    const f = this.frame(base);
    const iw = base.size[0] * f.s, ih = base.size[1] * f.s;

    // painting, cross-fading between stages
    const cur = art(base.stages[stage]);
    if (ih < H - 1 || iw < W - 1) this.backdrop(cur, base);
    if (this.fade) {
      this.fade.t += dt / 1.4;
      const prev = art(base.stages[this.fade.from]);
      if (ready(prev)) c.drawImage(prev, f.x, f.y, iw, ih);
      c.globalAlpha = smooth(0.15, 1, this.fade.t);
      if (ready(cur)) c.drawImage(cur, f.x, f.y, iw, ih);
      c.globalAlpha = 1;
      if (this.fade.t >= 1) this.fade = null;
    } else if (ready(cur)) {
      c.drawImage(cur, f.x, f.y, iw, ih);
    }

    // a slow breathing fog over everything outside
    const fogA = 0.22 + 0.18 * (1 - smooth(8, 11, hour)) + 0.12 * smooth(17, 20, hour);
    drawFog(c, this.fog, W, H, t, fogA);

    if (rain) drawRain(c, this.drops, W, H, snow, t);

    // night: darken everything except the warm interior
    const dark = darkness(hour);
    if (dark > 0.02) {
      const lc = this.lc;
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = 'source-over';
      lc.clearRect(0, 0, this.light.width, this.light.height);
      lc.fillStyle = `rgba(8,12,30,${0.72 * dark})`;
      lc.fillRect(0, 0, this.light.width, this.light.height);
      if (stage > 0) {
        lc.globalCompositeOperation = 'destination-out';
        lc.setTransform(dpr, 0, 0, dpr, 0, 0);
        const flick = 0.92 + 0.08 * Math.sin(t * 7.3) * Math.sin(t * 2.1);
        for (const g of base.glow) {
          const x = f.x + g.x * f.s, y = f.y + g.y * f.s;
          lc.save();
          lc.translate(x, y);
          lc.scale(g.rx * f.s * 1.25, g.ry * f.s * 1.25);
          const gr = lc.createRadialGradient(0, 0, 0, 0, 0, 1);
          gr.addColorStop(0, `rgba(0,0,0,${0.95 * flick})`);
          gr.addColorStop(0.7, `rgba(0,0,0,${0.75 * flick})`);
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          lc.fillStyle = gr;
          lc.fillRect(-1, -1, 2, 2);
          lc.restore();
        }
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(this.light, 0, 0);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (stage > 0) {
        c.globalCompositeOperation = 'lighter';
        for (const g of base.glow) {
          const x = f.x + g.x * f.s, y = f.y + g.y * f.s;
          c.save();
          c.translate(x, y);
          c.scale(g.rx * f.s * 1.4, g.ry * f.s * 1.4);
          const gr = c.createRadialGradient(0, 0, 0, 0, 0, 1);
          gr.addColorStop(0, `rgba(255,170,80,${0.16 * dark})`);
          gr.addColorStop(1, 'rgba(255,170,80,0)');
          c.fillStyle = gr;
          c.fillRect(-1, -1, 2, 2);
          c.restore();
        }
        c.globalCompositeOperation = 'source-over';
      }
    }

    // dust from building
    if (this.dust.length) {
      for (const d of this.dust) {
        d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 30 * dt; d.life -= dt * 0.7; d.r += dt * 20;
        c.globalAlpha = Math.max(0, d.life) * 0.5;
        c.fillStyle = '#d8ccb4';
        c.beginPath(); c.arc(d.x, d.y, d.r, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
      this.dust = this.dust.filter(d => d.life > 0);
    }

    // soft vignette to pull the eye inward
    const vg = c.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
  }
}

// A cheap blur: shrink the painting to a few dozen pixels and stretch it back.
View.prototype.backdrop = function (img, base) {
  if (!ready(img)) return;
  const { c, W, H } = this;
  if (this._bdSrc !== img) {
    this._bd = this._bd || document.createElement('canvas');
    this._bd.width = 40; this._bd.height = Math.round(40 * base.size[1] / base.size[0]);
    this._bd.getContext('2d').drawImage(img, 0, 0, this._bd.width, this._bd.height);
    this._bdSrc = img;
  }
  const s = Math.max(W / this._bd.width, H / this._bd.height);
  c.imageSmoothingQuality = 'high';
  c.drawImage(this._bd, (W - this._bd.width * s) / 2, (H - this._bd.height * s) / 2, this._bd.width * s, this._bd.height * s);
  c.fillStyle = 'rgba(10,14,22,0.35)';
  c.fillRect(0, 0, W, H);
};

function makeFog() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const c = cv.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const x = hash1(i) * 512, y = hash1(i + 9) * 512, r = 50 + hash1(i + 4) * 90;
    for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
      const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, 'rgba(220,226,232,0.28)');
      g.addColorStop(1, 'rgba(220,226,232,0)');
      c.fillStyle = g;
      c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  return cv;
}

function drawFog(c, tex, W, H, t, alpha) {
  const size = Math.max(W, H) * 1.1;
  for (const [speed, a, k] of [[6, alpha, 1], [11, alpha * 0.6, 0.7]]) {
    const off = (t * speed) % size;
    c.globalAlpha = a;
    for (let x = -off * k - size; x < W + size; x += size) {
      for (let y = -size * 0.2; y < H; y += size) c.drawImage(tex, x, y, size, size);
    }
  }
  c.globalAlpha = 1;
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
    c.strokeStyle = 'rgba(200,215,230,0.32)';
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
