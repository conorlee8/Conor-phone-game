"""Builds one Pod Planner job: the close-up to repaint, its mask and the prompt.

Each pin needs a `room`: the pod's interior as [x0, y0, x1, y1] in base-painting
pixels (find it by zooming on the painting; the layout guide's boxes drifted
in painting, so they can't be used). The job crops a square around the room
with plenty of neighbouring rooms for context, masks exactly the room, and
after painting pastes only the room back, so nothing around it can change and
the room keeps its true size.

    python3 wallpaper/tools/pod.py prep pin.json [--base previous_render.png]
    NODE_USE_ENV_PROXY=1 node wallpaper/tools/paint.mjs wallpaper/pods/work/<pin>/job.json
    python3 wallpaper/tools/pod.py finish wallpaper/pods/work/<pin>
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "raw" / "r8_inner.png"     # the locked base painting the pins sit on
WORK = ROOT / "pods" / "work"
SIZE = 1024
CONTEXT = 2.6                             # crop side = this × the room's longer side
ADULT = 85                                # a standing adult's height in base pixels

STYLE = ("This is a close-up of one small part of a large painting of a cozy, crammed space station cutaway: "
         "lofi anime night painting with ink linework, dim warm lamplight, every room with its own colour and light, "
         "rooms of different sizes at staggered levels, pipes and cables everywhere.")


def crop_for(room, W, H):
    x0, y0, x1, y1 = room
    side = int(max(x1 - x0, y1 - y0) * CONTEXT)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    cx0 = int(min(max(0, cx - side / 2), W - side))
    cy0 = int(min(max(0, cy - side / 2), H - side))
    return (cx0, cy0, cx0 + side, cy0 + side)


def to_crop(room, crop):
    k = SIZE / (crop[2] - crop[0])
    return [round((room[0] - crop[0]) * k), round((room[1] - crop[1]) * k),
            round((room[2] - crop[0]) * k), round((room[3] - crop[1]) * k)]


def prep(pin_path, base_render=None):
    pin = json.loads(Path(pin_path).read_text())
    pid, room = pin["id"], pin["room"]
    out = WORK / pid
    out.mkdir(parents=True, exist_ok=True)
    base = Image.open(BASE).convert("RGB")
    crop = crop_for(room, *base.size)
    original = base.crop(crop).resize((SIZE, SIZE), Image.LANCZOS)
    original.save(out / "original.png")
    src = Image.open(base_render).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS) if base_render else original
    src.save(out / "input.png")
    # Reference images for the real people and pets in this pod: each one's
    # approved character sheet and a face photo, downloaded beforehand.
    images = ["input.png"]
    ref_lines = []
    for i, ref in enumerate(pin.get("refs", [])):
        idx = []
        for kind in ("sheet", "photo"):
            if ref.get(kind):
                name = f"ref_{i + 1}_{kind}.jpg"
                Image.open(ref[kind]).convert("RGB").save(out / name, quality=92)
                images.append(name)
                idx.append(f"image {len(images)} ({'their approved character drawing' if kind == 'sheet' else 'a photo'})")
        if idx:
            what = "this exact dog" if ref.get("kind") == "dog" else "this exact person"
            looks = f" ({ref['looks'].strip()})" if (ref.get("looks") or "").strip() else ""
            ref_lines.append(f"{ref['name']}{looks}: {what}, shown in reference " + " and ".join(idx) + ".")
    r = to_crop(room, crop)
    mask = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 255))
    ImageDraw.Draw(mask).rectangle(r, fill=(0, 0, 0, 0))
    mask.save(out / "mask.png")
    outline = original.copy()
    ImageDraw.Draw(outline).rectangle(r, outline=(244, 160, 184), width=4)
    outline.save(out / "before.jpg", quality=88)

    room_h = room[3] - room[1]
    stand = min(95, round(ADULT / room_h * 100))
    touch = pin.get("touch", "").strip() or "a cozy, lived-in room"
    who = pin.get("who", "").strip()
    revise = " It already shows an earlier version of this room: keep what fits the description." if base_render else ""
    prompt = " ".join(filter(None, [
        STYLE,
        "Repaint ONLY the inside of the one small room in the transparent area of the mask, between its own walls, "
        "ceiling and floor slab. Everything outside it stays exactly as it is." + revise,
        f"The room becomes: {touch}.",
        ("Real people and pets in this room, painted from the reference images so their friends recognize them: "
         + " ".join(ref_lines) + " They are small here, so carry their likeness through face shape, skin tone, "
         "hairstyle and hair colour, facial hair, glasses, build and their clothes, exactly as in the references, "
         "in this painting's style. Reference images after the first are references only: never paste them in."
         ) if ref_lines else "",
        f"Also here: {who}." if who else "",
        f"Keep the room its current size; it is small. A standing adult is about {stand}% of the room's height, "
        "exactly the size of the people in the neighbouring rooms, and seated people are smaller; dogs are knee-high. "
        "Only two or three people fit. Pack it with small, specific objects that suit the description.",
        "Any sign is small and part of the room, no bigger than the signs on the neighbouring rooms, in English and "
        "spelled correctly.",
        "Match the surrounding painting exactly: the same ink line weight, grainy painted texture, dim night lighting, "
        "saturation and level of detail as the neighbouring rooms. Do not make it brighter, cleaner or sharper than "
        "the rooms around it.",
    ]))
    n = len([x for x in pin.get("renders", []) if x.get("kind") == "paint"]) + 1
    job = {"out": ".", "model": "gpt-image-2", "quality": "high",
           "assets": [{"id": f"render_{n}", "prompt": prompt, "size": f"{SIZE}x{SIZE}",
                       "images": images, "mask": "mask.png"}]}
    (out / "job.json").write_text(json.dumps(job, indent=1))
    (out / "meta.json").write_text(json.dumps({"pin": pid, "room": room, "crop": crop, "render": n}))
    print(out / "job.json")


def finish(work_dir):
    """Paste only the room from the painted result onto the untouched close-up."""
    work = Path(work_dir)
    meta = json.loads((work / "meta.json").read_text())
    painted = Image.open(work / f"render_{meta['render']}.png").convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
    original = Image.open(work / "original.png").convert("RGB")
    r = to_crop(meta["room"], meta["crop"])
    m = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(m).rectangle([r[0] + 3, r[1] + 3, r[2] - 3, r[3] - 3], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(3))
    out = Image.composite(painted, original, m)
    out.save(work / f"pod_{meta['render']}.png")
    out.save(work / f"pod_{meta['render']}.jpg", quality=88)
    # The pod at its true size inside the whole painting, for checking the fit.
    base = Image.open(BASE).convert("RGB")
    c = meta["crop"]
    base.paste(out.resize((c[2] - c[0], c[3] - c[1]), Image.LANCZOS), (c[0], c[1]))
    base.save(work / f"context_{meta['render']}.jpg", quality=90)
    print(work / f"pod_{meta['render']}.jpg")


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
