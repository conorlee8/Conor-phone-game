"""Finds the painted light sources in the station so the living world can animate them.

Scans the master painting for small, bright, saturated spots (lamps, lanterns,
neon, screens) inside the hull, and for the red beacons on the antennas
outside it. Writes world/data/lights.json: [{x, y, r, c: [r,g,b], k}] where
k is "lamp", "screen" or "beacon".

    python3 wallpaper/tools/lights.py
"""
import colorsys
import json
import math
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
SRC = ROOT / "wallpaper" / "pods" / "work" / "master.png"
OUT = ROOT / "world" / "data" / "lights.json"
HULL = (915, 752, 632)          # centre x, centre y, outer radius in painting pixels
CELL = 9


def main():
    img = Image.open(SRC).convert("RGB")
    W, H = img.size
    px = img.load()
    cx, cy, ro = HULL
    found = []
    for gy in range(0, H - CELL, CELL):
        for gx in range(0, W - CELL, CELL):
            best, hits, acc = None, 0, [0, 0, 0]
            for y in range(gy, gy + CELL):
                for x in range(gx, gx + CELL):
                    r, g, b = px[x, y]
                    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                    if v > 0.9 and s > 0.28:
                        hits += 1
                        acc[0] += r; acc[1] += g; acc[2] += b
                        if best is None or v > best[0]:
                            best = (v, x, y, h, s)
            if hits < 4 or best is None:
                continue
            _, x, y, h, s = best
            d = math.hypot(x - cx, y - cy)
            col = [round(c / hits) for c in acc]
            red = (h < 0.04 or h > 0.95) and s > 0.55
            if d < ro - 30:
                blue = 0.45 < h < 0.72
                found.append({"x": x, "y": y, "r": round(6 + hits * 0.35, 1), "c": col,
                              "k": "screen" if blue else "lamp"})
            elif red and hits < 30:
                found.append({"x": x, "y": y, "r": 9, "c": [255, 70, 60], "k": "beacon"})
    # Thin out clusters so lights don't stack.
    random.seed(4)
    random.shuffle(found)
    kept = []
    for f in found:
        if all(math.hypot(f["x"] - k["x"], f["y"] - k["y"]) > 14 for k in kept):
            kept.append(f)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(kept))
    by = {}
    for k in kept:
        by[k["k"]] = by.get(k["k"], 0) + 1
    print(len(kept), "lights", by)


if __name__ == "__main__":
    main()
