"""Builds a character-sheet job from someone's photos, for the Pod Planner's People.

The sheet is where likeness gets settled at a big size: a large face portrait,
a three-quarter head and a full-body pose, in the station's painting style.
Once Conor approves it, pod jobs use it (plus a face photo) as references.

    python3 wallpaper/tools/character.py prep person.json photo1.jpg photo2.jpg ... [--previous sheet.jpg]
    NODE_USE_ENV_PROXY=1 node wallpaper/tools/paint.mjs wallpaper/pods/work/people/<id>/job.json
    python3 wallpaper/tools/character.py finish wallpaper/pods/work/people/<id>
"""
import argparse
import json
import shutil
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "pods" / "work" / "people"
MAX_PHOTOS = 6

STYLE = ("Character reference sheet in the style of a lofi anime night painting with clean ink linework and soft "
         "painted shading, the style of a cozy space station cutaway illustration.")

PERSON = ("The reference photos all show one real person, {name}. Draw THIS EXACT PERSON so that their friends "
          "recognize them instantly. Keep every feature exactly as in the photos: face shape, eye shape and spacing, "
          "eyebrows, nose shape and size, mouth and lips, jawline and chin, ears, hairline, hairstyle and hair colour, "
          "skin tone, facial hair, glasses, freckles or marks, age, body build and height. Stylise only the rendering, "
          "never the features: no generic anime face, no slimming, no de-ageing, no beautifying. Layout on one sheet: "
          "on the left a large head-and-shoulders portrait looking at the viewer, filling most of the height; in the "
          "middle the same head at a three-quarter angle; on the right a full-body standing pose in the kind of clothes "
          "they wear in the photos. Plain warm paper background, soft even light, no text, no other people.")

DOG = ("The reference photos all show one real dog, {name}. Draw THIS EXACT DOG so that its owner recognizes it "
       "instantly. Keep everything exactly as in the photos: breed and build, coat colour and shade, every white "
       "marking and exactly where it is (chest, paws, face blaze, muzzle), the dark mask, ear shape and how the ears "
       "sit, eye colour, muzzle shape, tail, size and collar. Layout on one sheet: on the left a large portrait of the "
       "head looking at the viewer; in the middle the head at a three-quarter angle; on the right the whole dog "
       "standing, seen from the side. Plain warm paper background, soft even light, no text, no people.")


def prep(person_path, photos, previous=None):
    m = json.loads(Path(person_path).read_text())
    pid = m["id"]
    out = WORK / pid
    if out.exists():
        for f in out.glob("ref_*"):
            f.unlink()
    out.mkdir(parents=True, exist_ok=True)
    images = []
    for i, src in enumerate(photos[:MAX_PHOTOS]):
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        im.thumbnail((1536, 1536))
        name = f"ref_{i + 1}.jpg"
        im.save(out / name, quality=92)
        images.append(name)
    if previous:
        shutil.copy(previous, out / "ref_previous.jpg")
        images.append("ref_previous.jpg")
    body = (DOG if m.get("kind") == "dog" else PERSON).format(name=m.get("name") or "them")
    parts = [STYLE, body]
    if (m.get("looks") or "").strip():
        parts.append(f"Notes from people who know them: {m['looks'].strip()}.")
    if previous:
        parts.append("The last reference image is the previous drawing of them, not a photo. "
                     f"Fix this: {(m.get('fix') or '').strip() or 'make it look more like the photos'}. "
                     "Keep everything about it that already looks like them, but take every feature from the photos.")
    n = len(m.get("sheets") or []) + 1
    job = {"out": ".", "model": "gpt-image-2", "quality": "high",
           "assets": [{"id": f"sheet_{n}", "prompt": " ".join(parts), "size": "1536x1024", "images": images}]}
    (out / "job.json").write_text(json.dumps(job, indent=1))
    (out / "meta.json").write_text(json.dumps({"id": pid, "sheet": n}))
    print(out / "job.json")


def finish(work_dir):
    work = Path(work_dir)
    meta = json.loads((work / "meta.json").read_text())
    src = work / f"sheet_{meta['sheet']}.png"
    dst = work / f"sheet_{meta['sheet']}.jpg"
    Image.open(src).convert("RGB").save(dst, quality=90)
    print(dst)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("prep")
    a.add_argument("person")
    a.add_argument("photos", nargs="+")
    a.add_argument("--previous")
    b = sub.add_parser("finish")
    b.add_argument("work")
    args = ap.parse_args()
    prep(args.person, args.photos, args.previous) if args.cmd == "prep" else finish(args.work)
