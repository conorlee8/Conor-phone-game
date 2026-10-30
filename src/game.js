import { BASES, BASE_BY_ID, LOCATION_BY_ID } from './data/havens.js';
import { clamp, smooth } from './util.js';

export const SAVE_KEY = 'haven-save-v2';
export const HOURS_PER_SEC = 0.08; // one in-game day = 5 real minutes at 1x
const EAT = 0.15;
const DRINK = 0.2;

export function newGame() {
  return {
    v: 2,
    time: 8,
    dayIdx: 0,
    speed: 1,
    scrap: 40,
    food: 15,
    water: 15,
    survivors: 2,
    hunger: 0,
    rain: false,
    active: 'train_car',
    owned: { train_car: { done: [], hp: 100 } },
    runs: [],
  };
}

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s || s.v !== 2 || !BASE_BY_ID[s.active]) return null;
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

export const daylight = hour => smooth(5.5, 7.5, hour) - smooth(18, 20, hour);

// How many tiers of a base are fully built; also its art stage (0-3).
export function stageOf(state, baseId) {
  const b = BASE_BY_ID[baseId];
  const done = new Set(state.owned[baseId]?.done || []);
  let n = 0;
  for (const tier of b.tiers) {
    if (tier.items.every(it => done.has(it.id))) n++;
    else break;
  }
  return n;
}

export function stats(state, baseId = state.active) {
  const b = BASE_BY_ID[baseId];
  const tr = b.trait;
  const s = {
    beds: 1, comfort: 0, defense: tr.defense || 0,
    food: tr.food || 0, water: tr.water || 0, scrap: tr.scrap || 0,
    foodCap: 25, waterCap: 25,
  };
  const done = new Set(state.owned[baseId]?.done || []);
  for (const tier of b.tiers) {
    for (const it of tier.items) {
      if (!done.has(it.id)) continue;
      for (const [k, v] of Object.entries(it.fx)) s[k] = (s[k] || 0) + v;
    }
  }
  return s;
}

export const threatFor = day => Math.round(2 + (day - 1) * 2.4);
export const away = state => state.runs.length;
export const home = state => state.survivors - away(state);

export function canAfford(state, cost) {
  return Object.entries(cost).every(([k, v]) => state[k] >= v);
}

export function build(state, itemId) {
  const b = BASE_BY_ID[state.active];
  const tierIdx = stageOf(state, state.active);
  const tier = b.tiers[tierIdx];
  const it = tier && tier.items.find(i => i.id === itemId);
  const own = state.owned[state.active];
  if (!it || own.done.includes(itemId)) return { err: 'Not available yet.' };
  if (!canAfford(state, it.cost)) return { err: 'Not enough supplies.' };
  for (const [k, v] of Object.entries(it.cost)) state[k] -= v;
  own.done.push(itemId);
  const leveled = stageOf(state, state.active) > tierIdx;
  return { item: it, leveled };
}

export function step(state, dh) {
  const ev = [];
  const st = stats(state);
  state.food = clamp(state.food + (st.food - state.survivors * EAT) * dh, 0, st.foodCap);
  state.water = clamp(state.water + (st.water * (state.rain ? 1.6 : 1) - state.survivors * DRINK) * dh, 0, st.waterCap);
  state.scrap += st.scrap * dh;

  if (state.food <= 0 || state.water <= 0) {
    state.hunger += dh;
    if (state.hunger >= 18 && state.survivors > 1) {
      state.survivors -= 1;
      state.hunger = 0;
      ev.push({ type: 'bad', text: `A survivor left to find ${state.food <= 0 ? 'food' : 'water'} elsewhere.` });
    }
  } else {
    state.hunger = Math.max(0, state.hunger - dh * 2);
  }

  if (st.beds > state.survivors && st.comfort >= state.survivors * 2 && Math.random() < 0.03 * dh) {
    state.survivors += 1;
    ev.push({ type: 'good', text: 'A stranger saw your lights and asked to stay. 👋' });
  }

  for (const run of state.runs.filter(r => state.time >= r.end)) {
    state.runs.splice(state.runs.indexOf(run), 1);
    ev.push(finishRun(state, run, st));
  }

  state.time += dh;
  const idx = Math.floor(state.time / 24);
  if (idx > state.dayIdx) {
    state.dayIdx = idx;
    ev.push(nightAttack(state, st, idx));
    state.rain = Math.random() < 0.4;
  }
  return ev;
}

function nightAttack(state, st, day) {
  const threat = threatFor(day) + Math.floor(Math.random() * 2);
  const def = st.defense + home(state);
  const base = state.owned[state.active];
  if (def >= threat) {
    const loot = 2 + Math.floor(threat * 0.8);
    state.scrap += loot;
    return { type: 'good', night: true, text: `Night ${day}: ${threat} zombies came. You held. +${loot} 🔩` };
  }
  const dmg = (threat - def) * 7;
  base.hp = Math.max(0, base.hp - dmg);
  if (base.hp <= 0) {
    state.food *= 0.5;
    state.water *= 0.5;
    base.hp = 35;
    return { type: 'bad', night: true, text: `Night ${day}: they broke in! Half your food and water is gone.` };
  }
  return { type: 'bad', night: true, text: `Night ${day}: ${threat} zombies battered the walls. -${dmg} ❤️` };
}

export function startRun(state, locId) {
  const loc = LOCATION_BY_ID[locId];
  const hour = state.time % 24;
  if (home(state) < 1) return 'Everyone is already out.';
  if (hour < 6 || hour + loc.hours > 21) return 'Too close to dark. Wait for morning.';
  state.runs.push({ loc: locId, end: state.time + loc.hours });
  return null;
}

function finishRun(state, run, st) {
  const loc = LOCATION_BY_ID[run.loc];
  if (Math.random() < loc.risk) {
    return { type: 'bad', text: `${loc.icon} The ${loc.name.toLowerCase()} was crawling with them. Came back empty-handed.` };
  }
  const roll = ([a, b]) => Math.round(a + Math.random() * (b - a));
  const got = { scrap: roll(loc.loot.scrap), food: roll(loc.loot.food), water: roll(loc.loot.water) };
  state.scrap += got.scrap;
  state.food = Math.min(st.foodCap, state.food + got.food);
  state.water = Math.min(st.waterCap, state.water + got.water);
  const parts = [`+${got.scrap} 🔩`];
  if (got.food) parts.push(`+${got.food} 🥫`);
  if (got.water) parts.push(`+${got.water} 💧`);
  return { type: 'good', text: `${loc.icon} Back from the ${loc.name.toLowerCase()}: ${parts.join(' ')}` };
}

export function repairCost(state) {
  return Math.ceil((100 - state.owned[state.active].hp) * 0.4);
}

export function repair(state) {
  const cost = repairCost(state);
  if (cost <= 0) return 'Already in good shape.';
  if (state.scrap < cost) return `Need ${cost} 🔩 to repair.`;
  state.scrap -= cost;
  state.owned[state.active].hp = 100;
  return null;
}

export function buyBase(state, baseId) {
  const b = BASE_BY_ID[baseId];
  if (state.owned[baseId]) return null;
  if (state.scrap < b.cost) return `Need ${b.cost} 🔩.`;
  state.scrap -= b.cost;
  state.owned[baseId] = { done: [], hp: 100 };
  return null;
}

export { BASES };
