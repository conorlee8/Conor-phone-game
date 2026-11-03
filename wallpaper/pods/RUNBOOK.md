# Pod Planner: handling "generate pin" messages

The Pod Planner page (https://claude.ai/artifact/KPF1KShwp4EHMLBdkxrNcy) marks
a pin `status: "queued"` and messages this session:
`Pod Planner: generate pin <id> (#<n>).` Handle it like this.

1. **Read the pin.** `ArtifactData get` collection `pins`, doc `<id>`, with
   `out_dir: wallpaper/pods/work/_db`. Write `{...data, id}` to
   `wallpaper/pods/work/_db/pin.json`. Note the doc `version` for `if_version`.
2. **Mark it working.** `ArtifactData update` `{status: "working", statusNote: ""}`.
3. **Pick the base.** If `pin.base` is set, or the pin has a `kind: "paint"`
   render, download that asset (`Artifact read`, `url` = the page, `path` =
   asset id) and pass it as `--base`. Otherwise the job crops the locked base
   painting (`wallpaper/raw/r8_inner.png`) around the pin.
4. **Build and paint.**
   ```sh
   python3 wallpaper/tools/pod.py prep wallpaper/pods/work/_db/pin.json [--base <file>]
   NODE_USE_ENV_PROXY=1 node wallpaper/tools/paint.mjs wallpaper/pods/work/<id>/job.json
   python3 wallpaper/tools/pod.py finish wallpaper/pods/work/<id>
   ```
   Look at the render before uploading.
5. **Upload and record.** `Artifact publish` with `url` = the page, `asset: true`,
   `file_path` = the render jpg. If the pin has no renders yet, upload
   `before.jpg` too as `kind: "current"` first. Append
   `{asset, kind: "paint", touch, who, box}` to `renders`, clear `base`
   (`{"__delete__": true}`), set `status: "done"`.
6. **On failure** set `status: "error"` and a plain `statusNote` the page shows
   (for example: "The image service is out of credits; add credits and generate
   again.").

Real people: when `who` names someone with an approved character sheet, add
that sheet to the job's `images` and name them in the prompt.

Later, approved pod renders get composited back into the master painting at
their `box` (base-painting pixels), then the cover is re-cut from the master.
