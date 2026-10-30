import { ITEM, PAINTS, CAT_ICON, needsWire, needsPipe } from './catalog.js';
import { ROOM_H, FLOOR_BAND, ROW_H, ROWS, YARD, YARD_F, itemBox, lineCellsOf, yardX } from './grid.js';
import { smooth, rr, clamp, hash1 } from '../util.js';

export const darkness = h => 1 - smooth(5, 7.5, h) + smooth(18, 20.5, h);

const images = new Map();
function load(path) {
  if (!images.has(path)) {
    const img = new Image();
    img.src = path;
    img.onerror = () => { img.failed = true; };
    images.set(path, img);
  }
  const img = images.get(path);
  return img.complete && img.naturalWidth && !img.failed ? img : null;
}
export const sprite = id => load(`assets/sprites/${id}.webp`);
const texture = name => load(`assets/textures/${name}.webp`);

const PAINT = Object.fromEntries(Object.entries(PAINTS).map(([k, list]) => [k, Object.fromEntries(list.map(p => [p.id, p]))]));
const WIRE = '#f2c14e', PIPE = '#5ab0e8';

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.c = canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.lc = this.light.getContext('2d');
  }

  resize(W, H, dpr) {
    this.W = W; this.H = H; this.dpr = dpr;
    for (const cv of [this.cv, this.light]) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  }

  render(v) {
    const { c, W, H, dpr } = this;
    const { L, cam, hour, t, mode, ghost, base, sel } = v;
    const sh = L.sh;
    const s = cam.s;
    const dark = darkness(hour);
    const sun = 1 - dark;
    const world = () => c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - cam.x * s), dpr * (H / 2 - cam.y * s));
    this.skyTop = dark > 0.5 ? '#0d1322' : '#8fa6b8';
    this.skyLow = dark > 0.5 ? '#1c2232' : '#d8dcd6';

    // sky, ground, yard
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, this.skyTop); sky.addColorStop(1, this.skyLow);
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    world();
    const vx0 = cam.x - W / 2 / s - 2, vw = W / s + 4, vy1 = cam.y + H / 2 / s + 2;
    c.fillStyle = sh.underground ? '#5a4634' : '#56603f';
    c.fillRect(vx0, L.ground, vw, vy1 - L.ground);
    c.fillStyle = '#6b7a45';
    c.fillRect(vx0, L.ground - 0.08, vw, 0.2);
    if (sh.underground) {
      c.fillStyle = '#4b3a2b';
      for (let y = L.ground + 1.5; y < vy1; y += 1.8) c.fillRect(vx0, y, vw, 0.4);
    }
    if (sh.stilts) this.stilts(L);

    // shell frame
    for (const st of L.storeys) {
      c.fillStyle = sh.colors.frame;
      c.fillRect(st.x0 - 0.22, st.top - 0.4, st.cols + 0.44, ROOM_H + 0.4 + (st.f === 0 ? 0.3 : 0));
    }

    // rooms: back wall, floor, inner walls
    for (const st of L.storeys) {
      c.save();
      c.beginPath(); c.rect(st.x0, st.top, st.cols, ROOM_H); c.clip();
      for (let x = 0; x < st.cols; x++) {
        this.wallCell(base.walls[`${x},${st.f}`] || sh.wallMat, st.x0 + x, st.top, x, st.f, sun);
        this.floorCell(base.floors[`${x},${st.f}`] || sh.floorMat, st.x0 + x, st.yb - FLOOR_BAND, x);
      }
      const g = c.createLinearGradient(0, st.top, 0, st.top + 0.9);
      g.addColorStop(0, 'rgba(20,14,8,0.45)'); g.addColorStop(1, 'rgba(20,14,8,0)');
      c.fillStyle = g; c.fillRect(st.x0, st.top, st.cols, 0.9);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(st.x0, st.yb - FLOOR_BAND, st.cols, 0.035);
      c.restore();
    }

    const showWire = mode === 'wire', showPipe = mode === 'pipe';
    this.lines(base.wire, base.wireUp, L, WIRE, 'wire', showWire);
    this.lines(base.pipe, base.pipeUp, L, PIPE, 'pipe', showPipe);

    // pieces: wall, ceiling, roof, then floor and yard; plug-in cables first
    const order = { wall: 0, ceiling: 1, roof: 2, floor: 3, yard: 3 };
    const list = base.items.map((it, i) => ({ it, i, box: itemBox(L, it) }))
      .sort((a, b) => order[a.it.m] - order[b.it.m] || a.box.y + a.box.h - (b.box.y + b.box.h));
    for (const { it, box } of list) this.hookups(L, it, box, base);
    const lights = [];
    for (const { it, i, box } of list) {
      const d = ITEM[it.id];
      const dim = it.on === false && !['idle'].includes(it.why) ? 0.6 : 1;
      if (it.m === 'floor' || it.m === 'yard') this.shadow(box);
      this.drawItem(d, box, dim);
      if (sel === i) { c.strokeStyle = '#f0b45a'; c.lineWidth = 0.05; c.strokeRect(box.x - 0.03, box.y - 0.03, box.w + 0.06, box.h + 0.06); }
      if (d.light && it.on) lights.push({ x: box.x + box.w / 2, y: box.y + box.h * 0.5, r: d.light, k: 1 });
    }
    for (const st of L.storeys) for (let x = 1; x < st.cols; x++) {
      const dv = base.divs[`${x},${st.f}`];
      if (dv) this.divider(dv, st.x0 + x, st);
    }

    if (ghost) {
      const box = itemBox(L, ghost);
      c.globalAlpha = 0.75;
      this.drawItem(ITEM[ghost.id], box, 1);
      c.globalAlpha = 1;
      c.fillStyle = ghost.ok ? 'rgba(90,220,120,0.28)' : 'rgba(255,80,70,0.32)';
      c.fillRect(box.x, box.y, box.w, box.h);
      c.strokeStyle = ghost.ok ? '#5adc78' : '#ff5046'; c.lineWidth = 0.04; c.strokeRect(box.x, box.y, box.w, box.h);
    }

    this.lighting(L, base, lights, dark, sun, t);

    // ports: green when plugged in, red when they still need hooking up
    if (showWire || showPipe || mode === 'look') {
      for (const { it, box } of list) {
        const d = ITEM[it.id];
        if ((showWire || mode === 'look') && needsWire(d)) this.port(box, 'top', it.wired, '⚡', showWire || !it.wired);
        if ((showPipe || mode === 'look') && needsPipe(d)) this.port(box, 'bottom', it.piped, '💧', showPipe || !it.piped);
      }
    }
    if (mode === 'look') {
      for (const { it, box } of list) {
        if (it.on !== false || !it.why || it.why === 'idle' || it.why === 'switched off') continue;
        if (it.why === 'not plugged in' || it.why === 'no pipe connected') continue;
        badge(c, box.x + box.w - 0.12, box.y + 0.12, { 'not enough power': '⚡', 'pipes are dry': '💧', 'out of fuel': '⛽' }[it.why] || '!');
      }
    }
    if (mode !== 'look') this.grid(L, mode);
  }

  stilts(L) {
    const c = this.c;
    const s0 = L.storeys[0];
    c.strokeStyle = '#4a4e4a'; c.lineWidth = 0.22;
    for (const x of [s0.x0 + 0.3, 0, s0.x0 + s0.cols - 0.3]) { c.beginPath(); c.moveTo(x, s0.yb + 0.3); c.lineTo(x * 1.15, 0); c.stroke(); }
    c.lineWidth = 0.08;
    for (let y = s0.yb + 0.3; y < -0.5; y += 1.4) {
      c.beginPath(); c.moveTo(s0.x0 + 0.3, y); c.lineTo(s0.x0 + s0.cols - 0.3, y + 1.4); c.moveTo(s0.x0 + s0.cols - 0.3, y); c.lineTo(s0.x0 + 0.3, y + 1.4); c.stroke();
    }
  }

  // Procedural surface materials (painted textures can replace these later).
  wallCell(mat, x, top, cx, f, sun) {
    const c = this.c;
    const p = PAINT.wall[mat] || PAINT.wall.panel;
    const h = ROOM_H - FLOOR_BAND;
    if (mat !== 'window' && this.textured(`wall_${mat}`, x, top, 1.002, h, 3)) return;
    c.fillStyle = p.color;
    c.fillRect(x, top, 1.002, h);
    c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 0.015;
    const line = (x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    switch (mat) {
      case 'panel':
        for (let k = 0; k < 4; k++) {
          c.fillStyle = `rgba(${hash1(cx * 4 + k + f * 97) > 0.5 ? '255,255,255' : '0,0,0'},${0.04 + hash1(cx * 7 + k) * 0.05})`;
          c.fillRect(x + k * 0.25, top, 0.25, h);
          line(x + k * 0.25, top, x + k * 0.25, top + h);
        }
        c.fillStyle = 'rgba(60,40,20,0.35)'; c.fillRect(x, top + h - 0.12, 1, 0.12);
        break;
      case 'brick':
        for (let r = 0, y = top; y < top + h; y += 0.2, r++) {
          line(x, y, x + 1, y);
          for (let bx = x + (r % 2) * 0.25; bx < x + 1; bx += 0.5) line(bx, y, bx, y + 0.2);
        }
        break;
      case 'concrete':
        for (let k = 0; k < 5; k++) {
          c.fillStyle = `rgba(0,0,0,${0.03 + hash1(cx * 13 + k + f * 31) * 0.05})`;
          c.beginPath(); c.arc(x + hash1(cx * 3 + k) , top + hash1(cx * 5 + k * 3) * h, 0.15 + hash1(k + cx) * 0.2, 0, Math.PI * 2); c.fill();
        }
        if (cx % 2 === 0) line(x, top, x, top + h);
        line(x, top + h * 0.5, x + 1, top + h * 0.5);
        break;
      case 'metal':
        line(x, top, x, top + h); line(x, top + h / 2, x + 1, top + h / 2);
        c.fillStyle = 'rgba(0,0,0,0.3)';
        for (const [rx, ry] of [[0.08, 0.08], [0.92, 0.08], [0.08, h / 2 - 0.08], [0.92, h / 2 - 0.08], [0.08, h / 2 + 0.08], [0.92, h / 2 + 0.08]]) { c.beginPath(); c.arc(x + rx, top + ry, 0.025, 0, Math.PI * 2); c.fill(); }
        break;
      case 'wallpaper':
        c.fillStyle = 'rgba(255,255,255,0.18)';
        for (let k = 0; k < 4; k++) c.fillRect(x + k * 0.25, top, 0.1, h);
        c.fillStyle = '#6b4f36'; c.fillRect(x, top + h - 0.14, 1, 0.14);
        c.fillRect(x, top + h * 0.45, 1, 0.04);
        break;
      case 'window': {
        c.fillStyle = '#8b8577'; c.fillRect(x, top, 1, h);
        const wx = x + 0.12, wy = top + 0.45, ww = 0.76, wh = h - 0.9;
        const g = c.createLinearGradient(0, wy, 0, wy + wh);
        g.addColorStop(0, this.skyTop); g.addColorStop(0.75, this.skyLow); g.addColorStop(0.76, '#5a6648'); g.addColorStop(1, '#4a5438');
        c.fillStyle = g; c.fillRect(wx, wy, ww, wh);
        c.fillStyle = `rgba(200,225,240,${0.1 + 0.15 * sun})`; c.fillRect(wx, wy, ww, wh);
        c.strokeStyle = '#4a3f33'; c.lineWidth = 0.06; c.strokeRect(wx, wy, ww, wh);
        c.lineWidth = 0.03; line(wx + ww / 2, wy, wx + ww / 2, wy + wh); line(wx, wy + wh / 2, wx + ww, wy + wh / 2);
        c.fillStyle = '#5a4a38'; c.fillRect(wx - 0.06, wy + wh, ww + 0.12, 0.06);
        break;
      }
    }
  }

  floorCell(mat, x, y, cx) {
    const c = this.c;
    const p = PAINT.floor[mat] || PAINT.floor.planks;
    if (this.textured(`floor_${mat}`, x, y, 1.002, FLOOR_BAND, 2.4)) { this.floorShade(x, y); return; }
    c.fillStyle = p.color;
    c.fillRect(x, y, 1.002, FLOOR_BAND);
    c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 0.014;
    const line = (x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    if (mat === 'planks') { for (let k = 1; k < 4; k++) line(x, y + k * 0.125, x + 1, y + k * 0.125); line(x + (cx % 2) * 0.5 + 0.2, y, x + (cx % 2) * 0.5 + 0.2, y + 0.25); }
    if (mat === 'tile') { line(x + 0.5, y, x + 0.5, y + FLOOR_BAND); line(x, y + 0.25, x + 1, y + 0.25); line(x, y, x, y + FLOOR_BAND); }
    if (mat === 'concrete') { if (cx % 2 === 0) line(x, y, x, y + FLOOR_BAND); }
    if (mat === 'carpet') { c.fillStyle = 'rgba(255,220,180,0.12)'; c.fillRect(x, y + 0.08, 1, 0.04); c.fillRect(x, y + 0.38, 1, 0.04); }
    this.floorShade(x, y);
  }

  // a slight top-down tilt: the back of the floor is darker
  floorShade(x, y) {
    const c = this.c;
    const g = c.createLinearGradient(0, y, 0, y + FLOOR_BAND);
    g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0.05)');
    c.fillStyle = g; c.fillRect(x, y, 1.002, FLOOR_BAND);
  }

  // Fill a rect with a painted texture, tiled seamlessly in world space.
  textured(name, x, y, w, h, unitsPerTile) {
    const img = texture(name);
    if (!img) return false;
    this.pats ||= {};
    const pat = (this.pats[name] ||= this.c.createPattern(img, 'repeat'));
    pat.setTransform(new DOMMatrix().scale(unitsPerTile / img.naturalWidth));
    this.c.fillStyle = pat;
    this.c.fillRect(x, y, w, h);
    return true;
  }

  divider(kind, x, st) {
    const c = this.c;
    const w = 0.16;
    c.fillStyle = '#5c544a';
    c.fillRect(x - w / 2, st.top, w, ROOM_H);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x - w / 2, st.top, 0.04, ROOM_H);
    if (kind === 'door') {
      c.fillStyle = '#7a5636';
      c.fillRect(x - 0.11, st.yb - 2.1, 0.22, 2.0);
      c.fillStyle = '#c9a227';
      c.beginPath(); c.arc(x + 0.05, st.yb - 1.1, 0.03, 0, Math.PI * 2); c.fill();
    }
  }

  lineY(L, kind, f, x) {
    if (f === YARD_F) return L.yard.y - (kind === 'wire' ? 0.06 : 0.14);
    const st = L.storeys[f];
    return kind === 'wire' ? st.top + 0.12 : st.yb - FLOOR_BAND - 0.05;
  }

  lineX(L, f, x) {
    return f === YARD_F ? yardX(L, x) + 0.5 : L.storeys[f].x0 + x + 0.5;
  }

  lines(lines, up, L, color, kind, strong) {
    const c = this.c;
    c.strokeStyle = color;
    c.lineCap = 'round';
    c.lineWidth = strong ? 0.1 : 0.05;
    c.globalAlpha = strong ? 1 : 0.75;
    c.beginPath();
    for (const key of Object.keys(lines)) {
      const [x, f] = key.split(',').map(Number);
      if (f !== YARD_F && !L.storeys[f]) continue;
      const cx = this.lineX(L, f, x), y = this.lineY(L, kind, f, x);
      c.moveTo(cx - 0.5, y); c.lineTo(cx + 0.5, y);
      if (up[`${x},${f}`] && L.storeys[f + 1]) { c.moveTo(cx, y); c.lineTo(L.storeys[f + 1].x0 + x + 0.5, this.lineY(L, kind, f + 1, x)); }
      if (f === YARD_F && (x === -1 || x === L.yard.cols0) && lines[`${x === -1 ? 0 : x - 1},0`]) {
        const tx = this.lineX(L, 0, x === -1 ? 0 : x - 1), ty = this.lineY(L, kind, 0, 0);
        c.moveTo(cx, y); c.lineTo(cx, ty); c.lineTo(tx, ty);
      }
    }
    c.stroke();
    if (strong) {
      c.fillStyle = color;
      for (const key of Object.keys(lines)) {
        const [x, f] = key.split(',').map(Number);
        if (f !== YARD_F && !L.storeys[f]) continue;
        c.beginPath(); c.arc(this.lineX(L, f, x), this.lineY(L, kind, f, x), 0.08, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  // The visible plug-in: a cable dropping from the wire run to the piece,
  // a pipe rising from the pipe run to its inlet.
  hookups(L, it, box, base) {
    const c = this.c;
    const d = ITEM[it.id];
    const cells = lineCellsOf(it, L);
    const at = lines => cells.find(k => lines[k]);
    c.lineCap = 'round';
    if (needsWire(d) && it.wired) {
      const [x, f] = at(base.wire).split(',').map(Number);
      const lx = this.lineX(L, f, x), ly = this.lineY(L, 'wire', f, x);
      const px = box.x + box.w / 2, py = it.m === 'roof' ? box.y + box.h : box.y + 0.05;
      c.strokeStyle = '#2a2622'; c.lineWidth = 0.035;
      c.beginPath(); c.moveTo(lx, ly);
      if (it.m === 'yard') c.lineTo(px, ly); else c.quadraticCurveTo(lx, (ly + py) / 2, px, py);
      c.lineTo(px, py); c.stroke();
    }
    if (needsPipe(d) && it.piped) {
      const [x, f] = at(base.pipe).split(',').map(Number);
      const lx = this.lineX(L, f, x), ly = this.lineY(L, 'pipe', f, x);
      const px = box.x + box.w * 0.75, py = it.m === 'roof' ? box.y + box.h : box.y + box.h - 0.05;
      c.strokeStyle = '#3f86b8'; c.lineWidth = 0.06;
      c.beginPath(); c.moveTo(lx, ly); c.lineTo(px, ly); c.lineTo(px, py); c.stroke();
      c.fillStyle = '#6b7880'; c.fillRect(px - 0.06, py - 0.04, 0.12, 0.08);
    }
  }

  shadow(box) {
    const c = this.c;
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath(); c.ellipse(box.x + box.w / 2, box.y + box.h - 0.01, box.w * 0.46, 0.07, 0, 0, Math.PI * 2); c.fill();
  }

  drawItem(d, box, alpha) {
    const c = this.c;
    const img = sprite(d.id);
    const a0 = c.globalAlpha;
    c.globalAlpha = a0 * alpha;
    if (img) {
      // fill the footprint: stretch a little rather than leave gaps, never more than 20%
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const k = box.h / ih;
      let w = iw * k, h = box.h;
      if (Math.abs(w - box.w) / box.w < 0.2) w = box.w;
      else if (w > box.w) { h = h * box.w / w; w = box.w; }
      c.drawImage(img, box.x + (box.w - w) / 2, box.y + box.h - h, w, h);
    } else {
      c.fillStyle = 'rgba(58,50,42,0.92)';
      c.beginPath(); rr(c, box.x + 0.05, box.y, box.w - 0.1, box.h, Math.min(0.12, box.h / 3)); c.fill();
      c.strokeStyle = 'rgba(240,200,120,0.55)'; c.lineWidth = 0.03; c.stroke();
      c.fillStyle = '#f1ebdf';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `${clamp(Math.min(box.w, box.h) * 0.42, 0.18, 0.55)}px system-ui`;
      c.fillText(CAT_ICON[d.cat] || '▪', box.x + box.w / 2, box.y + box.h / 2 - (box.h > 0.7 ? 0.1 : 0));
      if (box.h > 0.7) { c.font = '0.15px system-ui'; c.fillText(d.name, box.x + box.w / 2, box.y + box.h - 0.15, box.w - 0.08); }
    }
    c.globalAlpha = a0;
  }

  port(box, side, ok, icon, show) {
    if (!show) return;
    const c = this.c;
    const x = box.x + (side === 'top' ? box.w / 2 : box.w * 0.75), y = side === 'top' ? box.y + 0.05 : box.y + box.h - 0.05;
    c.fillStyle = ok ? '#4fd17a' : '#ff5a4a';
    c.beginPath(); c.arc(x, y, 0.13, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#111'; c.lineWidth = 0.025; c.stroke();
    c.fillStyle = '#fff'; c.font = '0.15px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(icon, x, y + 0.01);
  }

  lighting(L, base, lights, dark, sun, t) {
    const { c, lc } = this;
    const sh = L.sh;
    const outside = 0.78 * dark;
    const inside = sh.underground ? 0.74 : Math.max(0.3, 0.82 * dark);
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, this.light.width, this.light.height);
    lc.fillStyle = `rgba(8,12,28,${outside})`;
    lc.fillRect(0, 0, this.light.width, this.light.height);
    lc.setTransform(c.getTransform());
    for (const st of L.storeys) {
      lc.clearRect(st.x0, st.top, st.cols, ROOM_H);
      lc.fillStyle = `rgba(8,10,20,${inside})`;
      lc.fillRect(st.x0, st.top, st.cols, ROOM_H);
    }
    lc.globalCompositeOperation = 'destination-out';
    const all = lights.slice();
    // daylight pours in through windows
    if (!sh.underground && sun > 0.05) {
      for (const [key, id] of Object.entries(base.walls)) {
        if (id !== 'window') continue;
        const [x, f] = key.split(',').map(Number);
        const st = L.storeys[f];
        if (st) all.push({ x: st.x0 + x + 0.5, y: st.top + 1.2, r: 2.2, k: 0.85 * sun });
      }
    }
    const flick = 0.95 + 0.05 * Math.sin(t * 9);
    for (const l of all) {
      const g = lc.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(0,0,0,${l.k * flick})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.light, 0, 0);
    c.restore();
    c.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const g = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.9);
      g.addColorStop(0, `rgba(255,180,90,${0.1 + 0.08 * dark})`);
      g.addColorStop(1, 'rgba(255,180,90,0)');
      c.fillStyle = g;
      c.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    c.globalCompositeOperation = 'source-over';
  }

  // Build-mode guides: cell columns, wall rows and the yard plots.
  grid(L, mode) {
    const c = this.c;
    c.strokeStyle = 'rgba(255,230,170,0.35)';
    c.lineWidth = 0.02;
    c.setLineDash([0.08, 0.08]);
    for (const st of L.storeys) {
      for (let x = 0; x <= st.cols; x++) { c.beginPath(); c.moveTo(st.x0 + x, st.top); c.lineTo(st.x0 + x, st.yb); c.stroke(); }
      if (mode === 'place') {
        for (let r = 1; r <= ROWS; r++) { const y = st.yb - FLOOR_BAND - r * ROW_H; c.beginPath(); c.moveTo(st.x0, y); c.lineTo(st.x0 + st.cols, y); c.stroke(); }
      }
    }
    const y = L.yard.y;
    for (let k = 0; k <= YARD; k++) {
      for (const x0 of [L.yard.left, L.yard.right]) { c.beginPath(); c.moveTo(x0 + k, y); c.lineTo(x0 + k, y - 0.25); c.stroke(); }
    }
    c.setLineDash([]);
  }
}

function badge(c, x, y, icon) {
  c.fillStyle = 'rgba(200,50,40,0.92)';
  c.beginPath(); c.arc(x, y, 0.16, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff';
  c.font = '0.18px system-ui';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(icon, x, y + 0.01);
}
