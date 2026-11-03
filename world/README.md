# Station

Conor's living space station: a Tamagotchi-style world on top of the painted
cutaway, and a camera that grabs any moment as a pair of iPhone Duo wallpapers.

Open `world/` on the GitHub Pages site in Safari, then Share → Add to Home Screen.

| Path | What it holds |
|---|---|
| `data/world.js` | Needs, places, care actions, neglect rules and the station's little moments |
| `data/lights.json` | Every lamp, screen and beacon in the painting (`wallpaper/tools/lights.py`) |
| `assets/station.jpg` | The published station painting (`wallpaper/tools/master.py`) |
| `js/render.js` | Draws the painting plus all the motion, as a pure function of time and state |
| `js/app.js` | Simulation (needs drain in real time, also while you're away), controls, capture |

Preview moods without touching your save: `?demo=thriving`, `?demo=struggling`,
`?demo=neglected`. `?speed=3600` makes an hour pass every second.

## Publishing from the Pod Planner

"Publish to my world" asks Claude to export the pins, run
`wallpaper/tools/master.py` and `wallpaper/tools/lights.py`, copy
`wallpaper/pods/station.jpg` to `world/assets/station.jpg`, and push.
