import { BASES, BASE_BY_ID, GROUPS } from './data/bases.js';
import { ITEMS, ITEM_BY_ID, itemSummary } from './data/items.js';
import { Scene, renderThumb, darkness } from './render/scene.js';
import { layoutBase, hitCell, FLOOR_H, BAND_H } from './render/shell.js';
import { ART, SLEEP_SPOTS } from './render/itemArt.js';
import { LOOKS } from './render/people.js';
import * as G from './game.js';
import { clamp } from './util.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
const scene = new Scene(canvas);

let state = G.load() || G.newGame();
let viewId = state.active;
let L = layoutBase(BASE_BY_ID[viewId]);
let build = false;
let sel = null;
let W = 0, H = 0;
let zoom = 1;
const pan = { x: 0, y: 0 };
const cam = { x: 0, y: 0, s: 40 };
let people = [];
let zombies = [];
let t = 0;
let shake = 0;
let galleryTab = 'vehicle';
const showcase = {};

const def = () => BASE_BY_ID[viewId];
const isHome = () => viewId === state.active;
function viewItems() {
  const o = state.owned[viewId];
  return o ? o.items : (showcase[viewId] ||= G.showcaseItems(BASE_BY_ID[viewId]));
}

// ---------------------------------------------------------------------------
// Layout & camera

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  scene.resize(W, H, Math.min(window.devicePixelRatio || 1, 2));
}

function fit() {
  const b = L.bounds;
  const top = $('hud').getBoundingClientRect().bottom + 6;
  const banner = $('banner');
  const bottomEl = banner.classList.contains('hidden') ? $('bar') : banner;
  const bottom = bottomEl.getBoundingClientRect().top - 6;
  const ah = Math.max(120, bottom - top);
  const sFit = Math.min((W - 12) / (b.maxX - b.minX), ah / (b.maxY - b.minY));
  return { sFit, cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, midY: (top + bottom) / 2 };
}

function resetView() {
  const f = fit();
  zoom = clamp(30 / f.sFit, 1, 2.6);
  pan.x = 0;
  pan.y = 0;
}

function updateCam() {
  const f = fit();
  const b = L.bounds;
  cam.s = f.sFit * zoom;
  const mx = Math.max(0, (b.maxX - b.minX) / 2 - W / 2 / cam.s + 1);
  const my = Math.max(0, (b.maxY - b.minY) / 2 - (H / 2) / cam.s + 1.5);
  pan.x = clamp(pan.x, -mx, mx);
  pan.y = clamp(pan.y, -my, my);
  const sh = shake > 0 ? (Math.random() - 0.5) * shake / cam.s : 0;
  cam.x = f.cx + pan.x + sh;
  cam.y = f.cy - (f.midY - H / 2) / cam.s + pan.y;
}

function setView(id) {
  viewId = id;
  L = layoutBase(BASE_BY_ID[id]);
  sel = null;
  if (!isHome()) setBuild(false);
  people = [];
  zombies = [];
  renderBanner();
  resetView();
}

// ---------------------------------------------------------------------------
// Survivors

function syncPeople() {
  const n = isHome() ? G.present(state) : 0;
  while (people.length < n) {
    const i = people.length;
    const f = i % L.rooms.length;
    const rm = L.rooms[f];
    const x = rm.x + 0.4 + Math.random() * Math.max(0.1, rm.w - 0.8);
    people.push({ look: LOOKS[i % LOOKS.length], f, x, dir: 1, state: 'idle', phase: Math.random() * 10, target: x, wait: 1 + Math.random() * 3 });
  }
  people.length = n;
}

function updatePeople(dt, hour) {
  const night = hour >= 22 || hour < 6;
  const items = viewItems();
  const spots = [];
  let guardAt = null;
  for (const it of items) {
    const rm = L.rooms[it.f];
    if (!rm) continue;
    const fn = SLEEP_SPOTS[it.id];
    if (fn) for (const p of fn(rm.x + it.c, rm.fy - 0.06)) spots.push({ ...p, f: it.f });
    const d = ITEM_BY_ID[it.id];
    if (!guardAt && d && d.layer === 'floor' && d.defense) guardAt = { f: it.f, x: rm.x + it.c + d.w + 0.25 };
  }
  people.forEach((p, i) => {
    if (p.f >= L.rooms.length) p.f = 0;
    if (night) {
      if (i === 0 && guardAt) {
        p.state = 'guard'; p.f = guardAt.f; p.x = Math.min(guardAt.x, L.rooms[p.f].x + L.rooms[p.f].w - 0.3); p.dir = 1;
        return;
      }
      const sp = spots[i - (guardAt ? 1 : 0)];
      if (sp) { p.state = 'sleep'; p.sx = sp.x; p.sy = sp.y; p.f = sp.f; return; }
    }
    if (p.state === 'sleep' || p.state === 'guard') { p.state = 'idle'; p.wait = 0.5 + Math.random() * 2; }
    const rm = L.rooms[p.f];
    p.x = clamp(p.x, rm.x + 0.25, rm.x + rm.w - 0.25);
    if (p.state === 'idle') {
      p.wait -= dt;
      if (p.wait <= 0) {
        if (L.rooms.length > 1 && Math.random() < 0.15) {
          p.f = Math.floor(Math.random() * L.rooms.length);
          const r2 = L.rooms[p.f];
          p.x = r2.x + 0.3;
          p.target = r2.x + 0.3 + Math.random() * (r2.w - 0.6);
        } else {
          p.target = rm.x + 0.3 + Math.random() * Math.max(0.1, rm.w - 0.6);
        }
        p.state = 'walk';
      }
    } else {
      const d = p.target - p.x;
      p.dir = d > 0 ? 1 : -1;
      if (Math.abs(d) < 0.04) { p.state = 'idle'; p.wait = 2 + Math.random() * 6; }
      else { p.x += Math.sign(d) * Math.min(Math.abs(d), 0.55 * dt); p.phase += dt; }
    }
  });
}

// ---------------------------------------------------------------------------
// The horde

function canFront() {
  const d = def();
  return !(d.env === 'water' || d.env === 'coast');
}

// Zombies walk in two lanes: "back" ones stand behind the base (you see them
// through the windows) and "front" ones prowl the ground in front of it.
function spawnZombie(lane, anywhere) {
  const d = def();
  const water = d.env === 'water' || d.env === 'coast';
  const half = W / 2 / cam.s + 1.5;
  const bh = L.bw / 2 + 0.6;
  const side = Math.random() < 0.5 ? -1 : 1;
  let x = anywhere ? cam.x + (Math.random() * 2 - 1) * half : cam.x + side * (half + Math.random() * 3);
  const z = { lane, x, speed: 0.16 + Math.random() * 0.24, phase: Math.random() * 10, turn: 2 + Math.random() * 6 };
  if (lane === 'front') {
    if (anywhere && Math.abs(x) < bh && !underBase()) x = side * (bh + Math.random() * 2);
    z.x = x;
    z.depth = 1;
    z.y = 0.3 + Math.random() * 1.4;
    z.scale = 1.0 + z.y * 0.15;
  } else {
    z.depth = water ? 0.12 + Math.random() * 0.1 : 0.15 + Math.random() * 0.85;
    z.y = water ? -0.56 : -(1 - z.depth) * 0.55;
    z.scale = water ? 0.3 : 0.42 + 0.58 * z.depth;
  }
  z.dir = anywhere ? (Math.random() < 0.5 ? -1 : 1) : -side;
  return z;
}

// Elevated bases leave room for the horde to shamble underneath.
function underBase() {
  return L.bottom < -1.5;
}

function updateZombies(dt, hour) {
  const dark = darkness(hour);
  const day = state.dayIdx + 1;
  const wantBack = Math.round(3 + dark * (4 + Math.min(day * 1.2, 18)));
  const wantFront = canFront() ? Math.round(1 + dark * Math.min(2 + day * 0.8, 12)) : 0;
  const first = zombies.length === 0;
  const count = lane => zombies.filter(z => z.lane === lane).length;
  for (let n = count('back'); n < wantBack; n++) zombies.push(spawnZombie('back', first));
  for (let n = count('front'); n < wantFront; n++) zombies.push(spawnZombie('front', first));
  const half = W / 2 / cam.s + 1.5;
  const bh = L.bw / 2 + 0.5;
  const blockFront = !underBase();
  for (const z of zombies) {
    z.x += z.dir * z.speed * z.scale * dt;
    z.phase += dt * z.speed * 7;
    z.turn -= dt;
    const near = z.lane === 'front' || z.depth > 0.5;
    // front zombies may pass in front of the base only below the floor line
    const clear = z.y - 1.05 * z.scale > L.rooms[0].fy - 0.15;
    if (z.lane === 'front' && blockFront && !clear && Math.abs(z.x) < bh) {
      z.x = Math.sign(z.x || 1) * bh;
      z.dir = z.x < 0 ? -1 : 1;
      z.turn = 1 + Math.random() * 2;
    }
    if (dark > 0.4 && near) {
      const edge = bh + 0.3 + (z.phase % 1.7);
      if (Math.abs(z.x) > edge) z.dir = z.x < 0 ? 1 : -1;
      else if (z.turn < 0) { z.dir *= -1; z.turn = 1 + Math.random() * 3; }
    } else if (z.turn < 0) {
      if (Math.random() < 0.3) z.dir *= -1;
      z.turn = 3 + Math.random() * 8;
    }
  }
  zombies = zombies.filter(z => Math.abs(z.x - cam.x) < half + 6);
  for (const lane of ['back', 'front']) {
    const want = lane === 'back' ? wantBack : wantFront;
    let extra = count(lane) - want - 3;
    if (extra > 0) zombies = zombies.filter(z => z.lane !== lane || extra-- <= 0);
  }
}

// ---------------------------------------------------------------------------
// HUD

function fmtHour(h) {
  const hh = Math.floor(h), mm = Math.floor((h % 1) * 6) * 10;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function renderHUD() {
  const st = G.stats(state);
  const hour = state.time % 24;
  const day = Math.floor(state.time / 24) + 1;
  const d = BASE_BY_ID[state.active];
  const icon = darkness(hour) > 0.5 ? '🌙' : '☀️';
  const wx = state.rain ? (d.env === 'snow' ? ' ❄️' : ' 🌧') : '';
  $('clock').textContent = `${icon} Day ${day} · ${fmtHour(hour)}${wx}`;
  const hp = state.owned[state.active].hp;
  $('baseLabel').textContent = isHome() ? `${d.name}` : `Viewing: ${def().name}`;
  $('speedBtn').textContent = state.speed === 0 ? '⏸' : `${state.speed}×`;

  const pres = G.present(state);
  const defense = st.defense + pres;
  const threat = G.threatFor(day);
  const chips = [
    ['🔩', Math.floor(state.scrap), '', 'Scrap: build furniture and buy new bases'],
    ['🥫', `${Math.floor(state.food)}/${st.foodCap}`, state.food < 3 ? 'warn' : '', 'Food: each survivor eats 3.6 a day'],
    ['💧', `${Math.floor(state.water)}/${st.waterCap}`, state.water < 3 ? 'warn' : '', 'Water: each survivor drinks 4.8 a day'],
    ['⚡', `${Math.floor(state.power)}/${st.powerCap}`, !state.powered ? 'warn' : '', 'Power: runs lamps, purifiers, hydroponics'],
    ['👥', `${state.survivors}/${Math.max(st.beds, state.survivors)}`, '', 'Survivors / beds. Free beds + comfort attract more'],
    ['🛋', Math.round(st.comfort), '', 'Comfort: helps new survivors decide to stay'],
    ['🛡', `${defense} vs ${threat}`, defense < threat ? 'warn' : 'ok', 'Defense vs tonight’s horde. Attack hits at midnight'],
    ['❤️', hp, hp < 50 ? 'warn' : '', 'Base integrity. Tap to repair'],
  ];
  $('res').innerHTML = chips.map(([i, v, cls, tip], k) =>
    `<span class="chip ${cls}" data-tip="${tip}" data-k="${k}">${i} ${v}</span>`).join('');

  const sl = $('scavLabel');
  if (state.scav) sl.textContent = `Back in ${Math.max(0, Math.ceil((state.scav.end - state.time) * 10) / 10)}h`;
  else sl.textContent = 'Scavenge';
  document.querySelector('[data-act="build"]').classList.toggle('on', build);
}

$('res').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  if (chip.dataset.k === '7') {
    const err = G.repair(state);
    toast(err || 'Repaired to 100 ❤️', err ? 'bad' : 'good');
    renderHUD();
    return;
  }
  toast(chip.dataset.tip);
});

function toast(text, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3800);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

function handleEvents(evs) {
  for (const e of evs) {
    toast(e.text, e.type);
    if (e.shake) shake = Math.max(shake, e.shake);
  }
}

// ---------------------------------------------------------------------------
// Banner (preview / build hint)

function renderBanner() {
  const b = $('banner');
  const d = def();
  if (!isHome()) {
    const owned = !!state.owned[d.id];
    const afford = state.creative || state.scrap >= d.cost;
    b.className = 'banner';
    b.innerHTML = `
      <h3>${d.name}</h3>
      <p>${d.blurb || ''}</p>
      <div class="trait">${d.trait?.text || ''} · ${d.floors.reduce((a, n) => a + n, 0)} slots, ${d.floors.length} floor${d.floors.length > 1 ? 's' : ''}</div>
      <div class="actions">
        ${owned ? '<button class="cta" data-b="move">Move in</button>'
                : `<button class="cta" data-b="buy" ${afford ? '' : 'disabled'}>Buy · 🔩 ${d.cost}</button>`}
        <button class="cta secondary" data-b="home">Back home</button>
      </div>`;
  } else if (build) {
    b.className = 'banner hint';
    b.textContent = 'Tap a dashed slot. Top row hangs on the wall, bottom row stands on the floor.';
  } else {
    b.className = 'banner hidden';
  }
}

$('banner').addEventListener('click', e => {
  const btn = e.target.closest('[data-b]');
  if (!btn) return;
  const d = def();
  if (btn.dataset.b === 'buy') {
    const err = G.buyBase(state, d);
    if (err) toast(err, 'bad');
    else { toast(`${d.name} is yours. Move in when ready.`, 'good'); G.save(state); }
    renderBanner();
  } else if (btn.dataset.b === 'move') {
    state.active = d.id;
    G.save(state);
    toast(`Moved into the ${d.name}.`, 'good');
    setView(d.id);
  } else if (btn.dataset.b === 'home') {
    setView(state.active);
  }
});

// ---------------------------------------------------------------------------
// Sheet

function openSheet(title, html, tall = false) {
  $('sheetTitle').textContent = title;
  $('sheetBody').innerHTML = html;
  $('sheet').classList.remove('hidden');
  $('sheet').classList.toggle('tall', tall);
  $('scrim').classList.remove('hidden');
  $('sheetBody').scrollTop = 0;
}

function closeSheet() {
  $('sheet').classList.add('hidden');
  $('scrim').classList.add('hidden');
  sel = null;
}
$('sheetClose').addEventListener('click', closeSheet);
$('scrim').addEventListener('click', closeSheet);

function itemIcon(cv, d) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = 54 * dpr; cv.height = 54 * dpr;
  const c = cv.getContext('2d');
  const h = d.layer === 'wall' ? BAND_H : FLOOR_H;
  const s = (54 * dpr) / (Math.max(d.w, h) + 0.25);
  c.setTransform(s, 0, 0, s, (54 * dpr - d.w * s) / 2, (54 * dpr + h * s) / 2);
  ART[d.id]?.(c, 0, 0, d.w, h, { t: 1, lit: true, night: 0.6, lights: [], hour: 10, rain: false });
}

function openPicker(cell) {
  const d = BASE_BY_ID[state.active];
  const items = state.owned[state.active].items;
  const list = ITEMS.filter(it => it.layer === cell.layer && (!it.env || it.env.includes(d.env)));
  const rows = list.map(it => {
    const fitC = G.bestFit(d, items, it.id, cell.f, cell.c);
    const ok = fitC >= 0 && (state.creative || state.scrap >= it.cost);
    const why = fitC < 0 ? ` · needs ${it.w} free slots` : '';
    return `<button class="row-item" data-id="${it.id}" ${ok ? '' : 'disabled'}>
      <canvas data-icon="${it.id}"></canvas>
      <div class="txt"><div class="name">${it.name}${it.w > 1 ? ` <span class="sub">(${it.w} wide)</span>` : ''}</div>
      <div class="sub">${itemSummary(it)}${why}</div></div>
      <div class="cost">🔩 ${it.cost}</div></button>`;
  }).join('');
  openSheet(cell.layer === 'wall' ? 'Hang on the wall' : 'Place on the floor', `<div class="list">${rows}</div>`);
  sel = cell;
  $('sheetBody').querySelectorAll('canvas[data-icon]').forEach(cv => itemIcon(cv, ITEM_BY_ID[cv.dataset.icon]));
  $('sheetBody').onclick = e => {
    const btn = e.target.closest('.row-item');
    if (!btn || btn.disabled) return;
    const it = ITEM_BY_ID[btn.dataset.id];
    const c = G.bestFit(d, items, it.id, cell.f, cell.c);
    if (c < 0) return;
    if (!state.creative) state.scrap -= it.cost;
    items.push({ id: it.id, f: cell.f, c });
    G.save(state);
    toast(`Built ${it.name}.`, 'good');
    closeSheet();
    renderHUD();
  };
}

function openItem(idx) {
  const items = viewItems();
  const it = items[idx];
  const d = ITEM_BY_ID[it.id];
  const refund = Math.floor(d.cost / 2);
  openSheet(d.name, `
    <div class="row-item" style="margin-bottom:12px"><canvas data-icon="${d.id}"></canvas>
      <div class="txt"><div class="sub">${itemSummary(d)}</div></div></div>
    <div class="stack"><button class="cta danger" id="rm">Remove · refund 🔩 ${refund}</button></div>`);
  itemIcon($('sheetBody').querySelector('canvas'), d);
  $('sheetBody').onclick = e => {
    if (e.target.id !== 'rm') return;
    items.splice(idx, 1);
    if (!state.creative) state.scrap += refund;
    G.save(state);
    closeSheet();
    renderHUD();
  };
}

// ---------------------------------------------------------------------------
// Bases gallery

let thumbObserver = null;

function openGallery() {
  const tabs = `<div class="tabs">
    <button class="tab ${galleryTab === 'vehicle' ? 'on' : ''}" data-tab="vehicle">🚐 Vehicles (${BASES.filter(b => b.cat === 'vehicle').length})</button>
    <button class="tab ${galleryTab === 'building' ? 'on' : ''}" data-tab="building">🏠 Buildings (${BASES.filter(b => b.cat === 'building').length})</button></div>`;
  const groups = GROUPS[galleryTab].map(g => {
    const list = BASES.filter(b => b.cat === galleryTab && b.group === g);
    const cards = list.map(b => {
      const owned = !!state.owned[b.id];
      const active = state.active === b.id;
      const tag = active ? '<span class="tag own">🏠 Home</span>' : owned ? '<span class="tag own">Owned</span>' : `<span class="tag">🔩 ${b.cost}</span>`;
      return `<button class="card ${active ? 'active' : ''}" data-id="${b.id}">
        <canvas data-thumb="${b.id}" width="320" height="200"></canvas>
        <div class="meta"><div class="name">${b.name}</div><div class="sub">${tag} · ${b.floors.reduce((a, n) => a + n, 0)} slots</div></div></button>`;
    }).join('');
    return `<div class="group-h">${g}</div><div class="cards">${cards}</div>`;
  }).join('');
  openSheet('Bases', tabs + groups, true);

  if (thumbObserver) thumbObserver.disconnect();
  thumbObserver = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const cv = en.target;
      thumbObserver.unobserve(cv);
      const b = BASE_BY_ID[cv.dataset.thumb];
      const items = state.owned[b.id] ? state.owned[b.id].items : (showcase[b.id] ||= G.showcaseItems(b));
      renderThumb(cv, b, items);
    }
  }, { root: $('sheetBody'), rootMargin: '200px' });
  $('sheetBody').querySelectorAll('canvas[data-thumb]').forEach(cv => thumbObserver.observe(cv));

  $('sheetBody').onclick = e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { galleryTab = tab.dataset.tab; openGallery(); return; }
    const card = e.target.closest('.card');
    if (!card) return;
    closeSheet();
    setView(card.dataset.id);
  };
}

// ---------------------------------------------------------------------------
// More

function openMore() {
  openSheet('Last Haven', `
    <div class="help">
      <p><b>Your base is everything.</b> Pick from ${BASES.filter(b => b.cat === 'vehicle').length} vehicles and ${BASES.filter(b => b.cat === 'building').length} buildings, then fill every slot.</p>
      <p>🔨 <b>Build</b>: tap a slot. The top row hangs on the wall, the bottom row stands on the floor.</p>
      <p>🎒 <b>Scavenge</b> in daylight for scrap, food and water.</p>
      <p>🛡 <b>Midnight</b>: the horde tests your defense. Sandbags, lookouts and survivors keep them out.</p>
      <p>👥 Free beds and comfort bring new survivors. Power keeps the lights, purifiers and grow racks on.</p>
    </div>
    <div class="stack">
      <label class="switch"><span>Creative mode<br><span class="sub" style="color:var(--muted);font-size:12px">Unlimited scrap and supplies, for decorating</span></span>
        <input type="checkbox" id="creative" ${state.creative ? 'checked' : ''}></label>
      <button class="cta danger" id="reset">Start over</button>
    </div>`);
  $('sheetBody').onclick = e => {
    if (e.target.id === 'reset') {
      if (e.target.dataset.armed) {
        G.wipe();
        state = G.newGame();
        closeSheet();
        setView(state.active);
        toast('A new story begins.');
      } else {
        e.target.dataset.armed = '1';
        e.target.textContent = 'Tap again to erase your save';
      }
    }
  };
  $('creative').onchange = e => {
    state.creative = e.target.checked;
    if (!state.creative) state.scrap = Math.min(state.scrap, 500);
    G.save(state);
    renderHUD();
  };
}

// ---------------------------------------------------------------------------
// Controls

function setBuild(on) {
  build = on && isHome();
  sel = null;
  renderBanner();
}

document.getElementById('bar').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'bases') openGallery();
  else if (act === 'build') {
    if (!isHome()) setView(state.active);
    setBuild(!build);
  } else if (act === 'scav') {
    if (!isHome()) setView(state.active);
    const err = G.startScavenge(state);
    toast(err || 'A survivor heads out to scavenge. Back in 3 hours.', err ? 'bad' : '');
  } else if (act === 'more') openMore();
  renderHUD();
});

$('speedBtn').addEventListener('click', () => {
  state.speed = state.speed === 1 ? 3 : state.speed === 3 ? 0 : 1;
  renderHUD();
});

const pointers = new Map();
let gesture = null;

canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) gesture = { moved: false, x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gesture = { moved: true, pinch: true, d: Math.hypot(a.x - b.x, a.y - b.y), zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, panX: pan.x, panY: pan.y };
  }
});

canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture.pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    zoom = clamp(gesture.zoom * d / gesture.d, 0.8, 6);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    pan.x = gesture.panX - (mx - gesture.mx) / cam.s;
    pan.y = gesture.panY - (my - gesture.my) / cam.s;
  } else if (!gesture.pinch) {
    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    if (Math.hypot(dx, dy) > 8) gesture.moved = true;
    if (gesture.moved) {
      pan.x = gesture.panX - dx / cam.s;
      pan.y = gesture.panY - dy / cam.s;
    }
  }
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (gesture && !gesture.moved && pointers.size === 0) tap(e.clientX, e.clientY);
  if (pointers.size === 0) gesture = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  zoom = clamp(zoom * Math.exp(-e.deltaY * 0.0015), 0.8, 6);
}, { passive: false });

canvas.addEventListener('dblclick', () => resetView());

function tap(sx, sy) {
  const wx = (sx - W / 2) / cam.s + cam.x;
  const wy = (sy - H / 2) / cam.s + cam.y;
  const hit = hitCell(L, wx, wy);
  if (!hit) return;
  const items = viewItems();
  const occ = G.occupancy(items);
  let idx = occ[`${hit.f}:${hit.c}:${hit.layer}`];
  if (idx === undefined && !build) {
    const other = hit.layer === 'wall' ? 'floor' : 'wall';
    idx = occ[`${hit.f}:${hit.c}:${other}`];
  }
  if (build) {
    if (idx !== undefined) openItem(idx);
    else openPicker({ f: hit.f, c: hit.c, layer: hit.layer });
  } else if (idx !== undefined) {
    const d = ITEM_BY_ID[items[idx].id];
    toast(`${d.name}: ${itemSummary(d)}`);
  } else if (isHome()) {
    toast('Empty slot. Tap 🔨 Build to furnish it.');
  }
}

// ---------------------------------------------------------------------------
// Loop

let last = performance.now();
let hudTimer = 0;
let saveTimer = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;

  let dh = dt * G.HOURS_PER_SEC * state.speed;
  while (dh > 1e-6) {
    const d = Math.min(dh, 0.1);
    handleEvents(G.step(state, d));
    dh -= d;
  }
  const hour = state.time % 24;

  syncPeople();
  updatePeople(dt, hour);
  updateCam();
  updateZombies(dt, hour);
  shake = Math.max(0, shake - dt * 20);

  const occ = build ? G.occupancy(viewItems()) : null;
  scene.render({
    cam, def: def(), L, hour, t,
    items: viewItems(),
    people,
    zombies,
    rain: state.rain,
    powered: isHome() ? state.powered !== false : true,
    build,
    occ,
    sel,
  });

  hudTimer -= dt;
  if (hudTimer <= 0) { renderHUD(); hudTimer = 0.25; }
  saveTimer -= dt;
  if (saveTimer <= 0) { G.save(state); saveTimer = 5; }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => { resize(); resetView(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(state); });
window.addEventListener('pagehide', () => G.save(state));

resize();
renderHUD();
renderBanner();
resetView();
requestAnimationFrame(frame);

// Debug hooks for automated screenshots.
window.__haven = {
  get state() { return state; },
  get zombies() { return zombies; },
  get cam() { return cam; },
  view: id => setView(id),
  setHour: h => { state.time = Math.floor(state.time / 24) * 24 + h; },
  gallery: () => openGallery(),
  build: on => setBuild(on),
};
