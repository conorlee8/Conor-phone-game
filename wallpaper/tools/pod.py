"""Builds one Pod Planner job: the close-up to repaint, its mask and the prompt.

A pin marks a spot on the base painting (percent coordinates). The first
render crops a square around the pin from the base painting and enlarges it;
later renders start from whichever earlier render the pin is built on. Only
the middle of the square is masked for repainting, so neighbouring rooms stay.

    python3 wallpaper/tools/pod.py prep pin.json [--base previous.jpg]
    NODE_USE_ENV_PROXY=1 node wallpaper/tools/paint.mjs wallpaper/pods/work/<pin>/job.json
    python3 wallpaper/tools/pod.py finish wallpaper/pods/work/<pin>
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "raw" / "r8_inner.png"     # the locked base painting the pins sit on
WORK = ROOT / "pods" / "work"
SIZE = 1024
CROP = 520                                # base-painting pixels around the pin
HOLE = 0.56                               # share of the square that may change

STYLE = ("This is a close-up of one small part of a large painting of a cozy, crammed space station cutaway: "
         "lofi anime night painting with crisp, clean ink linework, warm lamplight, every room with its own colour "
         "and light, rooms of different sizes at staggered levels, pipes and cables everywhere.")
KEEP = ("Keep everything around it exactly as it is: the neighbouring rooms, walls, pipes, floors, lighting, colours "
        "and painting style, and keep the same camera angle, perspective and scale, with adults the same height as "
        "the other people in the image and dogs knee-high. Fill the pod with specific, unique detail that fits the "
        "description: objects, decor, food, gadgets, plants, and people busy doing things, each person a distinct "
        "individual. Any lettering is in English, small, part of the room, and spelled correctly. Nothing is empty "
        "or flat.")


def crop_box(pin):
    img = Image.open(BASE)
    W, H = img.size
    cx, cy = pin["x"] / 100 * W, pin["y"] / 100 * H
    x0 = int(min(max(0, cx - CROP / 2), W - CROP))
    y0 = int(min(max(0, cy - CROP / 2), H - CROP))
    return img, (x0, y0, x0 + CROP, y0 + CROP)


def prep(pin_path, base_render=None):
    pin = json.loads(Path(pin_path).read_text())
    pid = pin["id"]
    out = WORK / pid
    out.mkdir(parents=True, exist_ok=True)
    img, box = crop_box(pin)
    if base_render:
        src = Image.open(base_render).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
        mode = "revise"
    else:
        src = img.convert("RGB").crop(box).resize((SIZE, SIZE), Image.LANCZOS)
        mode = "first"
    src.save(out / "input.png")
    mask = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 255))
    m = int(SIZE * (1 - HOLE) / 2)
    ImageDraw.Draw(mask).rectangle([m, m, SIZE - m, SIZE - m], fill=(0, 0, 0, 0))
    mask.save(out / "mask.png")
    touch = pin.get("touch", "").strip() or "a cozy, lived-in room"
    who = pin.get("who", "").strip()
    lead = ("Repaint only the pod in the middle of the image so it becomes: " if mode == "first" else
            "This is the current version of the pod in the middle of the image. Repaint it to match this description, "
            "which may have been revised, keeping what already fits: ")
    prompt = " ".join(filter(None, [STYLE, lead + touch + ".", f"Who is here: {who}." if who else "", KEEP]))
    n = len([r for r in pin.get("renders", []) if r.get("kind") == "paint"]) + 1
    job = {"out": ".", "model": "gpt-image-2", "quality": "high",
           "assets": [{"id": f"render_{n}", "prompt": prompt, "size": f"{SIZE}x{SIZE}",
                       "images": ["input.png"], "mask": "mask.png"}]}
    (out / "job.json").write_text(json.dumps(job, indent=1))
    (out / "meta.json").write_text(json.dumps({"pin": pid, "box": box, "mode": mode, "render": n}))
    src.convert("RGB").save(out / "before.jpg", quality=88)
    print(out / "job.json")


def finish(work_dir):
    work = Path(work_dir)
    meta = json.loads((work / "meta.json").read_text())
    png = work / f"render_{meta['render']}.png"
    jpg = work / f"render_{meta['render']}.jpg"
    Image.open(png).convert("RGB").save(jpg, quality=88)
    print(jpg)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("prep")
    a.add_argument("pin")
    a.add_argument("--base")
    b = sub.add_parser("finish")
    b.add_argument("work")
    args = ap.parse_args()
    prep(args.pin, args.base) if args.cmd == "prep" else finish(args.work)
