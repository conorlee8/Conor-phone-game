"""Cuts the station painting into overlapping 16:9 tiles for a video model, and
stitches the animated tiles back into one seamless looping station video.

The video model animates the painted people in place (eating, playing,
working, doors and traffic). Each tile overlaps its neighbours, and the
overlaps are cross-faded, so there are no seams. Tiles that are only space
are skipped: the app animates the sky itself.

    python3 wallpaper/tools/tiles.py cut            # writes wallpaper/video/tiles/*.png + tiles.json
    # animate each tile -> wallpaper/video/tiles/<id>.mp4 (same size, 16:9)
    python3 wallpaper/tools/tiles.py stitch         # writes wallpaper/video/station.mp4 (+ a loop)
    python3 wallpaper/tools/tiles.py stitch --test  # stand-in clips made from the stills, to check the geometry
"""
import argparse
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "pods" / "work" / "master.png"
OUT = ROOT / "video" / "tiles"
TILE_W, TILE_H = 640, 360        # painting pixels per tile (16:9); people end up ~2x bigger in the video
VIDEO = (1280, 720)
OVERLAP = 64
HULL = (915, 752, 632)           # centre x, centre y, outer radius
FPS = 24
LOOP_FADE = 1.0                  # seconds cross-faded from the end into the start


def cut():
    img = Image.open(SRC).convert("RGB")
    W, H = img.size
    OUT.mkdir(parents=True, exist_ok=True)
    nx = math.ceil((W - OVERLAP) / (TILE_W - OVERLAP))
    ny = math.ceil((H - OVERLAP) / (TILE_H - OVERLAP))
    tiles = []
    for j in range(ny):
        for i in range(nx):
            x0 = min(i * (TILE_W - OVERLAP), W - TILE_W)
            y0 = min(j * (TILE_H - OVERLAP), H - TILE_H)
            # Skip tiles that don't touch the station (pure sky).
            cx = min(max(HULL[0], x0), x0 + TILE_W)
            cy = min(max(HULL[1], y0), y0 + TILE_H)
            if math.hypot(cx - HULL[0], cy - HULL[1]) > HULL[2] + 40:
                continue
            tid = f"t{j}{i}"
            img.crop((x0, y0, x0 + TILE_W, y0 + TILE_H)).resize(VIDEO, Image.LANCZOS).save(OUT / f"{tid}.png")
            tiles.append({"id": tid, "x": x0, "y": y0})
    (OUT / "tiles.json").write_text(json.dumps({"tile": [TILE_W, TILE_H], "video": VIDEO, "tiles": tiles}, indent=1))
    print(f"{len(tiles)} tiles of {nx * ny} ({TILE_W}x{TILE_H} -> {VIDEO[0]}x{VIDEO[1]})")


def read_frames(path, n):
    """Decode n frames of a tile clip at the painting's tile size."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"fps={FPS},scale={TILE_W}:{TILE_H}:flags=lanczos",
           "-frames:v", str(n), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, TILE_H, TILE_W, 3)
    if len(fr) < n:                                   # pad short clips by holding the last frame
        fr = np.concatenate([fr, np.repeat(fr[-1:], n - len(fr), axis=0)])
    return fr.astype(np.float32)


def feather(w, h, edge):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rectangle([edge, edge, w - edge - 1, h - edge - 1], fill=255)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(edge / 2)), np.float32)[..., None] / 255


def stitch(seconds, test=False):
    meta = json.loads((OUT / "tiles.json").read_text())
    base = np.asarray(Image.open(SRC).convert("RGB"), np.float32)
    H, W, _ = base.shape
    n = int(seconds * FPS)
    clips = {}
    for t in meta["tiles"]:
        mp4 = OUT / f"{t['id']}.mp4"
        if test:
            mp4 = OUT / f"{t['id']}.test.mp4"
        if test and not mp4.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", str(OUT / f"{t['id']}.png"), "-t", str(seconds),
                            "-r", str(FPS), "-pix_fmt", "yuv420p", str(mp4)], check=True)
        if mp4.exists():
            clips[t["id"]] = (t, read_frames(mp4, n))
    print(f"stitching {len(clips)} of {len(meta['tiles'])} tiles, {n} frames")
    mask = feather(TILE_W, TILE_H, OVERLAP // 2)
    out = ROOT / "video" / ("station_test.mp4" if test else "station.mp4")
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
                            "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE)
    fade = int(LOOP_FADE * FPS)
    for f in range(n - fade):
        acc = base.copy()
        wsum = np.zeros((H, W, 1), np.float32)
        layer = np.zeros_like(base)
        for t, frames in clips.values():
            fr = frames[f]
            if f < fade:                                  # cross-fade the clip's end into its start: a seamless loop
                a = f / fade
                fr = frames[n - fade + f] * (1 - a) + fr * a
            ys, xs = slice(t["y"], t["y"] + TILE_H), slice(t["x"], t["x"] + TILE_W)
            layer[ys, xs] += fr * mask
            wsum[ys, xs] += mask
        has = wsum > 1e-3
        blended = np.where(has, layer / np.maximum(wsum, 1e-3), base)
        cover = np.clip(wsum, 0, 1)                       # full tile interiors replace the painting, edges blend into it
        acc = blended * cover + base * (1 - cover)
        enc.stdin.write(np.clip(acc, 0, 255).astype(np.uint8).tobytes())
    enc.stdin.close()
    enc.wait()
    print("wrote", out.relative_to(ROOT.parent))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["cut", "stitch"])
    ap.add_argument("--seconds", type=float, default=8)
    ap.add_argument("--test", action="store_true")
    a = ap.parse_args()
    cut() if a.cmd == "cut" else stitch(a.seconds, a.test)
