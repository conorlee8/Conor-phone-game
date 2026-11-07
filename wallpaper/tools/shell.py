"""Shelter shells with bays (the modular base system).

A shell is the painted structure of a shelter (hull, floor slabs, frames,
pod doors, pipes); its bays are holes that pods fill. This draws the guide
the image model paints over: bays are flat pure green, which is keyed out of
the painting afterwards to make the holes, so each hole matches its painted
frame exactly. All bays are 16:9 at one floor height, so people are the same
size in every pod and each pod can be animated on its own.

    python3 wallpaper/tools/shell.py guide station      # wallpaper/shelters/station/guide.png + bays.json
    python3 wallpaper/tools/shell.py key station        # painted.png -> shell.png (holes) + check.jpg
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
GREEN = (0, 255, 0)
W, H = 1824, 1280

# Space station: a sphere with a central elevator shaft; rows of bays either side.
STATION = dict(cx=912, cy=640, r=622, hull=24, bay_h=104, slab=14, frame=12, shaft=56, core_rows=(3, 4, 5))


def station_bays(c, seed=7):
    """Staggered bays that grow outward from the shaft: single bays (16:9, one
    floor) and some double bays (16:9, two floors, for big rooms). Rows start
    at different offsets and gaps vary, so it reads as built up over time."""
    rng = np.random.default_rng(seed)
    bh, slab, fr = c["bay_h"], c["slab"], c["frame"]
    bw = round(bh * 16 / 9)
    rows_h = bh + slab
    ri = c["r"] - c["hull"] - 14
    top = c["cy"] - ri + 30
    nrows = int((2 * ri - 60) // rows_h)
    occupied = {(r, s): [] for r in range(nrows) for s in (-1, 1)}

    def inside(x0, y0, x1, y1):
        return all(math.hypot(x - c["cx"], y - c["cy"]) < ri for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)))

    def free(row, side, a, b):
        return all(b <= o0 or a >= o1 for o0, o1 in occupied[(row, side)])

    bays = []
    for row in range(nrows):
        y0 = top + row * rows_h
        for side in (-1, 1):
            d = c["shaft"] / 2 + fr + rng.integers(0, 34)          # distance from the shaft's centre
            while True:
                double = row + 1 < nrows and rng.random() < 0.22
                w, h = (2 * bw + fr, 2 * bh + slab) if double else (bw, bh)
                a, b = d, d + w
                x0, x1 = (c["cx"] - b, c["cx"] - a) if side < 0 else (c["cx"] + a, c["cx"] + b)
                y1 = y0 + h
                rows = [row, row + 1] if double else [row]
                if not inside(x0, y0, x1, y1):
                    if double:
                        continue_single = True
                        w, h = bw, bh
                        a, b = d, d + w
                        x0, x1 = (c["cx"] - b, c["cx"] - a) if side < 0 else (c["cx"] + a, c["cx"] + b)
                        y1 = y0 + h
                        rows = [row]
                        if not inside(x0, y0, x1, y1):
                            break
                    else:
                        break
                if all(free(r, side, a, b) for r in rows):
                    for r in rows:
                        occupied[(r, side)].append((a, b))
                    bays.append({"id": f"b{len(bays):02d}", "row": row, "side": side, "size": "double" if len(rows) == 2 else "single",
                                 "box": [round(x0), round(y0), round(x1), round(y1)]})
                    d = b + fr + rng.integers(0, 40)
                else:
                    blockers = [o1 for r in rows for o0, o1 in occupied[(r, side)] if not (b <= o0 or a >= o1)]
                    d = max(blockers) + fr + rng.integers(0, 20)
    # Rings by distance from the centre: the closest six are the starting core.
    def dist(b):
        x0, y0, x1, y1 = b["box"]
        return math.hypot((x0 + x1) / 2 - c["cx"], (y0 + y1) / 2 - c["cy"])
    order = sorted(bays, key=dist)
    for i, b in enumerate(order):
        b["ring"] = 0 if i < 6 else (1 if i < 6 + (len(bays) - 6) // 2 else 2)
    return bays


def guide(name):
    c = STATION
    out = ROOT / "shelters" / name
    out.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (W, H), (10, 14, 30))
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(3)
    for _ in range(500):                                         # stars
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        d.point((x, y), fill=(220, 225, 240))
    d.ellipse([-120, 1000, 260, 1380], fill=(46, 92, 160))         # planet
    cx, cy, r = c["cx"], c["cy"], c["r"]
    for side in (-1, 1):                                          # docking arms
        a0, a1 = (cx + side * (r - 10), cx + side * (r + 150))
        d.rectangle([min(a0, a1), cy - 40, max(a0, a1), cy + 40], fill=(92, 98, 108))
        mx = cx + side * (r + 230)
        d.rounded_rectangle([mx - 90, cy - 120, mx + 90, cy + 120], radius=40, fill=(96, 102, 112), outline=(60, 64, 72), width=6)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(104, 110, 120))   # hull
    ri = r - c["hull"]
    d.ellipse([cx - ri, cy - ri, cx + ri, cy + ri], fill=(58, 54, 52))  # interior structure
    d.rectangle([cx - c["shaft"] / 2, cy - ri + 20, cx + c["shaft"] / 2, cy + ri - 20], fill=(150, 200, 225))  # glass shaft
    bays = station_bays(c)
    for b in bays:
        x0, y0, x1, y1 = b["box"]
        d.rectangle([x0 - 8, y0 - 8, x1 + 8, y1 + 8], fill=(70, 66, 62))      # bay frame / door surround
        d.rectangle([x0, y0, x1, y1], fill=GREEN)
        d.rectangle([x0 - 8, y1 + 8, x1 + 8, y1 + 8 + c["slab"] - 8], fill=(44, 44, 46))  # floor slab
    for k in range(-6, 7):                                        # pipes along the shaft
        y = cy + k * 80
        d.line([cx - c["shaft"] / 2 - 6, y, cx - c["shaft"] / 2 - 6, y + 50], fill=(160, 120, 70), width=6)
    img.save(out / "guide.png")
    (out / "bays.json").write_text(json.dumps({"size": [W, H], "hull": [cx, cy, r], "bays": bays}, indent=1))
    rings = {}
    for b in bays:
        rings[b["ring"]] = rings.get(b["ring"], 0) + 1
    print(f"{len(bays)} bays ({rings}), bay {bays[0]['box'][2] - bays[0]['box'][0]}x{c['bay_h']}")


def key(name, src="painted.png"):
    """Turn the green bays of the painting into transparent holes.

    The image model moves and resizes bays a little, so the holes are read
    from the painting itself (each solid green patch), then matched to the
    planned bays for their ids and rings. Writes shell.png (holes are
    transparent), shell.json (each bay's hole and the 16:9 pod rectangle
    that covers it, with bleed hidden under the frame) and check.jpg."""
    import scipy.ndimage as nd
    out = ROOT / "shelters" / name
    meta = json.loads((out / "bays.json").read_text())
    p = np.asarray(Image.open(out / src).convert("RGB").resize(tuple(meta["size"]), Image.LANCZOS)).astype(np.int16)
    r, g, b = p[..., 0], p[..., 1], p[..., 2]
    green = (g > 150) & (g - np.maximum(r, b) > 80)
    cx, cy, hr = meta["hull"]
    yy, xx = np.mgrid[:green.shape[0], :green.shape[1]]
    green &= np.hypot(xx - cx, yy - cy) < hr
    lab, n = nd.label(green)
    sizes = nd.sum(green, lab, range(1, n + 1))
    objs = nd.find_objects(lab)
    keep = np.zeros(n + 1, bool)
    patches = []
    for i, s in enumerate(sizes):
        sl = objs[i]
        x0, y0, x1, y1 = sl[1].start, sl[0].start, sl[1].stop, sl[0].stop
        if s > 1500 and s / ((x1 - x0) * (y1 - y0)) > 0.7:          # a solid rectangle, not a stray green light
            keep[i + 1] = True
            patches.append([x0, y0, x1, y1])
    hole = keep[lab]
    # Take in the soft anti-aliased edge too: greenish pixels touching a hole.
    soft = (g - np.maximum(r, b) > 30) & (np.asarray(Image.fromarray((hole * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 127)
    hole |= soft
    alpha = np.where(hole, 0, 255).astype(np.uint8)

    def overlap(a, b):
        w = min(a[2], b[2]) - max(a[0], b[0])
        h = min(a[3], b[3]) - max(a[1], b[1])
        return max(w, 0) * max(h, 0)
    bays, used = [], set()
    for h in sorted(patches, key=lambda q: (q[1], q[0])):
        plan = max(meta["bays"], key=lambda bb: overlap(h, bb["box"]))
        if overlap(h, plan["box"]) == 0 or plan["id"] in used:
            print("  unmatched hole", h)
            continue
        used.add(plan["id"])
        # The pod is 16:9 and covers the hole plus a few pixels of bleed; the frame hides the rest.
        x0, y0, x1, y1 = h
        bleed = 6
        w, hh = x1 - x0 + 2 * bleed, y1 - y0 + 2 * bleed
        if w / hh > 16 / 9:
            hh = w * 9 / 16
        else:
            w = hh * 16 / 9
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        pod = [round(mx - w / 2), round(my - hh / 2), round(mx + w / 2), round(my + hh / 2)]
        bays.append({"id": plan["id"], "ring": plan["ring"], "size": plan["size"], "hole": h, "pod": pod})
    missing = [bb["id"] for bb in meta["bays"] if bb["id"] not in used]
    # Small green gaps inside a pod's rectangle (between railing bars in front of a room) are holes too.
    for i in range(n):
        if keep[i + 1]:
            continue
        sl = objs[i]
        x0, y0, x1, y1 = sl[1].start, sl[0].start, sl[1].stop, sl[0].stop
        for bb in bays:
            px0, py0, px1, py1 = bb["pod"]
            if x0 >= px0 - 6 and y0 >= py0 - 6 and x1 <= px1 + 6 and y1 <= py1 + 6:
                gap = lab[y0:y1, x0:x1] == i + 1
                gap = np.asarray(Image.fromarray((gap * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 127
                alpha[y0:y1, x0:x1][gap] = 0
                break
    # Despill: the painted rim right around each hole picks up a green glow; pull it back to neutral.
    holes = Image.fromarray(np.where(alpha == 0, 255, 0).astype(np.uint8))
    rim = (np.asarray(holes.filter(ImageFilter.MaxFilter(9))) > 127) & (alpha > 0)
    g_max = np.maximum(r, b)
    spill = rim & (g > g_max)
    p = p.copy()
    p[..., 1][spill] = g_max[spill]
    rgba = np.dstack([np.clip(p, 0, 255).astype(np.uint8), alpha])
    Image.fromarray(rgba, "RGBA").save(out / "shell.png")
    bays.sort(key=lambda bb: bb["id"])
    (out / "shell.json").write_text(json.dumps({"size": meta["size"], "hull": meta["hull"], "bays": bays}, indent=1))
    check = Image.fromarray(rgba, "RGBA")
    bg = Image.new("RGBA", check.size, (255, 0, 255, 255))
    bg.alpha_composite(check)
    d = ImageDraw.Draw(bg)
    ring_col = {0: (255, 255, 255), 1: (255, 200, 0), 2: (0, 200, 255)}
    for bb in bays:
        d.rectangle(bb["pod"], outline=ring_col[bb["ring"]], width=2)
        d.text((bb["hole"][0] + 4, bb["hole"][1] + 2), bb["id"], fill=(0, 0, 0))
    bg.convert("RGB").resize((1140, 800)).save(out / "check.jpg", quality=85)
    sz = sorted((bb["hole"][2] - bb["hole"][0], bb["hole"][3] - bb["hole"][1]) for bb in bays)
    print(f"{len(bays)} bays keyed, holes {sz[0]} to {sz[-1]}; missing: {missing or 'none'}")


if __name__ == "__main__":
    {"guide": guide, "key": key}[sys.argv[1]](*sys.argv[2:])
