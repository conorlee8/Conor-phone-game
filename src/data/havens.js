// The painted bases. Each base has four stages of art (bare → camp → home →
// fortified). Finishing every project in a tier repaints the base to the next
// stage. Coordinates are in the painting's own pixels.
//
// Project effects: beds, comfort, defense, food / water / scrap (per hour),
// foodCap / waterCap (storage).

const p = (id, name, icon, cost, fx, blurb) => ({ id, name, icon, cost, fx, blurb });

export const BASES = [
  {
    id: 'train_car',
    name: 'Passenger Car',
    blurb: 'A stalled commuter car on a foggy line. Long windows, long nights.',
    cost: 0,
    size: [1536, 1024],
    show: 0.62,
    stages: ['train_car_0', 'train_car_1', 'train_car_2', 'train_car_3'],
    focus: [770, 470],
    glow: [{ x: 770, y: 450, rx: 640, ry: 170 }],
    trait: { text: 'Balanced: a bit of everything', defense: 1 },
    tiers: [
      { name: 'Camp', items: [
        p('bedrolls', 'Bed corner', '🛏', { scrap: 15 }, { beds: 2, comfort: 1 }, 'A real bed for whoever is off watch.'),
        p('pantry', 'Can shelves', '🥫', { scrap: 12 }, { foodCap: 15, waterCap: 10 }, 'Somewhere to keep what you find.'),
        p('lanterns', 'Lanterns', '🏮', { scrap: 8 }, { comfort: 2 }, 'Light against the dark windows.'),
      ] },
      { name: 'Home', items: [
        p('hydro', 'Grow shelf', '🥬', { scrap: 40, water: 5 }, { food: 0.35 }, 'Lettuce under grow lights.'),
        p('kitchen', 'Kitchen corner', '🍳', { scrap: 30 }, { comfort: 3, food: 0.1 }, 'Hot food stretches the rations.'),
        p('cozy', 'Rugs & string lights', '✨', { scrap: 20 }, { comfort: 4 }, 'It finally feels like home.'),
      ] },
      { name: 'Fortified', items: [
        p('sandbags', 'Sandbag wall', '🧱', { scrap: 45 }, { defense: 5 }, 'Holds the end door.'),
        p('guard', 'Guard post', '🎯', { scrap: 60, food: 5 }, { defense: 7 }, 'Someone always watching the field.'),
        p('ammo', 'Ammo stockpile', '📦', { scrap: 50 }, { defense: 4, foodCap: 10 }, 'Enough to make the night shorter.'),
      ] },
    ],
  },
  {
    id: 'water_tower',
    name: 'Water Tower',
    blurb: 'Drained, insulated, and high above it all.',
    cost: 120,
    size: [1024, 1536],
    stages: ['water_tower_0', 'water_tower_1', 'water_tower_2', 'water_tower_3'],
    focus: [540, 560],
    glow: [{ x: 545, y: 440, rx: 310, ry: 210 }, { x: 325, y: 750, rx: 50, ry: 50 }, { x: 690, y: 775, rx: 50, ry: 50 }],
    trait: { text: 'High up: +6 defense, +0.2 water/h', defense: 6, water: 0.2 },
    tiers: [
      { name: 'Camp', items: [
        p('bed', 'Iron bed', '🛏', { scrap: 20 }, { beds: 2, comfort: 2 }, 'Hauled up the ladder in pieces.'),
        p('jugs', 'Water jugs', '💧', { scrap: 12 }, { waterCap: 20 }, 'Every drop counts up here.'),
        p('lanterns', 'Lanterns', '🏮', { scrap: 8 }, { comfort: 2 }, 'Warm light inside the steel.'),
      ] },
      { name: 'Home', items: [
        p('stove', 'Wood stove', '🔥', { scrap: 35 }, { comfort: 3, food: 0.1 }, 'Heat for the cold tank.'),
        p('plants', 'Herb shelves', '🌿', { scrap: 35, water: 5 }, { food: 0.3 }, 'Pots under a grow light.'),
        p('cozy', 'Rug & string lights', '✨', { scrap: 20 }, { comfort: 4 }, 'Round room, round rug.'),
      ] },
      { name: 'Fortified', items: [
        p('funnel', 'Rain funnel', '🌧', { scrap: 40 }, { water: 0.5 }, 'Catches every storm.'),
        p('catwalk', 'Catwalk sniper', '🎯', { scrap: 60, food: 5 }, { defense: 8 }, 'Nothing climbs that ladder.'),
        p('ladder', 'Pull-up ladder', '🪜', { scrap: 30 }, { defense: 4 }, 'Raise it at dusk.'),
      ] },
    ],
  },
  {
    id: 'raft',
    name: 'Lake Raft',
    blurb: 'Oil drums and planks. The dead can’t swim.',
    cost: 160,
    size: [1024, 1536],
    stages: ['raft_0', 'raft_1', 'raft_2', 'raft_3'],
    focus: [560, 780],
    glow: [{ x: 600, y: 700, rx: 190, ry: 120 }, { x: 655, y: 880, rx: 90, ry: 70 }],
    trait: { text: 'On water: +8 defense, +0.2 food/h fishing', defense: 8, food: 0.2 },
    tiers: [
      { name: 'Camp', items: [
        p('shack', 'Little shack', '🛖', { scrap: 25 }, { beds: 2, comfort: 2 }, 'Four walls and a canvas roof.'),
        p('crates', 'Supply crates', '📦', { scrap: 10 }, { foodCap: 10, waterCap: 10 }, 'Lashed down against the wind.'),
        p('lantern', 'Lantern', '🏮', { scrap: 8 }, { comfort: 2 }, 'A glow on the black water.'),
      ] },
      { name: 'Home', items: [
        p('beans', 'Bean planter', '🌱', { scrap: 30, water: 5 }, { food: 0.3 }, 'Climbing beans on a stick trellis.'),
        p('barrel', 'Water filter', '💧', { scrap: 35 }, { water: 0.4, waterCap: 10 }, 'Lake water, made drinkable.'),
        p('drum', 'Fire drum', '🔥', { scrap: 20 }, { comfort: 3, food: 0.1 }, 'Kettle always on.'),
      ] },
      { name: 'Fortified', items: [
        p('turbine', 'Wind turbine', '🌬', { scrap: 55 }, { comfort: 2, scrap: 0.2 }, 'Power for the long nights.'),
        p('fish', 'Drying line', '🐟', { scrap: 25 }, { food: 0.35 }, 'Smoked fish keeps for weeks.'),
        p('fisher', 'Fishing spot', '🎣', { scrap: 20, food: 3 }, { food: 0.25, comfort: 2 }, 'The quietest job left in the world.'),
      ] },
    ],
  },
];

export const BASE_BY_ID = Object.fromEntries(BASES.map(b => [b.id, b]));

// Places a survivor can scavenge. Hours are in-game hours away.
export const LOCATIONS = [
  { id: 'cars', name: 'Abandoned cars', icon: '🚗', hours: 2, risk: 0.05, loot: { scrap: [6, 14], food: [0, 2], water: [0, 2] }, blurb: 'Quick and fairly safe.' },
  { id: 'gas', name: 'Gas station', icon: '⛽', hours: 3, risk: 0.12, loot: { scrap: [10, 22], food: [1, 4], water: [2, 5] }, blurb: 'Snacks, bottled water, parts.' },
  { id: 'market', name: 'Supermarket', icon: '🛒', hours: 4, risk: 0.22, loot: { scrap: [4, 10], food: [5, 11], water: [4, 9] }, blurb: 'Food, if the horde left any.' },
  { id: 'checkpoint', name: 'Army checkpoint', icon: '🪖', hours: 5, risk: 0.35, loot: { scrap: [28, 50], food: [2, 6], water: [2, 6] }, blurb: 'Big rewards. Big danger.' },
];
export const LOCATION_BY_ID = Object.fromEntries(LOCATIONS.map(l => [l.id, l]));
