// Builds art/sprites.json: one paint-over job per catalog piece, using its
// grey template for shape and the style sheet for look.
//   node tools/sprite-prompts.mjs && MANIFEST=art/sprites.json NODE_USE_ENV_PROXY=1 node tools/gen-art.mjs
import { writeFileSync } from 'node:fs';
import { CATALOG } from '../src/builder/catalog.js';

const DESC = {
  generator: 'a small red portable petrol generator on a steel frame with wheels',
  solar: 'a solar panel tilted on a metal stand, dark blue cells with a silver frame',
  wind: 'a small homemade wind turbine with three white blades on a tall metal pole',
  battery_bank: 'a stack of three dark grey deep-cycle batteries joined by red and black cables',
  wall_battery: 'a compact grey wall-mounted battery box with a small charge display',
  wall_lamp: 'a brass wall sconce lamp with a cream glass shade',
  ceiling_light: 'a hanging industrial pendant lamp with a green enamel shade on a short chain',
  string_lights: 'a strand of warm bulb string lights hanging in two gentle swags',
  floor_lamp: 'a tall standing floor lamp with a fabric shade',
  flood_light: 'a heavy outdoor flood light with a metal housing on a short post',
  rain_collector: 'a blue rain barrel with a wide funnel top and a mesh filter',
  well_pump: 'a cast iron electric well pump with pipes coming out of the ground',
  water_tank: 'a tall white plastic water tank with a ladder-ribbed side and a tap',
  purifier: 'a water purifier: a clear acrylic tank of water on a white machine base with pipes and small lights',
  sink: 'a small enamel sink on a wooden stand with a tap',
  water_heater: 'a white cylindrical wall water heater with copper pipes',
  shower: 'a simple open shower stall with a metal frame, shower head and a plastic curtain',
  planter: 'a long wooden hydroponic planter trough of leafy green lettuce with a white grow-light bar on posts above it',
  wall_planter: 'a metal gutter planter mounted on the wall with herbs growing in it',
  hanging_plant: 'a woven hanging basket with a trailing green plant',
  soil_bed: 'a raised wooden garden bed of dark soil with rows of vegetables',
  stove: 'a small cast iron wood stove with a kettle on top',
  fridge: 'a slightly dented retro white fridge',
  shelf: 'a tall metal wire storage shelf stocked with canned food, rice bags, water bottles and a first aid kit',
  wall_shelf: 'a wooden wall shelf on brackets with jars and cans',
  cabinet: 'a small green metal wall cabinet with a tool sticker on the door',
  crate: 'a sturdy wooden supply crate with rope handles',
  locker: 'a tall grey metal locker with vents, slightly dented',
  fuel_drum: 'a red steel fuel drum with a hand pump on top',
  bunk_bed: 'a grey metal bunk bed with two thin mattresses, a navy blanket below and a red plaid blanket above, and a small ladder',
  bed: 'a cozy wooden single bed with a thick patchwork quilt and two pillows',
  sofa: 'a worn olive-green two-seat sofa with a crocheted blanket over one arm',
  tv: 'an old flat screen TV mounted on the wall, screen dark',
  radio: 'a ham radio set with dials and a microphone on a small wooden desk',
  heater: 'an old portable oil-filled radiator heater on wheels',
  ceiling_fan: 'a simple ceiling fan with four wooden blades on a short rod',
  clock: 'a round wooden wall clock with a cream face',
  workbench: 'a sturdy wooden workbench with a vice and hand tools on it',
  pegboard: 'a wall pegboard with hanging hand tools: hammer, saw, wrenches, pliers',
  barricade: 'a low barricade of stacked sandbags with a plank across them',
  spikes: 'a row of sharpened rebar spikes in a wooden frame, a defensive trap',
  fence: 'a section of chain-link fence on metal posts with barbed wire on top',
  turret: 'a homemade motorised sentry post: a swivelling metal head with a spotlight and a camera on a sturdy tripod, wires and a junction box',
  gun_rack: 'a wooden wall gun rack holding two hunting rifles',
  window_bars: 'heavy steel security bars in a square frame',
  ladder: 'a tall wooden ladder',
};

const assets = CATALOG.map(d => ({
  id: `sprite_${d.id}`,
  kind: 'raw',
  cutout: true,
  quality: 'medium',
  size: '1024x1024',
  images: [`art/templates/${d.id}.png`, 'art/reference/sprite_style.png'],
  prompt: `Paint over the grey placeholder box in the first image: replace it with ${DESC[d.id]}. `
    + 'The object must fill the placeholder’s exact outline, width and height, standing on the same baseline, seen front-on and slightly from above. '
    + 'Match the art style of the second image exactly: hand-painted anime illustration like Studio Ghibli background art, soft cel shading, clean thin dark ink outlines, painterly texture, muted post-apocalyptic palette, slightly worn and used. '
    + 'Neutral, even, soft lighting with no glow and no coloured light. A single object on a fully transparent background. No floor, no wall, no shadow, no text, no people.',
}));
// Tileable surface textures for walls and floors.
const TEX = {
  wall_panel: 'weathered cream-painted vertical wooden wall panels with a dark wood skirting board along the bottom',
  wall_brick: 'old red-brown brick wall with worn mortar',
  wall_concrete: 'stained grey poured concrete wall with faint formwork seams',
  wall_metal: 'riveted steel wall plates, grey-green paint, a little rust at the seams',
  wall_wallpaper: 'faded sage-green striped wallpaper over a dark wood dado rail',
  floor_planks: 'worn dark wooden floor planks running left to right',
  floor_concrete: 'scuffed grey concrete floor',
  floor_tile: 'cream square ceramic floor tiles with grey grout, slightly chipped',
  floor_carpet: 'a faded red patterned carpet',
};
for (const [id, desc] of Object.entries(TEX)) {
  assets.push({
    id: `tex_${id}`, kind: 'raw', background: 'opaque', quality: 'medium', size: '1024x1024',
    prompt: `Seamless tileable texture, flat front view with no perspective and even lighting: ${desc}. `
      + 'Hand-painted anime background-art style like Studio Ghibli, soft painterly texture, muted post-apocalyptic palette. No objects, no text.',
  });
}

const missing = CATALOG.filter(d => !DESC[d.id]).map(d => d.id);
if (missing.length) throw new Error(`no description for ${missing.join(', ')}`);
writeFileSync(new URL('../art/sprites.json', import.meta.url), JSON.stringify({ assets }, null, 2));
console.log(`${assets.length} sprite jobs`);
