// Who lives on the station and where they spend their time.
// Floors and room edges are pixels on the station painting.

export const SHAFT_X = 946;                  // the glass elevator tube
export const RIDE_SPEED = 170;               // painting px per second

export const PLACES = {
  office: { name: "Conor's office", y: 646, x0: 1178, x1: 1368, zone: 'office', seats: { conor: 1292 } },
  park: { name: 'Elliot & Colenzo Park', y: 708, x0: 668, x1: 878, zone: 'park' },
  court: { name: 'the court', y: 798, x0: 1014, x1: 1392, zone: 'court' },
  cinema: { name: 'Orbit Cinema', y: 344, x0: 994, x1: 1144, zone: 'cinema' },
  dumpling: { name: 'Dumpling Orbit', y: 496, x0: 1160, x1: 1292, zone: 'dumpling' },
  snus: { name: 'the snus shop', y: 384, x0: 554, x1: 672, zone: 'snus' },
  nursery: { name: 'Root Bound Plants', y: 1002, x0: 570, x1: 752, zone: 'nursery' },
  vet: { name: 'Good Boy Vet', y: 517, x0: 488, x1: 594, zone: 'vet' },
};

// What someone is doing at a place, by kind.
export const DOING = {
  person: {
    office: 'gaming in the office', park: 'hanging out in the park', court: 'shooting hoops', cinema: 'watching a movie',
    dumpling: 'eating dumplings', snus: 'picking up pouches', nursery: 'tending the plants', vet: 'visiting the vet',
  },
  dog: {
    office: 'watching Conor play', park: 'running laps in the park', court: 'chasing the ball on the court', cinema: 'begging for popcorn',
    dumpling: 'begging for dumplings', snus: 'sniffing around the snus shop', nursery: 'digging in the planters', vet: 'getting a check-up',
  },
  cat: {
    office: 'napping by the fish tanks', park: 'stalking a moth', court: 'watching the game', cinema: 'asleep on a seat',
    dumpling: 'waiting for scraps', snus: 'sitting on the counter', nursery: 'hiding in the ferns', vet: 'avoiding the vet',
  },
  robot: {
    office: 'delivering snacks', park: 'sweeping the park', court: 'fetching balls', cinema: 'selling popcorn',
    dumpling: 'carrying dumpling crates', snus: 'restocking shelves', nursery: 'misting the plants', vet: 'dropping off supplies',
  },
};

// kind: person | dog | cat | robot. likes: place -> weight. home: where they sleep at night.
export const CAST = [
  { id: 'conor', name: 'Conor', sprite: 'conor', kind: 'person', speed: 34, home: 'office',
    likes: { office: 6, park: 3, court: 2, dumpling: 2, cinema: 1, snus: 1 } },
  { id: 'elliot', name: 'Elliot', sprite: 'elliot', kind: 'dog', speed: 50, home: 'office', follows: 'conor',
    likes: { park: 5, office: 2, dumpling: 1, court: 1 } },
  { id: 'colenzo', name: 'Colenzo', sprite: 'colenzo', kind: 'dog', speed: 52, home: 'office', follows: 'conor',
    likes: { park: 5, office: 2, dumpling: 2, nursery: 1 } },
  { id: 'mara', name: 'Mara', sprite: 'mara', kind: 'person', speed: 36, home: 'nursery',
    likes: { nursery: 4, court: 2, dumpling: 2, vet: 1 } },
  { id: 'gus', name: 'Gus', sprite: 'gus', kind: 'person', speed: 24, home: 'cinema',
    likes: { cinema: 4, dumpling: 3, nursery: 2, park: 1 } },
  { id: 'jules', name: 'Jules', sprite: 'jules', kind: 'person', speed: 40, home: 'park',
    likes: { court: 4, park: 3, cinema: 2, snus: 1 } },
  { id: 'dee', name: 'Dee', sprite: 'dee', kind: 'person', speed: 36, home: 'dumpling',
    likes: { dumpling: 3, snus: 3, court: 2, vet: 1 } },
  { id: 'ginger', name: 'Ginger', sprite: 'ginger', kind: 'cat', speed: 26, home: 'nursery',
    likes: { nursery: 3, dumpling: 3, office: 2, park: 1 } },
  { id: 'pixel', name: 'Pixel', sprite: 'pixel', kind: 'cat', speed: 30, home: 'cinema',
    likes: { cinema: 3, office: 2, snus: 2, court: 1 } },
  { id: 'bolt', name: 'Bolt', sprite: 'bolt', kind: 'robot', speed: 42, home: 'dumpling',
    likes: { dumpling: 3, snus: 2, office: 2, nursery: 2, cinema: 1 } },
];
