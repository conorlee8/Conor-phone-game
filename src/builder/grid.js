import { ITEM } from './catalog.js';
import { SHELL } from './shells.js';

// One source of truth for where things sit, used by both the simulation
// (what fits, what connects) and the renderer (where to draw it).
//
// World units: one cell is 1 wide. A storey is a 3-unit room plus a 0.4 slab.
// y grows downward; the ground is y = 0. Inside a room, the back wall above
// the floor band is split into 3 rows of 0.8 units for wall pieces.

export const ROOM_H = 3;
export const STOREY = 3.4;
export const FLOOR_BAND = 0.5;
export const ROW_H = 0.8;
export const ROWS = 3;
export const YARD = 3;
export const YARD_F = -1; // the yard counts as its own "floor" for lines and cells

export function layout(shellId) {
  const sh = SHELL[shellId];
  const lift = (sh.stilts || 0) * STOREY;
  const storeys = sh.floors.map((cols, f) => {
    const yb = -lift - f * STOREY;
    return { f, cols, x0: -cols / 2, yb, top: yb - ROOM_H };
  });
  const top = storeys[storeys.length - 1].top - 0.4;
  const ground = sh.underground ? top - 0.15 : 0;
  const s0 = storeys[0];
  const yard = { y: ground, left: s0.x0 - YARD, right: s0.x0 + s0.cols, cols0: s0.cols };
  const widest = Math.max(...sh.floors);
  return {
    sh, storeys, lift, top, ground, yard,
    bounds: { minX: -widest / 2 - YARD - 0.3, maxX: widest / 2 + YARD + 0.3, minY: Math.min(top, ground) - 2.8, maxY: sh.underground ? 0.6 : 0.9 },
  };
}

export const rowsOf = d => Math.max(1, Math.ceil(d.h / ROW_H - 0.01));
export const yardOk = (L, x) => (x >= -YARD && x < 0) || (x >= L.yard.cols0 && x < L.yard.cols0 + YARD);

// Grid cells an item covers, as "layer:x,f[,row]" keys.
export function cellsOf(it) {
  const d = ITEM[it.id];
  const out = [];
  for (let k = 0; k < d.w; k++) {
    const x = it.x + k;
    switch (it.m) {
      case 'wall': for (let r = it.r; r < it.r + rowsOf(d); r++) out.push(`wall:${x},${it.f},${r}`); break;
      // ceiling pieces hang into the top wall row, so they claim it too
      case 'ceiling': out.push(`ceil:${x},${it.f}`, `wall:${x},${it.f},${ROWS - 1}`); break;
      case 'roof': out.push(`roof:${x}`); break;
      case 'yard': out.push(`yard:${x}`); break;
      default:
        out.push(`floor:${x},${it.f}`);
        if (d.ladder) out.push(`floor:${x},${it.f + 1}`);
    }
  }
  return out;
}

// The line cells (wire / pipe) an item can connect through.
export function lineCellsOf(it, L) {
  const d = ITEM[it.id];
  const f = it.m === 'yard' ? YARD_F : it.m === 'roof' ? L.storeys.length - 1 : it.f;
  return Array.from({ length: d.w }, (_, k) => `${it.x + k},${f}`);
}

export function lineCellOk(L, x, f) {
  if (f === YARD_F) return yardOk(L, x);
  const st = L.storeys[f];
  return !!st && x >= 0 && x < st.cols;
}

// `up` holds risers: "x,f" joins cell (x,f) to the cell above it.
export function lineNeighbours(L, x, f, up = {}) {
  const out = [[x - 1, f], [x + 1, f]];
  if (f >= 0 && up[`${x},${f}`]) out.push([x, f + 1]);
  if (f > 0 && up[`${x},${f - 1}`]) out.push([x, f - 1]);
  // the yard joins the bottom floor through its end walls
  if (f === YARD_F && x === -1) out.push([0, 0]);
  if (f === YARD_F && x === L.yard.cols0) out.push([L.yard.cols0 - 1, 0]);
  if (f === 0 && x === 0) out.push([-1, YARD_F]);
  if (f === 0 && x === L.yard.cols0 - 1) out.push([L.yard.cols0, YARD_F]);
  return out.filter(([a, b]) => (b >= 0 || b === YARD_F) && !(f >= 0 && b === YARD_F && !(f === 0 && (x === 0 || x === L.yard.cols0 - 1))) && lineCellOk(L, a, b));
}

// The box an item is drawn in, in world units.
export function itemBox(L, it) {
  const d = ITEM[it.id];
  if (it.m === 'yard') return { x: yardX(L, it.x), y: L.yard.y - d.h, w: d.w, h: d.h };
  const st = L.storeys[it.m === 'roof' ? L.storeys.length - 1 : it.f];
  const x = st.x0 + it.x;
  switch (it.m) {
    case 'wall': {
      const rows = rowsOf(d);
      const bottom = st.yb - FLOOR_BAND - it.r * ROW_H;
      const space = rows * ROW_H;
      return { x, y: bottom - space + (space - d.h) / 2, w: d.w, h: d.h };
    }
    case 'ceiling': return { x, y: st.top + 0.02, w: d.w, h: d.h };
    case 'roof': return { x, y: st.top - 0.4 - d.h, w: d.w, h: d.h };
    default:
      if (d.ladder) return { x: x + 0.12, y: st.yb - STOREY - 0.05, w: 0.76, h: STOREY - 0.15 };
      return { x, y: st.yb - 0.2 - d.h, w: d.w, h: d.h };
  }
}

export const yardX = (L, x) => (x < 0 ? L.yard.left + (x + YARD) : L.yard.right + (x - L.yard.cols0));

// What the player tapped: which surface, cell and wall row.
export function hitSurface(L, wx, wy) {
  const y = L.yard;
  const s0 = L.storeys[0];
  if (wy <= y.y + 0.3 && wy > y.y - 2.6 && (wx < s0.x0 || wx >= s0.x0 + s0.cols)) {
    const x = wx < s0.x0 ? Math.floor(wx - y.left) - YARD : y.cols0 + Math.floor(wx - y.right);
    if (yardOk(L, x)) return { m: 'yard', x, f: YARD_F };
  }
  for (const st of L.storeys) {
    if (wx < st.x0 || wx >= st.x0 + st.cols) continue;
    const x = Math.floor(wx - st.x0);
    const isTop = st.f === L.storeys.length - 1;
    if (isTop && wy < st.top - 0.1 && wy > st.top - 2.8) return { m: 'roof', x, f: st.f };
    if (wy < st.top - 0.1 || wy > st.yb + 0.1) continue;
    const fromFloor = st.yb - FLOOR_BAND - wy;
    if (wy < st.top + 0.45) return { m: 'ceiling', x, f: st.f };
    if (fromFloor < 0.55) return { m: 'floor', x, f: st.f };
    return { m: 'wall', x, f: st.f, r: Math.max(0, Math.min(ROWS - 1, Math.floor(fromFloor / ROW_H))) };
  }
  return null;
}

// Pick the surface an item will actually use for a tap.
export function mountFor(d, hit, L) {
  if (!hit) return null;
  const top = L.storeys.length - 1;
  const tryM = m => {
    if (!d.mounts.includes(m)) return null;
    if (m === 'ground' && hit.f !== 0) return null;
    if (m === 'roof') return { m, x: hit.x, f: top };
    if (m === 'yard') return hit.m === 'yard' ? { m, x: hit.x, f: YARD_F } : null;
    if (hit.m === 'yard' || hit.m === 'roof') return null;
    if (m === 'wall') return { m, x: hit.x, f: hit.f, r: Math.max(0, Math.min(ROWS - rowsOf(d), (hit.r ?? 1) - Math.floor((rowsOf(d) - 1) / 2))) };
    return { m: m === 'ground' ? 'floor' : m, x: hit.x, f: hit.f };
  };
  const exact = hit.m === 'floor' ? ['floor', 'ground'] : [hit.m];
  for (const m of exact) { const r = tryM(m); if (r) return r; }
  if (hit.m === 'yard' || hit.m === 'roof') return null;
  for (const m of d.mounts) { const r = tryM(m); if (r) return r; }
  return null;
}
