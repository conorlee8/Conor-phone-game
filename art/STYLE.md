# Last Haven art direction

The goal is the look of the reference ads: hand-painted anime cutaways of cozy
shelters, warm inside, cold and dangerous outside.

## Look

- **Style:** anime / Studio Ghibli background art. Soft cel shading, thin ink
  lines, painterly textures, lots of lived-in detail.
- **Palette:** sage green, cream, rust, faded navy, with warm amber lamplight
  inside and grey-blue fog outside.
- **Mood:** safety vs danger. Every base shows the outside through windows or
  around its edges, where the horde waits in the mist.

## Camera

¾ top-down cutaway: from the front and above at about 35°, roof and front wall
removed. Every base and every item uses this one angle, so pieces fit together.

## How assets are made

1. `tools/blockout.js` draws a grey layout of the base in the game camera, with
   furniture slots built in (`art/guides/*_debug.png` shows the slots).
2. The image model paints over the guide, so the painting keeps the same walls,
   floor and windows. The interior is painted **empty**.
3. Furniture, characters and zombies are generated as separate pieces on a
   transparent background, in the same style and angle.
4. The game places each piece at its slot's anchor, scaled by the slot's
   pixels-per-unit, and adds lighting, fog, rain and glow in code.

Prompts and the asset list live in `art/assets.json`. Run `tools/gen-art.mjs`
to generate anything missing; raw output lands in `art/raw/`.

## Characters

No animation. Each survivor has a few painted poses (sleeping, standing guard,
sitting, cooking). Sleeping is baked into "occupied" versions of beds, which
looks far better than laying a sprite on top.

## Sample first

Only the train car is in scope until it looks right on a phone. After that, the
style is locked and the other bases are produced in batches.
