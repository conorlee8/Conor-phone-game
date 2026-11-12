"""The Duo wallpaper pair: the whole living station for the open (inner) screen,
and a tall crop centred on the #1 room for the closed (cover) screen. Both
come from the same frames, so they match when the phone opens.

The station is composited at twice its painted size: every room's loop (the
catalog rooms from the shared atlas, the custom rooms from their own loops,
or their chosen still) goes into its bay, then the shell goes on top. Bays
whose custom room isn't painted yet keep their regular catalog room.

Custom rooms show real people, so the output goes to the git-ignored
wallpaper/pods/custom/duo/.

    python3 wallpaper/tools/duo.py
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT.parent / "world"
WORK = ROOT / "pods" / "work"
CUSTOM = ROOT / "pods" / "custom"
OUT = CUSTOM / "duo"
RANK_BAYS = {1: "b08", 2: "b06", 3: "b09", 4: "b11", 5: "b13", 6: "b15", 7: "b02", 8: "b04", 9: "b10", 10: "b12"}
FPS, FRAMES = 24, 168                       # every loop is 7 s
K = 2                                       # composite at twice the painted size
COVER = (1398, 2034)                        # closed screen
INNER = (2670, 1878)                        # open screen
COVER_W = 760                               # cover crop width, in painting pixels


def reader(path, size):
    """Stream frames of a video at `size` (w, h)."""
    w, h = size
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"fps={FPS},scale={w}:{h}:flags=lanczos",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    last = None
    while True:
        buf = p.stdout.read(w * h * 3)
        if len(buf) == w * h * 3:
            last = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
        yield last                           # holds the last frame if a clip runs short


def writer(path, size):
    w, h = size
    return subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(FPS),
                             "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high",
                             "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(path)], stdin=subprocess.PIPE)


def custom_rooms():
    """bay -> ('video'|'still', local path) for every painted custom room, by rank."""
    renders = json.loads((WORK / "rooms" / "_renders.json").read_text())
    out = {}
    for f in sorted((WORK / "rooms" / "_db" / "rooms").glob("r*.json")):
        d = json.loads(f.read_text())
        d = d.get("data", d)
        bay = RANK_BAYS.get(d.get("rank"))
        rs = d.get("renders", [])
        art = d.get("chosen") or (rs[-1]["asset"] if rs else None)
        if not bay or not art or art not in renders:
            continue
        anim = d.get("anim") or {}
        if anim.get("asset") in renders and anim.get("from") == art:
            out[bay] = ("video", CUSTOM / renders[anim["asset"]])
        else:
            out[bay] = ("still", CUSTOM / renders[art])
    return out


def main():
    data = json.loads((APP / "data" / "station.json").read_text())
    W, H = data["size"]
    CW, CH = W * K, H * K
    home = {bay: pid for pid, bay in data["home"].items()}
    bays = {b["id"]: [v * K for v in b["pod"]] for b in data["bays"]}
    custom = custom_rooms()
    print("custom rooms:", {b: (k, p.name) for b, (k, p) in custom.items()})

    shell = Image.open(ROOT / "shelters" / "station" / "shell.png").convert("RGBA").resize((CW, CH), Image.LANCZOS)
    aw, ah = data["atlas"]["size"]
    atlas = reader(APP / data["atlas"]["video"], (aw, ah))
    videos, stills = {}, {}
    for bay, (kind, path) in custom.items():
        x0, y0, x1, y1 = bays[bay]
        if kind == "video":
            videos[bay] = reader(path, (x1 - x0, y1 - y0))
        else:
            stills[bay] = Image.open(path).convert("RGB").resize((x1 - x0, y1 - y0), Image.LANCZOS)

    # Cover crop: centred on the #1 room, full painting height allowed.
    b1 = [v / K for v in bays[RANK_BAYS[1]]]
    cx, cy = (b1[0] + b1[2]) / 2, (b1[1] + b1[3]) / 2
    cw, ch = COVER_W, COVER_W * COVER[1] / COVER[0]
    cx0 = min(max(cx - cw / 2, 0), W - cw)
    cy0 = min(max(cy - ch / 2, 0), H - ch)
    cover_box = tuple(round(v * K) for v in (cx0, cy0, cx0 + cw, cy0 + ch))
    # Inner: the whole station, letterboxed by a sliver of the painted sky if the ratios differ.
    s = min(INNER[0] / CW, INNER[1] / CH)
    iw, ih = round(CW * s), round(CH * s)
    sky = shell.getpixel((4, 4))[:3]

    OUT.mkdir(parents=True, exist_ok=True)
    enc_c, enc_i = writer(OUT / "duo_cover.mp4", COVER), writer(OUT / "duo_inner.mp4", INNER)
    for f in range(FRAMES):
        canvas = Image.new("RGBA", (CW, CH), (20, 18, 22, 255))
        a = Image.fromarray(next(atlas))
        for bay, box in bays.items():
            x0, y0, x1, y1 = box
            if bay in videos:
                canvas.paste(Image.fromarray(next(videos[bay])), (x0, y0))
            elif bay in stills:
                canvas.paste(stills[bay], (x0, y0))
            else:
                cx_, cy_, cw_, ch_ = data["pods"][home[bay]]["cell"]
                canvas.paste(a.crop((cx_, cy_, cx_ + cw_, cy_ + ch_)).resize((x1 - x0, y1 - y0), Image.LANCZOS), (x0, y0))
        canvas.alpha_composite(shell)
        rgb = canvas.convert("RGB")
        cover = rgb.crop(cover_box).resize(COVER, Image.LANCZOS)
        inner = Image.new("RGB", INNER, sky)
        inner.paste(rgb.resize((iw, ih), Image.LANCZOS), ((INNER[0] - iw) // 2, (INNER[1] - ih) // 2))
        enc_c.stdin.write(cover.tobytes())
        enc_i.stdin.write(inner.tobytes())
        if f == 0:                           # the painted moment every loop starts and ends on
            cover.save(OUT / "duo_cover.jpg", quality=95)
            inner.save(OUT / "duo_inner.jpg", quality=95)
        if f % 24 == 0:
            print(f"  frame {f}/{FRAMES}", flush=True)
    for e in (enc_c, enc_i):
        e.stdin.close()
        e.wait()
    # Live Photo length cuts (3 s) to turn into Live Photos.
    for name in ("cover", "inner"):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT / f"duo_{name}.mp4"), "-t", "3", "-c", "copy",
                        "-movflags", "+faststart", str(OUT / f"duo_{name}_3s.mp4")], check=True)
    for p in sorted(OUT.iterdir()):
        print(f"{p.name}: {p.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
