# Pod Planner: handling "generate pin" messages

The Pod Planner page (https://claude.ai/artifact/KPF1KShwp4EHMLBdkxrNcy) marks
a pin `status: "queued"` and wakes this session with
`Pod Planner: generate pin <id> (#<n>).`, first as a comment sent to Claude on
the page, else through Claude Code Remote `send_message`; if both fail, Conor
says "generate pin <n>" in chat. Any queued pin found in the store is a
request too. Handle it like this.

1. **Read the pin.** `ArtifactData get` collection `pins`, doc `<id>`, with
   `out_dir: wallpaper/pods/work/_db`. Write `{...data, id}` to
   `wallpaper/pods/work/_db/pin.json`. Note the doc `version` for `if_version`.
2. **Find the pod.** If the pin has no `room`, zoom on `wallpaper/raw/r8_inner.png`
   around the pin with a pixel grid and read off the room's interior
   (between its walls, ceiling and floor slab) as `[x0, y0, x1, y1]` in base
   pixels. The layout guide's boxes don't match the painting, so don't use
   them. Add `room` to `pin.json` and save it on the pin so the page outlines it.
   Never repaint more than that one room: a bigger area makes one oversized
   room with oversized people that swallows its neighbours.
3. **Mark it working.** `ArtifactData update` `{status: "working", statusNote: ""}`.
4. **Pick the base.** If `pin.base` is set, or the pin has a `kind: "paint"`
   render, download that asset (`Artifact read`, `url` = the page, `path` =
   asset id) and pass it as `--base`. Otherwise the job crops the locked base
   painting (`wallpaper/raw/r8_inner.png`) around the pin.
5. **Build and paint.**
   ```sh
   python3 wallpaper/tools/pod.py prep wallpaper/pods/work/_db/pin.json [--base <file>]
   NODE_USE_ENV_PROXY=1 node wallpaper/tools/paint.mjs wallpaper/pods/work/<id>/job.json
   python3 wallpaper/tools/pod.py finish wallpaper/pods/work/<id>
   ```
   `finish` pastes only the room back onto the untouched close-up (`pod_N.jpg`)
   and writes `context_N.jpg`, the whole painting with the pod in place. Look
   at both before uploading.
6. **Upload and record.** `Artifact publish` with `url` = the page, `asset: true`,
   `file_path` = `pod_N.jpg`. If the pin has no renders yet, upload
   `before.jpg` (it has the room outlined) too as `kind: "current"` first.
   Append `{asset, kind: "paint", touch, who}` to `renders`, clear `base`
   (`{"__delete__": true}`), set `status: "done"`.
7. **On failure** set `status: "error"` and a plain `statusNote` the page shows
   (for example: "The image service is out of credits; add credits and generate
   again.").

Real people: when `who` names someone with an approved character sheet, add
that sheet to the job's `images` and name them in the prompt.

Later, approved pod renders get composited back into the master painting at
their `room` (base-painting pixels), then the cover is re-cut from the master.
