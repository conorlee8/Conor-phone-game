import { IMAGE, HULL, METERS, ZONES, ACTIONS, MOMENTS, START, DARK_BELOW, DARK_AFTER, RECOVER } from '../data/world.js';
import { drawWorld, assignZones } from './render.js';
import { Cast, scene } from './cast.js';
import { PROPS } from '../data/props.js';
import { CAST } from '../data/cast.js';
const CAST_BY_ID = Object.fromEntries(CAST.map(c => [c.id, c]));
import { quizFor } from '../data/quiz.js';

const $ = id => document.getElementById(id);
const KEY = 'station-world-v1';
const params = new URLSearchParams(location.search);
const SPEED = Math.max(1, Number(params.get('speed')) || 1);      // ?speed=3600 makes an hour pass every second
const DEMO = params.get('demo');
const HOUR = params.has('hour') ? Number(params.get('hour')) : null;   // ?hour=14 previews a time of day
const hourNow = () => HOUR ?? new Date().getHours();
const RESIDENTS = params.get('residents') === '1';   // the walking cutouts are off unless ?residents=1
const BOOST = params.has('crowd') ? params.get('crowd').split(',') : [];   // ?crowd=dumpling,court sends people there                                    // ?demo=thriving|struggling|neglected

// ---------- the simulation ----------
function fresh() {
  return { v: 1, name: "Conor's Station", meters: { ...START }, lowSince: {}, cooldowns: {}, last: Date.now(), born: Date.now() };
}
function load() {
  if (DEMO) return demoState(DEMO);
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.meters) return s; } catch (e) { /* start fresh */ }
  return fresh();
}
function demoState(kind) {
  const s = fresh();
  const set = { thriving: 92, struggling: 32, neglected: 6 }[kind] ?? 60;
  for (const m of METERS) s.meters[m.id] = set + (kind === 'struggling' ? (m.id === 'boys' ? -14 : 0) : 0);
  if (kind === 'neglected') for (const m of METERS) s.lowSince[m.id] = Date.now() - DARK_AFTER - 1000;
  return s;
}
let state = load();
function save() { if (DEMO) return; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage off */ } }

// Advance the world to `now`, including any time you were away (up to two weeks).
function advance(now = Date.now()) {
  const dtHours = Math.min(14 * 24, ((now - state.last) / 3600000) * SPEED);
  if (dtHours <= 0) return;
  for (const m of METERS) {
    const before = state.meters[m.id];
    const after = Math.max(0, before - m.decay * dtHours);
    state.meters[m.id] = after;
    if (after < DARK_BELOW && state.lowSince[m.id] == null) {
      // When did it cross the line? Work back so a long absence counts from the right moment.
      const hoursAgo = before <= DARK_BELOW ? dtHours : (DARK_BELOW - after) / m.decay;
      state.lowSince[m.id] = now - (hoursAgo * 3600000) / SPEED;
    }
  }
  state.last = now;
}
const isDark = id => state.lowSince[id] != null && (Date.now() - state.lowSince[id]) * SPEED >= DARK_AFTER;
function overall() {
  const v = METERS.map(m => state.meters[m.id]);
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 0.6 + Math.min(...v) * 0.4);
}
function mood() {
  const o = overall();
  if (METERS.some(m => isDark(m.id))) return { label: 'Shutting down', cls: 'bad' };
  return o >= 75 ? { label: 'Thriving', cls: 'good' } : o >= 50 ? { label: 'Doing okay', cls: 'ok' } : o >= 25 ? { label: 'Struggling', cls: 'meh' } : { label: 'In trouble', cls: 'bad' };
}
function lookFor() {
  const zones = {};
  for (const z of ZONES) zones[z.id] = { level: state.meters[z.meter], dark: isDark(z.meter) };
  const h = hourNow();
  return { power: state.meters.power, food: state.meters.food, air: state.meters.air, fun: state.meters.fun, overall: overall(), zones, night: h >= 22 || h < 6,
           agents: RESIDENTS ? scene(cast.draw(now()), PROPS) : [], sprites };
}

function act(id) {
  const a = ACTIONS[id];
  const now = Date.now();
  if ((state.cooldowns[id] || 0) > now) return;
  for (const [m, v] of Object.entries(a.costs || {})) state.meters[m] = Math.max(0, state.meters[m] - v);
  for (const [m, v] of Object.entries(a.gives)) {
    state.meters[m] = Math.min(100, state.meters[m] + v);
    if (state.meters[m] >= RECOVER) delete state.lowSince[m];
  }
  state.cooldowns[id] = now + a.cooldown / SPEED;
  save();
  askForNudges();
  toast(a.say, Object.entries(a.gives).map(([m, v]) => `+${v} ${meterName(m)}`).join(' · '));
  renderHud();
  if (openZone) renderZone();
}
const METER_COLORS = Object.fromEntries(METERS.map(m => [m.id, m.color]));
const meterName = id => METERS.find(m => m.id === id).name.toLowerCase();

// ---------- the view: pan and zoom over the painting ----------
const canvas = $('view');
const ctx = canvas.getContext('2d');
const img = new Image();
let lights = [];
const cast = new Cast(state.personality || {});
let following = null;
const sprites = {};
let selected = null, selectedUntil = 0;
let cam = { x: HULL.x, y: HULL.y - 40, s: 1 };       // painting point at screen centre, and zoom
let focus = null;
let dpr = 1, W = 0, H = 0;

function fitScale() { return Math.max(W / IMAGE.w, Math.min(H / (HULL.r * 2 + 60), W / (HULL.r * 2 + 40))); }
function minScale() { return Math.min(W / IMAGE.w, H / IMAGE.h); }
function clampCam() {
  cam.s = Math.max(minScale(), Math.min(cam.s, 6));
  const hw = W / 2 / cam.s, hh = H / 2 / cam.s;
  cam.x = hw * 2 >= IMAGE.w ? IMAGE.w / 2 : Math.max(hw, Math.min(IMAGE.w - hw, cam.x));
  cam.y = hh * 2 >= IMAGE.h ? IMAGE.h / 2 : Math.max(hh, Math.min(IMAGE.h - hh, cam.y));
}
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  if (!cam.fitted) { cam.s = fitScale(); cam.fitted = true; }
  clampCam();
}
const toPaint = (px, py) => ({ x: cam.x + (px - W / 2) / cam.s, y: cam.y + (py - H / 2) / cam.s });

const pointers = new Map();
let gesture = null, moved = false;
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = false;
  gesture = { cam: { ...cam }, pts: new Map([...pointers].map(([k, v]) => [k, { ...v }])) };
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const p = [...pointers.values()], s = [...gesture.pts.values()];
  if (p.length === 1 && s.length >= 1) {
    const dx = p[0].x - s[0].x, dy = p[0].y - s[0].y;
    if (Math.abs(dx) + Math.abs(dy) > 6) { moved = true; following = null; }
    cam.x = gesture.cam.x - dx / cam.s; cam.y = gesture.cam.y - dy / cam.s;
  } else if (p.length >= 2 && s.length >= 2) {
    moved = true;
    const d0 = Math.hypot(s[0].x - s[1].x, s[0].y - s[1].y), d1 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    const m0 = { x: (s[0].x + s[1].x) / 2, y: (s[0].y + s[1].y) / 2 }, m1 = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
    const anchor = { x: gesture.cam.x + (m0.x - W / 2) / gesture.cam.s, y: gesture.cam.y + (m0.y - H / 2) / gesture.cam.s };
    cam.s = gesture.cam.s * (d1 / d0);
    cam.x = anchor.x - (m1.x - W / 2) / cam.s; cam.y = anchor.y - (m1.y - H / 2) / cam.s;
  }
  clampCam();
});
function endPointer(e) {
  const wasTap = pointers.size === 1 && !moved;
  pointers.delete(e.pointerId);
  if (pointers.size) gesture = { cam: { ...cam }, pts: new Map([...pointers].map(([k, v]) => [k, { ...v }])) };
  if (wasTap && e.type === 'pointerup') tapAt(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const a = toPaint(e.clientX, e.clientY);
  cam.s *= Math.exp(-e.deltaY * 0.0015);
  clampCam();
  cam.x = a.x - (e.clientX - W / 2) / cam.s; cam.y = a.y - (e.clientY - H / 2) / cam.s;
  clampCam();
}, { passive: false });

function tapAt(px, py) {
  const p = toPaint(px, py);
  const slop = 6 / cam.s;
  const hit = cast.draw(now()).reverse().find(a => {
    const sp = sprites[a.sprite]; if (!sp) return false;
    const f = sp.frames[a.frame] || sp.frames.stand || sp.frames.sit; if (!f) return false;
    const w = f[2] / sp.res * (a.scale || 1), h = f[3] / sp.res * (a.scale || 1);
    return p.x > a.x - w / 2 - slop && p.x < a.x + w / 2 + slop && p.y > a.y - a.bob - h - slop && p.y < a.y + slop;
  });
  if (hit && RESIDENTS) { openWho(hit.id); return; }
  const z = ZONES.find(z => p.x >= z.box[0] && p.x <= z.box[2] && p.y >= z.box[1] && p.y <= z.box[3]);
  if (z) openZoneSheet(z.id);
}
function flyTo(x, y, s) {
  const from = { ...cam }, to = { x, y, s: s || Math.max(cam.s, fitScale() * 2.2) };
  const t0 = performance.now();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function step() {
    const p = reduce ? 1 : Math.min(1, (performance.now() - t0) / 650);
    const e = 1 - Math.pow(1 - p, 3);
    cam.x = from.x + (to.x - from.x) * e; cam.y = from.y + (to.y - from.y) * e; cam.s = from.s + (to.s - from.s) * e;
    clampCam();
    if (p < 1) requestAnimationFrame(step);
  })();
}

// ---------- HUD ----------
const ICON = {
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0zm4-5c0-1.5 1-2 1-3m4 3c0-1.5 1-2 1-3m4 3c0-1.5 1-2 1-3" />',
  leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15m0 0 7-7"/>',
  star: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  paw: '<circle cx="7" cy="9" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="9" r="2"/><path d="M8 17c0-3 2-5 4-5s4 2 4 5-2 3-4 3-4 0-4-3z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
};
const svg = (name, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

function renderHud() {
  $('stationName').textContent = state.name;
  const md = mood();
  const pill = $('mood'); pill.textContent = md.label; pill.className = 'mood ' + md.cls;
  const box = $('meters');
  if (!box.children.length) {
    for (const m of METERS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'meter'; b.dataset.id = m.id; b.style.setProperty('--c', m.color);
      b.innerHTML = `${svg(m.icon)}<span class="mname">${m.name}</span><span class="bar"><i></i></span><span class="mval"></span>`;
      b.addEventListener('click', () => focusMeter(m.id));
      box.appendChild(b);
    }
  }
  for (const b of box.children) {
    const v = Math.round(state.meters[b.dataset.id]);
    b.querySelector('i').style.width = v + '%';
    b.querySelector('.mval').textContent = v;
    b.classList.toggle('low', v < 35);
    b.classList.toggle('dark', isDark(b.dataset.id));
    b.setAttribute('aria-pressed', String(focus === b.dataset.id));
    b.setAttribute('aria-label', `${METERS.find(m => m.id === b.dataset.id).name}: ${v} out of 100`);
  }
}
function focusMeter(id) {
  focus = focus === id ? null : id;
  renderHud();
  if (!focus) return;
  const zs = ZONES.filter(z => z.meter === id);
  const worst = zs[0];
  flyTo((worst.box[0] + worst.box[2]) / 2, (worst.box[1] + worst.box[3]) / 2);
  const m = METERS.find(m => m.id === id);
  toast(`${m.name} is at ${Math.round(state.meters[id])}.`, `Tap ${zs.map(z => z.name).join(' or ')} to help.`);
}

// ---------- the place sheet ----------
let openZone = null;
function openZoneSheet(id) {
  openZone = id;
  renderZone();
  $('zoneSheet').hidden = false;
  const z = ZONES.find(z => z.id === id);
  flyTo((z.box[0] + z.box[2]) / 2, (z.box[1] + z.box[3]) / 2 + (z.box[3] - z.box[1]) * 0.6);
}
function closeZoneSheet() { openZone = null; $('zoneSheet').hidden = true; }
function fmtWait(ms) {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim() : `${m}m`;
}
function renderZone() {
  const z = ZONES.find(z => z.id === openZone);
  if (!z) return;
  const m = METERS.find(m => m.id === z.meter);
  const v = Math.round(state.meters[z.meter]);
  $('zoneName').textContent = z.name;
  $('zoneNeed').innerHTML = '';
  const need = document.createElement('span');
  need.className = 'need';
  need.style.setProperty('--c', m.color);
  need.innerHTML = `${svg(m.icon, 16)} ${m.name} ${v}`;
  $('zoneNeed').appendChild(need);
  const note = document.createElement('span');
  note.className = 'note';
  note.textContent = isDark(z.meter) ? 'Shut down. Bring it back above 40 to reopen.' : v < 35 ? 'Needs you.' : v < 70 ? 'Could use a hand.' : 'All good here.';
  $('zoneNeed').appendChild(note);
  const list = $('zoneActions'); list.textContent = '';
  const now = Date.now();
  for (const id of z.actions) {
    const a = ACTIONS[id];
    const wait = (state.cooldowns[id] || 0) - now;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'action';
    b.disabled = wait > 0;
    const gains = Object.entries(a.gives).map(([k, n]) => `+${n} ${meterName(k)}`).join(', ');
    const costs = Object.entries(a.costs || {}).map(([k, n]) => `−${n} ${meterName(k)}`).join(', ');
    b.innerHTML = `<span class="alabel"></span><span class="ameta"></span>`;
    b.querySelector('.alabel').textContent = a.label;
    b.querySelector('.ameta').textContent = wait > 0 ? `Again in ${fmtWait(wait)}` : [gains, costs].filter(Boolean).join(' · ');
    b.addEventListener('click', () => act(id));
    list.appendChild(b);
  }
}

// ---------- residents: who's who, follow, personality quiz ----------
let whoId = null;
function spriteThumb(sid, frame, size = 44) {
  const sp = sprites[sid]; const c = document.createElement('canvas');
  c.width = c.height = size * 2; c.className = 'thumbc';
  if (!sp) return c;
  const draw = () => {
    const f = sp.frames[frame] || sp.frames.stand || sp.frames.sit; if (!f) return;
    const g = c.getContext('2d'); const k = Math.min((size * 2 - 8) / f[2], (size * 2 - 8) / f[3]);
    g.drawImage(sp.img, f[0], f[1], f[2], f[3], (size * 2 - f[2] * k) / 2, size * 2 - 4 - f[3] * k, f[2] * k, f[3] * k);
  };
  sp.img.complete ? draw() : sp.img.addEventListener('load', draw, { once: true });
  return c;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function openWho(id) {
  whoId = id; selected = id; selectedUntil = performance.now() + 600000;
  renderWho();
  $('whoSheet').hidden = false;
}
function closeWho() { whoId = null; selected = null; $('whoSheet').hidden = true; }
function renderWho() {
  const a = cast.draw(now()).find(a => a.id === whoId); if (!a) return;
  const m = CAST_BY_ID[a.id];
  $('whoName').textContent = a.name;
  $('whoDoing').textContent = cap(a.doing) + '.';
  const pic = $('whoPic'); pic.textContent = ''; pic.appendChild(spriteThumb(a.sprite, 'stand', 40));
  $('whoFollow').textContent = following === a.id ? 'Stop following' : 'Follow';
  const q = quizFor(m.kind);
  $('whoQuiz').hidden = !q;
  $('whoQuiz').textContent = (state.personality || {})[a.id] ? 'Edit personality' : 'Take the personality quiz';
}
function openPeople() {
  const list = $('peopleList'); list.textContent = '';
  const now_ = cast.draw(now());
  for (const m of Object.values(CAST_BY_ID)) {
    const a = now_.find(a => a.id === m.id);
    const row = document.createElement('button'); row.type = 'button'; row.className = 'prow';
    row.appendChild(spriteThumb(m.sprite, 'stand', 26));
    const t = document.createElement('span'); t.className = 'pt';
    const n = document.createElement('b'); n.textContent = m.name;
    const d = document.createElement('span'); d.textContent = a ? cap(a.doing) : '';
    t.append(n, d); row.appendChild(t);
    if (quizFor(m.kind)) {
      const chip = document.createElement('span'); chip.className = 'qchip' + ((state.personality || {})[m.id] ? ' done' : '');
      chip.textContent = (state.personality || {})[m.id] ? 'Personality set' : 'Take quiz';
      row.appendChild(chip);
    }
    row.addEventListener('click', () => { $('peopleSheet').hidden = true; openWho(m.id); following = m.id; cam.s = Math.max(cam.s, fitScale() * 3); renderWho(); });
    list.appendChild(row);
  }
  $('peopleSheet').hidden = false;
}

let quizId = null, quizAnswers = {};
function words(m) {
  const you = m.id === 'conor';
  return s => s.replace(/\{they\}/g, you ? 'you' : 'they').replace(/\{are\}/g, 'are').replace(/\{name\}/g, m.name);
}
function openQuiz(id) {
  quizId = id;
  const m = CAST_BY_ID[id];
  quizAnswers = JSON.parse(JSON.stringify((state.personality || {})[id] || {}));
  $('quizTitle').textContent = id === 'conor' ? 'Your personality' : `${m.name}'s personality`;
  const box = $('quizBody'); box.textContent = '';
  const w = words(m);
  for (const q of quizFor(m.kind)) {
    const sec = document.createElement('fieldset'); sec.className = 'qq';
    const lg = document.createElement('legend'); lg.textContent = cap(w(q.q)); sec.appendChild(lg);
    if (q.multi) { const h = document.createElement('p'); h.className = 'hint'; h.textContent = 'Pick all that fit.'; sec.appendChild(h); }
    const chips = document.createElement('div'); chips.className = 'qchips';
    for (const o of q.options) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'qopt';
      b.textContent = o.label;
      if (o.note) { const sm = document.createElement('small'); sm.textContent = o.note; b.appendChild(sm); }
      const on = () => [].concat(quizAnswers[q.id] ?? []).includes(o.label);
      b.setAttribute('aria-pressed', String(on()));
      b.addEventListener('click', () => {
        const cur = [].concat(quizAnswers[q.id] ?? []);
        quizAnswers[q.id] = q.multi ? (cur.includes(o.label) ? cur.filter(x => x !== o.label) : [...cur, o.label]) : (cur.includes(o.label) ? [] : [o.label]);
        chips.querySelectorAll('.qopt').forEach((el, i) => el.setAttribute('aria-pressed', String([].concat(quizAnswers[q.id]).includes(q.options[i].label))));
      });
      chips.appendChild(b);
    }
    sec.appendChild(chips); box.appendChild(sec);
  }
  $('whoSheet').hidden = true;
  $('quizSheet').hidden = false;
  box.scrollTop = 0;
}
function saveQuiz() {
  state.personality = { ...(state.personality || {}), [quizId]: quizAnswers };
  save();
  cast.setPersonalities(state.personality);
  cast.replan(now());
  const m = CAST_BY_ID[quizId];
  $('quizSheet').hidden = true;
  toast(quizId === 'conor' ? 'Got it. That\'s you now.' : `Got it. That's ${m.name} now.`, 'Their days on the station follow these answers from here on.');
  openWho(quizId);
}

// ---------- toasts and the station log ----------
let toastTimer;
function toast(main, sub) {
  const t = $('toast');
  t.querySelector('b').textContent = main;
  t.querySelector('span').textContent = sub || '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
}
let momentAt = 0, lastMoment = -1;
function tickMoments(now) {
  if (now - momentAt < 11000) return;
  momentAt = now;
  const h = hourNow();
  const ok = MOMENTS.map((m, i) => [m, i]).filter(([m, i]) => i !== lastMoment && m.when(state.meters, h));
  const mine = cast.moments(state.meters).map(text => [{ text }, text]);
  const pool = mine.length && Math.random() < 0.6 ? mine : ok;      // personality moments come up often
  if (!pool.length) return;
  const [m, i] = pool[Math.floor(Math.random() * pool.length)];
  lastMoment = i;
  const el = $('log');
  el.classList.remove('in'); void el.offsetWidth;
  el.textContent = m.text;
  el.classList.add('in');
}

// ---------- capture: the same moment as two wallpapers ----------
const COVER = { w: 1398, h: 2034 };   // closed screen
const INNER = { w: 2670, h: 1878 };   // open screen
let coverView = { sx: 700, sy: 250, sw: 600, sh: 600 * COVER.h / COVER.w };
const innerView = (() => { const sh = IMAGE.h, sw = sh * INNER.w / INNER.h; return { sx: (IMAGE.w - sw) / 2, sy: 0, sw, sh }; })();
let captureSize = 1;     // 0 closer, 1 normal, 2 wider
const COVER_WIDTHS = [430, 600, 820];

function openCapture() {
  $('capSheet').hidden = false;
  $('capResult').hidden = true;
  $('capStart').disabled = false;
  $('capStatus').textContent = '';
  drawCapPreview();
}
function closeCapture() { $('capSheet').hidden = true; }
function setCoverSize(i) {
  captureSize = i;
  const cx = coverView.sx + coverView.sw / 2, cy = coverView.sy + coverView.sh / 2;
  coverView.sw = COVER_WIDTHS[i]; coverView.sh = coverView.sw * COVER.h / COVER.w;
  moveCover(cx, cy);
  document.querySelectorAll('#capSizes button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
}
function moveCover(cx, cy) {
  coverView.sx = Math.max(0, Math.min(IMAGE.w - coverView.sw, cx - coverView.sw / 2));
  coverView.sy = Math.max(0, Math.min(IMAGE.h - coverView.sh, cy - coverView.sh / 2));
  drawCapPreview();
}
function drawCapPreview() {
  const c = $('capPreview');
  const w = c.clientWidth || 320;
  c.width = Math.round(w * dpr); c.height = Math.round(w * IMAGE.h / IMAGE.w * dpr);
  const g = c.getContext('2d');
  drawWorld(g, img, lights, { sx: 0, sy: 0, sw: IMAGE.w, sh: IMAGE.h }, { w: c.width, h: c.height }, now() , lookFor());
  const k = c.width / IMAGE.w;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = 'rgba(5,7,13,0.45)';
  g.fillRect(0, 0, c.width, c.height);
  g.save();
  g.beginPath(); g.rect(coverView.sx * k, coverView.sy * k, coverView.sw * k, coverView.sh * k); g.clip();
  drawWorld(g, img, lights, { sx: 0, sy: 0, sw: IMAGE.w, sh: IMAGE.h }, { w: c.width, h: c.height }, now(), lookFor());
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.strokeStyle = '#ffb45e'; g.lineWidth = 2 * dpr;
  g.strokeRect(coverView.sx * k, coverView.sy * k, coverView.sw * k, coverView.sh * k);
}
$('capPreview').addEventListener('pointerdown', e => {
  const c = e.currentTarget, r = c.getBoundingClientRect();
  const move = ev => moveCover((ev.clientX - r.left) / r.width * IMAGE.w, (ev.clientY - r.top) / r.height * IMAGE.h);
  move(e);
  c.setPointerCapture(e.pointerId);
  c.onpointermove = move;
  c.onpointerup = () => { c.onpointermove = null; };
});

function pickMime() {
  if (!window.MediaRecorder) return null;
  for (const m of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}
async function renderStill(view, size, t, look) {
  const c = document.createElement('canvas'); c.width = size.w; c.height = size.h;
  drawWorld(c.getContext('2d'), img, lights, view, size, t, look);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
}
async function recordBoth(seconds) {
  const mime = pickMime();
  if (!mime || !HTMLCanvasElement.prototype.captureStream) return null;
  const mk = size => {
    const c = document.createElement('canvas'); c.width = size.w; c.height = size.h;
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 14000000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise(r => { rec.onstop = r; });
    return { c, g: c.getContext('2d'), size, stream, rec, chunks, done };
  };
  const A = mk(COVER), B = mk(INNER);
  const draw = () => {
    const look = lookFor(), t = now();       // one moment, drawn twice
    drawWorld(A.g, img, lights, coverView, COVER, t, look);
    drawWorld(B.g, img, lights, innerView, INNER, t, look);
  };
  draw();
  A.rec.start(250); B.rec.start(250);
  const start = performance.now();
  const tStart = now();
  await new Promise(resolve => {
    (function frame() {
      const el = (performance.now() - start) / 1000;
      draw();
      $('capStatus').textContent = `Recording both screens… ${Math.min(seconds, el).toFixed(1)}s`;
      if (el < seconds) requestAnimationFrame(frame); else resolve();
    })();
  });
  A.rec.stop(); B.rec.stop();
  await Promise.all([A.done, B.done]);
  for (const x of [A, B]) x.stream.getTracks().forEach(tr => tr.stop());
  const type = mime.split(';')[0];
  return { cover: new Blob(A.chunks, { type }), inner: new Blob(B.chunks, { type }), tStart };
}
let captured = [];
async function capture() {
  $('capStart').disabled = true;
  $('capResult').hidden = true;
  const secs = 3.2;
  try {
    const clips = await recordBoth(secs);
    const coverClip = clips && clips.cover, innerClip = clips && clips.inner;
    // The stills are the middle of the clip: that's the frame a Live Photo rests on.
    const tMid = clips ? clips.tStart + secs / 2 : now(), look = lookFor();
    const coverJpg = await renderStill(coverView, COVER, tMid, look);
    const innerJpg = await renderStill(innerView, INNER, tMid, look);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const ext = coverClip ? (coverClip.type.includes('mp4') ? 'mp4' : 'webm') : '';
    captured = [
      coverClip && new File([coverClip], `station-${stamp}-closed.${ext}`, { type: coverClip.type }),
      innerClip && new File([innerClip], `station-${stamp}-open.${ext}`, { type: innerClip.type }),
      new File([coverJpg], `station-${stamp}-closed.jpg`, { type: 'image/jpeg' }),
      new File([innerJpg], `station-${stamp}-open.jpg`, { type: 'image/jpeg' }),
    ].filter(Boolean);
    showResult(!!coverClip);
  } catch (e) {
    $('capStatus').textContent = 'Capture didn\'t work on this device: ' + (e && e.message ? e.message : 'unknown error');
  }
  $('capStart').disabled = false;
}
function showResult(hasVideo) {
  const box = $('capFiles'); box.textContent = '';
  for (const f of captured) {
    const url = URL.createObjectURL(f);
    const fig = document.createElement('figure');
    const media = f.type.startsWith('video') ? Object.assign(document.createElement('video'), { src: url, muted: true, loop: true, playsInline: true, autoplay: true }) : Object.assign(document.createElement('img'), { src: url, alt: '' });
    const cap = document.createElement('figcaption');
    cap.textContent = (f.name.includes('closed') ? 'Closed screen' : 'Open screen') + (f.type.startsWith('video') ? ' · video' : ' · still');
    const a = Object.assign(document.createElement('a'), { href: url, download: f.name, textContent: 'Download' });
    fig.append(media, cap, a);
    box.appendChild(fig);
  }
  $('capStatus').textContent = hasVideo ? 'Captured. Same moment, both screens.' : 'This browser can\'t record video, so you got the two stills.';
  $('capShare').hidden = NATIVE || !(navigator.canShare && navigator.canShare({ files: captured }));
  $('capLive').hidden = !(NATIVE && hasVideo);
  $('capHow').hidden = NATIVE && hasVideo;
  $('capResult').hidden = false;
}

// ---------- the iPhone app: real Live Photos and notifications ----------
const CAP = window.Capacitor;
const NATIVE = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
const plugin = name => (NATIVE && CAP.Plugins ? CAP.Plugins[name] : null);
const toB64 = blob => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = bad; r.readAsDataURL(blob); });
async function saveLivePhotos() {
  const LP = plugin('LivePhoto');
  if (!LP) return;
  $('capLive').disabled = true;
  try {
    for (const which of ['closed', 'open']) {
      const video = captured.find(f => f.name.includes(which) && f.type.startsWith('video'));
      const photo = captured.find(f => f.name.includes(which) && f.type === 'image/jpeg');
      if (!video || !photo) continue;
      $('capStatus').textContent = `Saving the ${which === 'closed' ? 'closed-screen' : 'open-screen'} Live Photo…`;
      await LP.save({ photo: await toB64(photo), video: await toB64(video), videoType: video.type });
    }
    $('capStatus').textContent = 'Saved 2 Live Photos. Settings → Wallpaper: put "closed" on the cover screen and "open" on the inner screen.';
  } catch (e) {
    $('capStatus').textContent = 'Couldn\'t save: ' + ((e && e.message) || 'unknown error');
  }
  $('capLive').disabled = false;
}

// When the app goes to the background, schedule a nudge for when the station will need you.
async function scheduleNudges() {
  const LN = plugin('LocalNotifications');
  if (!LN) return;
  try {
    const perm = await LN.checkPermissions();
    if (perm.display !== 'granted') return;
    await LN.cancel({ notifications: [{ id: 1 }, { id: 2 }] }).catch(() => {});
    const soon = [];
    const hoursUntil = (id, level) => {
      const m = METERS.find(m => m.id === id), v = state.meters[id];
      return v <= level ? 0 : (v - level) / m.decay / SPEED;
    };
    const boys = hoursUntil('boys', 30);
    if (boys > 0.2) soon.push({ id: 1, title: 'Elliot and Colenzo are hungry', body: 'The boys are staring at their bowls. Come feed them.', schedule: { at: new Date(Date.now() + boys * 3600000) } });
    const worst = METERS.filter(m => m.id !== 'boys').map(m => [m, hoursUntil(m.id, 20)]).sort((a, b) => a[1] - b[1])[0];
    if (worst && worst[1] > 0.2) soon.push({ id: 2, title: `${state.name} needs you`, body: `${worst[0].name} is running low. Things are starting to go dark.`, schedule: { at: new Date(Date.now() + worst[1] * 3600000) } });
    if (soon.length) await LN.schedule({ notifications: soon });
  } catch (e) { /* notifications are a nice-to-have */ }
}
async function askForNudges() {
  const LN = plugin('LocalNotifications');
  if (!LN) return;
  try { const p = await LN.checkPermissions(); if (p.display === 'prompt' || p.display === 'prompt-with-rationale') await LN.requestPermissions(); } catch (e) { /* fine */ }
}
async function shareCapture() {
  try { await navigator.share({ files: captured, title: state.name }); }
  catch (e) { if (e && e.name !== 'AbortError') $('capStatus').textContent = 'Sharing didn\'t work. Use the Download links instead.'; }
}

// ---------- loop ----------
const T0 = performance.now();
const now = () => (performance.now() - T0) / 1000;
let lastSim = 0;
function frame(ts) {
  if (ts - lastSim > 1000) {
    lastSim = ts;
    advance();
    save();
    renderHud();
    if (openZone) renderZone();
    if (whoId) renderWho();
    tickMoments(ts);
  }
  cast.update(now(), { meters: state.meters, dark: Object.fromEntries(ZONES.map(z => [z.id, isDark(z.meter)])), hour: hourNow(), boost: BOOST });
  if (following) {
    const a = cast.draw(now()).find(a => a.id === following);
    if (a) { cam.x += (a.x - cam.x) * 0.08; cam.y += (a.y - 30 - cam.y) * 0.08; clampCam(); }
  }
  if (selected && performance.now() > selectedUntil) selected = null;
  const look = lookFor();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const view = { sx: cam.x - W / 2 / cam.s, sy: cam.y - H / 2 / cam.s, sw: W / cam.s, sh: H / cam.s };
  if (img.complete && img.naturalWidth) drawWorld(ctx, img, lights, view, { w: canvas.width, h: canvas.height }, now(), look, { ui: true, focus, px: dpr, colors: METER_COLORS, selected });
  requestAnimationFrame(frame);
}

async function boot() {
  advance();
  window.addEventListener('resize', resize);
  resize();
  try { lights = assignZones(await (await fetch('data/lights.json')).json()); } catch (e) { lights = []; }
  try {
    const meta = await (await fetch('data/sprites.json')).json();
    for (const [id, m] of Object.entries(meta)) { const im = new Image(); im.src = m.src; sprites[id] = { img: im, frames: m.frames, res: m.res }; }
  } catch (e) { /* the station still runs without residents */ }
  img.src = 'assets/station.jpg';
  await img.decode().catch(() => {});
  renderHud();
  requestAnimationFrame(frame);
  if (DEMO) toast(`Preview: ${DEMO}`, 'Nothing you do here is saved.');
  else if (!localStorage.getItem(KEY + '-seen')) {
    try { localStorage.setItem(KEY + '-seen', '1'); } catch (e) { /* fine */ }
    toast('Welcome aboard.', 'The colored dots are places you can take care of. Tap anyone to meet them; the people button lists everyone. The camera grabs this moment as wallpaper.');
  }
}

$('zoneClose').addEventListener('click', closeZoneSheet);
$('whoClose').addEventListener('click', closeWho);
$('whoFollow').addEventListener('click', () => { following = following === whoId ? null : whoId; if (following) cam.s = Math.max(cam.s, fitScale() * 3); renderWho(); });
$('whoQuiz').addEventListener('click', () => openQuiz(whoId));
$('peopleBtn').addEventListener('click', openPeople);
if (!RESIDENTS) $('peopleBtn').hidden = true;
$('peopleClose').addEventListener('click', () => { $('peopleSheet').hidden = true; });
$('quizSave').addEventListener('click', saveQuiz);
$('quizClose').addEventListener('click', () => { $('quizSheet').hidden = true; });
$('capOpen').addEventListener('click', openCapture);
$('capClose').addEventListener('click', closeCapture);
$('capStart').addEventListener('click', capture);
$('capShare').addEventListener('click', shareCapture);
$('capLive').addEventListener('click', saveLivePhotos);
document.querySelectorAll('#capSizes button').forEach(b => b.addEventListener('click', () => setCoverSize(+b.dataset.i)));
$('stationName').addEventListener('click', () => {
  const n = $('renameInput');
  $('rename').hidden = false; n.value = state.name; n.focus(); n.select();
});
$('renameForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('renameInput').value.trim();
  if (v) { state.name = v.slice(0, 40); save(); renderHud(); }
  $('rename').hidden = true;
});
$('renameCancel').addEventListener('click', () => { $('rename').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeZoneSheet(); closeCapture(); closeWho(); $('peopleSheet').hidden = true; $('quizSheet').hidden = true; $('rename').hidden = true; } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { advance(); renderHud(); } else scheduleNudges(); });
boot();

// For checking the look in a test browser.
window.__world = { state: () => state, overall, isDark, cast: () => cast.draw(now()), screenOf: (x, y) => ({ x: (x - cam.x) * cam.s + W / 2, y: (y - cam.y) * cam.s + H / 2 }) };
