# Making the painted people move (handoff)

Conor wants every person and animal on the station to be alive and part of
the painting: eating, playing, working, sleeping, pod doors and traffic. Two
earlier tries were rejected:

- **Walking cutouts** over the painting (`world/js/cast.js`, behind
  `?residents=1`): they read as stickers on top of the picture.
- **Rooms rebuilt in layers** (emptied rooms plus furniture,
  `wallpaper/rooms/`, behind `wallpaper/rooms/enabled.json`): hard seams, rooms
  look cut off.

## The plan: animate the painting itself with a video model

1. `python3 wallpaper/tools/tiles.py cut` cuts the station (`wallpaper/pods/work/master.png`,
   or the committed `wallpaper/pods/station.jpg`) into 20 overlapping 640x360
   tiles, upscaled to 1280x720 (`wallpaper/video/tiles/`).
2. Animate each tile with a video model, camera locked, people come alive in
   place (prompt in `wallpaper/tools/veo.mjs`). Test ONE tile first and show
   Conor before doing all 20 (around 160 seconds of video, roughly $25-65 with
   Veo depending on the model; check current prices).
3. `python3 wallpaper/tools/tiles.py stitch` cross-fades the overlaps and the
   loop end into one seamless `wallpaper/video/station.mp4` (1824x1280, 24 fps).
   Already verified with stand-in clips (`--test`): no seams.
4. The Station app plays that video as its base layer instead of
   `assets/station.jpg`, keeping its lights, needs, care and capture on top.
   Later: thriving / okay / neglected versions of the video, swapped by the
   station's mood; the wallpaper camera records from it.

## Video model status

- OpenAI shut down Sora (`sora-2`, `sora-2-pro`) on 2026-09-24. No OpenAI video model.
- The Google Cloud token in the environment is invalid.
- Chosen: **Google Veo via the Gemini API**, key in `GEMINI_API_KEY`
  (environment settings). `NODE_USE_ENV_PROXY=1 node wallpaper/tools/veo.mjs models`
  lists usable models; `veo.mjs one wallpaper/video/tiles/t21.png /tmp/t21.mp4`
  for the first test. `veo.mjs` hasn't run against the live API yet.

## Conor's answers so far

- Packed like the painting. Actions: eat and drink, play, work, sleep, pod doors and traffic.
- Characters approved: Conor, Elliot, Colenzo (drawings in the Pod Planner's People).
- He wants every question as multiple choice, and short updates.
