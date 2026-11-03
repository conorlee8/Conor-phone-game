# Duo wallpaper brief

A pair of iPhone Duo wallpapers: a busy cutaway of a cozy space station where
Conor, his girlfriend, family, friends and his two boxers all live.

## Screens

- **Cover (closed):** 1398×2034 portrait. A zoomed-in vertical slice through the
  middle of the station. People are bigger here, so faces read.
- **Inner (open):** 2670×1878 landscape. The whole spherical station in cutaway,
  with docking modules. Opening the phone "zooms out".
- Each screen gets its own wallpaper. Keep the top quarter calm (stars) for the
  lock-screen clock.

## Look

- Round 4/5 is the target: lofi anime night painting (tests B and D) with the
  crisp ink linework of the watercolor test (A).
- Night glow, but every room has its own color and light, never all amber.
- Lead palettes: ocean (navy, aqua, coral), neon night (magenta, cyan, violet),
  retro 70s (burnt orange, mustard, teal).
- People slightly larger than Biesty's, smaller than the bunker ads; slightly
  chunky storybook proportions.
- Writing only where it exists in the world (signs, packaging, posters), in English.

## Cast

Conor, girlfriend, mom, sister, 10 friends, and two boxers: **Elliot** and
**Colenzo**. Photos and notes live in the Crew Manifest artifact
(https://claude.ai/artifact/FWqKHdZdffL4Uz2aHpj8ra). Photos never go in git.

## Inventory picks (from the Station Inventory artifact)

- **Tech:** cozy mix of 90s, Y2K and future, leaning 90s with specific nods
  (N64-style console, Nickelodeon-style slime, DBZ-style posters). Arcade
  cabinets, CRTs, RGB gaming PCs, retro consoles, holograms, projectors, helper
  robots, robot vacuums, drones, radio rigs, neon, vending machines, lava lamps.
- **Food:** dumplings, ramen, hot pot, sushi conveyor, skewers, pizza, tacos,
  breakfast diner, brewery, steakhouse.
- **Places:** arcade, gym, bath house, barber, record store, movie theater,
  bookshop, plant nursery, pub, basketball court, ping pong and pool, post
  office, skate ramp, shuttle repair garage, dog groomer and vet, comic shop.
- **Home:** loft beds, couches buried in blankets, overflowing bookshelves, fish
  tanks, posters, egg chairs, big windows, fireplace, hot tub, rugs, string lights.
- **Plants:** hydroponic veggies, fruit trees, bonsai, hanging vines, moss walls,
  monsteras, cacti, algae tanks, salt and freshwater fish tanks.
- **Doing:** gaming, cooking, gardening, working out, watching sports, grilling,
  partying, stargazing, skateboarding, reading, jamming in a band, fixing robots,
  a dab rig in a lounge.
- **Creatures:** more dogs, cats, fish, birds, friendly little aliens. Only two
  real boxers, but boxer look-alikes can hide around the station.
- **Getting around:** glass elevators, pneumatic tubes, scooters and
  skateboards, zip lines.
- **Hidden details:** friends' faces on posters, a tiny copy of the station,
  inside jokes on signs, hometown on a screen, hidden boxers, holiday
  decorations (Christmas, Halloween, Thanksgiving).

## How it's made (from round 6 on)

- `tools/blockout.py` grows an off-grid station layout (seed 40) with people
  and dog markers at true scale, crawlspaces, hull pods and astronauts. No
  sign text in the guide: shop names go in the prompt and the painter makes
  the signs.
- `tools/paint.mjs` paints over the guide (round 8 is the current favorite).
- Plan for the final: lock a base painting, make the cover a sharpened zoom of
  the open view (same pods, same people), then repaint pod by pod with edit
  masks for personal touches and real people from character sheets.

## Pages

- Crew Manifest (photos and notes): https://claude.ai/artifact/FWqKHdZdffL4Uz2aHpj8ra
- Station Inventory (picks): https://claude.ai/artifact/XSEa4SbAtH2p7jo6U8FrzD
- Pod Planner (pins on the painting for personal touches): https://claude.ai/artifact/KPF1KShwp4EHMLBdkxrNcy

## Still open

- OpenAI image credits ran out on Nov 3; painting resumes once topped up.
- Station name, hometown, inside jokes, pun level.
- Photos and notes for everyone.
- Bring the room colors back from amber; fix misspelled signs.
