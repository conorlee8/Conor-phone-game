// Personality quizzes. Every answer changes how a resident lives on the
// station: where they go (likes), when they sleep, how fast they move, how
// long they hang around, how closely they follow Conor, and the little
// moments the station log shows about them.
//
// effect keys: likes {place: weight}, wake, sleep (hours), speed, stay (multipliers),
// homebody (extra weight on home), follow (0-1), lie (0-1, chance to lie down),
// happy / bored / any: moment lines ({name} is replaced).

export const QUIZ = {
  person: [
    { id: 'spots', q: 'Where do {they} spend free time?', multi: true, options: [
      { label: 'Gaming in the office', fx: { likes: { office: 6 } } },
      { label: 'Hooping on the court', fx: { likes: { court: 5, gym: 2 } } },
      { label: 'The park with the boys', fx: { likes: { park: 5 } } },
      { label: 'Eating out', fx: { likes: { dumpling: 3, diner: 3, noodle: 2, pie: 2, taco: 2 } } },
      { label: 'Movies and shows', fx: { likes: { cinema: 5 } } },
      { label: 'Out for drinks', fx: { likes: { ales: 5 } } },
      { label: 'Gym', fx: { likes: { gym: 5 } } },
      { label: 'Records and comics', fx: { likes: { records: 3, pie: 2 } } },
      { label: 'Plants and gardening', fx: { likes: { nursery: 5 } } },
      { label: 'Skating', fx: { likes: { skate: 5 } } },
    ] },
    { id: 'clock', q: 'Morning person or night owl?', options: [
      { label: 'Early bird', note: 'up at 6, asleep by 10pm', fx: { wake: 6, sleep: 22 } },
      { label: 'In between', note: 'up at 8, asleep by midnight', fx: { wake: 8, sleep: 24 } },
      { label: 'Night owl', note: 'up at 10, asleep around 2am', fx: { wake: 10, sleep: 26 } },
    ] },
    { id: 'social', q: 'How social {are} {they}?', options: [
      { label: 'Homebody', fx: { homebody: 6, stay: 1.4 } },
      { label: 'Small crew', fx: { homebody: 2, stay: 1 } },
      { label: 'Always out', fx: { homebody: 0, stay: 0.75 } },
    ] },
    { id: 'energy', q: 'Energy level?', options: [
      { label: 'Chill', fx: { speed: 0.8, stay: 1.3 } },
      { label: 'Steady', fx: { speed: 1, stay: 1 } },
      { label: 'Always moving', fx: { speed: 1.3, stay: 0.7 } },
    ] },
    { id: 'happy', q: 'When {they} {are} happy, {they}…', multi: true, options: [
      { label: 'Throw a party', fx: { happy: ['{name} is throwing a party. The whole deck is invited.'] } },
      { label: 'Dance', fx: { happy: ['{name} is dancing in the glass elevator.'] } },
      { label: 'High-five everyone', fx: { happy: ['{name} is high-fiving everyone on the way past.'] } },
      { label: 'Game all night', fx: { happy: ['{name} is deep in a Rust raid and winning.'] } },
      { label: 'Cook for everyone', fx: { happy: ['{name} is cooking for half the station.'] } },
    ] },
    { id: 'bored', q: 'When {they} {are} bored, {they}…', multi: true, options: [
      { label: 'Raid the snacks', fx: { bored: ['{name} is raiding the food library again.'] } },
      { label: 'Start another game', fx: { bored: ['{name} just started another Rust session.'] } },
      { label: 'Nap', fx: { bored: ['{name} dozed off mid-sentence.'], lie: 0.2 } },
      { label: 'Walk the boys', fx: { bored: ['{name} is walking the boys around the ring.'], likes: { park: 3 } } },
      { label: 'Doomscroll', fx: { bored: ['{name} has been scrolling for an hour.'] } },
    ] },
  ],
  dog: [
    { id: 'spot', q: "{name}'s favorite spot?", multi: true, options: [
      { label: 'The park', fx: { likes: { park: 6 } } },
      { label: 'Right next to Conor', fx: { follow: 0.9 } },
      { label: 'Begging where the food is', fx: { likes: { dumpling: 4, diner: 3, pie: 2 } } },
      { label: 'Napping on the cinema seats', fx: { likes: { cinema: 4 }, lie: 0.3 } },
      { label: 'The vet (weirdly loves it)', fx: { likes: { vet: 4 } } },
    ] },
    { id: 'type', q: "{name}'s personality?", options: [
      { label: 'Zoomies machine', fx: { speed: 1.35, stay: 0.7, any: ['{name} has the zoomies and is doing laps of the deck.'] } },
      { label: 'Lazy lounger', fx: { speed: 0.8, stay: 1.5, lie: 0.5 } },
      { label: "Conor's shadow", fx: { follow: 0.95 } },
      { label: 'Troublemaker', fx: { follow: 0.4, likes: { dumpling: 3, diner: 2 }, any: ['{name} is up to something. It is very quiet.'] } },
    ] },
    { id: 'move', q: "{name}'s signature move?", multi: true, options: [
      { label: 'Steals food', fx: { any: ['{name} just stole a dumpling from Dumpling Orbit.', '{name} is chewing something. Nobody knows what.'] } },
      { label: 'Belly-up for rubs', fx: { any: ['{name} flopped over in the middle of the court for belly rubs.'] } },
      { label: 'Howls at shuttles', fx: { any: ['{name} is howling at a passing shuttle.'] } },
      { label: 'Chases the cats', fx: { any: ['{name} is chasing Pixel around the park. Pixel is winning.'] } },
      { label: 'Leans on people', fx: { any: ['{name} is leaning his whole weight on Gus.'] } },
    ] },
    { id: 'naps', q: 'How much does {name} nap?', options: [
      { label: 'All day', fx: { lie: 0.7 } },
      { label: 'Sometimes', fx: { lie: 0.35 } },
      { label: 'Never, too busy', fx: { lie: 0.1 } },
    ] },
  ],
};

// Combine someone's answers into one profile.
export function profileFrom(kind, answers) {
  const qs = QUIZ[kind === 'dog' ? 'dog' : 'person'];
  const out = { likes: {}, happy: [], bored: [], any: [] };
  let anyLikes = false;
  for (const q of qs) {
    const picked = [].concat(answers?.[q.id] ?? []);
    for (const label of picked) {
      const o = q.options.find(o => o.label === label);
      if (!o) continue;
      for (const [k, v] of Object.entries(o.fx)) {
        if (k === 'likes') { anyLikes = true; for (const [p, w] of Object.entries(v)) out.likes[p] = (out.likes[p] || 0) + w; }
        else if (Array.isArray(v)) out[k].push(...v);
        else if (k === 'stay' || k === 'speed') out[k] = (out[k] ?? 1) * v;
        else out[k] = Math.max(out[k] ?? 0, v);
      }
    }
  }
  if (!anyLikes) delete out.likes;
  return out;
}

export const quizFor = kind => (kind === 'dog' ? QUIZ.dog : kind === 'person' ? QUIZ.person : null);
