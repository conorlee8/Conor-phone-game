// Who lives on the station and where they spend their time.
// Floors and room edges are pixels on the station painting.

export const SHAFT_X = 946;                  // the glass elevator tube
export const RIDE_SPEED = 170;               // painting px per second

export const PLACES = {
  office: { name: "Conor's office", y: 646, x0: 1178, x1: 1368, zone: 'office', seats: { conor: 1292 } },
  park: { name: 'Elliot & Colenzo Park', y: 708, x0: 668, x1: 878, zone: 'park' },
  court: { name: 'the court', y: 798, yb: 752, yf: 800, x0: 1018, x1: 1392, zone: 'court', layered: true },
  cinema: { name: 'Orbit Cinema', y: 344, x0: 994, x1: 1144, zone: 'cinema' },
  dumpling: { name: 'Dumpling Orbit', y: 496, yb: 470, yf: 498, x0: 1156, x1: 1296, zone: 'dumpling', layered: true },
  snus: { name: 'the snus shop', y: 384, x0: 554, x1: 672, zone: 'snus' },
  nursery: { name: 'Root Bound Plants', y: 1002, x0: 570, x1: 752, zone: 'nursery' },
  vet: { name: 'Good Boy Vet', y: 517, x0: 488, x1: 594, zone: 'vet' },
  lounge: { name: 'the lounge', y: 498, x0: 700, x1: 885 },
  diner: { name: 'Starlite Diner', y: 866, x0: 535, x1: 700 },
  noodle: { name: 'Zero-G Noodle Bar', y: 1013, x0: 390, x1: 540 },
  taco: { name: 'Taco Moon', y: 1148, x0: 448, x1: 545 },
  records: { name: 'Wax Planet Records', y: 1150, x0: 565, x1: 715 },
  skate: { name: 'the skate ramp', y: 742, x0: 385, x1: 525 },
  gym: { name: 'Iron Orbit Gym', y: 905, x0: 1010, x1: 1210 },
  pie: { name: 'Skewer Row', y: 1048, x0: 1015, x1: 1405 },
  ales: { name: 'Airlock Ales', y: 1236, x0: 1010, x1: 1222 },
};

const SPECIFIC = {
  person: {
    office: 'gaming in the office', park: 'hanging out in the park', court: 'shooting hoops', cinema: 'watching a movie',
    dumpling: 'eating dumplings', snus: 'picking up pouches', nursery: 'tending the plants', vet: 'visiting the vet',
    lounge: 'chilling in the lounge', diner: 'eating pancakes at the diner', noodle: 'slurping noodles', taco: 'grabbing tacos',
    records: 'digging through records', skate: 'skating the ramp', gym: 'lifting at the gym', pie: 'eating on Skewer Row', ales: 'having a beer',
  },
  dog: {
    office: 'watching Conor play', park: 'running laps in the park', court: 'chasing the ball on the court', cinema: 'begging for popcorn',
    dumpling: 'begging for dumplings', snus: 'sniffing around the snus shop', nursery: 'digging in the planters', vet: 'getting a check-up',
    diner: 'begging for bacon', gym: 'supervising the gym', ales: 'getting pets at the bar',
  },
  cat: {
    office: 'napping by the fish tanks', park: 'stalking a moth', court: 'watching the game', cinema: 'asleep on a seat',
    dumpling: 'waiting for scraps', snus: 'sitting on the counter', nursery: 'hiding in the ferns', vet: 'avoiding the vet',
    records: 'asleep on the turntable', noodle: 'staring at the noodles',
  },
  robot: {
    office: 'delivering snacks', park: 'sweeping the park', court: 'fetching balls', cinema: 'selling popcorn',
    dumpling: 'carrying dumpling crates', snus: 'restocking shelves', nursery: 'misting the plants', vet: 'dropping off supplies',
    diner: 'wiping the tables', ales: 'polishing glasses', gym: 'wiping down benches',
  },
  alien: { cinema: 'learning about Earth from movies', court: 'trying to dribble', park: 'examining a dandelion', records: 'listening to vinyl for the first time' },
  bird: { park: 'pecking at seeds', court: 'shouting the score', nursery: 'eating the seedlings', cinema: 'repeating movie lines' },
};
export const SEATED_DOING = { dumpling: 'eating dumplings', court: 'resting on the bench' };
export function doingAt(kind, place) {
  return (SPECIFIC[kind] && SPECIFIC[kind][place]) || `hanging out at ${PLACES[place] ? PLACES[place].name : 'the station'}`;
}

// kind: person | dog | cat | robot | alien | bird. likes: place -> weight. home: where they rest.
// wake/sleep: hours they're up (sleep past midnight is 24+).
export const CAST = [
  { id: 'conor', name: 'Conor', sprite: 'conor', kind: 'person', speed: 34, home: 'office', wake: 8, sleep: 24, quiz: true,
    likes: { office: 6, park: 3, court: 2, dumpling: 2, cinema: 1, snus: 1, gym: 1 } },
  { id: 'elliot', name: 'Elliot', sprite: 'elliot', kind: 'dog', speed: 50, home: 'office', follows: 'conor', quiz: true,
    likes: { park: 5, office: 2, dumpling: 1, court: 1 } },
  { id: 'colenzo', name: 'Colenzo', sprite: 'colenzo', kind: 'dog', speed: 52, home: 'office', follows: 'conor', quiz: true,
    likes: { park: 5, office: 2, dumpling: 2, nursery: 1 } },
  { id: 'mara', name: 'Mara', sprite: 'mara', kind: 'person', speed: 36, home: 'nursery', wake: 6, sleep: 22,
    likes: { nursery: 4, court: 2, dumpling: 2, vet: 1, gym: 2 } },
  { id: 'gus', name: 'Gus', sprite: 'gus', kind: 'person', speed: 24, home: 'cinema', wake: 6, sleep: 21,
    likes: { cinema: 4, dumpling: 3, nursery: 2, diner: 3, lounge: 2 } },
  { id: 'jules', name: 'Jules', sprite: 'jules', kind: 'person', speed: 40, home: 'skate', wake: 10, sleep: 25,
    likes: { court: 3, park: 2, cinema: 2, skate: 5, records: 2, taco: 1 } },
  { id: 'dee', name: 'Dee', sprite: 'dee', kind: 'person', speed: 36, home: 'dumpling', wake: 7, sleep: 23,
    likes: { dumpling: 3, snus: 3, court: 2, vet: 1, noodle: 2, ales: 2 } },
  { id: 'mike', name: 'Big Mike', sprite: 'mike', kind: 'person', speed: 30, home: 'dumpling', wake: 5, sleep: 21,
    likes: { dumpling: 6, diner: 2, ales: 2, noodle: 1 } },
  { id: 'theo', name: 'Theo', sprite: 'theo', kind: 'person', speed: 38, home: 'records', wake: 9, sleep: 25,
    likes: { records: 4, ales: 3, park: 2, taco: 2, lounge: 2 } },
  { id: 'ivy', name: 'Ivy', sprite: 'ivy', kind: 'person', speed: 30, home: 'lounge', wake: 6, sleep: 22,
    likes: { lounge: 4, nursery: 3, pie: 2, cinema: 2, diner: 1 } },
  { id: 'nate', name: 'Nate', sprite: 'nate', kind: 'person', speed: 38, home: 'gym', wake: 7, sleep: 24,
    likes: { gym: 4, court: 4, noodle: 2, office: 1, ales: 1 } },
  { id: 'sky', name: 'Sky', sprite: 'sky', kind: 'person', speed: 42, home: 'park', wake: 7, sleep: 20,
    likes: { park: 5, skate: 2, pie: 2, vet: 1, nursery: 1 } },
  { id: 'biscuit', name: 'Biscuit', sprite: 'biscuit', kind: 'dog', speed: 40, home: 'park', follows: 'sky', wake: 7, sleep: 20,
    likes: { park: 5, diner: 2, vet: 1 } },
  { id: 'ginger', name: 'Ginger', sprite: 'ginger', kind: 'cat', speed: 26, home: 'nursery',
    likes: { nursery: 3, dumpling: 3, office: 2, park: 1, noodle: 1 } },
  { id: 'pixel', name: 'Pixel', sprite: 'pixel', kind: 'cat', speed: 30, home: 'cinema',
    likes: { cinema: 3, office: 2, snus: 2, court: 1, records: 2 } },
  { id: 'pepper', name: 'Pepper', sprite: 'pepper', kind: 'cat', speed: 28, home: 'lounge',
    likes: { lounge: 3, records: 2, pie: 2, ales: 1 } },
  { id: 'kiwi', name: 'Kiwi', sprite: 'kiwi', kind: 'bird', speed: 28, home: 'nursery',
    likes: { nursery: 3, park: 3, court: 1, cinema: 1 } },
  { id: 'zib', name: 'Zib', sprite: 'zib', kind: 'alien', speed: 30, home: 'cinema', wake: 12, sleep: 28,
    likes: { cinema: 3, records: 3, park: 2, court: 1, noodle: 1 } },
  { id: 'zorp', name: 'Zorp', sprite: 'zorp', kind: 'alien', speed: 34, home: 'records', follows: 'zib', wake: 12, sleep: 28,
    likes: { records: 3, cinema: 2, taco: 2, skate: 1 } },
  { id: 'bolt', name: 'Bolt', sprite: 'bolt', kind: 'robot', speed: 42, home: 'dumpling',
    likes: { dumpling: 3, snus: 2, office: 2, nursery: 2, cinema: 1 } },
  { id: 'scrub', name: 'Scrub', sprite: 'scrub', kind: 'robot', speed: 30, home: 'diner',
    likes: { diner: 3, ales: 3, gym: 2, noodle: 2, court: 1 } },
];
