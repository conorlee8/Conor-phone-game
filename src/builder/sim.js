import { ITEM } from './catalog.js';
import { SHELL } from './shells.js';
import { clamp, smooth } from '../util.js';

export const SAVE_KEY = 'haven-save-v3';
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
    { id: 'bunk_bed', x: 0, f: 0 }, { id: 'generator', x: 3, f: 0 }, { id: 'wall_lamp', x: 1, f: 0 },
    { id: 'shelf', x: 5, f: 0 }, { id: 'crate', x: 6, f: 0 }, { id: 'water_tank', x: 8, f: 0 },
    { id: 'rain_collector', x: 8, f: 1 }, { id: 'ladder', x: 9, f: 0 },
  ],
  wire: ['1,0', '2,0', '3,0'],
  pipe: ['8,0', '8,1'],
};

export function newGame() {
  return {
    v: 3, time: 8, dayIdx: 0, speed: 1,
    scrap: 120, parts: 4, fuel: 8, food: 15, water: 12,
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
    hp: 100,
  };
}

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    return s && s.v === 3 && SHELL[s.shell] ? s : null;
  } catch { return null; }
}
export function save(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }
export function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ } }

export const daylight = h => smooth(5.5, 7.5, h) - smooth(18, 20, h);
export const base = s => s.bases[s.shell];
export const home = s => s.survivors - s.runs.length;
export const threatFor = day => Math.round(2 + (day - 1) * 2.6);

// ---------------------------------------------------------------------------
// Placement

export function cellsOf(it) {
  const d = ITEM[it.id];
  const layer = d.mount === 'wall' ? 'wall' : d.mount === 'roof' ? 'roof' : 'floor';
  const out = [];
  for (let k = 0; k < d.w; k++) {
    out.push(`${layer}:${it.x + k},${it.f}`);
    if (d.ladder) out.push(`floor:${it.x + k},${it.f + 1}`);
  }
  return out;
}

export function occupancy(b) {
  const occ = {};
  b.items.forEach((it, i) => { for (const c of cellsOf(it)) occ[c] = i; });
  return occ;
}

export function canPlace(state, id, x, f) {
  const d = ITEM[id];
  const shell = SHELL[state.shell];
  const floors = shell.floors;
  if (f < 0 || f >= floors.length || x < 0 || x + d.w > floors[f]) return 'Doesn’t fit here.';
  if (d.mount === 'ground' && f !== 0) return 'Must go on the bottom floor.';
  if (d.mount === 'roof' && f !== floors.length - 1) return 'Goes on the roof of the top floor.';
  if (d.ladder && (f + 1 >= floors.length || x >= floors[f + 1])) return 'Needs a floor above.';
  const occ = occupancy(base(state));
  for (const c of cellsOf({ id, x, f })) if (occ[c] !== undefined) return 'Something is already there.';
  return null;
}

export function afford(state, cost) {
  return Object.entries(cost).every(([k, v]) => (state[k] || 0) >= v);
}

export function place(state, id, x, f) {
  const err = canPlace(state, id, x, f) || (afford(state, ITEM[id].cost) ? null : 'Not enough materials.');
  if (err) return err;
  for (const [k, v] of Object.entries(ITEM[id].cost)) state[k] -= v;
  base(state).items.push({ id, x, f });
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
  const shell = SHELL[state.shell];
  if (f < 0 || f >= shell.floors.length || x < 0 || x >= shell.floors[f]) return false;
  const lines = base(state)[kind];
  const key = `${x},${f}`;
  if (on && !lines[key]) {
    if (state.scrap < (kind === 'wire' ? 1 : 2)) return false;
    state.scrap -= kind === 'wire' ? 1 : 2;
    lines[key] = 1;
    return true;
  }
  if (!on && lines[key]) { delete lines[key]; return true; }
  return false;
}

// ---------------------------------------------------------------------------
// Networks: connected runs of wire or pipe, plus the items touching them.

export function networks(b, kind) {
  const lines = b[kind];
  const id = {};
  let n = 0;
  for (const key of Object.keys(lines)) {
    if (id[key] !== undefined) continue;
    const stack = [key];
    id[key] = n;
    while (stack.length) {
      const [x, f] = stack.pop().split(',').map(Number);
      for (const nb of [`${x - 1},${f}`, `${x + 1},${f}`, `${x},${f - 1}`, `${x},${f + 1}`]) {
        if (lines[nb] && id[nb] === undefined) { id[nb] = n; stack.push(nb); }
      }
    }
    n++;
  }
  const nets = Array.from({ length: n }, () => []);
  b.items.forEach((it, i) => {
    const d = ITEM[it.id];
    for (let k = 0; k < d.w; k++) {
      const net = id[`${it.x + k},${it.f}`];
      if (net !== undefined) { if (!nets[net].includes(i)) nets[net].push(i); break; }
    }
  });
  return { nets, cellNet: id };
}

// ---------------------------------------------------------------------------
// Simulation

export function caps(state) {
  const c = { food: 15, water: 15, scrap: 150, parts: 10, fuel: 10 };
  for (const it of base(state).items) {
    const d = ITEM[it.id];
    c.food += d.foodCap || 0; c.water += d.waterCap || 0;
    c.scrap += d.scrapCap || 0; c.parts += d.partsCap || 0; c.fuel += d.fuelCap || 0;
  }
  return c;
}

// Works out what is running this hour. Writes status flags onto each item:
// on (has what it needs), and for the overlay, why not.
export function runSystems(state, dh) {
  const b = base(state);
  const hour = state.time % 24;
  const sun = daylight(hour);
  const report = { supply: 0, demand: 0, stored: 0, cap: 0, rawWater: 0, rawCap: 0, fuelUse: 0 };
  for (const it of b.items) { it.on = true; it.why = ''; }

  // power
  const power = networks(b, 'wire');
  const wired = new Set(power.nets.flat());
  for (const [i, it] of b.items.entries()) {
    const d = ITEM[it.id];
    if ((d.power || d.battery) && !wired.has(i)) { it.on = !(d.power < 0); it.why = 'no wire'; }
  }
  for (const net of power.nets) {
    const items = net.map(i => b.items[i]);
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
      const d = ITEM[g.id];
      if (needGen && state.fuel > 0) {
        supply += d.power;
        const burn = d.fuel * dh;
        state.fuel = Math.max(0, state.fuel - burn);
        report.fuelUse += d.fuel;
        g.on = true;
      } else { g.on = false; g.why = state.fuel > 0 ? 'idle' : 'no fuel'; }
    }
    charge = clamp(charge + (supply - demand) * dh, 0, cap);
    const ok = supply >= demand || charge > 0.01;
    for (const it of items) {
      const d = ITEM[it.id];
      if (d.power < 0) { it.on = ok; if (!ok) it.why = 'no power'; }
      if (d.battery) it.charge = cap ? charge * (d.battery / cap) : 0;
    }
    report.supply += supply; report.demand += demand; report.stored += charge; report.cap += cap;
  }

  // water
  const water = networks(b, 'pipe');
  const piped = new Set(water.nets.flat());
  for (const [i, it] of b.items.entries()) {
    const d = ITEM[it.id];
    if ((d.source || d.draw || d.drink || d.tank) && !piped.has(i)) { it.on = false; it.why = 'no pipe'; }
  }
  for (const net of water.nets) {
    const items = net.map(i => b.items[i]);
    let level = 0, cap = 2;
    for (const it of items) {
      const d = ITEM[it.id];
      if (d.tank) { cap += d.tank; level += it.level || 0; }
    }
    for (const it of items) {
      const d = ITEM[it.id];
      if (d.source && it.on) level += d.source * (state.rain && d.rain ? d.rain : 1) * dh;
    }
    level = Math.min(level, cap);
    const c = caps(state);
    for (const it of items) {
      const d = ITEM[it.id];
      const need = (d.draw || d.drink || 0) * dh;
      if (!need) continue;
      if (!it.on) continue;
      if (level >= need) {
        level -= need;
        if (d.drink) state.water = Math.min(c.water, state.water + need);
      } else { it.on = false; it.why = 'no water'; }
    }
    const tankCap = cap - 2;
    for (const it of items) { const d = ITEM[it.id]; if (d.tank) it.level = tankCap ? level * (d.tank / tankCap) : 0; }
    report.rawWater += level; report.rawCap += cap;
  }
  return report;
}

export function step(state, dh) {
  const ev = [];
  const b = base(state);
  const r = runSystems(state, dh);
  const c = caps(state);
  let foodIn = 0, comfort = 0, craft = 0, fresh = false, boost = 0;
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
  // workbench: 3 scrap per part
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
  let d = (SHELL[state.shell].defense || 0) + home(state);
  for (const it of base(state).items) {
    const x = ITEM[it.id];
    if (x.defense && (it.on !== false || !x.power)) d += x.defense;
  }
  return d;
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
