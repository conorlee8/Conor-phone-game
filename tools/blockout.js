// Draws the grey "blockout" of a base in the ¾ cutaway camera. The clean
// version is handed to the image model to paint over; the slot data tells
// the game where each painted furniture sprite sits.
import { makeCamera } from '../src/render/projection.js';

export const SIZE = { W: 1536, H: 1024 };

const C = {
  ground: '#8d917f', sleeper: '#5e5246', rail: '#6f747a', wheel: '#2c2e31', bogie: '#3d4044',
  chassis: '#43474b', shell: '#7f8f88', shellDark: '#5d6a64', cap: '#3a3f44',
  floor: '#b9a68a', wall: '#ddd2bb', endWall: '#cfc3aa', window: '#c9dbe6', frame: '#8b8f86',
};

export function trainCar(cv, { debug = false } = {}) {
  const { W, H } = SIZE;
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const Lx = 8, D = 1.7, Hw = 2.4, T = 0.15;
  const cam = makeCamera({
    eye: [0, 15, 22], target: [0, 0.5, 0], W, H,
    margin: 0.1, fit: [[-Lx - 0.5, Hw, -D - 0.3], [Lx + 0.5, Hw, -D - 0.3], [-Lx - 0.5, -1.2, D + 0.6], [Lx + 0.5, -1.2, D + 0.6]],
  });
  const P = p => cam.project(p);
  const poly = (pts, fill, stroke) => {
    c.beginPath();
    pts.map(P).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  };
  const quadX = (x0, x1, y0, y1, z) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
  const quadY = (x0, x1, z0, z1, y) => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  const quadZ = (z0, z1, y0, y1, x) => [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]];
  const circle = (cx, cy, z, r, fill) => {
    c.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const [x, y] = P([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.fillStyle = fill; c.fill();
  };

  // ground, track
  c.fillStyle = '#9aa0a6';
  c.fillRect(0, 0, W, H);
  poly(quadY(-16, 16, -10, 8, -1.15), C.ground);
  for (let x = -15; x <= 15; x += 0.8) poly(quadY(x, x + 0.35, -1.5, 1.5, -1.12), C.sleeper);
  for (const z of [-0.9, 0.9]) poly(quadY(-16, 16, z - 0.06, z + 0.06, -1.05), C.rail);

  // bogies and wheels
  for (const bx of [-5.5, 5.5]) {
    poly(quadX(bx - 1.4, bx + 1.4, -0.95, -0.35, 1.3), C.bogie);
    for (const wx of [bx - 0.75, bx + 0.75]) circle(wx, -0.72, 1.32, 0.38, C.wheel);
  }
  // chassis
  poly(quadX(-Lx - 0.2, Lx + 0.2, -0.38, 0, D + 0.2), C.chassis);

  // floor
  poly(quadY(-Lx, Lx, -D, D, 0), C.floor);
  // back wall (inner face) with windows
  poly(quadX(-Lx, Lx, 0, Hw, -D), C.wall);
  const windows = [];
  for (let i = 0; i < 8; i++) {
    const cx = -Lx + 1 + i * 2;
    const w = quadX(cx - 0.68, cx + 0.68, 1.0, 2.0, -D);
    windows.push(w);
    poly(w, C.window, C.frame);
  }
  // end walls (inner faces)
  poly(quadZ(-D, D, 0, Hw, -Lx), C.endWall);
  poly(quadZ(-D, D, 0, Hw, Lx), C.endWall);
  // cut wall tops, showing the shell thickness
  poly(quadY(-Lx - T, Lx + T, -D - T, -D, Hw), C.cap);
  poly(quadY(-Lx - T, -Lx, -D - T, D + T, Hw), C.cap);
  poly(quadY(Lx, Lx + T, -D - T, D + T, Hw), C.cap);
  // end wall cut faces (front edge of the side walls)
  poly(quadX(-Lx - T, -Lx, 0.35, Hw, D + T), C.shellDark);
  poly(quadX(Lx, Lx + T, 0.35, Hw, D + T), C.shellDark);
  // front lip: the cut-away front wall
  poly(quadX(-Lx, Lx, 0, 0.35, D), C.shellDark);
  poly(quadY(-Lx - T, Lx + T, D, D + T, 0.35), C.cap);
  poly(quadX(-Lx - T, Lx + T, -0.38, 0.35, D + T), C.shell);

  const slots = trainSlots(cam, { Lx, D, Hw });
  if (debug) drawSlots(c, slots);
  return { slots, size: SIZE };
}

function trainSlots(cam, { Lx, D }) {
  const slots = [];
  const ppu = (p) => {
    const a = cam.project(p), b = cam.project([p[0] + 1, p[1], p[2]]);
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  };
  const add = (id, layer, row, col, pts, anchor) => {
    const a = cam.project(anchor);
    slots.push({
      id, layer, row, col,
      quad: pts.map(p => cam.project(p).slice(0, 2).map(Math.round)),
      anchor: a.slice(0, 2).map(Math.round),
      ppu: +ppu(anchor).toFixed(2),
      depth: +a[2].toFixed(3),
    });
  };
  for (let i = 0; i < 8; i++) {
    const x0 = -Lx + i * 2, x1 = x0 + 2;
    // back row: against the back wall, for tall pieces
    add(`back_${i}`, 'floor', 'back', i,
      [[x0 + 0.05, 0, -D], [x1 - 0.05, 0, -D], [x1 - 0.05, 0, -0.45], [x0 + 0.05, 0, -0.45]],
      [(x0 + x1) / 2, 0, -0.45]);
    // front row: along the cut-away front wall, for low pieces
    add(`front_${i}`, 'floor', 'front', i,
      [[x0 + 0.05, 0, 0.55], [x1 - 0.05, 0, 0.55], [x1 - 0.05, 0, D], [x0 + 0.05, 0, D]],
      [(x0 + x1) / 2, 0, D]);
    // wall: the back wall bay
    add(`wall_${i}`, 'wall', 'wall', i,
      [[x0 + 0.08, 0.95, -D], [x1 - 0.08, 0.95, -D], [x1 - 0.08, 2.35, -D], [x0 + 0.08, 2.35, -D]],
      [(x0 + x1) / 2, 0.95, -D]);
  }
  return slots;
}

function drawSlots(c, slots) {
  const col = { back: '#e0782f', front: '#2f8fe0', wall: '#c03ad0' };
  c.lineWidth = 3;
  c.font = 'bold 18px sans-serif';
  for (const s of slots) {
    c.beginPath();
    s.quad.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.strokeStyle = col[s.row];
    c.setLineDash([10, 6]);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = col[s.row];
    c.beginPath(); c.arc(s.anchor[0], s.anchor[1], 6, 0, Math.PI * 2); c.fill();
    c.fillText(s.id, s.quad[0][0] + 6, s.quad[0][1] + (s.row === 'wall' ? 22 : -6));
  }
}
