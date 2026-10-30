// Everything the player can build. Sizes are in grid units: w cells wide, h units
// tall (a room is 3 units tall; the wall grid has rows 0.8 units high).
//
// mounts: surfaces it can go on, first one is the default.
//   floor   - stands on a room's floor        wall    - hangs on the back wall (any row)
//   ceiling - hangs from a room's ceiling      roof    - on top of the top floor
//   ground  - bottom floor only               yard    - outside, either side of the base
//
// Systems (per in-game hour):
//   power  +supply / -draw. `solar` follows daylight, `wind` the day's wind, `fuel` burns fuel.
//   battery  stores power.       light  radius of light while running.
//   source  raw water in (`rain` multiplier in a storm).  tank  stores raw water.
//   drink  raw → drinking water.  draw  uses raw water.  food  per hour while running.
//   caps: foodCap waterCap scrapCap partsCap fuelCap.  beds, comfort, defense, craft, recruit.
// Anything with power < 0 needs a wire; anything with source/tank/drink/draw needs a pipe.

const it = (id, name, cat, w, h, mounts, cost, sys = {}, blurb = '') => ({ id, name, cat, w, h, mounts, cost, ...sys, blurb });

export const CATALOG = [
  // ---- Power
  it('generator', 'Generator', 'Power', 1, 1.1, ['floor', 'yard'], { scrap: 30 }, { power: 4, fuel: 0.25, comfort: -1 }, 'Loud, thirsty, reliable.'),
  it('solar', 'Solar Panel', 'Power', 1, 0.6, ['roof', 'yard'], { scrap: 25, parts: 2 }, { power: 2.5, solar: true }, 'Free power while the sun is up.'),
  it('wind', 'Wind Turbine', 'Power', 1, 2.4, ['roof', 'yard'], { scrap: 35, parts: 3 }, { power: 1.6, wind: true }, 'Spins day and night, if there’s wind.'),
  it('battery_bank', 'Battery Bank', 'Power', 1, 1.2, ['floor'], { scrap: 20, parts: 2 }, { battery: 20 }, 'Saves daytime power for the night.'),
  it('wall_battery', 'Wall Battery', 'Power', 1, 0.8, ['wall'], { scrap: 15, parts: 2 }, { battery: 8 }, 'Small, out of the way.'),

  // ---- Lighting
  it('wall_lamp', 'Wall Lamp', 'Lighting', 1, 0.6, ['wall'], { scrap: 5 }, { power: -0.15, comfort: 1, light: 2.4 }, 'Warm light. Needs power.'),
  it('ceiling_light', 'Ceiling Light', 'Lighting', 1, 0.6, ['ceiling'], { scrap: 8 }, { power: -0.2, comfort: 1, light: 3.2 }, 'Lights the whole room.'),
  it('string_lights', 'String Lights', 'Lighting', 2, 0.4, ['ceiling', 'wall'], { scrap: 6 }, { power: -0.05, comfort: 2, light: 1.6 }, 'Cheap, cheerful, cozy.'),
  it('floor_lamp', 'Floor Lamp', 'Lighting', 1, 1.8, ['floor'], { scrap: 8 }, { power: -0.1, comfort: 1, light: 2.2 }, 'Reading light.'),
  it('flood_light', 'Flood Light', 'Lighting', 1, 0.7, ['roof', 'yard'], { scrap: 15 }, { power: -0.4, defense: 2, light: 4 }, 'Lights up the yard. They hate it.'),

  // ---- Water
  it('rain_collector', 'Rain Collector', 'Water', 1, 1.1, ['roof', 'yard'], { scrap: 15 }, { source: 0.3, rain: 4 }, 'Fills fast in a storm.'),
  it('well_pump', 'Well Pump', 'Water', 1, 1.4, ['ground', 'yard'], { scrap: 40, parts: 3 }, { source: 1.5, power: -0.6 }, 'Ground water, if you can power it.'),
  it('water_tank', 'Water Tank', 'Water', 1, 2, ['floor', 'yard'], { scrap: 20 }, { tank: 40 }, 'Stores raw water for the pipes.'),
  it('purifier', 'Purifier', 'Water', 1, 2, ['floor'], { scrap: 35, parts: 3 }, { drink: 1.2, power: -0.8 }, 'Turns raw water into drinking water.'),
  it('sink', 'Sink', 'Water', 1, 1.1, ['floor'], { scrap: 12 }, { draw: 0.1, comfort: 2 }, 'Washing up. Small luxuries matter.'),
  it('water_heater', 'Water Heater', 'Water', 1, 1.2, ['wall'], { scrap: 25, parts: 2 }, { draw: 0.1, power: -0.5, comfort: 3 }, 'Hot showers. Morale through the roof.'),
  it('shower', 'Shower', 'Water', 1, 2.3, ['floor'], { scrap: 20 }, { draw: 0.25, comfort: 3 }, 'Cold, unless you have a heater.'),

  // ---- Food
  it('planter', 'Hydro Planter', 'Food', 2, 1.6, ['floor'], { scrap: 30, parts: 1 }, { food: 0.45, draw: 0.3, power: -0.4, light: 1 }, 'Lettuce under a grow light. Water and power.'),
  it('wall_planter', 'Wall Planter', 'Food', 1, 0.8, ['wall'], { scrap: 12 }, { food: 0.1, draw: 0.08 }, 'Herbs in a gutter. Needs a pipe.'),
  it('hanging_plant', 'Hanging Plant', 'Food', 1, 0.8, ['ceiling'], { scrap: 4 }, { comfort: 1, food: 0.02 }, 'Green things help.'),
  it('soil_bed', 'Soil Bed', 'Food', 2, 0.9, ['yard', 'ground'], { scrap: 15 }, { food: 0.25, draw: 0.2 }, 'Slow, but needs no power.'),
  it('stove', 'Stove', 'Food', 1, 1.1, ['floor'], { scrap: 20 }, { comfort: 2, foodBoost: 0.15 }, 'Cooking stretches every can.'),
  it('fridge', 'Fridge', 'Food', 1, 2, ['floor'], { scrap: 30, parts: 2 }, { power: -0.5, foodCap: 30, fresh: true }, 'Stops food spoiling. Needs power.'),

  // ---- Storage
  it('shelf', 'Storage Shelf', 'Storage', 1, 2.2, ['floor'], { scrap: 12 }, { foodCap: 20, waterCap: 15 }, 'Cans, bottles, everything.'),
  it('wall_shelf', 'Wall Shelf', 'Storage', 1, 0.6, ['wall'], { scrap: 6 }, { foodCap: 8 }, 'Uses the space above.'),
  it('cabinet', 'Wall Cabinet', 'Storage', 1, 0.8, ['wall'], { scrap: 10 }, { partsCap: 8, scrapCap: 30 }, 'Tools and spare parts.'),
  it('crate', 'Supply Crate', 'Storage', 1, 0.9, ['floor', 'yard'], { scrap: 6 }, { scrapCap: 60, fuelCap: 10 }, 'For scrap and spare parts.'),
  it('locker', 'Locker', 'Storage', 1, 2.2, ['floor'], { scrap: 18 }, { scrapCap: 80, partsCap: 15 }, 'Lockable. Organised. Finally.'),
  it('fuel_drum', 'Fuel Drum', 'Storage', 1, 1.3, ['floor', 'yard'], { scrap: 15 }, { fuelCap: 30 }, 'Keep it away from the stove.'),

  // ---- Living
  it('bunk_bed', 'Bunk Bed', 'Living', 2, 2.2, ['floor'], { scrap: 25 }, { beds: 2, comfort: 1 }, 'Two sleep, two keep watch.'),
  it('bed', 'Cozy Bed', 'Living', 2, 1.2, ['floor'], { scrap: 35 }, { beds: 1, comfort: 4 }, 'A real mattress.'),
  it('sofa', 'Sofa', 'Living', 2, 1.1, ['floor'], { scrap: 20 }, { comfort: 3 }, 'Somewhere to sit that isn’t a crate.'),
  it('tv', 'Wall TV', 'Living', 1, 0.8, ['wall'], { scrap: 20, parts: 1 }, { power: -0.3, comfort: 3, light: 1 }, 'Old DVDs. Very old DVDs.'),
  it('radio', 'Ham Radio', 'Living', 1, 1.2, ['floor'], { scrap: 25, parts: 3 }, { power: -0.2, comfort: 1, recruit: 1 }, 'Survivors hear you and come.'),
  it('heater', 'Heater', 'Living', 1, 1, ['floor'], { scrap: 18 }, { power: -0.6, comfort: 3 }, 'Cold nights get colder.'),
  it('ceiling_fan', 'Ceiling Fan', 'Living', 1, 0.6, ['ceiling'], { scrap: 12 }, { power: -0.2, comfort: 2 }, 'Moves the stale air.'),
  it('clock', 'Wall Clock', 'Living', 1, 0.6, ['wall'], { scrap: 3 }, { comfort: 1 }, 'Tick. Tick.'),

  // ---- Workshop
  it('workbench', 'Workbench', 'Workshop', 2, 1.4, ['floor'], { scrap: 30 }, { craft: 0.4 }, 'Turns scrap into parts.'),
  it('pegboard', 'Tool Pegboard', 'Workshop', 2, 1, ['wall'], { scrap: 10 }, { craft: 0.1 }, 'Every tool in its place.'),

  // ---- Defense
  it('barricade', 'Barricade', 'Defense', 1, 1, ['yard', 'floor'], { scrap: 15 }, { defense: 3 }, 'Sandbags and planks.'),
  it('spikes', 'Spike Trap', 'Defense', 1, 0.6, ['yard'], { scrap: 12 }, { defense: 4 }, 'Sharpened rebar. Nasty.'),
  it('fence', 'Chain Fence', 'Defense', 1, 1.8, ['yard'], { scrap: 10 }, { defense: 3 }, 'Slows them down.'),
  it('turret', 'Auto Turret', 'Defense', 1, 1.3, ['roof', 'yard'], { scrap: 60, parts: 6 }, { defense: 12, power: -1.2 }, 'Only works with power.'),
  it('gun_rack', 'Gun Rack', 'Defense', 1, 1, ['wall'], { scrap: 30 }, { defense: 3 }, 'Arms everyone at home.'),
  it('window_bars', 'Window Bars', 'Defense', 1, 1.1, ['wall'], { scrap: 10 }, { defense: 2, bars: true }, 'Put over a window: no more weak spot.'),

  // ---- Structure
  it('ladder', 'Ladder', 'Structure', 1, 3, ['floor'], { scrap: 10 }, { ladder: true }, 'Connects this floor to the one above.'),
];

// Surface paints and dividers, applied by tapping or dragging over cells.
export const PAINTS = {
  wall: [
    { id: 'panel', name: 'Wood panels', color: '#c9b38c', cost: 2 },
    { id: 'brick', name: 'Brick', color: '#9a5a44', cost: 3 },
    { id: 'concrete', name: 'Concrete', color: '#9c9a92', cost: 2 },
    { id: 'metal', name: 'Steel plate', color: '#7d8a8f', cost: 3, defense: 0.3 },
    { id: 'wallpaper', name: 'Wallpaper', color: '#b7c4a0', cost: 3, comfort: 0.3 },
    { id: 'window', name: 'Window', color: '#9fc4d8', cost: 4, window: true },
  ],
  floor: [
    { id: 'planks', name: 'Planks', color: '#7a5b3e', cost: 2 },
    { id: 'concrete', name: 'Concrete', color: '#6e6c66', cost: 2 },
    { id: 'tile', name: 'Tiles', color: '#b9b4a6', cost: 3, comfort: 0.2 },
    { id: 'carpet', name: 'Carpet', color: '#8a4a3e', cost: 3, comfort: 0.4 },
  ],
  divider: [
    { id: 'wall', name: 'Inner wall', color: '#5c544a', cost: 6, defense: 0.5 },
    { id: 'door', name: 'Door', color: '#7a5636', cost: 8 },
    { id: 'none', name: 'Remove wall', color: '#000', cost: 0 },
  ],
};

export const ITEM = Object.fromEntries(CATALOG.map(i => [i.id, i]));
export const CATEGORIES = ['Power', 'Lighting', 'Water', 'Food', 'Storage', 'Living', 'Workshop', 'Defense', 'Structure'];
export const CAT_ICON = { Power: '⚡', Lighting: '💡', Water: '💧', Food: '🥬', Storage: '📦', Living: '🛏', Workshop: '🔧', Defense: '🛡', Structure: '🧱' };

export const needsWire = d => d.power < 0 || d.power > 0 || d.battery;
export const needsPipe = d => !!(d.source || d.tank || d.drink || d.draw);

export function summary(d) {
  const p = [];
  if (d.power > 0) p.push(`⚡ +${d.power}${d.solar ? ' (day)' : ''}${d.wind ? ' (wind)' : ''}`);
  if (d.power < 0) p.push(`⚡ ${d.power}`);
  if (d.fuel) p.push(`⛽ -${d.fuel}/h`);
  if (d.battery) p.push(`🔋 ${d.battery}`);
  if (d.light) p.push('💡 light');
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

export const MOUNT_NAME = { floor: 'floor', wall: 'wall', ceiling: 'ceiling', roof: 'roof', ground: 'bottom floor', yard: 'yard' };
