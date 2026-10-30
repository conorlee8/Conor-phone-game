import { CATALOG, CATEGORIES, CAT_ICON, ITEM, summary } from './builder/catalog.js';
import { SHELLS, SHELL } from './builder/shells.js';
import { Renderer, layout, cellAt, itemBox, darkness, sprite } from './builder/render.js';
import * as S from './builder/sim.js';
import { clamp } from './util.js';

const $ = id => document.getElementById(id);
const cv = $('game');
const R = new Renderer(cv);

let state = S.load() || S.newGame();
let L = layout(state.shell);
let W = 0, H = 0, t = 0;
let zoom = 1;
const pan = { x: 0, y: 0 };
const cam = { x: 0, y: 0, s: 40 };
let mode = 'look'; // look | place | wire | pipe
let placing = null;
let erase = false;
let ghost = null;
let sheet = null;
let catTab = 'Power';
let style = localStorage.getItem('haven-style') || 'painted';

// ---------------------------------------------------------------------------
// Camera

function resize() {
  W = innerWidth; H = innerHeight;
  R.resize(W, H, Math.min(devicePixelRatio || 1, 2));
}

function fit() {
  const b = L.bounds;
  const top = $('hud').getBoundingClientRect().bottom + 4;
  const bottom = ($('banner').classList.contains('hidden') ? $('bar') : $('banner')).getBoundingClientRect().top - 4;
  const sFit = Math.min((W - 8) / (b.maxX - b.minX), Math.max(100, bottom - top) / (b.maxY - b.minY));
  return { sFit, cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, mid: (top + bottom) / 2 };
}

function resetView() {
  const f = fit();
  zoom = clamp(46 / f.sFit, 1, 2.5);
  pan.x = 0; pan.y = 0;
}

function updateCam() {
  const f = fit();
  const b = L.bounds;
  cam.s = f.sFit * zoom;
  const mx = Math.max(0, (b.maxX - b.minX) / 2 - W / 2 / cam.s + 0.5);
  const my = Math.max(0, (b.maxY - b.minY) / 2 - H / 2 / cam.s + 1);
  pan.x = clamp(pan.x, -mx, mx);
  pan.y = clamp(pan.y, -my, my);
  cam.x = f.cx + pan.x;
  cam.y = f.cy - (f.mid - H / 2) / cam.s + pan.y;
}

const toWorld = (sx, sy) => [(sx - W / 2) / cam.s + cam.x, (sy - H / 2) / cam.s + cam.y];

// ---------------------------------------------------------------------------
// HUD

const fmtHour = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 6) * 10).padStart(2, '0')}`;
const ICON = { scrap: '🔩', parts: '⚙️', fuel: '⛽', food: '🥫', water: '🚰' };
const costText = cost => Object.entries(cost).map(([k, v]) => `${ICON[k]} ${v}`).join(' ');

function renderHUD() {
  const r = state.report || { supply: 0, demand: 0, stored: 0, cap: 0, rawWater: 0, rawCap: 0 };
  const c = S.caps(state);
  const hour = state.time % 24;
  const day = Math.floor(state.time / 24) + 1;
  $('clock').textContent = `${darkness(hour) > 0.5 ? '🌙' : '☀️'} Day ${day} · ${fmtHour(hour)}${state.rain ? ' 🌧' : ''}`;
  $('baseLabel').textContent = SHELL[state.shell].name;
  $('speedBtn').textContent = state.speed === 0 ? '⏸' : `${state.speed}×`;
  const def = S.defense(state), threat = S.threatFor(day);
  const hp = S.base(state).hp;
  const pw = r.cap ? ` · ${Math.round((r.stored / r.cap) * 100)}%🔋` : '';
  const chips = [
    ['🔩', `${Math.floor(state.scrap)}`, '', 'Scrap: building material'],
    ['⚙️', `${Math.floor(state.parts)}`, '', 'Parts: from scavenging or a workbench'],
    ['⛽', `${state.fuel.toFixed(1)}`, state.fuel < 1 ? 'warn' : '', 'Fuel: generators burn it'],
    ['🥫', `${Math.floor(state.food)}/${c.food}`, state.food < 4 ? 'warn' : '', 'Food. Shelves and fridges store more; without a fridge it slowly spoils'],
    ['🚰', `${Math.floor(state.water)}/${c.water}`, state.water < 4 ? 'warn' : '', 'Drinking water. Pipe raw water into a purifier to make more'],
    ['⚡', `${r.supply.toFixed(1)}/${r.demand.toFixed(1)}${pw}`, r.demand > r.supply && !r.stored ? 'warn' : '', 'Power made / used per hour. Wire generators, solar or batteries to things that need power'],
    ['💧', `${Math.floor(r.rawWater)}/${Math.floor(r.rawCap)}`, '', 'Raw water in your pipes and tanks'],
    ['👥', `${S.home(state)}/${state.survivors}`, '', 'Survivors home / total. Free beds and comfort attract more'],
    ['🛡', `${def} vs ${threat}`, def < threat ? 'warn' : 'ok', 'Defense vs tonight’s horde (midnight)'],
    ['❤️', `${hp}`, hp < 50 ? 'warn' : '', 'Base health. Tap to repair'],
  ];
  $('res').innerHTML = chips.map(([i, v, cls, tip], k) => `<span class="chip ${cls}" data-tip="${tip}" data-k="${k}">${i} ${v}</span>`).join('');
  $('scavLabel').textContent = state.runs.length ? `Out (${state.runs.length})` : 'Scavenge';
  document.querySelectorAll('#bar [data-act]').forEach(b => b.classList.toggle('on', b.dataset.act === mode || (b.dataset.act === 'build' && mode === 'place')));
  if (sheet === 'scav') openScavenge();
}

$('res').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  if (chip.dataset.k === '9') { const err = S.repair(state); toast(err || 'Repaired. ❤️ 100', err ? 'bad' : 'good'); return; }
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
// Modes

function setMode(m, item = null) {
  mode = m;
  placing = item;
  erase = false;
  ghost = null;
  const b = $('banner');
  if (m === 'look') { b.className = 'banner hidden'; return renderHUD(); }
  b.className = 'banner hint';
  if (m === 'place') {
    const d = ITEM[item];
    b.innerHTML = `<div class="hint-row"><span>Placing <b>${d.name}</b> · ${costText(d.cost)}<br><span class="sub">${placeHint(d)}</span></span>
      <button class="cta secondary small" data-b="done">Done</button></div>`;
  } else {
    b.innerHTML = `<div class="hint-row"><span><b>${m === 'wire' ? 'Wiring' : 'Plumbing'}</b> · drag across the rooms<br>
      <span class="sub">${m === 'wire' ? 'Connect power makers to things that use power' : 'Connect water sources, tanks, purifiers and planters'} · ${m === 'wire' ? '🔩 1' : '🔩 2'} per cell</span></span>
      <button class="cta secondary small" data-b="erase">${erase ? 'Erasing' : 'Erase'}</button>
      <button class="cta secondary small" data-b="done">Done</button></div>`;
  }
  renderHUD();
}

const placeHint = d => ({ wall: 'Tap the upper wall of a room', roof: 'Tap the top floor to put it on the roof', ground: 'Tap the bottom floor' }[d.mount] || 'Tap a spot on a floor');

$('banner').addEventListener('click', e => {
  const b = e.target.closest('[data-b]');
  if (!b) return;
  if (b.dataset.b === 'done') setMode('look');
  if (b.dataset.b === 'erase') { erase = !erase; b.textContent = erase ? 'Erasing' : 'Erase'; b.classList.toggle('on', erase); }
});

// ---------------------------------------------------------------------------
// Sheets

function openSheet(title, html, tall = false) {
  $('sheetTitle').textContent = title;
  $('sheetBody').innerHTML = html;
  $('sheet').classList.remove('hidden');
  $('sheet').classList.toggle('tall', tall);
  $('scrim').classList.remove('hidden');
}
function closeSheet() { $('sheet').classList.add('hidden'); $('scrim').classList.add('hidden'); sheet = null; }
$('sheetClose').addEventListener('click', closeSheet);
$('scrim').addEventListener('click', closeSheet);

function thumb(d) {
  const ext = style === 'pixel' ? 'png' : 'webp';
  return sprite(style, d.id)
    ? `<div class="emoji sprite" style="background-image:url(assets/sprites/${style}/${d.id}.${ext})"></div>`
    : `<div class="emoji">${CAT_ICON[d.cat]}</div>`;
}

function openCatalog() {
  sheet = 'build';
  const tabs = `<div class="tabs scroll">${CATEGORIES.map(c => `<button class="tab ${c === catTab ? 'on' : ''}" data-tab="${c}">${CAT_ICON[c]} ${c}</button>`).join('')}</div>`;
  const rows = CATALOG.filter(d => d.cat === catTab).map(d => {
    const ok = S.afford(state, d.cost);
    return `<button class="row-item" data-id="${d.id}" ${ok ? '' : 'disabled'}>${thumb(d)}
      <div class="txt"><div class="name">${d.name} <span class="sub">${d.w > 1 ? `${d.w} wide` : ''}</span></div>
      <div class="sub">${d.blurb}</div><span class="fx">${summary(d)}</span></div>
      <div class="cost">${costText(d.cost)}</div></button>`;
  }).join('');
  openSheet('Build', tabs + `<div class="list">${rows}</div>`, true);
  $('sheetBody').onclick = e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { catTab = tab.dataset.tab; openCatalog(); return; }
    const btn = e.target.closest('.row-item');
    if (!btn || btn.disabled) return;
    closeSheet();
    setMode('place', btn.dataset.id);
  };
}

function openItem(index) {
  sheet = 'item';
  const b = S.base(state);
  const it = b.items[index];
  const d = ITEM[it.id];
  const status = it.on === false
    ? `<p class="lead bad">Not running: ${{ 'no wire': 'not wired to any power', 'no power': 'its wire has no power, or not enough', 'no pipe': 'not connected to any pipe', 'no water': 'its pipes are dry', 'no fuel': 'out of fuel', idle: 'idle (nothing needs power right now)' }[it.why] || it.why}.</p>`
    : '<p class="lead good">Running.</p>';
  const extra = d.battery ? `<p class="lead">🔋 ${(it.charge || 0).toFixed(1)} / ${d.battery}</p>` : d.tank ? `<p class="lead">🛢 ${(it.level || 0).toFixed(1)} / ${d.tank}</p>` : '';
  openSheet(d.name, `<div class="row-item static">${thumb(d)}<div class="txt"><div class="sub">${d.blurb}</div><span class="fx">${summary(d)}</span></div></div>
    ${status}${extra}<div class="stack"><button class="cta danger" id="rm">Remove · refund ${costText(d.cost)}</button></div>`);
  $('sheetBody').onclick = e => {
    if (e.target.id !== 'rm') return;
    S.remove(state, index);
    S.save(state);
    closeSheet();
  };
}

function openScavenge() {
  sheet = 'scav';
  const hour = state.time % 24;
  const out = state.runs.map(r => {
    const loc = S.LOCATIONS.find(l => l.id === r.loc);
    return `<div class="row-item static"><div class="emoji">${loc.icon}</div><div class="txt"><div class="name">${loc.name}</div><div class="sub">Back in ${Math.max(0, Math.ceil((r.end - state.time) * 10) / 10)} h</div></div></div>`;
  }).join('');
  const rows = S.LOCATIONS.map(l => {
    const ok = S.home(state) > 0 && hour >= 6 && hour + l.hours <= 21;
    const loot = Object.keys(l.loot).map(k => ICON[k]).join(' ');
    return `<button class="row-item" data-loc="${l.id}" ${ok ? '' : 'disabled'}><div class="emoji">${l.icon}</div>
      <div class="txt"><div class="name">${l.name}</div><div class="sub">${l.blurb} · ${l.hours} h · ${Math.round(l.risk * 100)}% risk · ${loot}</div></div>
      <div class="cost">Send</div></button>`;
  }).join('');
  const note = hour < 6 || hour > 18 ? '<p class="lead">It’s dark. Nobody goes out until morning.</p>' : `<p class="lead">${S.home(state)} at home. Send someone out for supplies.</p>`;
  openSheet('Scavenge', note + (out ? `<div class="group-h">Out now</div><div class="list">${out}</div>` : '') + `<div class="group-h">Places</div><div class="list">${rows}</div>`);
  $('sheetBody').onclick = e => {
    const btn = e.target.closest('[data-loc]');
    if (!btn || btn.disabled) return;
    const err = S.startRun(state, btn.dataset.loc);
    if (err) toast(err, 'bad');
    S.save(state);
    renderHUD();
  };
}

function openMore() {
  sheet = 'more';
  const shells = SHELLS.map(sh => {
    const owned = !!state.bases[sh.id];
    const here = state.shell === sh.id;
    return `<button class="row-item" data-shell="${sh.id}" ${here ? 'disabled' : ''}><div class="emoji">🏚️</div>
      <div class="txt"><div class="name">${sh.name}</div><div class="sub">${sh.blurb} · ${sh.floors.length} floor${sh.floors.length > 1 ? 's' : ''}, ${sh.floors.reduce((a, b) => a + b, 0)} cells</div></div>
      <div class="cost">${here ? 'Home' : owned ? 'Move' : `🔩 ${sh.cost}`}</div></button>`;
  }).join('');
  openSheet('Last Haven', `
    <div class="group-h">Art style test</div>
    <div class="tabs"><button class="tab ${style === 'painted' ? 'on' : ''}" data-style="painted">🎨 Painted</button><button class="tab ${style === 'pixel' ? 'on' : ''}" data-style="pixel">👾 Pixel</button></div>
    <div class="group-h">Bases</div><div class="list">${shells}</div>
    <div class="group-h">How it works</div>
    <div class="help">
      <p>🔨 <b>Build</b> anything anywhere it fits. Wall pieces go high, roof pieces on top.</p>
      <p>〰️ <b>Wire</b> power makers (generator, solar, wind, batteries) to things that use power. Underground rooms are pitch black without lamps.</p>
      <p>🟦 <b>Pipe</b> water from collectors or a well into tanks, then on to purifiers (drinking water) and planters (food).</p>
      <p>📦 Shelves, crates and lockers raise how much you can store. Fridges stop food spoiling.</p>
      <p>🛡 At midnight the horde comes. Barricades, powered turrets and whoever is home fight back.</p>
      <p>Tap anything to see if it’s running and why not. Drag to look around, pinch to zoom.</p>
    </div>
    <div class="stack"><button class="cta danger" id="reset">Start over</button></div>`, true);
  $('sheetBody').onclick = e => {
    const st = e.target.closest('[data-style]');
    if (st) { style = st.dataset.style; try { localStorage.setItem('haven-style', style); } catch { /* storage unavailable */ } R.patterns = {}; openMore(); return; }
    const sh = e.target.closest('[data-shell]');
    if (sh && !sh.disabled) {
      const err = S.moveTo(state, sh.dataset.shell);
      if (err) { toast(err, 'bad'); return; }
      L = layout(state.shell);
      resetView(); S.save(state); closeSheet();
      toast(`Moved into the ${SHELL[state.shell].name.toLowerCase()}.`, 'good');
      return;
    }
    if (e.target.id === 'reset') {
      if (!e.target.dataset.armed) { e.target.dataset.armed = '1'; e.target.textContent = 'Tap again to erase your save'; return; }
      S.wipe(); state = S.newGame(); L = layout(state.shell); resetView(); closeSheet(); toast('A new story begins.');
    }
  };
}

$('bar').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'build') openCatalog();
  else if (act === 'wire' || act === 'pipe') setMode(mode === act ? 'look' : act);
  else if (act === 'scav') openScavenge();
  else openMore();
});

$('speedBtn').addEventListener('click', () => { state.speed = state.speed === 1 ? 4 : state.speed === 4 ? 0 : 1; renderHUD(); });

// ---------------------------------------------------------------------------
// Touch: one finger pans (or paints lines), two fingers pinch

const pointers = new Map();
let gesture = null;
let lastCell = null;

function hitItem(wx, wy) {
  const b = S.base(state);
  let found = -1;
  b.items.forEach((it, i) => {
    const box = itemBox(L, it);
    if (wx >= box.x && wx <= box.x + box.w && wy >= box.y && wy <= box.y + box.h) {
      if (found < 0 || ITEM[it.id].mount !== 'wall') found = i;
    }
  });
  return found;
}

function paintAt(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  const cell = cellAt(L, wx, wy);
  if (!cell) return;
  const from = lastCell && lastCell.f === cell.f ? lastCell.x : cell.x;
  const step = cell.x >= from ? 1 : -1;
  for (let x = from; x !== cell.x + step; x += step) S.toggleLine(state, mode, x, cell.f, !erase);
  if (lastCell && lastCell.f !== cell.f && lastCell.x === cell.x) S.toggleLine(state, mode, cell.x, cell.f, !erase);
  lastCell = cell;
}

function placeAt(sx, sy, commit) {
  const [wx, wy] = toWorld(sx, sy);
  const d = ITEM[placing];
  let cell = cellAt(L, wx, wy);
  if (!cell) { ghost = null; return; }
  if (d.mount === 'roof') cell = { ...cell, f: L.storeys.length - 1 };
  const x = clamp(Math.round(wx - L.storeys[cell.f].x0 - d.w / 2), 0, L.storeys[cell.f].cols - d.w);
  const err = S.canPlace(state, placing, x, cell.f);
  ghost = { id: placing, x, f: cell.f, ok: !err && S.afford(state, d.cost) };
  if (!commit) return;
  const res = S.place(state, placing, x, cell.f);
  if (res) toast(res, 'bad');
  else { S.save(state); toast(`Built ${d.name}.`, 'good', 1800); }
}

cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  if (pts.length === 2) {
    gesture = { pinch: true, d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), zoom, mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2, px: pan.x, py: pan.y };
    return;
  }
  gesture = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false, paint: mode === 'wire' || mode === 'pipe' };
  lastCell = null;
  if (gesture.paint) paintAt(e.clientX, e.clientY);
  if (mode === 'place') placeAt(e.clientX, e.clientY, false);
});

cv.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) {
    if (mode === 'place' && e.pointerType === 'mouse') placeAt(e.clientX, e.clientY, false);
    return;
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!gesture) return;
  if (gesture.pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    zoom = clamp(gesture.zoom * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d, 0.8, 4);
    pan.x = gesture.px - ((a.x + b.x) / 2 - gesture.mx) / cam.s;
    pan.y = gesture.py - ((a.y + b.y) / 2 - gesture.my) / cam.s;
    return;
  }
  if (gesture.pinch) return;
  const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
  if (Math.hypot(dx, dy) > 8) gesture.moved = true;
  if (gesture.paint) { paintAt(e.clientX, e.clientY); return; }
  if (mode === 'place' && !gesture.moved) { placeAt(e.clientX, e.clientY, false); return; }
  if (gesture.moved) { pan.x = gesture.px - dx / cam.s; pan.y = gesture.py - dy / cam.s; }
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (gesture && !gesture.pinch && !gesture.paint && !gesture.moved && pointers.size === 0) {
    if (mode === 'place') placeAt(e.clientX, e.clientY, true);
    else if (mode === 'look') {
      const i = hitItem(...toWorld(e.clientX, e.clientY));
      if (i >= 0) openItem(i);
    }
  }
  if (gesture && gesture.paint) S.save(state);
  if (!pointers.size) gesture = null;
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('wheel', e => { e.preventDefault(); zoom = clamp(zoom * Math.exp(-e.deltaY * 0.0015), 0.8, 4); }, { passive: false });

// ---------------------------------------------------------------------------
// Loop

let last = performance.now(), hudTimer = 0, saveTimer = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; t += dt;
  let dh = dt * S.HOURS_PER_SEC * state.speed;
  if (!dh) S.runSystems(state, 0);
  while (dh > 1e-6) {
    const d = Math.min(dh, 0.1);
    for (const e of S.step(state, d)) toast(e.text, e.type, e.night ? 6000 : 3800);
    dh -= d;
  }
  updateCam();
  const overlay = mode === 'wire' || mode === 'pipe' ? mode : 'status';
  R.render({ L, cam, state, style, hour: state.time % 24, t, overlay, ghost, base: S.base(state), drawCells: mode !== 'look' });
  if ((hudTimer -= dt) <= 0) { renderHUD(); hudTimer = 0.3; }
  if ((saveTimer -= dt) <= 0) { S.save(state); saveTimer = 5; }
  requestAnimationFrame(frame);
}

addEventListener('resize', () => { resize(); resetView(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) S.save(state); });
addEventListener('pagehide', () => S.save(state));

resize();
renderHUD();
resetView();
requestAnimationFrame(frame);

window.__haven = {
  get state() { return state; },
  get cam() { return cam; },
  L: () => L,
  setHour: h => { state.time = Math.floor(state.time / 24) * 24 + h; },
  give: n => { for (const k of ['scrap', 'parts', 'fuel', 'food', 'water']) state[k] += n; },
  style: s => { style = s; R.patterns = {}; },
};
