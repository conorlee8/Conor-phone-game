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
7. **Place it in the station.** Export every pin (`ArtifactData list`
   collection `pins`, `out_dir: wallpaper/pods/work/_db`), run
   `python3 wallpaper/tools/master.py`, and republish the page with
   `files: {"station.jpg": "<abs path>/wallpaper/pods/station.jpg"}`. The map
   then shows the pod, and later pods are painted against it.
8. **On failure** set `status: "error"` and a plain `statusNote` the page shows
   (for example: "The image service is out of credits; add credits and generate
   again.").

Real people: when `who` names someone with an approved character sheet, add
that sheet to the job's `images` and name them in the prompt.

Later, approved pod renders get composited back into the master painting at
their `room` (base-painting pixels), then the cover is re-cut from the master.

# People: "draw character" messages

People live in the page's `people` collection: `{kind: person|dog, name,
photos: [asset ids], looks, fix, sheets: [{asset}], approved: asset id|null,
status, statusNote, order}`. The page sends
`Pod Planner: draw character <id> (<name>).` (or Conor says "draw <name>").

1. `ArtifactData get` `people/<id>`; write `{...data, id}` to
   `wallpaper/pods/work/_db/person.json`. Set `status: "working"`.
2. Download the photos: `Artifact read`, `url` = the page, `paths` = the photo
   asset ids, `out_dir` = `wallpaper/pods/work/_db/photos/<id>`. Look at them:
   skip any that aren't of this person or dog, and lead with the clearest face.
3. If redrawing (the person has `sheets`), also download the latest sheet and
   pass `--previous`; the prompt then applies `fix`.
   ```sh
   python3 wallpaper/tools/character.py prep wallpaper/pods/work/_db/person.json <photos…> [--previous <sheet>]
   NODE_USE_ENV_PROXY=1 node wallpaper/tools/paint.mjs wallpaper/pods/work/people/<id>/job.json
   python3 wallpaper/tools/character.py finish wallpaper/pods/work/people/<id>
   ```
4. Compare the sheet with the photos yourself before uploading. Upload
   `sheet_N.jpg` as an asset, append `{asset}` to `sheets`, set `status: "done"`.
   Conor approves it on the page (`approved` = that asset id).

Photos stay in `wallpaper/pods/work/` (ignored by git) and the page's asset
store. Never commit them.

# People in pods

A pin's `people` lists person ids. When generating it, for each one download
their approved sheet (or latest sheet) and their clearest face photo, and add
`refs: [{name, kind, looks, sheet: <path>, photo: <path>}]` to `pin.json`
before `pod.py prep`. The job passes them as extra reference images and names
them in the prompt; only the first image is masked and repainted.
