import { CATALOG, CATEGORIES, CAT_ICON, ITEM, PAINTS, MOUNT_NAME, summary, needsWire, needsPipe } from './builder/catalog.js';
import { SHELLS, SHELL } from './builder/shells.js';
import { Renderer, darkness, sprite } from './builder/render.js';
import { hitSurface, mountFor, itemBox, YARD_F } from './builder/grid.js';
import * as S from './builder/sim.js';
import { clamp } from './util.js';

const $ = id => document.getElementById(id);
const cv = $('game');
const R = new Renderer(cv);

let state = S.load() || S.newGame();
let W = 0, H = 0, t = 0;
let zoom = 1;
const pan = { x: 0, y: 0 };
const cam = { x: 0, y: 0, s: 40 };
let mode = 'look'; // look | place | wire | pipe | paint
let placing = null; // item id, or { kind, id } while painting
let erase = false;
let ghost = null;
let sel = -1;
let sheet = null;
let catTab = 'Power';
let style = (() => { try { return localStorage.getItem('haven-style') || 'painted'; } catch { return 'painted'; } })();
const lay = () => S.L(state);

// ---------------------------------------------------------------------------
// Camera

function resize() {
  W = innerWidth; H = innerHeight;
  R.resize(W, H, Math.min(devicePixelRatio || 1, 2));
}

function fit() {
  const b = lay().bounds;
  const top = $('hud').getBoundingClientRect().bottom + 4;
  const bottom = ($('banner').classList.contains('hidden') ? $('bar') : $('banner')).getBoundingClientRect().top - 4;
  const sFit = Math.min((W - 8) / (b.maxX - b.minX), Math.max(100, bottom - top) / (b.maxY - b.minY));
  return { sFit, cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, mid: (top + bottom) / 2 };
}

function resetView() {
  const f = fit();
  zoom = clamp(44 / f.sFit, 1, 2.5);
  pan.x = 0; pan.y = 0;
}

function updateCam() {
  const f = fit();
  const b = lay().bounds;
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
  const pw = r.cap ? ` ${Math.round((r.stored / r.cap) * 100)}%🔋` : '';
  const chips = [
    ['🔩', `${Math.floor(state.scrap)}`, '', 'Scrap: building material'],
    ['⚙️', `${Math.floor(state.parts)}`, '', 'Parts: from scavenging or a workbench'],
    ['⛽', `${state.fuel.toFixed(1)}`, state.fuel < 1 ? 'warn' : '', 'Fuel: generators burn it'],
    ['🥫', `${Math.floor(state.food)}/${c.food}`, state.food < 4 ? 'warn' : '', 'Food. Storage raises the cap; without a fridge it slowly spoils'],
    ['🚰', `${Math.floor(state.water)}/${c.water}`, state.water < 4 ? 'warn' : '', 'Drinking water. Pipe raw water into a purifier to make more'],
    ['⚡', `${r.supply.toFixed(1)}/${r.demand.toFixed(1)}${pw}`, r.demand > r.supply && !r.stored ? 'warn' : '', 'Power made / used per hour'],
    ['💧', `${Math.floor(r.rawWater)}/${Math.floor(r.rawCap)}`, '', 'Raw water in your pipes and tanks'],
    ['👥', `${S.home(state)}/${state.survivors}`, '', 'Survivors home / total. Free beds and comfort attract more'],
    ['🛡', `${def} vs ${threat}`, def < threat ? 'warn' : 'ok', 'Defense vs tonight’s horde (midnight). Unbarred windows are weak spots'],
    ['❤️', `${hp}`, hp < 50 ? 'warn' : '', 'Base health. Tap to repair'],
  ];
  $('res').innerHTML = chips.map(([i, v, cls, tip], k) => `<span class="chip ${cls}" data-tip="${tip}" data-k="${k}">${i} ${v}</span>`).join('');
  $('scavLabel').textContent = state.runs.length ? `Out (${state.runs.length})` : 'Scavenge';
  document.querySelectorAll('#bar [data-act]').forEach(b => b.classList.toggle('on',
    b.dataset.act === mode || (b.dataset.act === 'build' && (mode === 'place' || mode === 'paint'))));
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

function setMode(m, what = null) {
  mode = m;
  placing = what;
  erase = false;
  ghost = null;
  sel = -1;
  const b = $('banner');
  if (m === 'look') { b.className = 'banner hidden'; renderHUD(); return; }
  b.className = 'banner hint';
  let text;
  if (m === 'place') {
    const d = ITEM[what];
    text = `Placing <b>${d.name}</b> · ${costText(d.cost)}<br><span class="sub">Goes on: ${d.mounts.map(x => MOUNT_NAME[x]).join(', ')}. Tap to place, keep tapping to place more.</span>`;
  } else if (m === 'paint') {
    const p = PAINTS[what.kind].find(q => q.id === what.id);
    text = `<b>${p.name}</b> · 🔩 ${p.cost}<br><span class="sub">${what.kind === 'divider' ? 'Tap between two cells' : `Drag across ${what.kind === 'wall' ? 'walls' : 'floors'} to paint`}</span>`;
  } else {
    text = `<b>${m === 'wire' ? 'Wiring' : 'Plumbing'}</b> · drag through the rooms<br><span class="sub">${m === 'wire'
      ? 'Runs along the ceiling; drag up or down a floor to run it between floors. Anything on a wired cell plugs in.'
      : 'Runs along the floor; drag up or down a floor to make a riser. Anything on a piped cell connects.'} ${m === 'wire' ? '🔩 1' : '🔩 2'} per cell</span>`;
  }
  const eraseBtn = m === 'wire' || m === 'pipe' ? `<button class="cta secondary small" data-b="erase">${erase ? 'Erasing' : 'Erase'}</button>` : '';
  b.innerHTML = `<div class="hint-row"><span>${text}</span>${eraseBtn}<button class="cta secondary small" data-b="done">Done</button></div>`;
  renderHUD();
}

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
function closeSheet() { $('sheet').classList.add('hidden'); $('scrim').classList.add('hidden'); sheet = null; sel = -1; }
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
  const tabs = [...CATEGORIES, 'Surfaces'];
  const tabHtml = `<div class="tabs scroll">${tabs.map(c => `<button class="tab ${c === catTab ? 'on' : ''}" data-tab="${c}">${CAT_ICON[c] || '🎨'} ${c}</button>`).join('')}</div>`;
  let rows;
  if (catTab === 'Surfaces') {
    const group = (kind, title) => `<div class="group-h">${title}</div><div class="list">${PAINTS[kind].map(p => `
      <button class="row-item" data-paint="${kind}:${p.id}" ${p.window && lay().sh.underground ? 'disabled' : ''}>
        <div class="emoji" style="background:${p.id === 'none' ? 'transparent' : p.color}">${p.id === 'none' ? '✖' : ''}</div>
        <div class="txt"><div class="name">${p.name}</div><div class="sub">${paintNote(p, kind)}</div></div>
        <div class="cost">${p.cost ? `🔩 ${p.cost}` : ''}</div></button>`).join('')}</div>`;
    rows = group('wall', 'Back walls') + group('floor', 'Floors') + group('divider', 'Inner walls & doors');
  } else {
    rows = `<div class="list">${CATALOG.filter(d => d.cat === catTab).map(d => `
      <button class="row-item" data-id="${d.id}" ${S.afford(state, d.cost) ? '' : 'disabled'}>${thumb(d)}
        <div class="txt"><div class="name">${d.name} <span class="sub">${d.w > 1 ? `· ${d.w} wide ` : ''}· ${d.mounts.map(m => MOUNT_NAME[m]).join('/')}</span></div>
        <div class="sub">${d.blurb}</div><span class="fx">${summary(d)}${needsWire(d) ? ' · needs wire' : ''}${needsPipe(d) ? ' · needs pipe' : ''}</span></div>
        <div class="cost">${costText(d.cost)}</div></button>`).join('')}</div>`;
  }
  openSheet('Build', tabHtml + rows, true);
  $('sheetBody').onclick = e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { catTab = tab.dataset.tab; openCatalog(); return; }
    const p = e.target.closest('[data-paint]');
    if (p && !p.disabled) { const [kind, id] = p.dataset.paint.split(':'); closeSheet(); setMode('paint', { kind, id }); return; }
    const btn = e.target.closest('[data-id]');
    if (!btn || btn.disabled) return;
    closeSheet();
    setMode('place', btn.dataset.id);
  };
}

function paintNote(p, kind) {
  if (p.window) return 'Lets daylight in. A weak spot unless you add window bars.';
  if (kind === 'divider') return p.id === 'door' ? 'Splits a room, people can pass' : p.id === 'none' ? 'Opens a room back up' : 'Splits a room into two';
  const bits = [];
  if (p.comfort) bits.push(`🛋 +${p.comfort} per cell`);
  if (p.defense) bits.push(`🛡 +${p.defense} per cell`);
  return bits.join(' · ') || 'Looks only';
}

function openItem(index) {
  sheet = 'item';
  sel = index;
  const b = S.base(state);
  const it = b.items[index];
  const d = ITEM[it.id];
  const why = it.on === false && it.why && it.why !== 'idle'
    ? `<p class="lead bad">Not running: ${it.why}.${it.why === 'not plugged in' ? ' Use 〰️ Wire to run a cable to it.' : it.why === 'no pipe connected' ? ' Use 🟦 Pipe to connect it.' : ''}</p>`
    : it.why === 'idle' ? '<p class="lead">Idle: nothing needs its power right now.</p>' : '<p class="lead good">Running.</p>';
  const links = [needsWire(d) ? `⚡ ${it.wired ? 'plugged in' : 'not plugged in'}` : '', needsPipe(d) ? `💧 ${it.piped ? 'piped' : 'no pipe'}` : ''].filter(Boolean).join(' · ');
  const extra = d.battery ? `🔋 ${(it.charge || 0).toFixed(1)} / ${d.battery}` : d.tank ? `🛢 ${(it.level || 0).toFixed(1)} / ${d.tank}` : '';
  const canSwitch = needsWire(d) || needsPipe(d) || d.light;
  openSheet(d.name, `<div class="row-item static">${thumb(d)}<div class="txt"><div class="sub">${d.blurb}</div><span class="fx">${summary(d)}</span></div></div>
    ${why}${links || extra ? `<p class="lead">${[links, extra].filter(Boolean).join(' · ')}</p>` : ''}
    <div class="stack">${canSwitch ? `<button class="cta secondary" id="sw">${it.off ? 'Switch on' : 'Switch off'}</button>` : ''}
    <button class="cta danger" id="rm">Remove · refund ${costText(d.cost)}</button></div>`);
  $('sheetBody').onclick = e => {
    if (e.target.id === 'sw') { it.off = !it.off; S.runSystems(state, 0); S.save(state); openItem(index); return; }
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
    return `<button class="row-item" data-loc="${l.id}" ${ok ? '' : 'disabled'}><div class="emoji">${l.icon}</div>
      <div class="txt"><div class="name">${l.name}</div><div class="sub">${l.blurb} · ${l.hours} h · ${Math.round(l.risk * 100)}% risk · ${Object.keys(l.loot).map(k => ICON[k]).join(' ')}</div></div>
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
      <div class="txt"><div class="name">${sh.name}</div><div class="sub">${sh.blurb} · ${sh.floors.length} floor${sh.floors.length > 1 ? 's' : ''}, ${sh.floors.reduce((a, b) => a + b, 0)} cells + yard</div></div>
      <div class="cost">${here ? 'Home' : owned ? 'Move' : `🔩 ${sh.cost}`}</div></button>`;
  }).join('');
  openSheet('Last Haven', `
    <div class="group-h">Art style test</div>
    <div class="tabs"><button class="tab ${style === 'painted' ? 'on' : ''}" data-style="painted">🎨 Painted</button><button class="tab ${style === 'pixel' ? 'on' : ''}" data-style="pixel">👾 Pixel</button></div>
    <div class="group-h">Bases</div><div class="list">${shells}</div>
    <div class="group-h">How it works</div>
    <div class="help">
      <p>🔨 <b>Build</b> on every surface: floors, any height on the walls, ceilings, the roof and the yard outside. 🎨 <b>Surfaces</b> lets you change walls and floors, add windows, inner walls and doors.</p>
      <p>〰️ <b>Wire</b> runs along ceilings. Anything on a wired cell plugs in; you’ll see its cable drop down. Red ⚡ dots mean not plugged in yet.</p>
      <p>🟦 <b>Pipe</b> runs along floors: collectors and wells fill tanks, which feed purifiers, planters, sinks and showers.</p>
      <p>Tap any piece to see what it needs, or to switch it off and save power.</p>
      <p>🛡 Midnight brings the horde. Fences, spikes, turrets and barred windows help. Underground, rooms are black without lamps.</p>
    </div>
    <div class="stack"><button class="cta danger" id="reset">Start over</button></div>`, true);
  $('sheetBody').onclick = e => {
    const st = e.target.closest('[data-style]');
    if (st) { style = st.dataset.style; try { localStorage.setItem('haven-style', style); } catch { /* storage unavailable */ } openMore(); return; }
    const sh = e.target.closest('[data-shell]');
    if (sh && !sh.disabled) {
      const err = S.moveTo(state, sh.dataset.shell);
      if (err) { toast(err, 'bad'); return; }
      resetView(); S.save(state); closeSheet();
      toast(`Moved into the ${SHELL[state.shell].name.toLowerCase()}.`, 'good');
      return;
    }
    if (e.target.id === 'reset') {
      if (!e.target.dataset.armed) { e.target.dataset.armed = '1'; e.target.textContent = 'Tap again to erase your save'; return; }
      S.wipe(); state = S.newGame(); resetView(); closeSheet(); toast('A new story begins.');
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
// Touch: one finger pans (or paints), two fingers pinch

const pointers = new Map();
let gesture = null;
let lastCell = null;

function hitItem(wx, wy) {
  const b = S.base(state);
  const rank = { wall: 0, ceiling: 1, roof: 1, floor: 2, yard: 2 };
  let found = -1;
  b.items.forEach((it, i) => {
    const box = itemBox(lay(), it);
    if (wx >= box.x && wx <= box.x + box.w && wy >= box.y && wy <= box.y + box.h) {
      if (found < 0 || rank[it.m] >= rank[b.items[found].m]) found = i;
    }
  });
  return found;
}

// The line cell under a finger: any surface maps to its storey (roof → top floor).
function lineCellAt(sx, sy) {
  const hit = hitSurface(lay(), ...toWorld(sx, sy));
  if (!hit) return null;
  return { x: hit.x, f: hit.m === 'yard' ? YARD_F : hit.f };
}

function paintLine(sx, sy) {
  const cell = lineCellAt(sx, sy);
  if (!cell) return;
  // dragging up or down between floors lays a riser at this column
  if (lastCell && cell.f >= 0 && lastCell.f >= 0 && Math.abs(cell.f - lastCell.f) === 1) {
    S.toggleRiser(state, mode, cell.x, Math.min(cell.f, lastCell.f), !erase);
    lastCell = cell;
    return;
  }
  if (lastCell && lastCell.f === cell.f && lastCell.x !== cell.x) {
    const step = cell.x > lastCell.x ? 1 : -1;
    for (let x = lastCell.x + step; x !== cell.x; x += step) S.toggleLine(state, mode, x, cell.f, !erase);
  }
  S.toggleLine(state, mode, cell.x, cell.f, !erase);
  lastCell = cell;
}

function paintSurface(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  const hit = hitSurface(lay(), wx, wy);
  if (!hit || hit.m === 'yard' || hit.m === 'roof') return;
  if (placing.kind === 'divider') {
    const st = lay().storeys[hit.f];
    S.paint(state, 'divider', placing.id, Math.round(wx - st.x0), hit.f);
  } else S.paint(state, placing.kind, placing.id, hit.x, hit.f);
}

function placeAt(sx, sy, commit) {
  const d = ITEM[placing];
  const hit = hitSurface(lay(), ...toWorld(sx, sy));
  const spot = mountFor(d, hit, lay());
  if (!spot) { ghost = null; if (commit) toast(`${d.name} goes on: ${d.mounts.map(m => MOUNT_NAME[m]).join(', ')}.`, 'bad'); return; }
  const st = spot.m === 'yard' ? null : lay().storeys[spot.f];
  const maxX = st ? st.cols - d.w : Infinity;
  const it = { id: placing, ...spot, x: clamp(spot.x - Math.floor((d.w - 1) / 2), spot.m === 'yard' ? -Infinity : 0, maxX) };
  if (spot.m === 'yard') it.x = spot.x < 0 ? Math.min(spot.x, -d.w) : spot.x;
  const err = S.canPlace(state, it);
  ghost = { ...it, ok: !err && S.afford(state, d.cost) };
  if (!commit) return;
  const res = S.place(state, it);
  if (res) toast(res, 'bad');
  else { S.runSystems(state, 0); S.save(state); toast(`Built ${d.name}${needsWire(d) && !S.base(state).items.at(-1).wired ? ': needs wiring' : ''}.`, 'good', 1800); }
}

cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  if (pts.length === 2) {
    gesture = { pinch: true, d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), zoom, mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2, px: pan.x, py: pan.y };
    return;
  }
  gesture = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false, paint: mode === 'wire' || mode === 'pipe' || mode === 'paint' };
  lastCell = null;
  if (gesture.paint) mode === 'paint' ? paintSurface(e.clientX, e.clientY) : paintLine(e.clientX, e.clientY);
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
  if (gesture.paint) {
    if (mode === 'paint') { if (placing.kind !== 'divider') paintSurface(e.clientX, e.clientY); }
    else paintLine(e.clientX, e.clientY);
    return;
  }
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
  if (gesture && gesture.paint) { S.runSystems(state, 0); S.save(state); }
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
  R.render({ L: lay(), cam, style, hour: state.time % 24, t, mode, ghost, base: S.base(state), sel });
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
  S,
  setHour: h => { state.time = Math.floor(state.time / 24) * 24 + h; },
  give: n => { for (const k of ['scrap', 'parts', 'fuel', 'food', 'water']) state[k] += n; },
  style: s => { style = s; },
  mode: (m, w) => setMode(m, w),
};
