"""Cuts the painted sprite sheets into frames for the Station app.

Each sheet in wallpaper/sprites/raw/ is four poses in a row on a transparent
background. This finds each pose, trims it, scales the whole sheet so the
character's standing (or sitting, for animals) height matches its real size
on the painting, and packs the frames into one atlas per character with the
feet at the bottom edge of each frame.

    python3 wallpaper/tools/sprites.py
    # writes world/assets/sprites/<id>.png and world/data/sprites.json
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
RAW = ROOT / "wallpaper" / "sprites" / "raw"
OUT = ROOT / "world" / "assets" / "sprites"
META = ROOT / "world" / "data" / "sprites.json"
RES = 3            # atlas pixels per painting pixel, so close-up captures stay sharp

# Height in painting pixels of the reference frame (index), for each character.
SIZES = {
    "conor": (2, 84), "mara": (2, 78), "gus": (2, 74), "jules": (2, 76), "dee": (2, 80),
    "elliot": (2, 40), "colenzo": (2, 42),     # sitting dog, head to paws
    "ginger": (2, 17), "pixel": (2, 17),       # sitting cat
    "bolt": (2, 26),
    "mike": (2, 86), "theo": (2, 89), "ivy": (2, 74), "nate": (2, 80), "sky": (2, 52),
    "biscuit": (2, 25), "pepper": (2, 17), "kiwi": (2, 13), "zib": (2, 40), "zorp": (2, 38), "scrub": (2, 30),
}
NAMES = {
    "conor": ["walk", "walk2", "stand", "sit"], "mara": None, "gus": None, "jules": None, "dee": None,
    "elliot": ["walk", "walk2", "sit", "lie"], "colenzo": ["walk", "walk2", "sit", "lie"],
    "ginger": ["walk", "walk2", "sit", "lie"], "pixel": ["walk", "walk2", "sit", "lie"],
    "bolt": ["walk", "walk2", "stand", "carry"],
    "biscuit": ["walk", "walk2", "sit", "lie"], "pepper": ["walk", "walk2", "sit", "lie"], "kiwi": ["walk", "walk2", "sit", "fly"],
    "zib": ["walk", "walk2", "stand", "sit"], "zorp": ["walk", "walk2", "stand", "sit"], "scrub": ["walk", "walk2", "stand", "carry"],
}


def frames_of(img, want=4):
    """Split into `want` poses: cut on transparent columns, merge the closest
    pieces if there are too many, and split the widest piece at its thinnest
    column if poses touch."""
    a = img.getchannel("A").point(lambda v: 255 if v > 24 else 0)
    w, h = img.size
    px = a.load()
    count = [sum(1 for y in range(0, h, 2) if px[x, y]) for x in range(w)]
    runs, start = [], None
    for x, n in enumerate(count + [0]):
        if n and start is None:
            start = x
        if not n and start is not None:
            if x - start > 3:
                runs.append([start, x])
            start = None
    # Drop specks (a stray sparkle or a loose whisker).
    mass = [sum(count[x0:x1]) for x0, x1 in runs]
    runs = [r for r, m in zip(runs, mass) if m > max(mass) * 0.03]
    while len(runs) > want:
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = gaps.index(min(gaps))
        runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
    while len(runs) < want:
        i = max(range(len(runs)), key=lambda j: runs[j][1] - runs[j][0])
        x0, x1 = runs[i]
        lo, hi = x0 + (x1 - x0) // 5, x1 - (x1 - x0) // 5
        cut = min(range(lo, hi), key=lambda x: count[x])
        runs[i:i + 1] = [[x0, cut], [cut + 1, x1]]
    out = []
    for x0, x1 in runs:
        box = a.crop((x0, 0, x1, h)).getbbox()
        out.append(img.crop((x0, box[1], x1, box[3])))
    return out


def grade(img):
    """Dim and warm the sprite a little so it sits in the painting's lamplight."""
    from PIL import ImageEnhance
    rgb, a = img.convert("RGB"), img.getchannel("A")
    rgb = ImageEnhance.Brightness(rgb).enhance(0.8)
    rgb = ImageEnhance.Color(rgb).enhance(0.88)
    r, g, b = rgb.split()
    rgb = Image.merge("RGB", (r.point(lambda v: min(255, v * 1.04)), g, b.point(lambda v: v * 0.9)))
    out = rgb.convert("RGBA"); out.putalpha(a)
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    for sid, (ref, size) in SIZES.items():
        src = RAW / f"{sid}.png"
        if not src.exists():
            print("missing", src.name)
            continue
        fr = frames_of(Image.open(src).convert("RGBA"))
        if len(fr) != 4:
            print(f"{sid}: found {len(fr)} poses, expected 4")
        k = size * RES / fr[min(ref, len(fr) - 1)].height
        fr = [f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS) for f in fr]
        W, H = sum(f.width for f in fr) + 4 * (len(fr) - 1), max(f.height for f in fr)
        atlas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        boxes, x = [], 0
        for f in fr:
            atlas.paste(f, (x, H - f.height), f)
            boxes.append([x, H - f.height, f.width, f.height])
            x += f.width + 4
        atlas = grade(atlas)
        atlas.save(OUT / f"{sid}.png", optimize=True)
        names = NAMES.get(sid) or ["walk", "walk2", "stand", "sit"]
        meta[sid] = {"src": f"assets/sprites/{sid}.png", "res": RES,
                     "frames": {n: b for n, b in zip(names, boxes)}}
        print(f"{sid}: {len(fr)} poses, {W}x{H}")
    META.write_text(json.dumps(meta))


if __name__ == "__main__":
    main()
