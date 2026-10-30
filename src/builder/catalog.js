// Everything the player can build. Sizes are in grid cells: w cells wide,
// h units tall (a room is 3 units tall). `mount` says where it goes:
//   floor - stands on the floor        wall - hangs on the back wall
//   roof  - sits on the top floor's roof   ground - bottom floor only
//
// Systems:
//   power: +supply / -draw per hour (kW, roughly). `solar` scales with daylight,
//          `fuel` burns fuel per hour while running. `battery` stores kWh.
//   water: `source` adds raw water per hour (`rain` multiplies in rain), `tank`
//          stores raw water, `drink` turns raw water into drinking water per hour,
//          `draw` uses raw water per hour.
//   food per hour (only while its power and water needs are met), storage caps,
//   beds, comfort, defense (needs power if it has a draw), craft (parts per hour).

const it = (id, name, cat, w, h, mount, cost, sys = {}, blurb = '') => ({ id, name, cat, w, h, mount, cost, ...sys, blurb });

export const CATALOG = [
  // ---- Power
  it('generator', 'Generator', 'Power', 1, 1.1, 'floor', { scrap: 30 }, { power: 4, fuel: 0.25, comfort: -1 }, 'Loud, thirsty, reliable.'),
  it('solar', 'Solar Panel', 'Power', 1, 0.5, 'roof', { scrap: 25, parts: 2 }, { power: 2.5, solar: true }, 'Free power while the sun is up.'),
  it('wind', 'Wind Turbine', 'Power', 1, 2.2, 'roof', { scrap: 35, parts: 3 }, { power: 1.6, wind: true }, 'Spins day and night, if there’s wind.'),
  it('battery_bank', 'Battery Bank', 'Power', 1, 1.2, 'floor', { scrap: 20, parts: 2 }, { battery: 20 }, 'Saves daytime power for the night.'),
  it('wall_lamp', 'Wall Lamp', 'Power', 1, 0.6, 'wall', { scrap: 5 }, { power: -0.15, comfort: 1, light: 2.4 }, 'Warm light. Needs power.'),

  // ---- Water
  it('rain_collector', 'Rain Collector', 'Water', 1, 1, 'roof', { scrap: 15 }, { source: 0.3, rain: 4 }, 'Fills fast in a storm.'),
  it('well_pump', 'Well Pump', 'Water', 1, 1.4, 'ground', { scrap: 40, parts: 3 }, { source: 1.5, power: -0.6 }, 'Ground water, if you can power it.'),
  it('water_tank', 'Water Tank', 'Water', 1, 2, 'floor', { scrap: 20 }, { tank: 40 }, 'Stores raw water for the pipes.'),
  it('purifier', 'Purifier', 'Water', 1, 2, 'floor', { scrap: 35, parts: 3 }, { drink: 1.2, power: -0.8 }, 'Turns raw water into drinking water.'),
  it('sink', 'Sink', 'Water', 1, 1.1, 'floor', { scrap: 12 }, { draw: 0.1, comfort: 2 }, 'Washing up. Small luxuries matter.'),

  // ---- Food
  it('planter', 'Hydro Planter', 'Food', 2, 1.6, 'floor', { scrap: 30, parts: 1 }, { food: 0.45, draw: 0.3, power: -0.4 }, 'Lettuce under a grow light. Needs water and power.'),
  it('soil_bed', 'Soil Bed', 'Food', 2, 0.9, 'ground', { scrap: 15 }, { food: 0.2, draw: 0.2 }, 'Slow but needs no power.'),
  it('stove', 'Stove', 'Food', 1, 1.1, 'floor', { scrap: 20 }, { comfort: 2, foodBoost: 0.15 }, 'Cooking stretches every can.'),
  it('fridge', 'Fridge', 'Food', 1, 2, 'floor', { scrap: 30, parts: 2 }, { power: -0.5, foodCap: 30, fresh: true }, 'Stops food spoiling. Needs power.'),

  // ---- Storage
  it('shelf', 'Storage Shelf', 'Storage', 1, 2.2, 'floor', { scrap: 12 }, { foodCap: 20, waterCap: 15 }, 'Cans, bottles, everything.'),
  it('crate', 'Supply Crate', 'Storage', 1, 0.9, 'floor', { scrap: 6 }, { scrapCap: 60, fuelCap: 10 }, 'For scrap and spare parts.'),
  it('locker', 'Locker', 'Storage', 1, 2.2, 'floor', { scrap: 18 }, { scrapCap: 80, partsCap: 15 }, 'Lockable. Organised. Finally.'),
  it('fuel_drum', 'Fuel Drum', 'Storage', 1, 1.3, 'floor', { scrap: 15 }, { fuelCap: 30 }, 'Keep it away from the stove.'),

  // ---- Living
  it('bunk_bed', 'Bunk Bed', 'Living', 2, 2.2, 'floor', { scrap: 25 }, { beds: 2, comfort: 1 }, 'Two sleep, two keep watch.'),
  it('bed', 'Cozy Bed', 'Living', 2, 1.2, 'floor', { scrap: 35 }, { beds: 1, comfort: 4 }, 'A real mattress.'),
  it('sofa', 'Sofa', 'Living', 2, 1.1, 'floor', { scrap: 20 }, { comfort: 3 }, 'Somewhere to sit that isn’t a crate.'),
  it('radio', 'Ham Radio', 'Living', 1, 1.2, 'floor', { scrap: 25, parts: 3 }, { power: -0.2, comfort: 1, recruit: 1 }, 'Survivors hear you and come.'),
  it('heater', 'Heater', 'Living', 1, 1, 'floor', { scrap: 18 }, { power: -0.6, comfort: 3 }, 'Cold nights get colder.'),

  // ---- Workshop
  it('workbench', 'Workbench', 'Workshop', 2, 1.4, 'floor', { scrap: 30 }, { craft: 0.4 }, 'Turns scrap into parts.'),

  // ---- Defense
  it('barricade', 'Barricade', 'Defense', 1, 1, 'floor', { scrap: 15 }, { defense: 3 }, 'Sandbags and planks.'),
  it('turret', 'Auto Turret', 'Defense', 1, 1.3, 'roof', { scrap: 60, parts: 6 }, { defense: 12, power: -1.2 }, 'Only works with power.'),
  it('window_bars', 'Window Bars', 'Defense', 1, 1, 'wall', { scrap: 10 }, { defense: 2 }, 'Keeps hands out.'),

  // ---- Structure
  it('ladder', 'Ladder', 'Structure', 1, 3, 'floor', { scrap: 10 }, { ladder: true }, 'Connects this floor to the one above.'),
];

export const ITEM = Object.fromEntries(CATALOG.map(i => [i.id, i]));
export const CATEGORIES = ['Power', 'Water', 'Food', 'Storage', 'Living', 'Workshop', 'Defense', 'Structure'];
export const CAT_ICON = { Power: '⚡', Water: '💧', Food: '🥬', Storage: '📦', Living: '🛏', Workshop: '🔧', Defense: '🛡', Structure: '🪜' };

// Lines you paint between cells to connect things.
export const LINES = {
  wire: { name: 'Wire', icon: '〰️', cost: { scrap: 1 }, color: '#f2c14e' },
  pipe: { name: 'Pipe', icon: '🟦', cost: { scrap: 2 }, color: '#5ab0e8' },
};

export function summary(d) {
  const p = [];
  if (d.power > 0) p.push(`⚡ +${d.power}${d.solar ? ' (day)' : ''}${d.wind ? ' (wind)' : ''}`);
  if (d.power < 0) p.push(`⚡ ${d.power}`);
  if (d.fuel) p.push(`⛽ -${d.fuel}/h`);
  if (d.battery) p.push(`🔋 ${d.battery}`);
  if (d.source) p.push(`💧 +${d.source}/h${d.rain ? ' (more in rain)' : ''}`);
  if (d.tank) p.push(`🛢 ${d.tank}`);
  if (d.drink) p.push(`🚰 +${d.drink}/h`);
  if (d.draw) p.push(`💧 -${d.draw}/h`);
  if (d.food) p.push(`🥬 +${d.food}/h`);
  if (d.foodCap) p.push(`🥫 +${d.foodCap}`);
  if (d.waterCap) p.push(`🚰 +${d.waterCap}`);
  if (d.scrapCap) p.push(`🔩 +${d.scrapCap}`);
  if (d.partsCap) p.push(`⚙️ +${d.partsCap}`);
  if (d.fuelCap) p.push(`⛽ +${d.fuelCap}`);
  if (d.beds) p.push(`🛏 ${d.beds}`);
  if (d.comfort) p.push(`🛋 ${d.comfort > 0 ? '+' : ''}${d.comfort}`);
  if (d.defense) p.push(`🛡 +${d.defense}`);
  if (d.craft) p.push(`⚙️ +${d.craft}/h`);
  if (d.recruit) p.push('📻 recruits');
  if (d.ladder) p.push('🪜 up a floor');
  return p.join(' · ');
}
