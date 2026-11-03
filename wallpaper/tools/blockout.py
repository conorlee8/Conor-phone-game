"""Draws the layout guide the image model paints over.

The station grows the way a real one would: rooms of different widths and
heights are dropped in one at a time from the bottom up, each landing on
whatever is below it, so floors never line up into a grid. Every room is
drawn in one-point perspective with its own depth, and grey figures mark
people and dogs at true scale (1.75 m adults, knee-high dogs), so the
painting keeps everyone the same size.

One layout, two cameras: the wide open-screen view and a zoomed portrait
slice for the cover share the same architecture.

    python3 wallpaper/tools/blockout.py            # writes wallpaper/guides/*.png
    python3 wallpaper/tools/blockout.py --seed 7   # a different station
"""
import argparse
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "guides"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

R_IN, HULL = 18.0, 1.1          # sphere radius inside the hull, hull thickness (m)
R_OUT = R_IN + HULL
SLAB = 0.35                      # floor slab between stacked rooms (m)
F = 22.0                         # perspective focal distance (m)
VP = (0.0, 6.0)                  # vanishing point, a little above centre (m)
ATRIUM = (-1.6, 2.4)             # open shaft through the middle (x range, m)

SPECIAL = [  # (sign or None, width, height, extra)
    ("DOG PARK", 9.0, 4.2, {"dogs": 2, "boxers": True}),
    (None, 4.6, 6.2, {"kind": "reef"}),            # two-storey reef tank
    (None, 7.5, 6.0, {"kind": "court"}),           # basketball court
    ("CINEMA", 6.5, 4.4, {}),
    (None, 6.0, 4.0, {"kind": "skate"}),
    ("NURSERY", 5.5, 4.0, {"kind": "nursery"}),
]
SIGNS = ["NOODLES", "DUMPLINGS", "HOT POT", "SUSHI", "SKEWERS", "PIZZA", "TACOS", "DINER",
         "STEAKHOUSE", "BREWERY", "ARCADE", "RECORDS", "COMICS", "BOOKS", "BARBER", "GYM",
         "BATH HOUSE", "POST", "VET", "GROOMER", "REPAIRS", "PUB", "GAME LOUNGE"]

# Ocean, neon night and retro 70s, plus a few warm creams so it is not all neon.
TINTS = ["#6fd3c9", "#f08a76", "#d0569b", "#4cc3e0", "#8e6ad8", "#e07a3a", "#d9a62e", "#2f9c95",
         "#3b5ba8", "#9be3cf", "#f6a6c1", "#e8d9b8", "#f2c879", "#e8d9b8"]
FLOORS = ["#a98d6a", "#9b8063", "#8f9a9c", "#b39a78", "#7f8c80"]


def build(seed):
    rng = random.Random(seed)
    res = 0.25
    xs = [-R_IN + (i + 0.5) * res for i in range(int(2 * R_IN / res))]
    bottom = [-math.sqrt(max(0.0, R_IN ** 2 - x ** 2)) for x in xs]
    top = [-b for b in bottom]
    blocked = [ATRIUM[0] <= x <= ATRIUM[1] for x in xs]
    specials = SPECIAL[:]
    signs = SIGNS[:]
    rng.shuffle(signs)
    rooms = []

    # Start each column on a stepped floor that follows the hull curve.
    sky = [math.ceil((b + 0.4) / 1.0) * 1.0 for b in bottom]
    tol = 0.35

    def ok(k):
        return 0 <= k < len(xs) and not blocked[k] and sky[k] < top[k] - 2.4

    while True:
        open_cols = [k for k in range(len(xs)) if ok(k)]
        if not open_cols:
            break
        low = sorted(open_cols, key=lambda k: sky[k])[: max(1, len(open_cols) // 15)]
        i = rng.choice(low)
        tol = rng.choice([0.35, 0.35, 1.4])
        L = R = i
        while ok(L - 1) and abs(sky[L - 1] - sky[i]) <= tol:
            L -= 1
        while ok(R + 1) and abs(sky[R + 1] - sky[i]) <= tol:
            R += 1
        run = (R - L + 1) * res
        if run < 2.4:
            # Too narrow for a room: fill it with machinery up to a neighbour's level.
            nb = [sky[k] for k in (L - 1, R + 1) if 0 <= k < len(xs) and not blocked[k] and sky[k] > sky[i]]
            lift = min(nb) if nb else sky[i] + 1.0
            for k in range(L, R + 1):
                sky[k] = min(top[k], lift)
            continue

        mid = abs(sky[i]) < R_IN * 0.7
        fits = [sp for sp in specials if run >= sp[1] * 0.75]
        if fits and mid and rng.random() < 0.6:
            sp = fits[0]
            specials.remove(sp)
            sign, w, h, extra = sp
        else:
            sign, extra = None, {}
            w = rng.choice([2.6, 3.0, 3.4, 3.8, 4.4, 5.0, 5.6, 6.4])
            h = rng.choice([2.7, 2.9, 3.1, 3.3, 3.6, 3.6, 4.4])
            if signs and rng.random() < 0.38:
                sign = signs.pop()
        w = min(w, run)
        if run - w < 2.4:
            w = run                      # don't leave a sliver beside it
        n = int(round(w / res))
        start = L if rng.random() < 0.5 else R + 1 - n
        cols = range(start, start + n)
        floor = max(sky[k] for k in cols)
        x0 = xs[start] - res / 2
        room = {"x0": x0, "x1": x0 + w, "y0": floor, "y1": floor + h, "sign": sign,
                "depth": rng.choice([3.0, 4.0, 5.0, 6.5, 8.0]) if not extra.get("kind") else 6.0,
                "tint": rng.choice(TINTS), "floor": rng.choice(FLOORS),
                "balcony": rng.random() < 0.18, "mezz": h >= 4.0 and not extra, **extra}
        pts = [(x0 + w * (a + 0.5) / 6, floor + h * (b + 0.5) / 4) for a in range(6) for b in range(4)]
        if sum(math.hypot(px, py) < R_IN for px, py in pts) >= len(pts) * 0.55:
            rooms.append(room)
        for k in cols:
            sky[k] = floor + h + SLAB

    # People and dogs, standing on each floor at true scale.
    for r in rooms:
        r["people"] = []
        w = r["x1"] - r["x0"]
        count = r.get("dogs") and 3 or rng.choice([0, 1, 1, 2, 2, 3]) if w > 3 else rng.choice([0, 1, 1, 2])
        if r.get("kind") == "court":
            count = 5
        for _ in range(count):
            r["people"].append((rng.uniform(r["x0"] + 0.5, r["x1"] - 0.5), -rng.choice([0.6, 1.0, 1.6, 2.6])))
        r["animals"] = []
        for _ in range(r.get("dogs", 0)):
            r["animals"].append(("dog", rng.uniform(r["x0"] + 1, r["x1"] - 1.5), -rng.uniform(0.8, 2.0)))
        if not r.get("dogs") and rng.random() < 0.12:
            r["animals"].append(("dog", rng.uniform(r["x0"] + 0.6, r["x1"] - 1.4), -0.8))

    # Outer rooms sometimes keep their hull plating, so the cut line steps.
    for r in rooms:
        cx = (r["x0"] + r["x1"]) / 2
        cy = (r["y0"] + r["y1"]) / 2
        r["closed"] = math.hypot(cx, cy) > R_IN * 0.8 and rng.random() < 0.4 and not r.get("kind") and not r.get("dogs")

    bridges = sorted(rng.sample([y for y in range(-12, 13, 3)], 4))
    pipes = []
    for _ in range(4):
        y = rng.uniform(-12, 12)
        x = rng.uniform(-R_IN, -R_IN * 0.3)
        pts = [(x, y)]
        for _ in range(4):
            x += rng.uniform(4, 10)
            pts.append((x, y))
            y += rng.choice([-3, -1.5, 1.5, 3])
            pts.append((x, y))
        pipes.append(pts)
    return {"rooms": rooms, "bridges": bridges, "pipes": pipes, "seed": seed}


class Cam:
    def __init__(self, W, H, x0, y_top, width_m, ss=2):
        self.W, self.H, self.ss = W * ss, H * ss, ss
        self.k = self.W / width_m
        self.x0, self.y_top = x0, y_top

    def p(self, x, y, z=0.0):
        s = F / (F - z)
        x = VP[0] + (x - VP[0]) * s
        y = VP[1] + (y - VP[1]) * s
        return ((x - self.x0) * self.k, (self.y_top - y) * self.k)

    def m(self, v):
        return v * self.k


def draw_person(d, cam, x, z, y0, fill="#d8d8d8", edge="#4a4a4a"):
    s = F / (F - z)
    hx, hy = cam.p(x, y0 + 1.6, z)
    fx, fy = cam.p(x, y0, z)
    h = fy - hy
    r = cam.m(0.13) * s
    bw = cam.m(0.24) * s
    d.ellipse([hx - r, hy - r, hx + r, hy + r], fill=fill, outline=edge, width=max(1, int(r * 0.15)))
    d.rounded_rectangle([fx - bw, hy + r * 1.1, fx + bw, fy], radius=bw * 0.6, fill=fill, outline=edge,
                        width=max(1, int(r * 0.15)))


def draw_dog(d, cam, x, z, y0, fill="#d9b98c", edge="#4a4a4a"):
    s = F / (F - z)
    k = cam.m(1) * s
    bx, by = cam.p(x, y0 + 0.42, z)
    lw = max(1, int(k * 0.05))
    for lx in (0.12, 0.62):
        d.line([bx + lx * k, by, bx + lx * k, by + 0.4 * k], fill=edge, width=max(2, int(k * 0.08)))
    d.ellipse([bx, by - 0.16 * k, bx + 0.78 * k, by + 0.14 * k], fill=fill, outline=edge, width=lw)
    d.ellipse([bx + 0.66 * k, by - 0.42 * k, bx + 0.98 * k, by - 0.08 * k], fill=fill, outline=edge, width=lw)


def shade_hex(h, f):
    r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
    return "#%02x%02x%02x" % (int(r * f), int(g * f), int(b * f))


def poly(d, cam, pts, fill):
    d.polygon([cam.p(*p) for p in pts], fill=fill)


def render(layout, cam, path, show_planet=True):
    W, H = cam.W, cam.H
    img = Image.new("RGB", (W, H), "#0b1020")
    d = ImageDraw.Draw(img)
    rng = random.Random(layout["seed"] + 99)
    for _ in range(int(W * H / 5000)):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        r = rng.choice([1, 1, 1, 2]) * cam.ss * 0.6
        d.ellipse([x - r, y - r, x + r, y + r], fill="#e6ecff")

    # Planet, docking modules and tubes behind the sphere.
    if show_planet:
        px, py = cam.p(-R_OUT * 1.55, -R_OUT * 1.05)
        pr = cam.m(R_OUT * 0.5)
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill="#2d5fa8")
    for side in (-1, 1):
        a, b = cam.p(side * R_OUT * 0.9, 1.2), cam.p(side * (R_OUT + 7), -1.2)
        d.rectangle([min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])], fill="#5b616b")
    gx, gy = cam.p(-(R_OUT + 10), 0)
    gr = cam.m(5.5)
    d.ellipse([gx - gr, gy - gr, gx + gr, gy + gr], fill="#6f9a86", outline="#3a4048", width=int(cam.m(0.3)))
    for t in range(-4, 5, 2):
        d.line([gx + cam.m(t), gy - gr * 0.95, gx + cam.m(t), gy + gr * 0.95], fill="#3a4048", width=int(cam.m(0.12)))
    sx0, sy0 = cam.p(R_OUT + 3, 4.5)
    sx1, sy1 = cam.p(R_OUT + 15, -4.5)
    d.rounded_rectangle([sx0, sy0, sx1, sy1], radius=cam.m(1.5), fill="#5d636d", outline="#3a4048", width=int(cam.m(0.25)))
    ix0, iy0 = cam.p(R_OUT + 4.5, 3.0)
    ix1, iy1 = cam.p(R_OUT + 13.5, -3.0)
    d.rectangle([ix0, iy0, ix1, iy1], fill="#b9b2a4")

    # Sphere hull: shaded plating, then the interior cut open.
    cx, cy = cam.p(0, 0)
    ro, ri = cam.m(R_OUT), cam.m(R_IN)
    shade = Image.new("RGB", (W, H), "#5c636e")
    sd = ImageDraw.Draw(shade)
    for i in range(30, 0, -1):
        rr = ro * i / 30
        c = int(70 + (30 - i) * 2.2)
        sd.ellipse([cx - ro * 0.25 - rr, cy - ro * 0.3 - rr, cx - ro * 0.25 + rr, cy - ro * 0.3 + rr],
                   fill=(c, c + 6, c + 16))
    disc = Image.new("L", (W, H), 0)
    ImageDraw.Draw(disc).ellipse([cx - ro, cy - ro, cx + ro, cy + ro], fill=255)
    img.paste(shade, (0, 0), disc)
    d = ImageDraw.Draw(img)
    for i in range(-int(R_OUT), int(R_OUT), 2):          # plating seams
        y = cy + cam.m(i)
        half = math.sqrt(max(0, ro ** 2 - (y - cy) ** 2))
        d.line([cx - half, y, cx + half, y], fill="#4b515b", width=max(1, int(cam.m(0.06))))
    d.ellipse([cx - ri, cy - ri, cx + ri, cy + ri], fill="#262a31")   # machinery behind everything

    # Atrium: a deep shaft with a far wall of tiny lit windows.
    ax0, ax1 = ATRIUM
    far = -26.0
    poly(d, cam, [(ax0, -R_IN, 0), (ax1, -R_IN, 0), (ax1, -R_IN, far), (ax0, -R_IN, far)], "#3a3f48")
    poly(d, cam, [(ax0, -R_IN, far), (ax1, -R_IN, far), (ax1, R_IN, far), (ax0, R_IN, far)], "#4a505b")
    poly(d, cam, [(ax0, -R_IN, 0), (ax0, R_IN, 0), (ax0, R_IN, far), (ax0, -R_IN, far)], "#353a43")
    poly(d, cam, [(ax1, -R_IN, 0), (ax1, R_IN, 0), (ax1, R_IN, far), (ax1, -R_IN, far)], "#353a43")
    for yy in range(-17, 18):
        for xx in (ax0 + 0.6, (ax0 + ax1) / 2, ax1 - 0.6):
            if rng.random() < 0.6:
                a = cam.p(xx - 0.2, yy + 0.3, far)
                b = cam.p(xx + 0.2, yy + 0.8, far)
                d.rectangle([a[0], b[1], b[0], a[1]], fill="#e9c98a")

    # Rooms, each drawn into its own opening and clipped to the hull.
    font_cache = {}
    for r in sorted(layout["rooms"], key=lambda r: -r["depth"]):
        if r["closed"]:
            continue
        x0, x1, y0, y1, dz = r["x0"], r["x1"], r["y0"], r["y1"], -r["depth"]
        tint = r["tint"] if not r.get("kind") == "reef" else "#3f7fa3"
        layer = Image.new("RGB", (W, H))
        ld = ImageDraw.Draw(layer)
        poly(ld, cam, [(x0, y1, 0), (x1, y1, 0), (x1, y1, dz), (x0, y1, dz)], "#8a857c")   # ceiling
        poly(ld, cam, [(x0, y0, 0), (x1, y0, 0), (x1, y0, dz), (x0, y0, dz)],
             "#7fb06a" if r.get("dogs") or r.get("kind") == "nursery" else ("#c48a54" if r.get("kind") == "court" else r["floor"]))
        side = shade_hex(tint, 0.8)
        poly(ld, cam, [(x0, y0, 0), (x0, y1, 0), (x0, y1, dz), (x0, y0, dz)], side)          # left wall
        poly(ld, cam, [(x1, y0, 0), (x1, y1, 0), (x1, y1, dz), (x1, y0, dz)], shade_hex(tint, 0.72))  # right wall
        poly(ld, cam, [(x0, y0, dz), (x1, y0, dz), (x1, y1, dz), (x0, y1, dz)], tint)      # back wall
        if r.get("mezz"):
            my = y0 + (y1 - y0) * 0.5
            mx = x0 + (x1 - x0) * 0.55
            poly(ld, cam, [(x0, my, 0), (mx, my, 0), (mx, my, dz), (x0, my, dz)], "#6d675e")
            poly(ld, cam, [(x0, my - 0.25, 0), (mx, my - 0.25, 0), (mx, my, 0), (x0, my, 0)], "#4a4f57")
            for t in range(6):
                q0 = cam.p(mx + 0.2 + t * 0.25, y0 + t * (my - y0) / 6, -0.8)
                q1 = cam.p(mx + 0.2 + t * 0.25 + 0.5, y0 + t * (my - y0) / 6, -0.8)
                ld.line([q0, q1], fill="#4a4f57", width=int(cam.m(0.1)))
        if r.get("kind") == "reef":
            poly(ld, cam, [(x0 + 0.3, y0 + 0.3, dz + 0.5), (x1 - 0.3, y0 + 0.3, dz + 0.5), (x1 - 0.3, y1 - 0.4, dz + 0.5), (x0 + 0.3, y1 - 0.4, dz + 0.5)], "#2f9fc0")
        if r.get("kind") == "skate":
            poly(ld, cam, [(x0 + 0.5, y0, -1.5), (x0 + 2.5, y0, -1.5), (x0 + 0.5, y0 + 1.8, -1.5)], "#c9b08a")
        mask = Image.new("L", (W, H), 0)
        md = ImageDraw.Draw(mask)
        a, b = cam.p(x0, y1), cam.p(x1, y0)
        md.rectangle([a[0], a[1], b[0], b[1]], fill=255)
        clip = Image.new("L", (W, H), 0)
        ImageDraw.Draw(clip).ellipse([cx - ri, cy - ri, cx + ri, cy + ri], fill=255)
        from PIL import ImageChops
        mask = ImageChops.multiply(mask, clip)
        img.paste(layer, (0, 0), mask)
        d = ImageDraw.Draw(img)
        for (px, pz) in sorted(r["people"], key=lambda p: p[1]):
            if math.hypot(px, y0 + 1) < R_IN - 0.3:
                draw_person(d, cam, px, pz, y0)
        for (_, px, pz) in r["animals"]:
            if math.hypot(px, y0 + 0.5) < R_IN - 0.3:
                draw_dog(d, cam, px, pz, y0)
        if r["sign"]:
            size = int(cam.m(0.5))
            fnt = font_cache.setdefault(size, ImageFont.truetype(FONT, size))
            tw = d.textlength(r["sign"], font=fnt)
            while tw > (b[0] - a[0]) * 0.8 and size > 6:
                size -= 2
                fnt = font_cache.setdefault(size, ImageFont.truetype(FONT, size))
                tw = d.textlength(r["sign"], font=fnt)
            sx = (a[0] + b[0]) / 2 - tw / 2
            sy = a[1] + cam.m(0.25)
            if math.hypot((x0 + x1) / 2, y1) < R_IN:
                d.rectangle([sx - cam.m(0.2), sy - cam.m(0.1), sx + tw + cam.m(0.2), sy + size + cam.m(0.15)], fill="#2b2f36")
                d.text((sx, sy), r["sign"], font=fnt, fill="#f2e6c8")
        # Slab and frame at the cut face.
        d.rectangle([a[0], b[1], b[0], b[1] + cam.m(SLAB)], fill="#3b3f46")
        d.line([a[0], a[1], a[0], b[1]], fill="#3b3f46", width=int(cam.m(0.18)))
        if r["balcony"]:
            bx0, bx1 = x0 + 0.3, min(x1 - 0.3, x0 + 3.2)
            p0, p1 = cam.p(bx0, y0 + 1.0), cam.p(bx1, y0 + 1.0)
            d.line([p0[0], p0[1], p1[0], p1[1]], fill="#5a5f68", width=int(cam.m(0.08)))
            for t in range(int((bx1 - bx0) / 0.4) + 1):
                q = cam.p(bx0 + t * 0.4, y0)
                d.line([q[0], q[1], q[0], p0[1]], fill="#5a5f68", width=int(cam.m(0.05)))
            d.rectangle([p0[0], cam.p(0, y0)[1], p1[0], cam.p(0, y0)[1] + cam.m(0.3)], fill="#4a4f57")

    # Closed hull patches over some outer rooms, so the cut line steps.
    for r in layout["rooms"]:
        if not r["closed"]:
            continue
        a, b = cam.p(r["x0"], r["y1"] + SLAB), cam.p(r["x1"], r["y0"])
        patch = Image.new("L", (W, H), 0)
        pd = ImageDraw.Draw(patch)
        pd.rectangle([a[0], a[1], b[0], b[1]], fill=255)
        clip = Image.new("L", (W, H), 0)
        ImageDraw.Draw(clip).ellipse([cx - ro, cy - ro, cx + ro, cy + ro], fill=255)
        from PIL import ImageChops
        patch = ImageChops.multiply(patch, clip)
        img.paste(shade, (0, 0), patch)
        d = ImageDraw.Draw(img)
        for t in range(3):
            wx = a[0] + (b[0] - a[0]) * (0.2 + 0.3 * t)
            wy = (a[1] + b[1]) / 2
            if math.hypot(wx - cx, wy - cy) < ri:
                d.ellipse([wx - cam.m(0.3), wy - cam.m(0.3), wx + cam.m(0.3), wy + cam.m(0.3)], fill="#e9c98a",
                          outline="#3b3f46", width=int(cam.m(0.08)))
        d.rectangle([a[0], a[1], b[0], b[1]], outline="#9aa0a8", width=int(cam.m(0.35)))

    # Hull cut edge.
    d.ellipse([cx - ro, cy - ro, cx + ro, cy + ro], outline="#8e949d", width=int(cam.m(HULL)))

    # Bridges, elevator and a zip line across the atrium, in front of everything.
    ax0, ax1 = ATRIUM
    for by in layout["bridges"]:
        a, b = cam.p(ax0 - 0.4, by), cam.p(ax1 + 0.4, by)
        d.rectangle([a[0], a[1], b[0], a[1] + cam.m(0.35)], fill="#4a4f57")
        rl = cam.p(0, by + 1.0)[1]
        d.line([a[0], rl, b[0], rl], fill="#6a6f78", width=int(cam.m(0.07)))
        draw_person(d, cam, (ax0 + ax1) / 2 + rng.uniform(-1, 1), 0.2, by + 0.35)
    ex0, ex1 = cam.p(ax1 - 1.3, 0)[0], cam.p(ax1 - 0.2, 0)[0]
    d.rounded_rectangle([ex0, cam.p(0, R_IN - 2)[1], ex1, cam.p(0, -R_IN + 2)[1]], radius=cam.m(0.5),
                        fill="#9fc6d8", outline="#5d6670", width=int(cam.m(0.12)))
    z0, z1 = cam.p(-R_IN * 0.7, 9), cam.p(R_IN * 0.6, 3)
    d.line([z0, z1], fill="#2b2f36", width=int(cam.m(0.06)))

    # Pipes that wander across room boundaries.
    for pts in layout["pipes"]:
        P = [cam.p(x, y) for x, y in pts if math.hypot(x, y) < R_IN]
        if len(P) > 1:
            d.line(P, fill="#7a808a", width=int(cam.m(0.22)), joint="curve")

    img = img.resize((W // cam.ss, H // cam.ss), Image.LANCZOS)
    img.save(path)
    print(f"wrote {path.relative_to(ROOT.parent)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=40)
    args = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    layout = build(args.seed)
    (OUT / "layout.json").write_text(json.dumps(layout, indent=1))
    # Open screen: whole station, top quarter left as sky for the clock.
    width = 2 * R_OUT * 1.7
    render(layout, Cam(1824, 1280, -width / 2, R_OUT + 10.0, width), OUT / "inner_guide.png")
    # Cover: a zoomed portrait slice through the upper middle.
    park = next((r for r in layout["rooms"] if r.get("dogs")), None)
    hw = max(28.0, (R_OUT + 6.0) - (park["y0"] - 3.0)) if park else 28.0
    ww = hw * 1280 / 1824
    px = (park["x0"] + park["x1"]) / 2 if park else 0.0
    px = max(-R_IN + ww / 2 - 2, min(R_IN - ww / 2 + 2, px))   # keep the slice on the station
    render(layout, Cam(1280, 1824, px - ww / 2, R_OUT + 6.0, ww), OUT / "cover_guide.png", show_planet=False)
    placed = [r.get("sign") or r.get("kind") for r in layout["rooms"] if r.get("kind") or r.get("dogs")]
    print(f"{len(layout['rooms'])} rooms, seed {args.seed}, big rooms: {placed}")


if __name__ == "__main__":
    main()
