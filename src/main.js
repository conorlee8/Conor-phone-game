import { BASES, BASE_BY_ID, LOCATIONS } from './data/havens.js';
import { View, darkness, art } from './view.js';
import * as G from './game.js';
import { clamp } from './util.js';

const $ = id => document.getElementById(id);
const view = new View($('game'));

let state = G.load() || G.newGame();
let W = 0, H = 0;
let t = 0;
let sheet = null; // which sheet is open, so it can refresh live
const base = () => BASE_BY_ID[state.active];
const stage = () => G.stageOf(state, state.active);

// preload every stage of owned bases so upgrades swap instantly
function preload() {
  for (const id of Object.keys(state.owned)) for (const s of BASE_BY_ID[id].stages) art(s);
}

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  view.resize(W, H, Math.min(window.devicePixelRatio || 1, 2));
}

// ---------------------------------------------------------------------------
// HUD

const fmtHour = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 6) * 10).padStart(2, '0')}`;
const costText = cost => Object.entries(cost).map(([k, v]) => `${{ scrap: '🔩', food: '🥫', water: '💧' }[k]} ${v}`).join('  ');

function renderHUD() {
  const st = G.stats(state);
  const hour = state.time % 24;
  const day = Math.floor(state.time / 24) + 1;
  const icon = darkness(hour) > 0.5 ? '🌙' : '☀️';
  $('clock').textContent = `${icon} Day ${day} · ${fmtHour(hour)}${state.rain ? ' 🌧' : ''}`;
  $('baseLabel').textContent = `${base().name} · ${['Bare', 'Camp', 'Home', 'Fortified'][stage()]}`;
  $('speedBtn').textContent = state.speed === 0 ? '⏸' : `${state.speed}×`;
  const defense = st.defense + G.home(state);
  const threat = G.threatFor(day);
  const hp = state.owned[state.active].hp;
  const chips = [
    ['🔩', Math.floor(state.scrap), '', 'Scrap: build with it, buy new bases'],
    ['🥫', `${Math.floor(state.food)}/${st.foodCap}`, state.food < 4 ? 'warn' : '', 'Food: each survivor eats 3.6 a day'],
    ['💧', `${Math.floor(state.water)}/${st.waterCap}`, state.water < 4 ? 'warn' : '', 'Water: each survivor drinks 4.8 a day'],
    ['👥', `${G.home(state)}/${state.survivors}`, '', 'Survivors at home / total. Spare beds + comfort attract more'],
    ['🛋', Math.round(st.comfort), '', 'Comfort: makes strangers want to stay'],
    ['🛡', `${defense} vs ${threat}`, defense < threat ? 'warn' : 'ok', 'Your defense vs tonight’s horde. They come at midnight'],
    ['❤️', hp, hp < 50 ? 'warn' : '', 'Base health. Tap to repair'],
  ];
  $('res').innerHTML = chips.map(([i, v, cls, tip], k) =>
    `<span class="chip ${cls}" data-tip="${tip}" data-k="${k}">${i} ${v}</span>`).join('');
  $('scavLabel').textContent = state.runs.length ? `Out (${state.runs.length})` : 'Scavenge';
  if (sheet === 'scav') openScavenge();
}

$('res').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  if (chip.dataset.k === '6') {
    const err = G.repair(state);
    toast(err || 'Repaired. ❤️ 100', err ? 'bad' : 'good');
    renderHUD();
    return;
  }
  toast(chip.dataset.tip);
});

function toast(text, type = '', ms = 3800) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

// ---------------------------------------------------------------------------
// Sheets

function openSheet(title, html, tall = false) {
  $('sheetTitle').textContent = title;
  $('sheetBody').innerHTML = html;
  $('sheet').classList.remove('hidden');
  $('sheet').classList.toggle('tall', tall);
  $('scrim').classList.remove('hidden');
}

function closeSheet() {
  $('sheet').classList.add('hidden');
  $('scrim').classList.add('hidden');
  sheet = null;
}
$('sheetClose').addEventListener('click', closeSheet);
$('scrim').addEventListener('click', closeSheet);

function openBuild() {
  sheet = 'build';
  const b = base();
  const own = state.owned[b.id];
  const cur = stage();
  const tiers = b.tiers.map((tier, ti) => {
    const status = ti < cur ? '✅ Built' : ti === cur ? 'Building now' : '🔒 Finish the stage above first';
    const rows = tier.items.map(it => {
      const done = own.done.includes(it.id);
      const can = ti === cur && !done && G.canAfford(state, it.cost);
      const right = done ? '<div class="cost done">✓</div>' : `<div class="cost">${costText(it.cost)}</div>`;
      return `<button class="row-item ${done ? 'built' : ''}" data-id="${it.id}" ${can ? '' : 'disabled'}>
        <div class="emoji">${it.icon}</div>
        <div class="txt"><div class="name">${it.name}</div><div class="sub">${it.blurb} ${fxText(it.fx)}</div></div>
        ${right}</button>`;
    }).join('');
    return `<div class="group-h">Stage ${ti + 1}: ${tier.name} <span class="muted">· ${status}</span></div><div class="list">${rows}</div>`;
  }).join('');
  const header = cur >= b.tiers.length
    ? '<p class="lead">Fully built. Time to find a new home? Check 🏚️ Bases.</p>'
    : `<p class="lead">Build all three to transform the ${b.name.toLowerCase()} into a <b>${b.tiers[cur].name}</b>.</p>`;
  openSheet(`Build · ${b.name}`, header + tiers, true);
  $('sheetBody').onclick = e => {
    const btn = e.target.closest('.row-item');
    if (!btn || btn.disabled) return;
    const before = stage();
    const res = G.build(state, btn.dataset.id);
    if (res.err) { toast(res.err, 'bad'); return; }
    G.save(state);
    if (res.leveled) {
      closeSheet();
      view.transition(before, stage(), base());
      toast(`🎉 The ${base().name.toLowerCase()} is now a ${['', 'Camp', 'Home', 'Fortified'][stage()]}!`, 'good', 5000);
    } else {
      toast(`Built: ${res.item.name}`, 'good');
      openBuild();
    }
    renderHUD();
  };
}

function fxText(fx) {
  const m = { beds: '🛏', comfort: '🛋', defense: '🛡', food: '🥫', water: '💧', scrap: '🔩', foodCap: '🥫 cap', waterCap: '💧 cap' };
  return `<span class="fx">${Object.entries(fx).map(([k, v]) => `${m[k]} +${v}${['food', 'water', 'scrap'].includes(k) ? '/h' : ''}`).join(' · ')}</span>`;
}

function openScavenge() {
  sheet = 'scav';
  const hour = state.time % 24;
  const out = state.runs.map(r => {
    const loc = LOCATIONS.find(l => l.id === r.loc);
    return `<div class="row-item static"><div class="emoji">${loc.icon}</div><div class="txt"><div class="name">${loc.name}</div>
      <div class="sub">Back in ${Math.max(0, Math.ceil((r.end - state.time) * 10) / 10)} h</div></div></div>`;
  }).join('');
  const rows = LOCATIONS.map(l => {
    const ok = G.home(state) > 0 && hour >= 6 && hour + l.hours <= 21;
    return `<button class="row-item" data-loc="${l.id}" ${ok ? '' : 'disabled'}>
      <div class="emoji">${l.icon}</div>
      <div class="txt"><div class="name">${l.name}</div><div class="sub">${l.blurb} · ${l.hours} h · ${Math.round(l.risk * 100)}% risk</div></div>
      <div class="cost">Send</div></button>`;
  }).join('');
  const note = hour < 6 || hour > 18 ? '<p class="lead">It’s dark. Nobody goes out until morning.</p>'
    : `<p class="lead">${G.home(state)} survivor${G.home(state) === 1 ? '' : 's'} at home. Send someone out for supplies.</p>`;
  openSheet('Scavenge', note + (out ? `<div class="group-h">Out now</div><div class="list">${out}</div>` : '') + `<div class="group-h">Places</div><div class="list">${rows}</div>`);
  $('sheetBody').onclick = e => {
    const btn = e.target.closest('[data-loc]');
    if (!btn || btn.disabled) return;
    const err = G.startRun(state, btn.dataset.loc);
    if (err) { toast(err, 'bad'); return; }
    G.save(state);
    renderHUD();
  };
}

function openBases() {
  sheet = 'bases';
  const cards = BASES.map(b => {
    const owned = !!state.owned[b.id];
    const active = state.active === b.id;
    const st = owned ? G.stageOf(state, b.id) : 3;
    const tag = active ? '<span class="tag own">🏠 Home</span>' : owned ? '<span class="tag own">Owned · tap to move in</span>' : `<span class="tag">🔩 ${b.cost}</span>`;
    return `<button class="card ${active ? 'active' : ''}" data-id="${b.id}">
      <div class="thumb" style="background-image:url(assets/bases/${b.stages[st]}.webp)"></div>
      <div class="meta"><div class="name">${b.name}</div><div class="sub">${tag}</div>
      <div class="sub">${b.trait.text}</div></div></button>`;
  }).join('');
  openSheet('Bases', `<p class="lead">Every base starts bare. Build it up stage by stage.</p><div class="cards">${cards}</div>`, true);
  $('sheetBody').onclick = e => {
    const card = e.target.closest('.card');
    if (!card) return;
    const id = card.dataset.id;
    if (id === state.active) { closeSheet(); return; }
    if (!state.owned[id]) {
      const err = G.buyBase(state, id);
      if (err) { toast(err, 'bad'); return; }
      toast(`${BASE_BY_ID[id].name} is yours.`, 'good');
    }
    state.active = id;
    view.pan = { x: 0, y: 0 };
    view.zoom = 1;
    preload();
    G.save(state);
    closeSheet();
    toast(`Moved into the ${BASE_BY_ID[id].name.toLowerCase()}.`, 'good');
    renderHUD();
  };
}

function openMore() {
  sheet = 'more';
  openSheet('Last Haven', `
    <div class="help">
      <p>🔨 <b>Build</b> projects to transform your base: bare → camp → home → fortified.</p>
      <p>🎒 <b>Scavenge</b> in daylight for scrap, food and water. Riskier places pay more.</p>
      <p>🛡 At <b>midnight</b> the horde comes. Defense comes from what you build plus whoever is home.</p>
      <p>👥 Spare beds and comfort bring strangers in from the dark.</p>
      <p>🏚️ Save up for new <b>bases</b>. Each has its own strengths.</p>
      <p>Drag to look around. Pinch to zoom.</p>
    </div>
    <div class="stack"><button class="cta danger" id="reset">Start over</button></div>`);
  $('sheetBody').onclick = e => {
    if (e.target.id !== 'reset') return;
    if (!e.target.dataset.armed) {
      e.target.dataset.armed = '1';
      e.target.textContent = 'Tap again to erase your save';
      return;
    }
    G.wipe();
    state = G.newGame();
    preload();
    closeSheet();
    toast('A new story begins.');
  };
}

$('bar').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  ({ build: openBuild, scav: openScavenge, bases: openBases, more: openMore })[b.dataset.act]();
});

$('speedBtn').addEventListener('click', () => {
  state.speed = state.speed === 1 ? 4 : state.speed === 4 ? 0 : 1;
  renderHUD();
});

// ---------------------------------------------------------------------------
// Look around: drag to pan, pinch to zoom

const pointers = new Map();
let gesture = null;
const cv = $('game');
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  gesture = pts.length === 2
    ? { pinch: true, d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), zoom: view.zoom }
    : { x: e.clientX, y: e.clientY, px: view.pan.x, py: view.pan.y };
});
cv.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture.pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    view.zoom = clamp(gesture.zoom * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d, 1, 2.5);
  } else if (!gesture.pinch) {
    view.pan.x = gesture.px + (e.clientX - gesture.x);
    view.pan.y = gesture.py + (e.clientY - gesture.y);
  }
});
const endPointer = e => { pointers.delete(e.pointerId); if (!pointers.size) gesture = null; };
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('wheel', e => { e.preventDefault(); view.zoom = clamp(view.zoom * Math.exp(-e.deltaY * 0.0015), 1, 2.5); }, { passive: false });

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
    for (const e of G.step(state, d)) toast(e.text, e.type, e.night ? 6000 : 3800);
    dh -= d;
  }
  view.render({ base: base(), stage: stage(), hour: state.time % 24, t, dt, rain: state.rain, snow: false });
  if ((hudTimer -= dt) <= 0) { renderHUD(); hudTimer = 0.25; }
  if ((saveTimer -= dt) <= 0) { G.save(state); saveTimer = 5; }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(state); });
window.addEventListener('pagehide', () => G.save(state));

resize();
preload();
renderHUD();
requestAnimationFrame(frame);

// Hooks for automated screenshots.
window.__haven = {
  get state() { return state; },
  setHour: h => { state.time = Math.floor(state.time / 24) * 24 + h; },
  give: n => { state.scrap += n; state.food += n; state.water += n; },
};
