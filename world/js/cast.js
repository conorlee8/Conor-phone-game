// The station's residents: each one plans a day of small trips and hangs out
// in between. A plan is a list of timed legs (walk, pose, fade, ride), so where
// someone is at any moment is a pure function of the clock: the screen and
// both wallpaper clips see exactly the same thing.
import { CAST, PLACES, SHAFT_X, RIDE_SPEED, DOING } from '../data/cast.js';

const rand = (a, b) => a + Math.random() * (b - a);
function pick(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) if ((r -= w) <= 0) return k;
  return entries.length ? entries[entries.length - 1][0] : null;
}
const exitX = p => (PLACES[p].x0 + PLACES[p].x1) / 2 < SHAFT_X ? PLACES[p].x1 - 4 : PLACES[p].x0 + 4;
const restPose = kind => kind === 'person' ? 'sit' : kind === 'robot' ? 'stand' : 'lie';

export class Cast {
  constructor() {
    this.people = CAST.map((c, i) => ({ ...c, legs: [], at: null, lane: ((i * 7) % 11 - 5) * 2.2, depth: -((i * 5) % 9) }));
    this.world = { meters: {}, dark: {}, night: false };
  }

  // Keep every plan at least a few seconds ahead of the clock.
  update(t, world) {
    this.world = world;
    for (const p of this.people) {
      if (!p.legs.length) this.spawn(p, t);
      while (p.legs[p.legs.length - 1].t1 < t + 6) this.planVisit(p, p.legs[p.legs.length - 1].t1);
      while (p.legs.length > 1 && p.legs[0].t1 < t - 2) p.legs.shift();
    }
  }

  allowed(place) {
    const z = PLACES[place].zone;
    if (this.world.dark[z]) return false;
    if (place === 'dumpling' && (this.world.meters.food ?? 100) < 20) return false;
    return true;
  }

  spawn(p, t) {
    const place = this.allowed(p.home) ? p.home : 'park';
    const P = PLACES[place];
    const x = rand(P.x0 + 12, P.x1 - 12);
    p.at = place;
    p.legs.push({ k: 'pose', pose: p.kind === 'robot' ? 'stand' : (p.kind === 'person' ? 'stand' : 'sit'), x, y: P.y, face: 1, t0: t, t1: t + rand(1, 5), place });
  }

  chooseNext(p, t) {
    const m = this.world.meters;
    if (this.world.night && p.kind !== 'cat') return this.allowed(p.home) ? p.home : p.at;
    if (p.kind === 'dog' && (m.boys ?? 100) < 35) return 'park';            // hungry boys mope in the park
    if (p.follows && Math.random() < 0.65) {
      const lead = this.people.find(q => q.id === p.follows);
      if (lead && lead.target && this.allowed(lead.target)) return lead.target;
    }
    const likes = { ...p.likes };
    for (const k of Object.keys(likes)) if (!this.allowed(k)) likes[k] = 0;
    if ((m.fun ?? 100) < 35 && p.kind === 'person') likes[p.home] = (likes[p.home] || 0) + 6;   // low morale: people stay in
    return pick(likes) || p.at;
  }

  // One visit: travel to a place (if it's a different one), then hang out there.
  planVisit(p, t) {
    const last = p.legs[p.legs.length - 1];
    let x = last.x1 ?? last.x, y = last.y1 ?? last.y;
    const dest = this.chooseNext(p, t);
    const P = PLACES[dest];
    p.target = dest;
    if (dest !== p.at && last.k !== 'ride') {
      // Walk to the room's edge, slip out, ride the glass elevator, come in on the other floor.
      const ex = exitX(p.at);
      t = this.walk(p, x, ex, y, t, p.at);
      p.legs.push({ k: 'fade', out: true, x: ex, y, face: ex > x ? 1 : -1, t0: t, t1: t + 0.45, place: p.at }); t += 0.45;
      const sx = SHAFT_X + p.lane;
      const dt = 0.5 + Math.abs(P.y - y) / RIDE_SPEED;
      p.legs.push({ k: 'ride', x: sx, y0: y, y1: P.y, t0: t, t1: t + dt, place: null }); t += dt;
      const ix = exitX(dest);
      p.legs.push({ k: 'fade', out: false, x: ix, y: P.y, face: ix < SHAFT_X ? -1 : 1, t0: t, t1: t + 0.45, place: dest }); t += 0.45;
      x = ix; y = P.y;
      p.at = dest;
    }
    // Hang out: a few spots in the room, standing, sitting or lying between short strolls.
    const night = this.world.night, low = (this.world.meters.fun ?? 100) < 35;
    const lead = p.follows && this.people.find(q => q.id === p.follows);
    const stops = night ? 1 : 1 + Math.floor(rand(1, low ? 2 : 4));
    for (let i = 0; i < stops; i++) {
      let to = rand(P.x0 + 10, P.x1 - 10);
      if (lead && lead.at === dest) {
        const lx = lead.legs[lead.legs.length - 1].x ?? to;
        to = Math.max(P.x0 + 8, Math.min(P.x1 - 8, lx + (p.id === 'elliot' ? -26 : 30) + rand(-6, 6)));
      }
      const seat = P.seats && P.seats[p.id];
      if (seat && (i === 0 || Math.random() < 0.6)) to = seat;      // their own chair
      t = this.walk(p, x, to, P.y, t, dest);
      x = to;
      const sitty = p.kind === 'person' ? (dest === 'cinema' || dest === 'dumpling' || dest === 'office' ? 0.75 : 0.25) : 0.5;
      let pose = (seat && to === seat) || Math.random() < sitty ? restPose(p.kind) : (p.kind === 'robot' ? 'stand' : p.kind === 'person' ? 'stand' : 'sit');
      if (p.kind === 'dog' && (this.world.meters.boys ?? 100) < 35) pose = 'lie';
      if (night) pose = restPose(p.kind);
      if (p.kind === 'robot' && Math.random() < 0.4) pose = 'carry';
      const stay = night ? rand(40, 90) : rand(5, 16) * (low ? 1.6 : 1);
      p.legs.push({ k: 'pose', pose, x, y: P.y, face: Math.random() < 0.5 ? 1 : -1, t0: t, t1: t + stay, place: dest });
      t += stay;
    }
  }

  walk(p, x0, x1, y, t, place) {
    if (Math.abs(x1 - x0) < 2) return t;
    const dt = Math.abs(x1 - x0) / p.speed;
    p.legs.push({ k: 'walk', x0, x1, y, t0: t, t1: t + dt, place });
    return t + dt;
  }

  // Everyone's sprite, frame and position at time t, back to front.
  draw(t) {
    const out = [];
    for (const p of this.people) {
      const L = p.legs.find(l => t >= l.t0 && t < l.t1) || p.legs[p.legs.length - 1];
      if (!L) continue;
      const u = Math.max(0, Math.min(1, (t - L.t0) / (L.t1 - L.t0 || 1)));
      const step = p.kind === 'person' ? 0.24 : p.kind === 'robot' ? 0.3 : 0.17;
      const walkFrame = Math.floor(t / step) % 2 ? 'walk2' : 'walk';
      let item;
      if (L.k === 'walk') {
        item = { x: L.x0 + (L.x1 - L.x0) * u, y: L.y, frame: walkFrame, flip: L.x1 < L.x0, alpha: 1, bob: Math.abs(Math.sin(t / step * Math.PI)) * 1.1 };
      } else if (L.k === 'pose') {
        item = { x: L.x, y: L.y, frame: L.pose, flip: L.face < 0, alpha: 1, bob: 0 };
      } else if (L.k === 'fade') {
        item = { x: L.x, y: L.y, frame: p.kind === 'person' || p.kind === 'robot' ? 'stand' : 'sit', flip: L.face < 0, alpha: L.out ? 1 - u : u, bob: 0 };
      } else {
        item = { x: L.x, y: L.y0 + (L.y1 - L.y0) * u, frame: p.kind === 'person' || p.kind === 'robot' ? 'stand' : 'sit', flip: false, alpha: 0.9, bob: 0, glass: true };
      }
      if (p.kind === 'robot') item.bob += 6 + Math.sin(t * 3 + p.lane) * 2;
      item.y += L.k === 'ride' ? 0 : p.depth * 0.6;
      out.push({ ...item, id: p.id, name: p.name, sprite: p.sprite, kind: p.kind,
        doing: L.k === 'ride' ? 'riding the elevator' : L.k === 'fade' ? (L.out ? 'heading out' : 'arriving') : (DOING[p.kind][L.place] || 'wandering'),
        place: L.place });
    }
    return out.sort((a, b) => a.y - b.y);
  }
}
