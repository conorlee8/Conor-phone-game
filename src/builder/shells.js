// A shell is the structure you build inside: a stack of floors, each a row of
// cells. Later each shell gets painted exterior art; for now the renderer
// draws a simple frame in the shell's colours.

export const SHELLS = [
  {
    id: 'bunker', name: 'Prepper Bunker', cost: 0, floors: [10, 10],
    underground: true, colors: { frame: '#4a4d48', wall: '#b7ad98', floor: '#6a5d4c' },
    blurb: 'Two floors under a field. Room to grow.',
  },
  {
    id: 'train_car', name: 'Passenger Car', cost: 150, floors: [12],
    colors: { frame: '#5f6e66', wall: '#d9c8a6', floor: '#7a5b3e' },
    blurb: 'One long room on the rails.',
  },
  {
    id: 'water_tower', name: 'Water Tower', cost: 250, floors: [6, 6], stilts: 3,
    colors: { frame: '#5d6a64', wall: '#a9a593', floor: '#6b5236' },
    blurb: 'High up: zombies can’t climb in. +6 defense.', defense: 6,
  },
];

export const SHELL = Object.fromEntries(SHELLS.map(s => [s.id, s]));
