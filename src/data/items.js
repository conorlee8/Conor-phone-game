// Furniture and modules. Each takes `w` cells on a floor, in either the
// floor layer (stands on the floor) or the wall layer (hangs on the back wall).
//
// Per-hour production: food, water, power, scrap (negative power = consumption).
// Powered producers stop when the power store is empty.
// Static: beds, comfort, defense, foodCap, waterCap, powerCap.

const f = (id, name, w, cost, o) => ({ id, name, w, cost, layer: 'floor', ...o });
const wl = (id, name, w, cost, o) => ({ id, name, w, cost, layer: 'wall', ...o });

export const ITEMS = [
  // Sleep
  f('bedroll', 'Bedroll', 1, 5, { cat: 'Sleep', beds: 1, comfort: 1 }),
  f('cot', 'Camp Cot', 2, 14, { cat: 'Sleep', beds: 1, comfort: 2 }),
  f('bunk', 'Bunk Bed', 2, 30, { cat: 'Sleep', beds: 2, comfort: 2 }),
  f('bed', 'Cozy Bed', 2, 45, { cat: 'Sleep', beds: 2, comfort: 6 }),

  // Living
  f('sofa', 'Old Sofa', 2, 20, { cat: 'Living', comfort: 4 }),
  f('armchair', 'Armchair', 1, 12, { cat: 'Living', comfort: 2 }),
  f('table', 'Map Table', 1, 8, { cat: 'Living', comfort: 1, scav: 0.1 }),
  f('bookshelf', 'Bookshelf', 1, 16, { cat: 'Living', comfort: 3 }),
  f('tv', 'CRT TV', 1, 25, { cat: 'Living', comfort: 4, power: -0.15, light: { r: 1.4, c: '#8fb8ff', powered: true } }),
  f('pet_bed', 'Cat Bed', 1, 30, { cat: 'Living', comfort: 5 }),
  f('aquarium', 'Aquarium', 1, 35, { cat: 'Living', comfort: 3, food: 0.03, power: -0.05, light: { r: 1.1, c: '#7fe0ff', powered: true } }),
  f('heater', 'Heater', 1, 22, { cat: 'Living', comfort: 3, power: -0.2, light: { r: 1.3, c: '#ff8a3c', powered: true } }),
  f('radio_set', 'Ham Radio', 1, 40, { cat: 'Living', comfort: 1, recruit: 1, power: -0.05, light: { r: 0.6, c: '#9dff9a', powered: true } }),

  // Food & water
  f('planter', 'Planter Box', 1, 10, { cat: 'Food', food: 0.08 }),
  f('hydro', 'Hydroponic Rack', 2, 60, { cat: 'Food', food: 0.45, power: -0.3, needsPower: true, light: { r: 1.8, c: '#9dff7a', powered: true } }),
  f('stove', 'Camp Stove', 1, 15, { cat: 'Food', comfort: 2, foodMult: 0.1 }),
  f('fridge', 'Fridge', 1, 40, { cat: 'Food', foodCap: 25, power: -0.1, light: { r: 0.7, c: '#dff4ff', powered: true } }),
  f('pantry', 'Pantry Shelf', 1, 18, { cat: 'Food', foodCap: 15, waterCap: 10 }),
  f('rain_barrel', 'Rain Barrel', 1, 10, { cat: 'Water', water: 0.12, rain: 3 }),
  f('water_jugs', 'Water Jugs', 1, 12, { cat: 'Water', waterCap: 25 }),
  f('purifier', 'Water Purifier', 1, 55, { cat: 'Water', water: 0.5, power: -0.3, needsPower: true, light: { r: 1.5, c: '#6fe3ff', powered: true } }),
  f('fish_trap', 'Fish Trap', 1, 20, { cat: 'Food', food: 0.25, env: ['water', 'swamp', 'coast'] }),

  // Power & work
  f('generator', 'Generator', 1, 45, { cat: 'Power', power: 1.2, comfort: -2 }),
  f('solar', 'Solar Panel', 1, 50, { cat: 'Power', power: 0.7, solar: true }),
  f('battery', 'Battery Bank', 1, 35, { cat: 'Power', powerCap: 30 }),
  f('workbench', 'Workbench', 2, 35, { cat: 'Power', scrap: 0.5 }),
  f('crates', 'Supply Crates', 1, 8, { cat: 'Power', foodCap: 8, waterCap: 8 }),

  // Defense
  f('barricade', 'Sandbags', 1, 15, { cat: 'Defense', defense: 3 }),
  f('lookout', 'Lookout Post', 1, 40, { cat: 'Defense', defense: 6 }),
  f('turret', 'Mounted Gun', 2, 150, { cat: 'Defense', defense: 14, power: -0.1 }),

  // Wall
  wl('string_lights', 'String Lights', 1, 4, { cat: 'Wall', comfort: 1, light: { r: 1.1, c: '#ffd28a' } }),
  wl('lantern', 'Lantern', 1, 6, { cat: 'Wall', comfort: 1, light: { r: 1.8, c: '#ffb85c' } }),
  wl('wall_lamp', 'Wall Lamp', 1, 14, { cat: 'Wall', comfort: 1, power: -0.04, light: { r: 2.4, c: '#ffe2a8', powered: true } }),
  wl('shelf', 'Wall Shelf', 1, 8, { cat: 'Wall', foodCap: 8 }),
  wl('map', 'Map Board', 1, 12, { cat: 'Wall', scav: 0.25 }),
  wl('hanging_plant', 'Hanging Plant', 1, 8, { cat: 'Wall', comfort: 1, food: 0.03 }),
  wl('photos', 'Photos', 1, 3, { cat: 'Wall', comfort: 2 }),
  wl('clock', 'Wall Clock', 1, 6, { cat: 'Wall', comfort: 1 }),
  wl('gun_rack', 'Gun Rack', 1, 30, { cat: 'Wall', defense: 3 }),
  wl('medcab', 'First Aid', 1, 25, { cat: 'Wall', medical: 1, comfort: 1 }),
  wl('boards', 'Boarded Window', 1, 5, { cat: 'Wall', defense: 2, comfort: -1 }),
  wl('poster', 'Old Poster', 1, 3, { cat: 'Wall', comfort: 1 }),
  wl('sill_plants', 'Herb Pots', 1, 7, { cat: 'Wall', food: 0.04, comfort: 1 }),
  wl('wall_radio', 'Pocket Radio', 1, 15, { cat: 'Wall', comfort: 2, recruit: 0.5 }),
];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

export function itemSummary(it) {
  const p = [];
  if (it.beds) p.push(`🛏 +${it.beds} bed${it.beds > 1 ? 's' : ''}`);
  if (it.food) p.push(`🥫 +${it.food}/h`);
  if (it.water) p.push(`💧 +${it.water}/h`);
  if (it.power > 0) p.push(`⚡ +${it.power}/h${it.solar ? ' (day)' : ''}`);
  if (it.power < 0) p.push(`⚡ ${it.power}/h`);
  if (it.scrap) p.push(`🔩 +${it.scrap}/h`);
  if (it.comfort) p.push(`🛋 ${it.comfort > 0 ? '+' : ''}${it.comfort}`);
  if (it.defense) p.push(`🛡 +${it.defense}`);
  if (it.foodCap) p.push(`🥫 +${it.foodCap} cap`);
  if (it.waterCap) p.push(`💧 +${it.waterCap} cap`);
  if (it.powerCap) p.push(`⚡ +${it.powerCap} cap`);
  if (it.scav) p.push(`🎒 +${Math.round(it.scav * 100)}% loot`);
  if (it.recruit) p.push('📻 attracts survivors');
  if (it.medical) p.push('🩹 med care');
  if (it.foodMult) p.push(`🍳 +${Math.round(it.foodMult * 100)}% food`);
  if (it.rain) p.push('🌧 x3 in rain');
  return p.join(' · ');
}
