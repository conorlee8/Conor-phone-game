# Last Haven

A cozy-apocalypse base-building game for iPhone. It runs in the browser, so nothing needs installing.
Pick your shelter from 88 bases (42 vehicles, 46 buildings), fill every slot with furniture,
keep your survivors fed, and hold off the horde at midnight.

## Play

Open the GitHub Pages URL in Safari, then tap **Share → Add to Home Screen** to get a full-screen app.

## How it's built

Plain HTML, CSS and JavaScript modules. No build step, so any static host works.

| Path | What it holds |
|---|---|
| `src/data/bases.js` | Every base as data: floors, shape, roof, support, cab, windows, extras, colours, traits |
| `src/data/items.js` | Furniture and modules with their stats |
| `src/render/shell.js` | Assembles a base's cutaway from parts (body, roof, wheels, hulls, trees, stilts…) |
| `src/render/itemArt.js` | Procedural art for every item |
| `src/render/scene.js` | Sky, day/night lighting, fog, rain, the horde |
| `src/game.js` | Simulation: resources, survivors, scavenging, night attacks, save/load |
| `src/main.js` | Game loop, camera, touch input, UI |

### Adding a base

Add an entry to `BASES` in `src/data/bases.js`. Mix and match parts:

- `body`: `box` (default), `tube`, `taper`, `dome`, `tank`
- `roof`: `flat`, `curved`, `gable`, `hip`, `gambrel`, `conical`, `spire`, `dome`, `pagoda`, `mushroom`, `tent`, `battlement`, `sawtooth`, `pediment`, `glass`, `lamp`, `observatory`, `none`
- `support.type`: `ground`, `wheels`, `rails`, `hull`, `sub`, `stilts`, `tree`, `treads`, `blocks`, `balloon`, `skids`, `cable`, `rig`, `belly`, `rock`, `cliff`, `ferris`, `underground`
- `cab`: `van`, `bus`, `truck`, `semi`, `loco`, `steam`, `plow`
- `windows`: `band`, `few`, `grid`, `portholes`, `slits`, `arched`, `glass`, `none`
- `env`: `rail`, `road`, `town`, `field`, `forest`, `water`, `coast`, `swamp`, `snow`, `desert`, `mountain`, `tunnel`

### Running locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```
