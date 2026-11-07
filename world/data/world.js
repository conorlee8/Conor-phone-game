// What the station needs, where you take care of it, and what happens there.
// Coordinates are pixels on the 1824×1280 station painting (assets/station.jpg).

export const IMAGE = { w: 1824, h: 1280 };
export const HULL = { x: 915, y: 752, r: 632 };
export const SHAFT = { x0: 920, x1: 972, y0: 150, y1: 1280 };   // the glass elevator tube
export const TANKS = [1165, 525, 1215, 645];                     // fish tanks in Conor's office
export const STEAM = [1170, 440, 1290, 470];                     // tables at Dumpling Orbit

const HOUR = 3600 * 1000;

// Each need drains by `decay` points per hour (100 is full).
export const METERS = [
  { id: 'power', name: 'Power', decay: 1.6, color: '#ffd166', icon: 'bolt' },
  { id: 'food', name: 'Food', decay: 2.0, color: '#ff8a6b', icon: 'bowl' },
  { id: 'air', name: 'Air & water', decay: 1.2, color: '#7fdcc9', icon: 'leaf' },
  { id: 'fun', name: 'Fun', decay: 2.4, color: '#c4a7ff', icon: 'star' },
  { id: 'boys', name: 'The boys', decay: 3.0, color: '#f4a0b8', icon: 'paw' },
];

export const ZONES = [
  { id: 'park', name: 'Elliot & Colenzo Park', box: [655, 610, 885, 705], meter: 'boys', actions: ['feed', 'walk', 'fetch'] },
  { id: 'vet', name: 'Good Boy Vet', box: [475, 405, 600, 510], meter: 'boys', actions: ['checkup'] },
  { id: 'office', name: "Conor's office", box: [1163, 518, 1380, 662], meter: 'fun', actions: ['rust', 'tanks', 'library'] },
  { id: 'snus', name: 'Snus Shop', box: [544, 279, 678, 386], meter: 'fun', actions: ['pouches'] },
  { id: 'dumpling', name: 'Dumpling Orbit', box: [1150, 380, 1300, 495], meter: 'food', actions: ['cook'] },
  { id: 'nursery', name: 'Root Bound Plants', box: [560, 885, 760, 1000], meter: 'air', actions: ['water'] },
  { id: 'greenhouse', name: 'Greenhouse module', box: [10, 600, 150, 880], meter: 'air', actions: ['scrub'] },
  { id: 'reactor', name: 'Reactor bay', box: [1700, 635, 1824, 800], meter: 'power', actions: ['fix', 'refuel'] },
  { id: 'cinema', name: 'Orbit Cinema', box: [985, 225, 1150, 330], meter: 'fun', actions: ['movie', 'party'] },
  { id: 'court', name: 'The court', box: [1005, 680, 1400, 800], meter: 'fun', actions: ['pickup'] },
];

// gives/costs are meter points; cooldown is how long before you can do it again.
export const ACTIONS = {
  feed: { label: 'Feed the boys', gives: { boys: 40 }, cooldown: 4 * HOUR, say: 'Elliot and Colenzo inhale their bowls.' },
  walk: { label: 'Walk them around the ring', gives: { boys: 25, fun: 5 }, cooldown: 2 * HOUR, say: 'The boys tow you all the way around the ring.' },
  fetch: { label: 'Play fetch', gives: { boys: 15, fun: 12 }, cooldown: 1 * HOUR, say: 'Colenzo steals the ball from Elliot. Again.' },
  checkup: { label: 'Vet check-up', gives: { boys: 20 }, cooldown: 12 * HOUR, say: 'Both boys get a clean bill of health and a treat.' },
  rust: { label: 'Run a Rust session', gives: { fun: 25 }, costs: { power: 4 }, cooldown: 2 * HOUR, say: 'Raid successful. The boys did not help.' },
  tanks: { label: 'Clean the fish tanks', gives: { air: 20 }, cooldown: 6 * HOUR, say: 'The puffers puff. The shrimp approve.' },
  library: { label: 'Restock the food library', gives: { food: 30 }, cooldown: 6 * HOUR, say: 'The shelves are stacked to the ceiling again.' },
  pouches: { label: 'Restock the pouches', gives: { fun: 15 }, cooldown: 6 * HOUR, say: 'Evan files the new flavors in alphabetical order.' },
  cook: { label: 'Cook a dumpling batch', gives: { food: 40 }, cooldown: 4 * HOUR, say: 'Fresh baskets are steaming at Dumpling Orbit.' },
  water: { label: 'Water the plants', gives: { air: 30 }, cooldown: 4 * HOUR, say: 'Root Bound Plants perks right up.' },
  scrub: { label: 'Swap the air scrubbers', gives: { air: 35 }, cooldown: 8 * HOUR, say: 'The air smells like pine again.' },
  fix: { label: 'Fix the generator', gives: { power: 40 }, cooldown: 4 * HOUR, say: 'A good whack and the generator hums back up.' },
  refuel: { label: 'Refuel the reactor', gives: { power: 30 }, cooldown: 8 * HOUR, say: 'The reactor glows a happy blue.' },
  movie: { label: 'Movie night', gives: { fun: 30 }, costs: { food: 5 }, cooldown: 6 * HOUR, say: 'Popcorn everywhere. Elliot ate most of it.' },
  party: { label: 'Throw a station party', gives: { fun: 45 }, costs: { food: 15, power: 5 }, cooldown: 12 * HOUR, say: 'The whole station is dancing.' },
  pickup: { label: 'Pickup basketball game', gives: { fun: 20 }, cooldown: 3 * HOUR, say: 'Shirts beat skins by two.' },
  // The catalog pods of the modular station.
  stalls: { label: 'Open the night market', gives: { food: 40, fun: 5 }, cooldown: 4 * HOUR, say: 'Every stall is steaming and the long tables are packed.' },
  harvest: { label: 'Harvest the garden', gives: { air: 30, food: 8 }, cooldown: 4 * HOUR, say: 'Baskets of lettuce and strawberries. The frog approves.' },
  petfeed: { label: 'Feed the pets', gives: { boys: 40 }, cooldown: 4 * HOUR, say: 'Every bowl in the Pet Lounge is licked clean.' },
  petplay: { label: 'Ball pit time', gives: { boys: 20, fun: 8 }, cooldown: 1 * HOUR, say: 'The ball pit erupts. One corgi refuses to leave.' },
  petwash: { label: 'Bath day', gives: { boys: 15, air: 5 }, cooldown: 12 * HOUR, say: 'Wet dogs everywhere. The cat watches from the top of the tower.' },
  tournament: { label: 'Arcade tournament', gives: { fun: 30 }, costs: { power: 4 }, cooldown: 3 * HOUR, say: 'New high score on the pinball machine.' },
  lightsout: { label: 'Lights out, everyone', gives: { fun: 12, power: 8 }, cooldown: 12 * HOUR, say: 'Curtains drawn, fairy lights on. The whole deck sleeps well.' },
  ramen: { label: 'Fire up the ramen pots', gives: { food: 30 }, cooldown: 3 * HOUR, say: 'Steam fogs the counter. Every stool is taken.' },
  workout: { label: 'Group workout', gives: { fun: 15, air: 4 }, cooldown: 3 * HOUR, say: 'Low gravity makes everyone a personal best.' },
  laundry: { label: 'Laundry day', gives: { air: 18 }, cooldown: 8 * HOUR, say: 'Warm towels for everyone. One sock is still missing.' },
  records: { label: 'Spin some records', gives: { fun: 20 }, cooldown: 3 * HOUR, say: 'Someone found a rare pressing in the bargain crate.' },
  read: { label: 'Reading hour', gives: { fun: 15 }, cooldown: 4 * HOUR, say: 'Quiet pages, warm lamps, one snore.' },
  repair: { label: 'Repair day', gives: { power: 25 }, cooldown: 6 * HOUR, say: 'The robot walks. Mostly in circles, but it walks.' },
  soak: { label: 'Hot bath', gives: { air: 20, fun: 8 }, cooldown: 6 * HOUR, say: 'Everyone comes out pink and relaxed.' },
  stargaze: { label: 'Stargazing night', gives: { fun: 20 }, cooldown: 6 * HOUR, say: 'A comet tonight. The kid saw it first.' },
  clinic: { label: 'Health check', gives: { air: 15, fun: 5 }, cooldown: 12 * HOUR, say: 'Clean bills of health and a sticker each.' },
  bake: { label: 'Bake a fresh batch', gives: { food: 30 }, cooldown: 4 * HOUR, say: 'Croissants, still warm. The queue is out the door.' },
  repot: { label: 'Repot the plants', gives: { air: 25 }, cooldown: 6 * HOUR, say: 'The monstera finally has room to grow.' },
  gig: { label: 'Band night', gives: { fun: 30 }, costs: { power: 5 }, cooldown: 8 * HOUR, say: 'An encore. Then another encore.' },
  tea: { label: 'Tea ceremony', gives: { food: 12, fun: 10 }, cooldown: 4 * HOUR, say: 'The kettle sings and the room goes quiet.' },
  shuttle: { label: 'Service the shuttle', gives: { power: 20 }, cooldown: 8 * HOUR, say: 'The shuttle purrs. The cat on the wing does not move.' },
  deliveries: { label: 'Sort the deliveries', gives: { food: 25 }, cooldown: 6 * HOUR, say: 'Fresh supplies are in. The dog carried one parcel all by himself.' },
};

// Neglect, in between: things look sad as soon as a need drops, and a place
// only shuts down after its need has stayed under DARK_BELOW for DARK_AFTER.
// It comes back once the need is over RECOVER.
export const DARK_BELOW = 15;
export const DARK_AFTER = 48 * HOUR;
export const RECOVER = 40;

// Little things happening on the station. `when` checks the needs (0-100).
export const MOMENTS = [
  { when: m => m.boys > 60, text: 'Elliot and Colenzo are wrestling in the park.' },
  { when: m => m.boys > 60, text: 'Colenzo stole a dumpling from Dumpling Orbit.' },
  { when: m => m.boys < 35, text: 'Colenzo is staring at his empty bowl.' },
  { when: m => m.boys < 35, text: 'Elliot keeps nudging the door to the park.' },
  { when: m => m.fun > 60, text: 'Conor is deep in a Rust raid while the boys watch.' },
  { when: m => m.fun < 35, text: 'The arcade is quiet. Someone yawns in Orbit Cinema.' },
  { when: m => m.food < 35, text: 'Dumpling Orbit is down to its last basket.' },
  { when: m => m.food > 60, text: 'Dumpling Orbit is steaming. There is a line out the door.' },
  { when: m => m.power < 35, text: 'The lights in the snus shop keep flickering.' },
  { when: m => m.power > 60, text: 'The reactor is humming nicely.' },
  { when: m => m.air < 35, text: 'It is getting stuffy near Root Bound Plants.' },
  { when: m => m.air > 60, text: 'The ferns in Root Bound Plants are huge this week.' },
  { when: () => true, text: 'Evan is rearranging the pouch flavors at the snus shop.' },
  { when: () => true, text: 'An astronaut is patching a panel on the hull.' },
  { when: () => true, text: 'A shuttle is docking at the reactor bay.' },
  { when: (m, h) => h >= 22 || h < 6, text: 'Most of the station is asleep. The fish tanks glow.' },
  { when: (m, h) => h >= 6 && h < 10, text: 'The breakfast rush is on at Dumpling Orbit.' },
];

export const START = { power: 82, food: 70, air: 78, fun: 74, boys: 55 };

// Little things happening on the modular station; `pod` means it only comes
// up once that room is built.
export const STATION_MOMENTS = [
  { pod: 'market', when: m => m.food > 60, text: 'The night market is packed. There is a queue at the dumpling stall.' },
  { pod: 'market', when: m => m.food < 35, text: 'Half the market stalls have their shutters down.' },
  { pod: 'reactor', when: m => m.power > 60, text: 'The reactor is humming a happy blue.' },
  { pod: 'reactor', when: m => m.power < 35, text: 'The engineers are arguing over the reactor gauges.' },
  { pod: 'garden', when: m => m.air > 60, text: 'The tomatoes in the Hydro Garden are huge this week.' },
  { pod: 'garden', when: m => m.air < 35, text: 'It is getting stuffy. The garden lights are flickering.' },
  { pod: 'pets', when: m => m.boys > 60, text: 'A corgi has claimed the whole ball pit.' },
  { pod: 'pets', when: m => m.boys < 35, text: 'The dogs are staring at their empty bowls.' },
  { pod: 'arcade', when: m => m.fun > 60, text: 'Someone just set a new pinball high score.' },
  { pod: 'arcade', when: m => m.fun < 35, text: 'The arcade is quiet. One cabinet is stuck on the title screen.' },
  { pod: 'bunks', when: (m, h) => h >= 22 || h < 6, text: 'The bunk curtains are drawn. Fairy lights glow down the deck.' },
  { pod: 'ramen', when: m => m.food > 50, text: 'Steam is fogging up the ramen counter.' },
  { pod: 'gym', when: () => true, text: 'Someone in the gym is attempting a one-handed pull-up.' },
  { pod: 'cinema', when: m => m.fun > 50, text: 'The Tiny Cinema is cheering at the space battle.' },
  { pod: 'laundry', when: () => true, text: 'A single sock is going round and round in the laundromat.' },
  { pod: 'records', when: () => true, text: 'The record shop is playing something with a lot of saxophone.' },
  { pod: 'library', when: () => true, text: 'Someone fell asleep under a book in the Book Nook again.' },
  { pod: 'workshop', when: m => m.power > 40, text: 'The half-built robot in the workshop took its first step.' },
  { pod: 'aquarium', when: (m, h) => h >= 22 || h < 6, text: 'Most of the station is asleep. The aquarium glows.' },
  { pod: 'bathhouse', when: () => true, text: 'The bathhouse has steamed up every window on the deck.' },
  { pod: 'observatory', when: (m, h) => h >= 20 || h < 5, text: 'A kid in the observatory just spotted a comet.' },
  { pod: 'bakery', when: (m, h) => h >= 6 && h < 11, text: 'The breakfast rush is on at the bakery.' },
  { pod: 'band', when: m => m.fun > 50, text: 'The band is rehearsing the same chorus for the ninth time.' },
  { pod: 'tea', when: () => true, text: 'The kettle is singing in the Tea House.' },
  { pod: 'cargo', when: () => true, text: 'A dog is delivering a parcel to the wrong deck.' },
  { when: () => true, text: 'An astronaut is patching a panel on the hull.' },
  { when: () => true, text: 'A shuttle is docking at the side module.' },
  { when: m => Math.min(m.power, m.food, m.air, m.fun, m.boys) > 70, text: 'Everyone on the station seems to be in a good mood.' },
];
