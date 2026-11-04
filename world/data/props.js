// Furniture placed in rooms that have been rebuilt in layers. Each piece sits
// at its front baseline (x, y) on the painting and is drawn in depth order
// with the residents, so people walk behind tables and sit on real seats.
// seats: where someone sits, the way they face, and which prop they sit on.

export const PROPS = [
  // Dumpling Orbit: two tables, a stool either side of each.
  { place: 'dumpling', sprite: 'prop_stool', x: 1168, y: 486 },
  { place: 'dumpling', sprite: 'prop_stool', x: 1214, y: 486 },
  { place: 'dumpling', sprite: 'prop_table', x: 1191, y: 494 },
  { place: 'dumpling', sprite: 'prop_stool', x: 1240, y: 486 },
  { place: 'dumpling', sprite: 'prop_stool', x: 1286, y: 486 },
  { place: 'dumpling', sprite: 'prop_table', x: 1263, y: 494 },
  // The court: a bench at the front, a ball rack by the hoop.
  { place: 'court', sprite: 'prop_bench', x: 1070, y: 803 },
  { place: 'court', sprite: 'prop_balls', x: 1372, y: 772 },
];

export const SEATS = [
  { place: 'dumpling', x: 1168, y: 487, face: 1 },
  { place: 'dumpling', x: 1214, y: 487, face: -1 },
  { place: 'dumpling', x: 1240, y: 487, face: 1 },
  { place: 'dumpling', x: 1286, y: 487, face: -1 },
  { place: 'court', x: 1056, y: 804, face: 1 },
  { place: 'court', x: 1086, y: 804, face: -1 },
];
