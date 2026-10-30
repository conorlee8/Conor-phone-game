import { ITEM, PAINTS, needsWire, needsPipe } from './catalog.js';
import { SHELL } from './shells.js';
import { layout, cellsOf, lineCellsOf, lineCellOk, lineNeighbours, rowsOf, ROWS, YARD_F, yardOk } from './grid.js';
import { clamp, smooth } from '../util.js';

export const SAVE_KEY = 'haven-save-v4';
export const HOURS_PER_SEC = 0.08; // a day is 5 real minutes at 1x
const EAT = 0.15, DRINK = 0.2;

export const LOCATIONS = [
  { id: 'cars', name: 'Abandoned cars', icon: '🚗', hours: 2, risk: 0.05, loot: { scrap: [8, 16], fuel: [1, 4], parts: [0, 1] }, blurb: 'Fuel in the tanks, parts under the hood.' },
  { id: 'gas', name: 'Gas station', icon: '⛽', hours: 3, risk: 0.12, loot: { scrap: [8, 18], fuel: [4, 9], food: [1, 4], water: [2, 5] }, blurb: 'Fuel, snacks, bottled water.' },
  { id: 'market', name: 'Supermarket', icon: '🛒', hours: 4, risk: 0.22, loot: { scrap: [4, 10], food: [6, 12], water: [4, 9] }, blurb: 'Food, if the horde left any.' },
  { id: 'hardware', name: 'Hardware store', icon: '🔧', hours: 4, risk: 0.2, loot: { scrap: [20, 40], parts: [2, 5] }, blurb: 'Pipes, wire, tools.' },
  { id: 'checkpoint', name: 'Army checkpoint', icon: '🪖', hours: 5, risk: 0.35, loot: { scrap: [30, 55], parts: [4, 8], fuel: [4, 10] }, blurb: 'Big rewards. Big danger.' },
];

const START = {
  items: [
    { id: 'bunk_bed', m: 'floor', x: 0, f: 0 }, { id: 'generator', m: 'floor', x: 3, f: 0 },
    { id: 'ceiling_light', m: 'ceiling', x: 2, f: 0 }, { id: 'shelf', m: 'floor', x: 5, f: 0 },
    { id: 'crate', m: 'floor', x: 6, f: 0 }, { id: 'water_tank', m: 'floor', x: 8, f: 0 },
    { id: 'rain_collector', m: 'roof', x: 8, f: 1 }, { id: 'ladder', m: 'floor', x: 9, f: 0 },
    { id: 'wall_shelf', m: 'wall', x: 5, f: 0, r: 2 },
  ],
  wire: ['2,0', '3,0'],
  pipe: ['8,0', '8,1'],
  pipeUp: ['8,0'],
};

export function newGame() {
  return {
    v: 4, time: 8, dayIdx: 0, speed: 1,
    scrap: 140, parts: 4, fuel: 8, food: 15, water: 12,
    survivors: 2, hunger: 0, rain: false, wind: 0.5,
    shell: 'bunker',
    bases: { bunker: freshBase(START) },
    runs: [],
  };
}

function freshBase(seed = { items: [], wire: [], pipe: [] }) {
  return {
    items: seed.items.map(i => ({ ...i })),
    wire: Object.fromEntries(seed.wire.map(k => [k, 1])),
    pipe: Object.fromEntries(seed.pipe.map(k => [k, 1])),
    wireUp: Object.fromEntries((seed.wireUp || []).map(k => [k, 1])),
    pipeUp: Object.fromEntries((seed.pipeUp || []).map(k => [k, 1])),
    walls: {}, floors: {}, divs: {},
    hp: 100,
  };
}

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s || s.v !== 4 || !SHELL[s.shell]) return null;
    for (const b of Object.values(s.bases)) { b.wireUp ||= {}; b.pipeUp ||= {}; }
    return s;
  } catch { return null; }
}
export function save(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }
export function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ } }

export const daylight = h => smooth(5.5, 7.5, h) - smooth(18, 20, h);
export const base = s => s.bases[s.shell];
export const home = s => s.survivors - s.runs.length;
export const threatFor = day => Math.round(2 + (day - 1) * 2.6);

const layouts = {};
export const L = s => (layouts[s.shell] ||= layout(s.shell));

// ---------------------------------------------------------------------------
// Placement

export function occupancy(b) {
  const occ = {};
  b.items.forEach((it, i) => { for (const c of cellsOf(it)) occ[c] = i; });
  return occ;
}

export function canPlace(state, it) {
  const d = ITEM[it.id];
  const lay = L(state);
  if (!it || !d.mounts.includes(it.m === 'floor' && d.mounts.includes('ground') && !d.mounts.includes('floor') ? 'ground' : it.m)) return 'Can’t go there.';
  if (it.m === 'yard') {
    for (let k = 0; k < d.w; k++) if (!yardOk(lay, it.x + k)) return 'Doesn’t fit in the yard there.';
  } else {
    const st = lay.storeys[it.f];
    if (!st || it.x < 0 || it.x + d.w > st.cols) return 'Doesn’t fit here.';
    if (it.m === 'floor' && !d.mounts.includes('floor') && it.f !== 0) return 'Bottom floor only.';
    if (it.m === 'wall' && (it.r < 0 || it.r + rowsOf(d) > ROWS)) return 'Too tall for the wall there.';
    if (d.ladder && !lay.storeys[it.f + 1]) return 'Needs a floor above.';
    if (it.m === 'wall' || it.m === 'ceiling' || it.m === 'floor') {
      // an inner wall can't cut through a piece
      for (let k = 1; k < d.w; k++) if (base(state).divs[`${it.x + k},${it.f}`] === 'wall') return 'An inner wall is in the way.';
    }
  }
  const occ = occupancy(base(state));
  for (const c of cellsOf(it)) if (occ[c] !== undefined) return 'Something is already there.';
  return null;
}

export function afford(state, cost) {
  return Object.entries(cost).every(([k, v]) => (state[k] || 0) >= v);
}

export function place(state, it) {
  const d = ITEM[it.id];
  const err = canPlace(state, it) || (afford(state, d.cost) ? null : 'Not enough materials.');
  if (err) return err;
  for (const [k, v] of Object.entries(d.cost)) state[k] -= v;
  base(state).items.push({ ...it });
  return null;
}

export function remove(state, index) {
  const b = base(state);
  const it = b.items[index];
  if (!it) return;
  for (const [k, v] of Object.entries(ITEM[it.id].cost)) state[k] += v;
  b.items.splice(index, 1);
}

export function toggleLine(state, kind, x, f, on) {
  if (!lineCellOk(L(state), x, f)) return false;
  const lines = base(state)[kind];
  const key = `${x},${f}`;
  const cost = kind === 'wire' ? 1 : 2;
  if (on && !lines[key]) {
    if (state.scrap < cost) return false;
    state.scrap -= cost; lines[key] = 1; return true;
  }
  if (!on && lines[key]) {
    delete lines[key];
    state.scrap += cost;
    const up = base(state)[`${kind}Up`];
    delete up[key];
    delete up[`${x},${f - 1}`];
    return true;
  }
  return false;
}

// A riser carries a wire or pipe from floor f up to floor f + 1 at column x.
export function toggleRiser(state, kind, x, f, on) {
  const lay = L(state);
  if (f < 0 || !lineCellOk(lay, x, f) || !lineCellOk(lay, x, f + 1)) return false;
  const up = base(state)[`${kind}Up`];
  const key = `${x},${f}`;
  if (on && !up[key]) {
    toggleLine(state, kind, x, f, true);
    toggleLine(state, kind, x, f + 1, true);
    up[key] = 1;
    return true;
  }
  if (!on && up[key]) { delete up[key]; return true; }
  return false;
}

// Paint a wall / floor surface, or set the divider on a cell's left edge.
export function paint(state, kind, id, x, f) {
  const lay = L(state);
  const st = lay.storeys[f];
  if (!st || x < 0 || x >= st.cols) return false;
  const b = base(state);
  const p = PAINTS[kind].find(q => q.id === id);
  if (kind === 'divider') {
    if (x === 0) return false;
    const key = `${x},${f}`;
    if (id === 'none') { if (!b.divs[key]) return false; delete b.divs[key]; return true; }
    if (b.divs[key] === id || state.scrap < p.cost) return false;
    // a solid wall can't split a piece in two
    if (id === 'wall') {
      for (const it of b.items) {
        if (it.m === 'yard' || it.m === 'roof' || it.f !== f) continue;
        if (it.x < x && it.x + ITEM[it.id].w > x) return false;
      }
    }
    state.scrap -= p.cost; b.divs[key] = id; return true;
  }
  if (kind === 'wall' && id === 'window' && lay.sh.underground) return false;
  const map = kind === 'wall' ? b.walls : b.floors;
  const key = `${x},${f}`;
  if (map[key] === id || state.scrap < p.cost) return false;
  state.scrap -= p.cost; map[key] = id; return true;
}

// ---------------------------------------------------------------------------
// Networks: connected runs of wire or pipe, plus the items touching them.

export function networks(state, kind) {
  const b = base(state);
  const lay = L(state);
  const lines = b[kind];
  const id = {};
  let n = 0;
  for (const key of Object.keys(lines)) {
    if (id[key] !== undefined) continue;
    const stack = [key];
    id[key] = n;
    while (stack.length) {
      const [x, f] = stack.pop().split(',').map(Number);
      for (const [nx, nf] of lineNeighbours(lay, x, f, b[`${kind}Up`])) {
        const nb = `${nx},${nf}`;
        if (lines[nb] && id[nb] === undefined) { id[nb] = n; stack.push(nb); }
      }
    }
    n++;
  }
  const nets = Array.from({ length: n }, () => []);
  b.items.forEach((it, i) => {
    for (const c of lineCellsOf(it, lay)) {
      if (id[c] !== undefined) { nets[id[c]].push(i); break; }
    }
  });
  return { nets, cellNet: id };
}

export function caps(state) {
  const c = { food: 15, water: 15, scrap: 150, parts: 10, fuel: 10 };
  for (const it of base(state).items) {
    const d = ITEM[it.id];
    c.food += d.foodCap || 0; c.water += d.waterCap || 0;
    c.scrap += d.scrapCap || 0; c.parts += d.partsCap || 0; c.fuel += d.fuelCap || 0;
  }
  return c;
}

// Works out what is running this hour. Each item gets `on`, plus `why` when
// it isn't, and `wired` / `piped` for the plug-in visuals.
export function runSystems(state, dh) {
  const b = base(state);
  const sun = daylight(state.time % 24);
  const report = { supply: 0, demand: 0, stored: 0, cap: 0, rawWater: 0, rawCap: 0, fuelUse: 0 };
  for (const it of b.items) { it.on = !it.off; it.why = it.off ? 'switched off' : ''; it.wired = false; it.piped = false; }

  const power = networks(state, 'wire');
  for (const net of power.nets) for (const i of net) b.items[i].wired = true;
  for (const it of b.items) {
    const d = ITEM[it.id];
    if (needsWire(d) && !it.wired && d.power < 0 && !it.off) { it.on = false; it.why = 'not plugged in'; }
  }
  for (const net of power.nets) {
    const items = net.map(i => b.items[i]).filter(it => !it.off);
    let free = 0, demand = 0, cap = 0, charge = 0;
    const gens = [];
    for (const it of items) {
      const d = ITEM[it.id];
      if (d.power > 0 && d.fuel) gens.push(it);
      else if (d.power > 0) free += d.power * (d.solar ? sun : d.wind ? state.wind : 1);
      if (d.power < 0) demand += -d.power;
      if (d.battery) { cap += d.battery; charge += it.charge || 0; }
    }
    let supply = free;
    const needGen = demand > free || charge < cap - 0.01;
    for (const g of gens) {
      if (needGen && state.fuel > 0) {
        supply += ITEM[g.id].power;
        state.fuel = Math.max(0, state.fuel - ITEM[g.id].fuel * dh);
        report.fuelUse += ITEM[g.id].fuel;
      } else { g.on = false; g.why = state.fuel > 0 ? 'idle' : 'out of fuel'; }
    }
    charge = clamp(charge + (supply - demand) * dh, 0, cap);
    const ok = supply >= demand - 1e-6 || charge > 0.01;
    for (const it of items) {
      const d = ITEM[it.id];
      if (d.power < 0 && !ok) { it.on = false; it.why = 'not enough power'; }
      if (d.battery) it.charge = cap ? charge * (d.battery / cap) : 0;
    }
    report.supply += supply; report.demand += demand; report.stored += charge; report.cap += cap;
  }

  const water = networks(state, 'pipe');
  for (const net of water.nets) for (const i of net) b.items[i].piped = true;
  for (const it of b.items) {
    const d = ITEM[it.id];
    if (needsPipe(d) && !it.piped && !it.off) { it.on = false; it.why = 'no pipe connected'; }
  }
  const c = caps(state);
  for (const net of water.nets) {
    const items = net.map(i => b.items[i]).filter(it => !it.off);
    let level = 0, cap = 2;
    for (const it of items) { const d = ITEM[it.id]; if (d.tank) { cap += d.tank; level += it.level || 0; } }
    for (const it of items) {
      const d = ITEM[it.id];
      if (d.source && it.on) level += d.source * (state.rain && d.rain ? d.rain : 1) * dh;
    }
    level = Math.min(level, cap);
    for (const it of items) {
      const d = ITEM[it.id];
      const need = (d.draw || d.drink || 0) * dh;
      if (!need || !it.on) continue;
      if (level >= need) {
        level -= need;
        if (d.drink) state.water = Math.min(c.water, state.water + need);
      } else { it.on = false; it.why = 'pipes are dry'; }
    }
    const tankCap = cap - 2;
    for (const it of items) { const d = ITEM[it.id]; if (d.tank) it.level = tankCap ? level * (d.tank / tankCap) : 0; }
    report.rawWater += level; report.rawCap += cap;
  }
  return report;
}

// Comfort and defense from surfaces: paints, windows, inner walls.
function surfaceBonus(state) {
  const b = base(state);
  const lay = L(state);
  let comfort = 0, defense = 0, windows = 0;
  const find = (kind, id) => PAINTS[kind].find(p => p.id === id) || {};
  for (const id of Object.values(b.walls)) { const p = find('wall', id); comfort += p.comfort || 0; defense += p.defense || 0; }
  for (const id of Object.values(b.floors)) comfort += find('floor', id).comfort || 0;
  for (const id of Object.values(b.divs)) defense += find('divider', id).defense || 0;
  const barred = new Set(b.items.filter(it => ITEM[it.id].bars).map(it => `${it.x},${it.f}`));
  for (const [key, id] of Object.entries(b.walls)) if (id === 'window' && !barred.has(key)) windows++;
  if (!lay.sh.underground) defense -= windows * 0.5;
  return { comfort, defense, windows };
}

export function step(state, dh) {
  const ev = [];
  const b = base(state);
  const r = runSystems(state, dh);
  const c = caps(state);
  const sb = surfaceBonus(state);
  let foodIn = 0, comfort = sb.comfort, craft = 0, fresh = false, boost = 0;
  for (const it of b.items) {
    const d = ITEM[it.id];
    if (d.food && it.on) foodIn += d.food;
    if (d.comfort && (it.on || d.comfort < 0)) comfort += d.comfort;
    if (d.craft) craft += d.craft;
    if (d.fresh && it.on) fresh = true;
    if (d.foodBoost) boost += d.foodBoost;
  }
  state.food = clamp(state.food + (foodIn * (1 + boost) - state.survivors * EAT) * dh, 0, c.food);
  if (!fresh) state.food = Math.max(0, state.food - state.food * 0.004 * dh);
  state.water = clamp(state.water - state.survivors * DRINK * dh, 0, c.water);
  const make = Math.min(craft * dh, state.scrap / 3, Math.max(0, c.parts - state.parts));
  if (make > 0) { state.parts += make; state.scrap -= make * 3; }
  state.scrap = Math.min(state.scrap, c.scrap);
  state.fuel = Math.min(state.fuel, c.fuel);
  state.report = { ...r, comfort, foodIn };

  if (state.food <= 0 || state.water <= 0) {
    state.hunger += dh;
    if (state.hunger >= 18 && state.survivors > 1) {
      state.survivors--; state.hunger = 0;
      ev.push({ type: 'bad', text: `A survivor left to find ${state.food <= 0 ? 'food' : 'water'} elsewhere.` });
    }
  } else state.hunger = Math.max(0, state.hunger - dh * 2);

  const beds = b.items.reduce((n, it) => n + (ITEM[it.id].beds || 0), 0);
  const recruit = b.items.reduce((n, it) => n + (ITEM[it.id].recruit && it.on ? 1 : 0), 0);
  if (beds > state.survivors && comfort >= state.survivors * 2 && Math.random() < 0.025 * (1 + recruit) * dh) {
    state.survivors++;
    ev.push({ type: 'good', text: 'A stranger followed your lights here and asked to stay. 👋' });
  }

  for (const run of state.runs.filter(x => state.time >= x.end)) {
    state.runs.splice(state.runs.indexOf(run), 1);
    ev.push(finishRun(state, run));
  }

  state.time += dh;
  const idx = Math.floor(state.time / 24);
  if (idx > state.dayIdx) {
    state.dayIdx = idx;
    ev.push(nightAttack(state, idx));
    state.rain = Math.random() < 0.4;
    state.wind = Math.random();
  }
  return ev;
}

export function defense(state) {
  let d = (SHELL[state.shell].defense || 0) + home(state) + surfaceBonus(state).defense;
  for (const it of base(state).items) {
    const x = ITEM[it.id];
    if (x.defense && (x.power ? it.on : !it.off)) d += x.defense;
  }
  return Math.max(0, Math.round(d));
}

function nightAttack(state, day) {
  const threat = threatFor(day) + Math.floor(Math.random() * 2);
  const def = defense(state);
  const b = base(state);
  if (def >= threat) {
    const loot = 3 + Math.floor(threat * 0.8);
    state.scrap += loot;
    return { type: 'good', night: true, text: `Night ${day}: ${threat} zombies hit the walls. You held. +${loot} 🔩` };
  }
  const dmg = (threat - def) * 7;
  b.hp = Math.max(0, b.hp - dmg);
  if (b.hp > 0) return { type: 'bad', night: true, text: `Night ${day}: ${threat} zombies battered the base. -${dmg} ❤️` };
  b.hp = 35;
  const victim = b.items.findIndex(it => ITEM[it.id].cat !== 'Structure');
  const lost = victim >= 0 ? ITEM[b.items[victim].id].name : null;
  if (victim >= 0) b.items.splice(victim, 1);
  state.food *= 0.6;
  return { type: 'bad', night: true, text: `Night ${day}: they broke in!${lost ? ` The ${lost} was wrecked.` : ''}` };
}

export function startRun(state, locId) {
  const loc = LOCATIONS.find(l => l.id === locId);
  const hour = state.time % 24;
  if (home(state) < 1) return 'Everyone is already out.';
  if (hour < 6 || hour + loc.hours > 21) return 'Too close to dark. Wait for morning.';
  state.runs.push({ loc: locId, end: state.time + loc.hours });
  return null;
}

function finishRun(state, run) {
  const loc = LOCATIONS.find(l => l.id === run.loc);
  if (Math.random() < loc.risk) return { type: 'bad', text: `${loc.icon} The ${loc.name.toLowerCase()} was crawling with them. Came back empty-handed.` };
  const c = caps(state);
  const icons = { scrap: '🔩', parts: '⚙️', fuel: '⛽', food: '🥫', water: '🚰' };
  const parts = [];
  for (const [k, [a, z]] of Object.entries(loc.loot)) {
    const n = Math.round(a + Math.random() * (z - a));
    if (!n) continue;
    state[k] = Math.min(c[k], (state[k] || 0) + n);
    parts.push(`+${n} ${icons[k]}`);
  }
  return { type: 'good', text: `${loc.icon} Back from the ${loc.name.toLowerCase()}: ${parts.join(' ')}` };
}

export function repair(state) {
  const b = base(state);
  const cost = Math.ceil((100 - b.hp) * 0.4);
  if (cost <= 0) return 'Already in good shape.';
  if (state.scrap < cost) return `Need ${cost} 🔩 to repair.`;
  state.scrap -= cost; b.hp = 100;
  return null;
}

export function moveTo(state, shellId) {
  const sh = SHELL[shellId];
  if (!state.bases[shellId]) {
    if (state.scrap < sh.cost) return `Need ${sh.cost} 🔩.`;
    state.scrap -= sh.cost;
    state.bases[shellId] = freshBase();
  }
  state.shell = shellId;
  return null;
}

export { YARD_F };
