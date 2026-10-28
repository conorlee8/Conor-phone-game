import { BASE_BY_ID } from './data/bases.js';
import { ITEM_BY_ID } from './data/items.js';
import { clamp, rng, strHash, smooth } from './util.js';

export const SAVE_KEY = 'haven-save-v1';
export const HOURS_PER_SEC = 0.1; // one in-game day = 4 real minutes at 1x
const EAT = 0.15;
const DRINK = 0.2;

const STARTER = [
  { id: 'bedroll', f: 0, c: 0 }, { id: 'bedroll', f: 0, c: 1 }, { id: 'table', f: 0, c: 2 },
  { id: 'planter', f: 0, c: 3 }, { id: 'rain_barrel', f: 0, c: 4 }, { id: 'stove', f: 0, c: 5 },
  { id: 'crates', f: 0, c: 6 },
  { id: 'string_lights', f: 0, c: 0 }, { id: 'string_lights', f: 0, c: 1 }, { id: 'photos', f: 0, c: 2 },
  { id: 'lantern', f: 0, c: 4 }, { id: 'map', f: 0, c: 6 },
];

export function newGame() {
  return {
    v: 1,
    time: 8,
    dayIdx: 0,
    speed: 1,
    scrap: 60,
    food: 12,
    water: 12,
    power: 4,
    survivors: 2,
    hunger: 0,
    rain: false,
    active: 'passenger_car',
    owned: { passenger_car: { items: STARTER.map(i => ({ ...i })), hp: 100 } },
    scav: null,
    creative: false,
    seen: {},
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !BASE_BY_ID[s.active]) return null;
    return s;
  } catch {
    return null;
  }
}

export function save(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

export function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}

export function daylight(hour) {
  return smooth(6, 8, hour) - smooth(17, 19, hour);
}

export function stats(state, baseId = state.active) {
  const def = BASE_BY_ID[baseId];
  const tr = def.trait || {};
  const items = state.owned[baseId] ? state.owned[baseId].items : [];
  const s = {
    beds: tr.beds || 0, comfort: tr.comfort || 0, defense: tr.defense || 0,
    food: tr.food || 0, water: tr.water || 0, power: tr.power || 0, solar: 0, use: 0,
    pFood: 0, pWater: 0, rainWater: 0, scrap: tr.scrap || 0,
    foodCap: 20 + (tr.cap || 0), waterCap: 20 + (tr.cap || 0), powerCap: 10,
    scav: tr.scav || 0, recruit: tr.recruit || 0, medical: tr.medical || 0, foodMult: tr.foodMult || 1,
  };
  for (const it of items) {
    const d = ITEM_BY_ID[it.id];
    if (!d) continue;
    s.beds += d.beds || 0;
    s.comfort += d.comfort || 0;
    s.defense += d.defense || 0;
    s.foodCap += d.foodCap || 0;
    s.waterCap += d.waterCap || 0;
    s.powerCap += d.powerCap || 0;
    s.scav += d.scav || 0;
    s.recruit += d.recruit || 0;
    s.medical += d.medical || 0;
    s.scrap += d.scrap || 0;
    if (d.foodMult) s.foodMult += d.foodMult;
    if (d.power > 0) { if (d.solar) s.solar += d.power; else s.power += d.power; }
    if (d.power < 0) s.use += -d.power;
    if (d.food) { if (d.needsPower) s.pFood += d.food; else s.food += d.food; }
    if (d.water) {
      if (d.needsPower) s.pWater += d.water; else s.water += d.water;
      if (d.rain) s.rainWater += d.water * (d.rain - 1);
    }
  }
  return s;
}

export function threatFor(day) {
  return Math.round(2 + (day - 1) * 2.4);
}

export function present(state) {
  return state.survivors - (state.scav ? 1 : 0);
}

// Advance the world by dh in-game hours. Returns a list of events for the UI.
export function step(state, dh) {
  const ev = [];
  const st = stats(state);
  const hour = state.time % 24;
  const sun = daylight(hour);
  const net = st.power + st.solar * sun - st.use;
  state.power = clamp(state.power + net * dh, 0, st.powerCap);
  state.powered = state.power > 0.01 || net >= 0;

  const foodIn = (st.food + (state.powered ? st.pFood : 0)) * st.foodMult;
  const waterIn = st.water + (state.powered ? st.pWater : 0) + (state.rain ? st.rainWater : 0);
  state.food = clamp(state.food + (foodIn - state.survivors * EAT) * dh, 0, st.foodCap);
  state.water = clamp(state.water + (waterIn - state.survivors * DRINK) * dh, 0, st.waterCap);
  state.scrap += st.scrap * dh;
  if (state.creative) { state.scrap = Math.max(state.scrap, 99999); state.food = st.foodCap; state.water = st.waterCap; }

  if (state.food <= 0 || state.water <= 0) {
    state.hunger += dh;
    const limit = st.medical ? 30 : 16;
    if (state.hunger >= limit && state.survivors > 1) {
      state.survivors -= 1;
      state.hunger = 0;
      ev.push({ type: 'bad', text: `A survivor left to find ${state.food <= 0 ? 'food' : 'water'} elsewhere.` });
    }
  } else {
    state.hunger = Math.max(0, state.hunger - dh * 2);
  }

  // new survivors find you if there's room and it feels like home
  if (st.beds > state.survivors && st.comfort >= state.survivors * 2) {
    const chance = 0.025 * (1 + st.recruit) * dh;
    if (Math.random() < chance) {
      state.survivors += 1;
      ev.push({ type: 'good', text: 'A survivor saw your lights and joined you. 👋' });
    }
  }

  if (state.scav && state.time >= state.scav.end) ev.push(...finishScavenge(state, st));

  state.time += dh;
  const idx = Math.floor(state.time / 24);
  if (idx > state.dayIdx) {
    state.dayIdx = idx;
    ev.push(...nightAttack(state, st, idx));
    state.rain = Math.random() < 0.4;
  }
  return ev;
}

function nightAttack(state, st, day) {
  const ev = [];
  const threat = threatFor(day) + Math.floor(Math.random() * 2);
  const def = st.defense + present(state);
  const base = state.owned[state.active];
  if (def >= threat) {
    const loot = 2 + Math.floor(threat * 0.8);
    state.scrap += loot;
    ev.push({ type: 'good', text: `Night ${day}: held off ${threat} zombies. +${loot} 🔩`, shake: 4 });
  } else {
    const dmg = (threat - def) * 7;
    base.hp = Math.max(0, base.hp - dmg);
    ev.push({ type: 'bad', text: `Night ${day}: ${threat} zombies hit the walls. -${dmg} ❤️`, shake: 12 });
    if (base.hp <= 0) {
      state.food *= 0.6;
      state.water *= 0.6;
      const victims = base.items.filter(i => ITEM_BY_ID[i.id] && ITEM_BY_ID[i.id].layer === 'floor');
      if (victims.length) {
        const v = victims[Math.floor(Math.random() * victims.length)];
        base.items.splice(base.items.indexOf(v), 1);
        ev.push({ type: 'bad', text: `They broke in! Lost the ${ITEM_BY_ID[v.id].name} and some supplies.` });
      }
      base.hp = 35;
    }
  }
  return ev;
}

export function startScavenge(state) {
  const hour = state.time % 24;
  if (state.scav) return 'Someone is already out scavenging.';
  if (hour < 6 || hour > 17) return 'Too dark to go out. Wait for morning.';
  if (present(state) < 1) return 'Nobody is home to go.';
  state.scav = { start: state.time, end: state.time + 3 };
  return null;
}

function finishScavenge(state, st) {
  state.scav = null;
  const day = state.dayIdx + 1;
  const mult = 1 + st.scav;
  const scrap = Math.round((8 + Math.random() * 14 + day * 1.5) * mult);
  const food = Math.round(Math.random() * 4 * mult);
  const water = Math.round(Math.random() * 4 * mult);
  state.scrap += scrap;
  state.food = Math.min(st.foodCap, state.food + food);
  state.water = Math.min(st.waterCap, state.water + water);
  const parts = [`+${scrap} 🔩`];
  if (food) parts.push(`+${food} 🥫`);
  if (water) parts.push(`+${water} 💧`);
  return [{ type: 'good', text: `Scavenger is back: ${parts.join(' ')}` }];
}

export function repairCost(state) {
  const b = state.owned[state.active];
  return Math.ceil((100 - b.hp) * 0.4);
}

export function repair(state) {
  const cost = repairCost(state);
  if (cost <= 0) return 'Already in good shape.';
  if (state.scrap < cost) return `Need ${cost} 🔩 to repair.`;
  state.scrap -= cost;
  state.owned[state.active].hp = 100;
  return null;
}

// ---- layout helpers ------------------------------------------------------

export function occupancy(items) {
  const occ = {};
  items.forEach((it, idx) => {
    const d = ITEM_BY_ID[it.id];
    if (!d) return;
    for (let k = 0; k < d.w; k++) occ[`${it.f}:${it.c + k}:${d.layer}`] = idx;
  });
  return occ;
}

export function canPlace(def, items, itemId, f, c) {
  const d = ITEM_BY_ID[itemId];
  if (c + d.w > def.floors[f]) return false;
  if (d.env && !d.env.includes(def.env)) return false;
  const occ = occupancy(items);
  for (let k = 0; k < d.w; k++) if (occ[`${f}:${c + k}:${d.layer}`] !== undefined) return false;
  return true;
}

// Fit the item starting at the tapped cell, or shift left if it overhangs.
export function bestFit(def, items, itemId, f, c) {
  const d = ITEM_BY_ID[itemId];
  for (let off = 0; off < d.w; off++) {
    const cc = c - off;
    if (cc >= 0 && canPlace(def, items, itemId, f, cc)) return cc;
  }
  return -1;
}

export function buyBase(state, def) {
  if (state.owned[def.id]) return null;
  if (!state.creative && state.scrap < def.cost) return `Need ${def.cost} 🔩.`;
  if (!state.creative) state.scrap -= def.cost;
  state.owned[def.id] = { items: [{ id: 'bedroll', f: 0, c: 0 }, { id: 'lantern', f: 0, c: 0 }], hp: 100 };
  return null;
}

// A furnished layout for previews and gallery cards.
export function showcaseItems(def) {
  const r = rng(strHash(def.id));
  const floorPool = ['bed', 'sofa', 'bookshelf', 'planter', 'hydro', 'fridge', 'stove', 'pantry', 'armchair',
    'pet_bed', 'tv', 'purifier', 'rain_barrel', 'table', 'water_jugs', 'heater', 'aquarium', 'bunk',
    'workbench', 'crates', 'lookout', 'radio_set', 'cot', 'bedroll'];
  const wallPool = ['string_lights', 'lantern', 'map', 'hanging_plant', 'photos', 'shelf', 'clock',
    'wall_lamp', 'sill_plants', 'poster', 'string_lights', 'medcab', 'wall_radio'];
  const items = [];
  def.floors.forEach((cols, f) => {
    let c = 0;
    while (c < cols) {
      let placed = false;
      for (let tries = 0; tries < 8; tries++) {
        const id = floorPool[Math.floor(r() * floorPool.length)];
        const d = ITEM_BY_ID[id];
        if (d.w <= cols - c && (!d.env || d.env.includes(def.env))) {
          items.push({ id, f, c });
          c += d.w;
          placed = true;
          break;
        }
      }
      if (!placed) c++;
    }
    for (let k = 0; k < cols; k++) {
      if (r() < 0.2) continue;
      items.push({ id: wallPool[Math.floor(r() * wallPool.length)], f, c: k });
    }
  });
  return items;
}
