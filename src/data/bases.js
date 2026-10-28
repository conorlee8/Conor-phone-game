// Every base is plain data. The shell renderer (src/render/shell.js) builds it
// from parts: body shape, roof, support, cab, windows, extras and colours.
// Later, painted art can be dropped in per base without touching game logic.
//
// floors: interior cells per floor, bottom to top
// trait: bonuses the base gives (defense, comfort, food/water/power/scrap per hour,
//        foodMult, cap = extra storage)

const v = (id, name, group, o) => ({ id, name, cat: 'vehicle', group, ...o });
const b = (id, name, group, o) => ({ id, name, cat: 'building', group, ...o });

const cozy = { wall: '#e4d3b2', floor: '#8a6745' };
const steel = { wall: '#c3c0b6', floor: '#66635c' };
const wood = { wall: '#c89f6c', floor: '#7a5636' };
const plaster = { wall: '#e9e0cc', floor: '#9a7652' };
const stone = { wall: '#b3ab9c', floor: '#6d655a' };
const concrete = { wall: '#a9a69d', floor: '#5f5d58' };

export const BASES = [
  // ---------- RAIL ----------
  v('passenger_car', 'Passenger Car', 'Rail', {
    floors: [8], env: 'rail', r: 0.3, roof: 'curved', support: { type: 'rails' }, windows: 'band',
    col: { body: '#8a9a92', trim: '#3e4a48', roof: '#59625f', stripe: '#c0652f', ...cozy },
    extras: ['vents'], cost: 0, trait: { text: 'Balanced starter home' },
    blurb: 'A stalled commuter car on a foggy line. Long windows, long nights.',
  }),
  v('sleeper_car', 'Sleeper Car', 'Rail', {
    floors: [9], env: 'rail', r: 0.3, roof: 'curved', support: { type: 'rails' }, windows: 'band',
    col: { body: '#2f4a6b', trim: '#1c2b3d', roof: '#26303a', stripe: '#d0a24a', wall: '#d9c39a', floor: '#6e4a33' },
    extras: ['vents'], cost: 220, trait: { text: '+3 comfort: made for sleeping', comfort: 3 },
    blurb: 'Velvet berths and brass lamps, still smelling faintly of coffee.',
  }),
  v('boxcar', 'Freight Boxcar', 'Rail', {
    floors: [8], env: 'rail', r: 0.05, roof: 'flat', support: { type: 'rails' }, windows: 'none',
    col: { body: '#8a3f2a', trim: '#4f2418', roof: '#5a2a1c', ...wood },
    extras: ['ladder', 'rivets'], cost: 160, trait: { text: '+4 defense: thick steel, no windows', defense: 4 },
    blurb: 'No view, but nothing gets in either.',
  }),
  v('caboose', 'Caboose', 'Rail', {
    floors: [5, 2], env: 'rail', r: 0.08, roof: 'flat', support: { type: 'rails' }, windows: 'few',
    col: { body: '#a63a2c', trim: '#5a1f18', roof: '#3a2a26', ...cozy },
    extras: ['ladder', 'lantern'], cost: 140, trait: { text: '+3 defense: cupola lookout', defense: 3 },
    blurb: 'The little red cupola sees everything coming down the line.',
  }),
  v('tank_car', 'Tank Car', 'Rail', {
    floors: [7], env: 'rail', body: 'tube', roof: 'none', support: { type: 'rails' }, windows: 'portholes',
    col: { body: '#2c2f33', trim: '#16181a', roof: '#2c2f33', ...steel },
    extras: ['hatch', 'ladder'], cost: 180, trait: { text: '+0.2 water/h: old water tank', water: 0.2 },
    blurb: 'Scrubbed out and sealed up. Echoes when it rains.',
  }),
  v('subway_car', 'Subway Car', 'Rail', {
    floors: [9], env: 'tunnel', r: 0.25, roof: 'curved', support: { type: 'rails' }, windows: 'band',
    col: { body: '#a9b0b5', trim: '#5d6468', roof: '#7d8488', stripe: '#2f6fb0', wall: '#d6d9d2', floor: '#5a5c60' },
    extras: ['vents'], cost: 260, trait: { text: '+3 defense: deep underground', defense: 3 },
    blurb: 'The last train never left the station.',
  }),
  v('diesel_loco', 'Diesel Locomotive', 'Rail', {
    floors: [6], env: 'rail', r: 0.15, roof: 'curved', support: { type: 'rails' }, windows: 'few', cab: 'loco',
    col: { body: '#c9a227', trim: '#2a2a2a', roof: '#3b3b3b', stripe: '#2a2a2a', ...steel },
    extras: ['vents', 'horn'], cost: 380, trait: { text: '+0.6 power/h: idling engine', power: 0.6 },
    blurb: 'Two thousand horsepower, mostly used to run a kettle.',
  }),
  v('steam_engine', 'Steam Locomotive', 'Rail', {
    floors: [5], env: 'rail', r: 0.1, roof: 'curved', support: { type: 'rails' }, windows: 'few', cab: 'steam',
    col: { body: '#2b2d2f', trim: '#a8352b', roof: '#1d1e20', stripe: '#c9a227', ...wood },
    extras: ['smokestack'], cost: 420, trait: { text: '+0.4 power, +2 comfort: warm boiler', power: 0.4, comfort: 2 },
    blurb: 'A museum piece brought back to life with scrap coal.',
  }),
  v('armored_train', 'Armored Train', 'Rail', {
    floors: [9], env: 'rail', r: 0.1, roof: 'flat', support: { type: 'rails' }, windows: 'slits',
    col: { body: '#4f5a3a', trim: '#2c331f', roof: '#3a4229', stripe: '#262b1c', ...steel },
    extras: ['turret', 'rivets'], cost: 1100, trait: { text: '+12 defense: plated and armed', defense: 12 },
    blurb: 'Rolling fortress. Bring earplugs.',
  }),

  // ---------- ROAD ----------
  v('camper_van', 'Camper Van', 'Road', {
    floors: [4], env: 'road', r: 0.35, roof: 'curved', support: { type: 'wheels' }, windows: 'few', cab: 'van',
    col: { body: '#d8cfb8', trim: '#5f8a8b', roof: '#bdb4a0', stripe: '#5f8a8b', ...cozy },
    extras: ['ac', 'ladder'], cost: 60, trait: { text: '+2 comfort: cosy and small', comfort: 2 },
    blurb: 'Curtains, a tiny sink and a bed that folds out of the table.',
  }),
  v('motorhome', 'Class A Motorhome', 'Road', {
    floors: [7], env: 'road', r: 0.3, roof: 'flat', support: { type: 'wheels' }, windows: 'few', cab: 'bus',
    col: { body: '#e6e0d2', trim: '#7a5c3b', roof: '#cfc7b6', stripe: '#7a5c3b', ...cozy },
    extras: ['ac', 'solar', 'awning'], cost: 260, trait: { text: '+0.3 power/h: rooftop solar', power: 0.3 },
    blurb: 'Retirement dream turned apocalypse home.',
  }),
  v('airstream', 'Vintage Airstream', 'Road', {
    floors: [6], env: 'road', body: 'tube', roof: 'none', support: { type: 'wheels' }, windows: 'few',
    col: { body: '#c9ced3', trim: '#7e868d', roof: '#c9ced3', wall: '#e8d9b8', floor: '#8a6745' },
    extras: ['rivets', 'awning'], cost: 200, trait: { text: '+4 comfort: retro charm', comfort: 4 },
    blurb: 'Polished aluminium and pastel cushions.',
  }),
  v('school_bus', 'School Bus', 'Road', {
    floors: [8], env: 'road', r: 0.2, roof: 'curved', support: { type: 'wheels' }, windows: 'band', cab: 'bus',
    col: { body: '#e0a526', trim: '#1e1e1e', roof: '#d39a20', stripe: '#1e1e1e', ...cozy },
    extras: ['vents'], cost: 170, trait: { text: '+1 bed capacity: bench seats', beds: 1 },
    blurb: 'Seats ripped out, bunks bolted in.',
  }),
  v('double_decker', 'Double-Decker Bus', 'Road', {
    floors: [7, 7], env: 'town', r: 0.25, roof: 'curved', support: { type: 'wheels' }, windows: 'band',
    col: { body: '#b8322b', trim: '#5c1915', roof: '#a12b25', stripe: '#e9dcc0', ...cozy },
    extras: [], cost: 340, trait: { text: '+3 comfort: upstairs views', comfort: 3 },
    blurb: 'Sleep upstairs, cook downstairs, wave at nobody.',
  }),
  v('tour_coach', 'Tour Coach', 'Road', {
    floors: [9], env: 'road', r: 0.3, roof: 'curved', support: { type: 'wheels' }, windows: 'band', cab: 'bus',
    col: { body: '#3a6ea5', trim: '#1d3756', roof: '#2f5d8c', stripe: '#e6e2d6', ...cozy },
    extras: ['ac'], cost: 300, trait: { text: '+20 storage: luggage bays', cap: 20 },
    blurb: 'The luggage bays alone could feed a family.',
  }),
  v('food_truck', 'Food Truck', 'Road', {
    sign: 'TACOS',
    floors: [5], env: 'town', r: 0.15, roof: 'flat', support: { type: 'wheels' }, windows: 'few', cab: 'truck',
    col: { body: '#5aa3a0', trim: '#2c5654', roof: '#4a8a87', stripe: '#f0c75e', ...cozy },
    extras: ['awning', 'sign'], cost: 190, trait: { text: '+0.15 food/h: kitchen built in', food: 0.15 },
    blurb: 'Tacos were the last thing on the menu.',
  }),
  v('ice_cream_truck', 'Ice Cream Truck', 'Road', {
    floors: [4], env: 'town', r: 0.2, roof: 'flat', support: { type: 'wheels' }, windows: 'few', cab: 'van',
    col: { body: '#f2e6ef', trim: '#c96a8f', roof: '#e8d3e0', stripe: '#e58fb0', ...cozy },
    extras: ['cone'], cost: 150, trait: { text: '+4 comfort: the jingle still works', comfort: 4 },
    blurb: 'Plays a cheerful tune the dead can’t resist. Use sparingly.',
  }),
  v('ambulance', 'Ambulance', 'Road', {
    floors: [4], env: 'road', r: 0.12, roof: 'flat', support: { type: 'wheels' }, windows: 'few', cab: 'van',
    col: { body: '#f1f1ee', trim: '#c23b31', roof: '#e4e4e0', stripe: '#c23b31', ...steel },
    extras: ['lightbar', 'cross'], cost: 210, trait: { text: 'Med bay: survivors stay through hunger', medical: 1 },
    blurb: 'Fully stocked, if you don’t count what’s missing.',
  }),
  v('box_truck', 'Box Truck', 'Road', {
    floors: [6], env: 'road', r: 0.05, roof: 'flat', support: { type: 'wheels' }, windows: 'none', cab: 'truck',
    col: { body: '#e8e4da', trim: '#8b8b85', roof: '#d8d4ca', stripe: '#d26a2c', ...wood },
    extras: ['rivets'], cost: 170, trait: { text: '+2 defense, +15 storage', defense: 2, cap: 15 },
    blurb: 'A moving van that never finished the move.',
  }),
  v('semi_trailer', 'Semi Truck & Trailer', 'Road', {
    floors: [11], env: 'road', r: 0.05, roof: 'flat', support: { type: 'wheels' }, windows: 'none', cab: 'semi',
    col: { body: '#d0d3d6', trim: '#6d7175', roof: '#babdc0', stripe: '#2f5d8a', ...wood },
    extras: ['rivets'], cost: 480, trait: { text: '+3 defense, +30 storage', defense: 3, cap: 30 },
    blurb: 'Fifty-three feet of steel box.',
  }),
  v('fire_truck', 'Fire Truck', 'Road', {
    floors: [6], env: 'town', r: 0.1, roof: 'flat', support: { type: 'wheels' }, windows: 'few', cab: 'truck',
    col: { body: '#c0302b', trim: '#6a1916', roof: '#a8a8a8', stripe: '#e8d9a8', ...steel },
    extras: ['ladderTop', 'lightbar'], cost: 360, trait: { text: '+0.3 water/h: onboard pump', water: 0.3 },
    blurb: 'Still carries 500 gallons. Mostly for tea.',
  }),
  v('swat_truck', 'Armored SWAT Truck', 'Road', {
    floors: [5], env: 'town', r: 0.1, roof: 'flat', support: { type: 'wheels' }, windows: 'slits', cab: 'truck',
    col: { body: '#2c3036', trim: '#16181c', roof: '#23262b', stripe: '#3b414a', ...steel },
    extras: ['lightbar', 'rivets'], cost: 560, trait: { text: '+7 defense: bulletproof', defense: 7 },
    blurb: 'Run-flat tyres and a battering ram.',
  }),
  v('monster_truck', 'Monster Truck Camper', 'Road', {
    floors: [4], env: 'field', r: 0.2, roof: 'curved', support: { type: 'wheels', big: true }, windows: 'few', cab: 'truck',
    col: { body: '#6b8f2f', trim: '#2f4015', roof: '#56752a', stripe: '#e3b53a', ...cozy },
    extras: ['lightbar'], cost: 300, trait: { text: '+4 defense: too high to climb', defense: 4 },
    blurb: 'Five-foot tyres. Zombies just bounce off.',
  }),
  v('ice_road_truck', 'Snow Plow Truck', 'Road', {
    floors: [5], env: 'snow', r: 0.1, roof: 'flat', support: { type: 'wheels' }, windows: 'few', cab: 'plow',
    col: { body: '#e07b25', trim: '#4a2a12', roof: '#c96a1e', stripe: '#2b2b2b', ...steel },
    extras: ['lightbar'], cost: 280, trait: { text: '+3 defense: plow blade', defense: 3 },
    blurb: 'Pushes snow, and anything else in the way.',
  }),

  // ---------- WATER ----------
  v('houseboat', 'Houseboat', 'Water', {
    floors: [6], env: 'water', r: 0.05, roof: 'flat', support: { type: 'hull', flat: true }, windows: 'few',
    col: { body: '#5f8f87', trim: '#2c4743', roof: '#e6dfcc', stripe: '#e6dfcc', hull: '#3f5f5a', ...cozy },
    extras: ['railing', 'sill'], cost: 200, trait: { text: '+0.15 food/h fishing, +3 defense', food: 0.15, defense: 3 },
    blurb: 'Drop a line off the porch. The dead can’t swim.',
  }),
  v('trawler', 'Fishing Trawler', 'Water', {
    floors: [5], env: 'water', r: 0.05, roof: 'flat', support: { type: 'hull' }, windows: 'portholes',
    col: { body: '#e8e3d6', trim: '#2f5d8a', roof: '#2f5d8a', stripe: '#2f5d8a', hull: '#a8352b', ...wood },
    extras: ['mast', 'crane'], cost: 280, trait: { text: '+0.35 food/h: nets out', food: 0.35, defense: 2 },
    blurb: 'Smells like fish. Always will.',
  }),
  v('yacht', 'Luxury Yacht', 'Water', {
    floors: [8, 6], env: 'water', r: 0.25, roof: 'flat', support: { type: 'hull', sleek: true }, windows: 'band',
    col: { body: '#f2f2ef', trim: '#2b3b4c', roof: '#f2f2ef', stripe: '#2b3b4c', hull: '#f2f2ef', wall: '#efe4cf', floor: '#a4835a' },
    extras: ['railing', 'radar'], cost: 760, trait: { text: '+6 comfort, +3 defense', comfort: 6, defense: 3 },
    blurb: 'Someone’s billion-dollar toy. Now it’s yours.',
  }),
  v('tugboat', 'Tugboat', 'Water', {
    floors: [4, 2], env: 'water', r: 0.08, roof: 'flat', support: { type: 'hull' }, windows: 'portholes',
    col: { body: '#e9dfc9', trim: '#3b3b3b', roof: '#b5402e', stripe: '#b5402e', hull: '#b5402e', ...wood },
    extras: ['smokestack', 'tires'], cost: 230, trait: { text: '+0.4 power/h: diesel engine', power: 0.4, defense: 2 },
    blurb: 'Small, stubborn, unsinkable.',
  }),
  v('ferry', 'Car Ferry', 'Water', {
    floors: [11, 9], env: 'water', r: 0.1, roof: 'flat', support: { type: 'hull' }, windows: 'band',
    col: { body: '#e7e5df', trim: '#2a5c8f', roof: '#e7e5df', stripe: '#2a5c8f', hull: '#2a5c8f', ...steel },
    extras: ['smokestack', 'railing'], cost: 820, trait: { text: '+4 defense, +25 storage', defense: 4, cap: 25 },
    blurb: 'Two decks, a car hold and a snack bar.',
  }),
  v('galleon', 'Pirate Galleon', 'Water', {
    floors: [9, 6], env: 'water', r: 0.05, roof: 'flat', support: { type: 'hull', wood: true }, windows: 'arched',
    col: { body: '#6b4528', trim: '#3a2414', roof: '#5a3a22', stripe: '#c9a227', hull: '#5a3a22', ...wood },
    extras: ['mast', 'sail', 'flag', 'railing'], cost: 900, trait: { text: '+6 defense: cannons', defense: 6 },
    blurb: 'A theme-park replica. The cannons work fine.',
  }),
  v('submarine', 'Submarine', 'Water', {
    floors: [9], env: 'water', body: 'tube', roof: 'none', support: { type: 'sub' }, windows: 'portholes',
    col: { body: '#3c4a52', trim: '#1f272c', roof: '#3c4a52', ...steel },
    extras: ['conning', 'propeller'], cost: 1000, trait: { text: '+10 defense: half submerged', defense: 10 },
    blurb: 'Surfaced and silent. Sonar pings at night.',
  }),
  v('paddle_steamer', 'Paddle Steamer', 'Water', {
    floors: [8, 6], env: 'water', r: 0.05, roof: 'flat', support: { type: 'hull' }, windows: 'arched',
    col: { body: '#f0ead8', trim: '#8a2d24', roof: '#8a2d24', stripe: '#8a2d24', hull: '#2b2b2b', ...wood },
    extras: ['paddlewheel', 'smokestacks', 'railing'], cost: 640, trait: { text: '+4 comfort, +0.3 power/h', comfort: 4, power: 0.3 },
    blurb: 'Mississippi charm on a dead river.',
  }),

  // ---------- AIR ----------
  v('airliner', 'Crashed Airliner', 'Air', {
    floors: [12], env: 'field', body: 'tube', roof: 'none', support: { type: 'belly' }, windows: 'portholes',
    col: { body: '#e9ecef', trim: '#2a5c8f', roof: '#e9ecef', stripe: '#2a5c8f', wall: '#d9d6cc', floor: '#5c6670' },
    extras: ['wings', 'fin'], cost: 700, trait: { text: '+30 storage: cargo hold', cap: 30 },
    blurb: 'Flight 404 never arrived. Business class has legroom.',
  }),
  v('cargo_plane', 'Cargo Plane', 'Air', {
    floors: [10], env: 'field', body: 'tube', roof: 'none', support: { type: 'belly' }, windows: 'portholes',
    col: { body: '#7d8a74', trim: '#3d4537', roof: '#7d8a74', stripe: '#3d4537', ...steel },
    extras: ['wings', 'fin'], cost: 620, trait: { text: '+3 defense, +20 storage', defense: 3, cap: 20 },
    blurb: 'Military cargo, rear ramp welded shut.',
  }),
  v('helicopter', 'Cargo Helicopter', 'Air', {
    floors: [5], env: 'field', body: 'tube', roof: 'none', support: { type: 'skids' }, windows: 'portholes',
    col: { body: '#5f6b55', trim: '#2e3429', roof: '#5f6b55', ...steel },
    extras: ['rotor', 'tailboom'], cost: 450, trait: { text: '+2 defense, +25% scavenging', defense: 2, scav: 0.25 },
    blurb: 'No fuel to fly, but it makes a fine shed.',
  }),
  v('zeppelin', 'Zeppelin Gondola', 'Air', {
    floors: [6], env: 'field', r: 0.4, roof: 'none', support: { type: 'balloon', h: 3.2 }, windows: 'band',
    col: { body: '#8c6a4a', trim: '#3d2b1c', roof: '#8c6a4a', envelope: '#c9c2b0', ...wood },
    extras: [], cost: 1400, trait: { text: '+14 defense: out of reach', defense: 14 },
    blurb: 'Tethered high above the horde. Mind the gap.',
  }),
  v('hot_air_balloon', 'Hot Air Balloon', 'Air', {
    floors: [2], env: 'field', r: 0.1, roof: 'none', support: { type: 'balloon', h: 2.6, basket: true }, windows: 'none',
    col: { body: '#a87b45', trim: '#5c3f1f', roof: '#a87b45', envelope: '#d8573e', envelope2: '#f0c75e', ...wood },
    extras: [], cost: 320, trait: { text: '+9 defense: floating', defense: 9 },
    blurb: 'Tiny, terrifying, untouchable.',
  }),

  // ---------- HEAVY ----------
  v('battle_tank', 'Battle Tank', 'Heavy', {
    floors: [4], env: 'field', r: 0.2, roof: 'none', support: { type: 'treads' }, windows: 'slits',
    col: { body: '#5a6440', trim: '#2f3521', roof: '#5a6440', ...steel },
    extras: ['tankTurret'], cost: 1200, trait: { text: '+14 defense: main gun', defense: 14 },
    blurb: 'Cramped. Unstoppable.',
  }),
  v('apc', 'Armored APC', 'Heavy', {
    floors: [5], env: 'town', r: 0.25, roof: 'flat', support: { type: 'wheels', six: true }, windows: 'slits',
    col: { body: '#6e6a52', trim: '#36342a', roof: '#6e6a52', ...steel },
    extras: ['turret'], cost: 640, trait: { text: '+8 defense', defense: 8 },
    blurb: 'Eight wheels, one hatch, zero worries.',
  }),
  v('snowcat', 'Snowcat', 'Heavy', {
    floors: [4], env: 'snow', r: 0.2, roof: 'flat', support: { type: 'treads' }, windows: 'few', cab: 'van',
    col: { body: '#d9532b', trim: '#3a1a10', roof: '#c4471f', stripe: '#2b2b2b', ...cozy },
    extras: ['lightbar'], cost: 260, trait: { text: '+3 comfort: heated cabin', comfort: 3, defense: 2 },
    blurb: 'A warm box in a white world.',
  }),
  v('cable_car', 'Cable Car', 'Heavy', {
    floors: [3], env: 'mountain', r: 0.25, roof: 'flat', support: { type: 'cable', h: 3.4 }, windows: 'band',
    col: { body: '#c8382c', trim: '#5c1a14', roof: '#9a9a9a', ...cozy },
    extras: [], cost: 380, trait: { text: '+12 defense: hanging over a gorge', defense: 12 },
    blurb: 'Stuck halfway up the mountain. Best view in the world.',
  }),
  v('mining_truck', 'Mining Dump Truck', 'Heavy', {
    floors: [6], env: 'desert', r: 0.05, roof: 'flat', support: { type: 'wheels', big: true }, windows: 'few', cab: 'truck',
    col: { body: '#e3b53a', trim: '#5a4512', roof: '#c99c25', stripe: '#2b2b2b', ...steel },
    extras: ['rivets'], cost: 520, trait: { text: '+5 defense, +0.2 scrap/h', defense: 5, scrap: 0.2 },
    blurb: 'The bed holds 300 tons of anything.',
  }),

  // ---------- HOMES ----------
  b('log_cabin', 'Log Cabin', 'Homes', {
    floors: [6], env: 'forest', roof: 'gable', support: { type: 'ground' }, windows: 'few', wallStyle: 'logs',
    col: { body: '#7a5434', trim: '#4a3220', roof: '#4b5a3a', ...wood },
    extras: ['chimney'], cost: 120, trait: { text: '+3 comfort: wood stove', comfort: 3 },
    blurb: 'Smoke from the chimney, snow on the roof.',
  }),
  b('farmhouse', 'Farmhouse', 'Homes', {
    floors: [7, 7], env: 'field', roof: 'gable', support: { type: 'ground' }, windows: 'grid',
    col: { body: '#e9e2d0', trim: '#7a3a2a', roof: '#6e3b2a', ...plaster },
    extras: ['chimney', 'porch'], cost: 380, trait: { text: '+0.2 food/h: kitchen garden', food: 0.2 },
    blurb: 'Two stories, a porch swing and a root cellar.',
  }),
  b('suburban', 'Suburban House', 'Homes', {
    floors: [8, 7], env: 'town', roof: 'gable', support: { type: 'ground' }, windows: 'grid',
    col: { body: '#9fb3c4', trim: '#f0ede4', roof: '#4a4f57', ...plaster },
    extras: ['chimney'], cost: 360, trait: { text: '+3 comfort: real furniture', comfort: 3 },
    blurb: 'White picket fence, boarded-up garage.',
  }),
  b('mobile_home', 'Mobile Home', 'Homes', {
    floors: [8], env: 'field', r: 0.05, roof: 'flat', support: { type: 'blocks' }, windows: 'few',
    col: { body: '#d9d4c3', trim: '#6d8c6a', roof: '#bcb7a6', stripe: '#6d8c6a', ...plaster },
    extras: ['awning', 'satdish'], cost: 110, trait: { text: 'Cheap and roomy' },
    blurb: 'Double-wide and proud of it.',
  }),
  b('barn', 'Red Barn', 'Homes', {
    floors: [8, 8], env: 'field', roof: 'gambrel', support: { type: 'ground' }, windows: 'few', wallStyle: 'planks',
    col: { body: '#9e2e25', trim: '#efe8da', roof: '#4a4a4a', ...wood },
    extras: ['hayloft'], cost: 400, trait: { text: '+0.25 food/h, +20 storage', food: 0.25, cap: 20 },
    blurb: 'Hayloft bedrooms and a tractor that almost runs.',
  }),
  b('a_frame', 'A-Frame Cabin', 'Homes', {
    floors: [6, 3], env: 'forest', body: 'taper', roof: 'conical', support: { type: 'ground' }, windows: 'glass', wallStyle: 'planks',
    col: { body: '#6a4a30', trim: '#3a2818', roof: '#3d3d3d', ...wood },
    extras: ['chimney'], cost: 260, trait: { text: '+4 comfort: lofted ceilings', comfort: 4 },
    blurb: 'All roof, all window, all cosy.',
  }),
  b('victorian', 'Creepy Victorian', 'Homes', {
    floors: [6, 6, 3], env: 'town', roof: 'spire', support: { type: 'ground' }, windows: 'arched',
    col: { body: '#5b4a63', trim: '#d8cfc0', roof: '#2c2530', wall: '#b9a58f', floor: '#5a3e2c' },
    extras: ['chimney'], cost: 600, trait: { text: '+5 comfort, +2 defense', comfort: 5, defense: 2 },
    blurb: 'It was haunted before the dead walked.',
  }),
  b('container_stack', 'Container Stack', 'Homes', {
    floors: [6, 6, 6], env: 'town', r: 0.02, roof: 'flat', support: { type: 'ground' }, windows: 'few',
    col: { body: '#2f6b8a', trim: '#1b3a4b', roof: '#2f6b8a', stack: ['#2f6b8a', '#b5402e', '#d9a43a'], ...steel },
    extras: ['rivets', 'ladder'], cost: 520, trait: { text: '+5 defense: stacked steel', defense: 5 },
    blurb: 'Three shipping containers, welded into a tower.',
  }),
  b('greenhouse', 'Greenhouse', 'Homes', {
    floors: [7], env: 'field', roof: 'glass', support: { type: 'ground' }, windows: 'glass',
    col: { body: '#d9e3d6', trim: '#7d8f78', roof: '#cfe3d8', wall: '#e3ead7', floor: '#6b5236' },
    extras: [], cost: 330, trait: { text: 'Food production x1.6', foodMult: 1.6 },
    blurb: 'Everything grows. Everything can see in.',
  }),
  b('geodome', 'Geodesic Dome', 'Homes', {
    floors: [7, 5], env: 'desert', body: 'dome', roof: 'none', support: { type: 'ground' }, windows: 'portholes',
    col: { body: '#d7d2c4', trim: '#8a8577', roof: '#d7d2c4', ...plaster },
    extras: ['domeLines'], cost: 480, trait: { text: '+0.3 power/h, +3 comfort', power: 0.3, comfort: 3 },
    blurb: 'Off-grid prepper dream, finally useful.',
  }),
  b('igloo', 'Igloo', 'Homes', {
    floors: [5], env: 'snow', body: 'dome', roof: 'none', support: { type: 'ground' }, windows: 'none',
    col: { body: '#eef3f7', trim: '#b9c8d3', roof: '#eef3f7', wall: '#dfe8ee', floor: '#b9c3c9' },
    extras: ['domeBlocks'], cost: 90, trait: { text: '+3 defense: packed ice', defense: 3 },
    blurb: 'Surprisingly warm. Surprisingly small.',
  }),

  // ---------- TOWERS ----------
  b('water_tower', 'Water Tower', 'Towers', {
    floors: [5], env: 'field', body: 'tank', roof: 'conical', support: { type: 'stilts', h: 3.6 }, windows: 'few',
    col: { body: '#9aa7ad', trim: '#59656b', roof: '#7f8b91', ...steel },
    extras: ['railing'], cost: 480, trait: { text: '+0.5 water/h, +7 defense', water: 0.5, defense: 7 },
    blurb: 'Drained, insulated, and high above it all.',
  }),
  b('lighthouse', 'Lighthouse', 'Towers', {
    floors: [5, 4, 4, 3], env: 'coast', body: 'taper', roof: 'lamp', support: { type: 'rock' }, windows: 'few', wallStyle: 'stripes',
    col: { body: '#efe9dc', trim: '#b5302b', roof: '#b5302b', ...stone },
    extras: [], cost: 700, trait: { text: '+8 defense, +3 comfort: the beam', defense: 8, comfort: 3 },
    blurb: 'Keep the light on. Someone might see it.',
  }),
  b('grain_silo', 'Grain Silo', 'Towers', {
    floors: [4, 4, 4], env: 'field', r: 0.1, roof: 'dome', support: { type: 'ground' }, windows: 'portholes', wallStyle: 'corrugated',
    col: { body: '#b8bcbd', trim: '#6c7173', roof: '#a7abac', ...steel },
    extras: ['ladder'], cost: 420, trait: { text: '+40 food storage, +4 defense', cap: 40, defense: 4 },
    blurb: 'Tall, round, and full of old corn.',
  }),
  b('fire_lookout', 'Fire Lookout', 'Towers', {
    floors: [4], env: 'forest', roof: 'hip', support: { type: 'stilts', h: 5 }, windows: 'glass',
    col: { body: '#6b4f33', trim: '#3a2a1a', roof: '#4b4f45', ...wood },
    extras: ['railing'], cost: 360, trait: { text: '+9 defense, +25% scavenging', defense: 9, scav: 0.25 },
    blurb: 'You can see the whole valley. The valley can’t reach you.',
  }),
  b('windmill', 'Windmill', 'Towers', {
    floors: [6, 5, 4], env: 'field', body: 'taper', roof: 'conical', support: { type: 'ground' }, windows: 'few', wallStyle: 'planks',
    col: { body: '#d8cbb0', trim: '#6a4a2c', roof: '#5a3d26', ...wood },
    extras: ['windmill'], cost: 540, trait: { text: '+0.8 power/h: wind', power: 0.8 },
    blurb: 'The sails still turn. The lights still glow.',
  }),
  b('clock_tower', 'Clock Tower', 'Towers', {
    floors: [5, 5, 5, 5], env: 'town', roof: 'spire', support: { type: 'ground' }, windows: 'arched', wallStyle: 'brick',
    col: { body: '#8a5a44', trim: '#d8cfc0', roof: '#3d4a4f', ...stone },
    extras: ['clock'], cost: 760, trait: { text: '+7 defense, +2 comfort', defense: 7, comfort: 2 },
    blurb: 'Rings every hour. Draws a crowd.',
  }),
  b('radio_tower', 'Radio Station', 'Towers', {
    floors: [6, 6], env: 'field', r: 0.03, roof: 'flat', support: { type: 'ground' }, windows: 'grid',
    col: { body: '#c9c3b3', trim: '#7a2f28', roof: '#9a9488', ...concrete },
    extras: ['antenna', 'satdish'], cost: 450, trait: { text: 'Survivors find you 3x faster', recruit: 2 },
    blurb: 'Broadcasting on every frequency: we’re still here.',
  }),
  b('castle_keep', 'Castle Keep', 'Towers', {
    floors: [7, 7, 7], env: 'field', roof: 'battlement', support: { type: 'ground' }, windows: 'arched', wallStyle: 'stone',
    col: { body: '#8d8a82', trim: '#5c5a54', roof: '#7a776f', wall: '#a39c8c', floor: '#6a5d4c' },
    extras: ['flag'], cost: 1600, trait: { text: '+16 defense: built for sieges', defense: 16 },
    blurb: 'Built for a different apocalypse. Works for this one.',
  }),
  b('pagoda', 'Pagoda', 'Towers', {
    floors: [6, 5, 4], env: 'forest', body: 'taper', roof: 'pagoda', support: { type: 'ground' }, windows: 'grid',
    col: { body: '#b03a2e', trim: '#2c2a26', roof: '#2f3b3a', wall: '#e8d9b8', floor: '#6b4a2e' },
    extras: ['eaves'], cost: 680, trait: { text: '+6 comfort: peaceful', comfort: 6 },
    blurb: 'Five hundred years old and still standing.',
  }),

  // ---------- TREES & WILD ----------
  b('treehouse', 'Treehouse', 'Wild', {
    floors: [5], env: 'forest', roof: 'gable', support: { type: 'tree', h: 3 }, windows: 'few', wallStyle: 'planks',
    col: { body: '#8a6440', trim: '#4a3220', roof: '#5a6a3a', ...wood },
    extras: ['ropeLadder'], cost: 240, trait: { text: '+6 defense: pull up the ladder', defense: 6 },
    blurb: 'Every kid’s dream fort, now load-bearing.',
  }),
  b('tree_village', 'Giant Tree Village', 'Wild', {
    floors: [7, 5], env: 'forest', roof: 'gable', support: { type: 'tree', h: 4.2, giant: true }, windows: 'few', wallStyle: 'planks',
    col: { body: '#7a5634', trim: '#3d2a18', roof: '#4d6a34', ...wood },
    extras: ['ropeLadder', 'vines'], cost: 820, trait: { text: '+10 defense, +0.15 food/h', defense: 10, food: 0.15 },
    blurb: 'A whole village in one ancient tree.',
  }),
  b('stilt_house', 'Swamp Stilt House', 'Wild', {
    floors: [5], env: 'swamp', roof: 'gable', support: { type: 'stilts', h: 1.8, water: true }, windows: 'few', wallStyle: 'planks',
    col: { body: '#6a6448', trim: '#3a3626', roof: '#5a4a32', ...wood },
    extras: ['porch'], cost: 210, trait: { text: '+5 defense, +0.15 food/h fishing', defense: 5, food: 0.15 },
    blurb: 'Gators below, fireflies above.',
  }),
  b('mushroom_house', 'Giant Mushroom', 'Wild', {
    floors: [4, 3], env: 'forest', body: 'taper', roof: 'mushroom', support: { type: 'ground' }, windows: 'portholes',
    col: { body: '#efe4cf', trim: '#b9a888', roof: '#c4382c', wall: '#f0e2c8', floor: '#8a6745' },
    extras: ['vines'], cost: 430, trait: { text: '+0.3 food/h: edible walls', food: 0.3, comfort: 2 },
    blurb: 'Don’t ask how. Just enjoy the walls.',
  }),
  b('cave_den', 'Cliffside Cave', 'Wild', {
    floors: [7], env: 'mountain', r: 0.6, roof: 'none', support: { type: 'cliff' }, windows: 'none', wallStyle: 'stone',
    col: { body: '#6b6458', trim: '#3f3a33', roof: '#6b6458', wall: '#8e8577', floor: '#5c5348' },
    extras: [], cost: 300, trait: { text: '+9 defense: one way in', defense: 9 },
    blurb: 'Carved into the rock. Fire at the mouth.',
  }),

  // ---------- UNDERGROUND ----------
  b('bunker', 'Prepper Bunker', 'Underground', {
    floors: [8, 8], env: 'field', r: 0.1, roof: 'none', support: { type: 'underground' }, windows: 'none', wallStyle: 'concrete',
    col: { body: '#5a5d58', trim: '#33352f', roof: '#5a5d58', ...concrete },
    extras: [], cost: 1200, trait: { text: '+18 defense, +30 storage', defense: 18, cap: 30 },
    blurb: 'Two years of beans and a blast door.',
  }),
  b('missile_silo', 'Missile Silo', 'Underground', {
    floors: [5, 5, 5, 5], env: 'desert', r: 0.05, roof: 'none', support: { type: 'underground' }, windows: 'none', wallStyle: 'concrete',
    col: { body: '#4f524d', trim: '#2c2e2a', roof: '#4f524d', ...concrete },
    extras: [], cost: 1900, trait: { text: '+22 defense, +1 power/h', defense: 22, power: 1 },
    blurb: 'Decommissioned. Mostly.',
  }),
  b('subway_station', 'Subway Station', 'Underground', {
    floors: [12], env: 'tunnel', r: 0.05, roof: 'none', support: { type: 'ground' }, windows: 'none', wallStyle: 'tile',
    col: { body: '#3a3d40', trim: '#1e2022', roof: '#3a3d40', wall: '#d9d4c3', floor: '#6a6660' },
    extras: [], cost: 700, trait: { text: '+8 defense, +25 storage', defense: 8, cap: 25 },
    blurb: 'Platform 2. Tiled walls, endless tunnels.',
  }),

  // ---------- PUBLIC ----------
  b('gas_station', 'Gas Station', 'Public', {
    sign: 'GAS',
    floors: [7], env: 'road', r: 0.03, roof: 'flat', support: { type: 'ground' }, windows: 'glass',
    col: { body: '#e8e4da', trim: '#c23b31', roof: '#c23b31', stripe: '#c23b31', ...plaster },
    extras: ['canopy', 'sign'], cost: 300, trait: { text: '+0.5 power/h: fuel tanks', power: 0.5 },
    blurb: 'Snacks, fuel and a lot of glass.',
  }),
  b('diner', 'Roadside Diner', 'Public', {
    sign: 'DINER',
    floors: [9], env: 'road', r: 0.35, roof: 'curved', support: { type: 'blocks' }, windows: 'band',
    col: { body: '#c9d4d6', trim: '#c23b31', roof: '#b9c4c6', stripe: '#c23b31', wall: '#f0e6d2', floor: '#3b3b3b' },
    extras: ['sign'], cost: 340, trait: { text: '+0.25 food/h, +2 comfort', food: 0.25, comfort: 2 },
    blurb: 'Bottomless coffee, for as long as it lasts.',
  }),
  b('motel', 'Motel', 'Public', {
    sign: 'MOTEL',
    floors: [10, 10], env: 'road', r: 0.03, roof: 'flat', support: { type: 'ground' }, windows: 'grid',
    col: { body: '#e3c9a0', trim: '#2f6b6a', roof: '#a8603a', ...plaster },
    extras: ['sign', 'railing'], cost: 560, trait: { text: '+2 bed capacity', beds: 2 },
    blurb: 'Vacancy: always.',
  }),
  b('fire_station', 'Fire Station', 'Public', {
    floors: [9, 9], env: 'town', r: 0.03, roof: 'flat', support: { type: 'ground' }, windows: 'grid', wallStyle: 'brick',
    col: { body: '#9a3a2c', trim: '#e8e0cc', roof: '#6a2a20', ...plaster },
    extras: ['bell'], cost: 620, trait: { text: '+0.4 water/h, +4 defense', water: 0.4, defense: 4 },
    blurb: 'Brass pole, big doors, bigger kitchen.',
  }),
  b('police_station', 'Police Station', 'Public', {
    floors: [9, 9], env: 'town', r: 0.03, roof: 'flat', support: { type: 'ground' }, windows: 'grid', wallStyle: 'brick',
    col: { body: '#6f7480', trim: '#2b3d63', roof: '#4a4e57', ...concrete },
    extras: ['lightbar', 'flag'], cost: 720, trait: { text: '+10 defense: armory', defense: 10 },
    blurb: 'The cells lock from the inside too.',
  }),
  b('hospital', 'Hospital Wing', 'Public', {
    floors: [10, 10, 10], env: 'town', r: 0.03, roof: 'flat', support: { type: 'ground' }, windows: 'grid',
    col: { body: '#e6e6e0', trim: '#2f6fb0', roof: '#c9c9c3', ...steel },
    extras: ['cross', 'helipad'], cost: 980, trait: { text: 'Med bay, +4 comfort', medical: 1, comfort: 4 },
    blurb: 'Three floors of beds and a helipad.',
  }),
  b('school', 'High School', 'Public', {
    floors: [11, 11], env: 'town', r: 0.03, roof: 'flat', support: { type: 'ground' }, windows: 'grid', wallStyle: 'brick',
    col: { body: '#a5553a', trim: '#e8e0cc', roof: '#6a3a28', ...plaster },
    extras: ['bell', 'flag'], cost: 760, trait: { text: '+0.3 scrap/h: shop class', scrap: 0.3 },
    blurb: 'The gym makes a great greenhouse.',
  }),
  b('bank', 'Bank Vault', 'Public', {
    floors: [8], env: 'town', r: 0.02, roof: 'pediment', support: { type: 'ground' }, windows: 'arched', wallStyle: 'stone',
    col: { body: '#d9d2bf', trim: '#8a8370', roof: '#cfc8b4', ...stone },
    extras: ['columns'], cost: 640, trait: { text: '+9 defense: the vault', defense: 9 },
    blurb: 'Money’s worthless. The vault door isn’t.',
  }),
  b('chapel', 'Country Chapel', 'Public', {
    floors: [6], env: 'field', roof: 'spire', support: { type: 'ground' }, windows: 'arched', wallStyle: 'planks',
    col: { body: '#ece6d6', trim: '#6a5a44', roof: '#4a4a4a', wall: '#e8dcc0', floor: '#7a5636' },
    extras: ['bell'], cost: 280, trait: { text: '+6 comfort: sanctuary', comfort: 6 },
    blurb: 'Sanctuary, in every sense.',
  }),
  b('department_store', 'Department Store', 'Public', {
    sign: 'STORE',
    floors: [13, 13], env: 'town', r: 0.02, roof: 'flat', support: { type: 'ground' }, windows: 'glass',
    col: { body: '#b8b2a4', trim: '#3a3a3a', roof: '#8e887a', ...concrete },
    extras: ['sign'], cost: 900, trait: { text: '+40 storage, +0.2 scrap/h', cap: 40, scrap: 0.2 },
    blurb: 'Everything you need, one aisle at a time.',
  }),
  b('warehouse', 'Warehouse', 'Public', {
    floors: [12], env: 'town', r: 0.02, roof: 'sawtooth', support: { type: 'ground' }, windows: 'few', wallStyle: 'corrugated',
    col: { body: '#7f8a8c', trim: '#3d4446', roof: '#5d6668', ...concrete },
    extras: [], cost: 500, trait: { text: '+35 storage, +3 defense', cap: 35, defense: 3 },
    blurb: 'Pallets, forklifts and a lot of echo.',
  }),

  // ---------- ODDITIES ----------
  b('oil_rig', 'Oil Rig', 'Oddities', {
    floors: [9, 7], env: 'water', r: 0.02, roof: 'flat', support: { type: 'rig', h: 3.2 }, windows: 'few',
    col: { body: '#c9a227', trim: '#4a4a4a', roof: '#8e8e8e', ...steel },
    extras: ['crane', 'flare', 'helipad'], cost: 1300, trait: { text: '+1 power/h, +12 defense', power: 1, defense: 12 },
    blurb: 'An island of steel in a grey sea.',
  }),
  b('pyramid', 'Pyramid', 'Oddities', {
    floors: [9, 7, 5, 3], env: 'desert', body: 'taper', roof: 'conical', support: { type: 'ground' }, windows: 'none', wallStyle: 'stone',
    col: { body: '#d6b97a', trim: '#9a7f48', roof: '#d6b97a', wall: '#cdb27a', floor: '#8a7448' },
    extras: [], cost: 1500, trait: { text: '+15 defense, +4 comfort', defense: 15, comfort: 4 },
    blurb: 'Four thousand years of keeping things out.',
  }),
  b('teapot_house', 'Teapot House', 'Oddities', {
    floors: [5], env: 'field', body: 'dome', roof: 'none', support: { type: 'ground' }, windows: 'portholes',
    col: { body: '#6f9bb3', trim: '#2f4f60', roof: '#6f9bb3', ...cozy },
    extras: ['teapot'], cost: 360, trait: { text: '+6 comfort: tea time', comfort: 6 },
    blurb: 'Roadside attraction. Very British.',
  }),
  b('circus_tent', 'Circus Big Top', 'Oddities', {
    floors: [10], env: 'field', roof: 'tent', support: { type: 'ground' }, windows: 'none', wallStyle: 'stripes',
    col: { body: '#d8463a', trim: '#f2e8d4', roof: '#d8463a', wall: '#e9c9a0', floor: '#9a7a50' },
    extras: ['flag'], cost: 460, trait: { text: '+7 comfort: the show goes on', comfort: 7 },
    blurb: 'The clowns left. The popcorn machine stayed.',
  }),
  b('observatory', 'Observatory', 'Oddities', {
    floors: [7, 5], env: 'mountain', roof: 'observatory', support: { type: 'ground' }, windows: 'few',
    col: { body: '#e3e0d8', trim: '#6a6f75', roof: '#c9ccd0', ...plaster },
    extras: [], cost: 620, trait: { text: '+5 comfort, +25% scavenging', comfort: 5, scav: 0.25 },
    blurb: 'Watch the stars. Watch the horde.',
  }),
  b('ferris_gondola', 'Ferris Wheel Pod', 'Oddities', {
    floors: [3], env: 'field', r: 0.4, roof: 'curved', support: { type: 'ferris' }, windows: 'band',
    col: { body: '#f0c75e', trim: '#8a6a1c', roof: '#d8463a', ...cozy },
    extras: [], cost: 420, trait: { text: '+12 defense: top of the wheel', defense: 12, comfort: 2 },
    blurb: 'Jammed at the very top. Long way down.',
  }),
  b('shipwreck', 'Beached Shipwreck', 'Oddities', {
    floors: [9, 7], env: 'coast', r: 0.05, roof: 'flat', support: { type: 'hull', wreck: true }, windows: 'portholes',
    col: { body: '#7a5a3c', trim: '#3a2a1a', roof: '#5a4430', stripe: '#a8352b', hull: '#4f3a28', ...wood },
    extras: ['mast', 'railing'], cost: 540, trait: { text: '+5 defense, +0.2 scrap/h', defense: 5, scrap: 0.2 },
    blurb: 'Washed up on the rocks and tilted just a little.',
  }),
];

export const BASE_BY_ID = Object.fromEntries(BASES.map(d => [d.id, d]));
export const GROUPS = {
  vehicle: ['Rail', 'Road', 'Water', 'Air', 'Heavy'],
  building: ['Homes', 'Towers', 'Wild', 'Underground', 'Public', 'Oddities'],
};
