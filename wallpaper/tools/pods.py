"""Catalog pods: one painted room per bay of a shelter shell, plus a preview
of the whole shelter with every pod in place.

A pod is a 16:9 room seen straight on (the front wall removed). Its guide
marks the floor, the ceiling and how tall people are, so people are the same
size in every pod: about half the room height in a single bay, a quarter in
a double (two-storey) bay. The pod is drawn under the shell, whose door
frame hides its outer edge.

    python3 wallpaper/tools/pods.py paint [ids...]   # wallpaper/pods/catalog/<id>.png (all missing ones if no ids)
    python3 wallpaper/tools/pods.py animate [ids...] # <id>.mp4: a seamless 8 s loop per pod (Gemini Omni)
    python3 wallpaper/tools/pods.py preview          # wallpaper/shelters/station/preview.jpg
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path

import base64
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gpaint import MODEL, call, jpeg  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CAT = ROOT / "pods" / "catalog"
SIZE = (1376, 768)                   # Gemini 16:9 at 1K
STYLE_CROP = (980, 620, 1460, 890)  # a busy stretch of the old station painting: rooms, people, linework

PROMPT = (
    "The first image is a layout guide for one room: paint over it. The dark band at the bottom is the floor and the "
    "band at the top is the ceiling. The grey figures show exactly how tall people are in this room: paint every person "
    "at that height, busy doing things, placed wherever the scene needs them (not standing where the markers are). "
    "The second image shows the painting style, linework, colour and level of detail to match: match its look, not its layout or its people. "
    "Paint {scene} "
    "This is one room of a cozy, crammed space station, seen straight on as a cutaway, like a dollhouse room with the front wall removed: "
    "a flat back wall, the floor along the bottom, the ceiling along the top, no deep perspective. Fill every part of it with detail and life, "
    "Stephen Biesty levels of detail, in a lofi anime night painting style with crisp ink linework and warm lamp glow, with a little retro-future "
    "cartoon space charm. Something is happening in every corner. Keep the people and the main action away from the outer edges, which sit behind a door frame. "
    "Writing only where it would really exist in the room, in English, short and legible. People are mostly white with natural diversity, of all ages. "
    "No real brands or logos. No border, no door frame, no outer wall: the room fills the whole image edge to edge."
)


def guide(double):
    w, h = SIZE
    img = Image.new("RGB", SIZE, (88, 78, 70))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, round(h * 0.07)], fill=(60, 58, 58))             # ceiling
    floors = [h - round(h * 0.09)] if not double else [h // 2 + round(h * 0.02), h - round(h * 0.06)]
    person = round(h * (0.5 if not double else 0.25))
    if double:                                                              # mezzanine floor across the middle
        d.rectangle([0, h // 2 - round(h * 0.01), w, h // 2 + round(h * 0.02)], fill=(50, 48, 48))
    d.rectangle([0, floors[-1], w, h], fill=(50, 48, 48))
    rng = np.random.default_rng(1)
    for fy in floors:
        for x in rng.choice(np.arange(0.18, 0.84, 0.11), 3, replace=False):
            cx = round(w * x)
            pw = round(person * 0.28)
            d.rounded_rectangle([cx - pw // 2, fy - person, cx + pw // 2, fy], radius=pw // 2, fill=(150, 150, 150))
            d.ellipse([cx - pw * 0.4, fy - person - pw * 0.15, cx + pw * 0.4, fy - person + pw * 0.65], fill=(170, 170, 170))
    return img


def paint_one(pod, bays, style):
    out = CAT / f"{pod['id']}.png"
    double = bays[pod["bay"]]["size"] == "double"
    parts = [jpeg(guide(double)), style, {"text": PROMPT.format(scene=pod["scene"])}]
    body = {"_model": MODEL, "contents": [{"parts": parts}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "16:9", "imageSize": "1K"}}}
    for attempt in range(2):
        try:
            r = call(body.copy())
        except RuntimeError as e:
            print(f"  {pod['id']}: {e}", flush=True)
            continue
        pics = [p["inlineData"] for c in r.get("candidates", []) for p in c.get("content", {}).get("parts", []) if "inlineData" in p]
        if pics:
            Image.open(BytesIO(base64.b64decode(pics[-1]["data"]))).convert("RGB").resize(SIZE, Image.LANCZOS).save(out)
            print(f"  {pod['id']} done", flush=True)
            return
        print(f"  {pod['id']}: no image {json.dumps(r)[:300]}", flush=True)


def paint(ids):
    cat = json.loads((CAT / "catalog.json").read_text())
    shell = json.loads((ROOT / "shelters" / cat["shelter"] / "shell.json").read_text())
    bays = {b["id"]: b for b in shell["bays"]}
    ref = Image.open(ROOT / "shelters" / cat["shelter"] / "style_ref.jpg").crop(STYLE_CROP)
    style = jpeg(ref.resize((ref.width * 2, ref.height * 2), Image.LANCZOS))
    todo = [p for p in cat["pods"] if (p["id"] in ids if ids else not (CAT / f"{p['id']}.png").exists())]
    print(f"painting {len(todo)} pods", flush=True)
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda p: paint_one(p, bays, style), todo))


ANIM = (
    "Use this image as both the starting frame and the final frame. Bring this painting of one cozy room of a space station "
    "to life in a single continuous shot: {scene} "
    "The camera is completely locked: no zoom, no pan, no camera movement, no scene cuts. The walls, furniture, signs and "
    "objects stay exactly where they are. The people and animals keep busy the whole time, moving naturally within the room: "
    "they work, eat, chat, play and fidget; steam, lights, screens and water move gently. Nobody leaves through the edges of the frame. "
    "Do not add anything new to the room. Keep exactly the same hand-painted lofi anime style, ink linework, colours and warm lighting. "
    "Sound: soft room ambience. No music, no dialogue, no on-screen text."
)


def animate(ids):
    """Seamless 8 s loop per pod with Gemini Omni (the still is the first and last frame)."""
    import subprocess
    cat = json.loads((CAT / "catalog.json").read_text())
    todo = [p for p in cat["pods"] if p["id"] in ids] if ids else [p for p in cat["pods"] if not (CAT / f"{p['id']}.mp4").exists()]
    print(f"animating {len(todo)} pods", flush=True)

    def one(p):
        for attempt in range(2):
            res = subprocess.run([sys.executable, str(Path(__file__).parent / "omni.py"), str(CAT / f"{p['id']}.png"),
                                  str(CAT / f"{p['id']}.mp4"), "--prompt", ANIM.format(scene=p["scene"])],
                                 capture_output=True, text=True)
            last = (res.stdout.strip().splitlines() or [""])[-1]
            print(f"  {p['id']}: {last or res.stderr.strip()[-300:]}", flush=True)
            if res.returncode == 0:
                return
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(one, todo))


def preview():
    cat = json.loads((CAT / "catalog.json").read_text())
    sdir = ROOT / "shelters" / cat["shelter"]
    shell = json.loads((sdir / "shell.json").read_text())
    bays = {b["id"]: b for b in shell["bays"]}
    canvas = Image.new("RGBA", tuple(shell["size"]), (20, 18, 22, 255))
    for p in cat["pods"]:
        f = CAT / f"{p['id']}.png"
        if not f.exists():
            continue
        x0, y0, x1, y1 = bays[p["bay"]]["pod"]
        canvas.paste(Image.open(f).convert("RGBA").resize((x1 - x0, y1 - y0), Image.LANCZOS), (x0, y0))
    canvas.alpha_composite(Image.open(sdir / "shell.png").convert("RGBA"))
    canvas.convert("RGB").save(sdir / "preview.jpg", quality=88)
    print("wrote", (sdir / "preview.jpg").relative_to(ROOT.parent))


if __name__ == "__main__":
    {"paint": paint, "animate": animate, "preview": lambda _: preview()}[sys.argv[1]](sys.argv[2:])
