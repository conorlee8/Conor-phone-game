// The modular station: a painted shell whose bays are holes, and a pod (a
// room) in each built bay. Every pod comes from one shared atlas, an image
// and a looping video holding all the rooms, so the phone decodes a single
// video however many rooms are built. Pods are drawn first and the shell on
// top, so the door frames hide every pod edge.
//
// The layout lives in the save: { bays: {bayId: podId}, builds: {bayId: {pod, until}}, ring }
// where `ring` is the outermost ring open for building.

export const BUILD_MS = 2 * 60 * 1000;       // a catalog pod takes two minutes to build

const TAU = Math.PI * 2;

export class Station {
  constructor(data) {
    this.d = data;
    this.bays = Object.fromEntries(data.bays.map(b => [b.id, b]));
    this.canvas = document.createElement('canvas');
    [this.canvas.width, this.canvas.height] = data.size;
    this.g = this.canvas.getContext('2d');
    this.shell = new Image();
    this.still = new Image();
    this.video = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto' });
    this.video.setAttribute('playsinline', ''); this.video.setAttribute('muted', '');
    this.videoReady = false;
    this.cache = new Map();
  }

  async load() {
    this.shell.src = this.d.shell;
    this.still.src = this.d.atlas.still;
    await Promise.all([this.shell.decode(), this.still.decode()]).catch(() => {});
    this.video.addEventListener('playing', () => { this.videoReady = true; }, { once: true });
    this.video.addEventListener('error', () => { this.videoReady = false; });
    this.video.src = this.d.atlas.video;
    this.play();
  }
  play() { this.video.play().catch(() => {}); }
  ready() { return this.shell.complete && this.shell.naturalWidth > 0; }

  status(layout, id, now = Date.now()) {
    if (layout.bays[id]) return 'built';
    if (layout.builds[id]) return 'building';
    return this.bays[id].ring <= layout.ring ? 'empty' : 'locked';
  }
  // Catalog pods that could go in this bay: same size, not already on the station.
  choices(layout, id) {
    const size = this.bays[id].size;
    const used = new Set([...Object.values(layout.bays), ...Object.values(layout.builds).map(b => b.pod)]);
    return Object.entries(this.d.pods).filter(([pid, p]) => p.size === size && !used.has(pid)).map(([pid, p]) => ({ id: pid, ...p }));
  }

  drawPod(g, podId, box, alpha = 1) {
    const p = this.d.pods[podId];
    const [cx, cy, cw, ch] = p.cell;
    const [x0, y0, x1, y1] = box;
    const src = this.videoReady ? this.video : this.still;
    g.globalAlpha = alpha;
    g.drawImage(src, cx, cy, cw, ch, x0, y0, x1 - x0, y1 - y0);
    g.globalAlpha = 1;
  }

  // Draw the station at time t (seconds) into this.canvas.
  compose(layout, t, now = Date.now()) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#141216';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (const b of this.d.bays) {
      const st = this.status(layout, b.id, now);
      if (st === 'built') this.drawPod(g, layout.bays[b.id], b.pod);
      else if (st === 'locked') g.drawImage(this.plating(b), b.pod[0], b.pod[1]);
      else {
        g.drawImage(this.construction(b), b.pod[0], b.pod[1]);
        if (st === 'building') this.drawBuilding(g, b, layout.builds[b.id], t, now);
      }
    }
    g.drawImage(this.shell, 0, 0);
  }

  // A room materialising: it fills in from the floor up, with a bright weld line at the edge.
  drawBuilding(g, b, job, t, now) {
    const p = Math.max(0, Math.min(1, 1 - (job.until - now) / BUILD_MS));
    const [x0, y0, x1, y1] = b.pod;
    const top = y1 - (y1 - y0) * p;
    g.save();
    g.beginPath(); g.rect(x0, top, x1 - x0, y1 - top); g.clip();
    this.drawPod(g, job.pod, b.pod, 0.55 + 0.45 * p);
    g.restore();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(140,220,255,0.75)';
    g.fillRect(x0, top - 1, x1 - x0, 2);
    for (let i = 0; i < 6; i++) {                                     // welding sparks along the line
      const x = x0 + ((Math.sin(t * 3.1 + i * 2.3) + 1) / 2) * (x1 - x0);
      const flick = (Math.sin(t * 23 + i * 7) + 1) / 2;
      g.fillStyle = `rgba(255,230,160,${0.4 + 0.6 * flick})`;
      g.fillRect(x - 1, top - 2, 2, 2);
    }
    g.globalCompositeOperation = 'source-over';
  }

  // An open bay waiting for a room: bare deck, scaffolding, hazard tape, a work lamp.
  construction(b) {
    const key = 'c' + b.id;
    if (this.cache.has(key)) return this.cache.get(key);
    const [x0, y0, x1, y1] = b.pod, w = x1 - x0, h = y1 - y0;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#24211f'); bg.addColorStop(1, '#3a332c');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;          // back-wall panels
    for (let x = 8; x < w; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    const lamp = g.createRadialGradient(w * 0.62, h * 0.18, 0, w * 0.62, h * 0.18, h * 0.9);
    lamp.addColorStop(0, 'rgba(255,200,120,0.35)'); lamp.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = lamp; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a7a5a'; g.lineWidth = 2;                          // scaffolding
    const sx = [w * 0.18, w * 0.42];
    for (const x of sx) { g.beginPath(); g.moveTo(x, h * 0.12); g.lineTo(x, h * 0.88); g.stroke(); }
    for (const y of [h * 0.35, h * 0.62]) { g.beginPath(); g.moveTo(sx[0] - 6, y); g.lineTo(sx[1] + 6, y); g.stroke(); }
    g.beginPath(); g.moveTo(sx[0], h * 0.35); g.lineTo(sx[1], h * 0.62); g.stroke();
    g.fillStyle = '#5a4a36'; g.fillRect(w * 0.6, h * 0.66, w * 0.16, h * 0.2);   // crates
    g.fillStyle = '#6b5840'; g.fillRect(w * 0.72, h * 0.74, w * 0.12, h * 0.12);
    g.fillStyle = '#2c2a28'; g.fillRect(0, h * 0.88, w, h * 0.12);       // deck
    g.save();                                                            // hazard tape along the deck edge
    g.beginPath(); g.rect(0, h * 0.86, w, 5); g.clip();
    for (let x = -10; x < w + 10; x += 10) {
      g.fillStyle = '#e8b830'; g.beginPath(); g.moveTo(x, h * 0.86 + 5); g.lineTo(x + 5, h * 0.86); g.lineTo(x + 10, h * 0.86); g.lineTo(x + 5, h * 0.86 + 5); g.fill();
    }
    g.restore();
    this.cache.set(key, c);
    return c;
  }

  // A ring that isn't open yet: the bay is closed with riveted hull plating.
  plating(b) {
    const key = 'p' + b.id;
    if (this.cache.has(key)) return this.cache.get(key);
    const [x0, y0, x1, y1] = b.pod, w = x1 - x0, h = y1 - y0;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#5d636c'); bg.addColorStop(1, '#474c55');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const cols = 3, rows = 2;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const px = (i * w) / cols, py = (j * h) / rows, pw = w / cols, ph = h / rows;
      g.strokeStyle = 'rgba(20,22,26,0.7)'; g.lineWidth = 2; g.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.strokeRect(px + 3, py + 3, pw - 6, ph - 6);
      g.fillStyle = 'rgba(30,32,36,0.8)';
      for (const [rx, ry] of [[6, 6], [pw - 6, 6], [6, ph - 6], [pw - 6, ph - 6]]) { g.beginPath(); g.arc(px + rx, py + ry, 1.6, 0, TAU); g.fill(); }
    }
    g.fillStyle = '#c99a2e'; g.fillRect(w * 0.5 - 14, h * 0.5 - 3, 28, 6);   // a closed latch
    this.cache.set(key, c);
    return c;
  }
}
