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
            print(f"  {p['id']}: {last} {res.stderr.strip()[-300:]}", flush=True)
            if "depleted" in res.stderr:             # out of Google credit: no point retrying
                return
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


CELL = (384, 216)       # one single pod in the atlas (about 2x its size on the station); a double pod takes 2x2 cells
COLS = 6
FPS, SECONDS, FADE = 24, 8, 24


def cell_clip(src, size, dst):
    """Decode a pod's loop at its atlas size and cross-fade its last second into its first: a seamless loop."""
    import subprocess
    w, h = size
    n = FPS * SECONDS
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-vf", f"fps={FPS},scale={w}:{h}:flags=lanczos",
                          "-frames:v", str(n), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
    if len(fr) < n:
        fr = np.concatenate([fr, np.repeat(fr[-1:], n - len(fr), axis=0)])
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", str(dst)], stdin=subprocess.PIPE)
    for f in range(n - FADE):
        x = fr[f]
        if f < FADE:
            a = f / FADE
            x = (fr[n - FADE + f].astype(np.float32) * (1 - a) + x.astype(np.float32) * a).astype(np.uint8)
        enc.stdin.write(x.tobytes())
    enc.stdin.close()
    enc.wait()


def export():
    """Everything the app needs for this shelter: the shell, one atlas image and one atlas video
    holding every pod (one video to decode instead of one per pod), and station.json."""
    import subprocess
    cat = json.loads((CAT / "catalog.json").read_text())
    sdir = ROOT / "shelters" / cat["shelter"]
    shell = json.loads((sdir / "shell.json").read_text())
    bays = {b["id"]: b for b in shell["bays"]}
    app = ROOT.parent / "world"
    out = app / "assets" / cat["shelter"]
    out.mkdir(parents=True, exist_ok=True)
    work = ROOT / "pods" / "work" / "atlas"
    work.mkdir(parents=True, exist_ok=True)

    Image.open(sdir / "shell.png").save(out / "shell.webp", quality=90, method=6)

    # Pack the atlas: the double pods first (2x2 cells), then the singles.
    taken = set()
    def place(cw, ch):
        for r in range(50):
            for c in range(COLS - cw + 1):
                if all((r + j, c + i) not in taken for j in range(ch) for i in range(cw)):
                    taken.update((r + j, c + i) for j in range(ch) for i in range(cw))
                    return [c * CELL[0], r * CELL[1], cw * CELL[0], ch * CELL[1]]
    pods = sorted(cat["pods"], key=lambda p: bays[p["bay"]]["size"] != "double")
    cells = {p["id"]: place(*((2, 2) if bays[p["bay"]]["size"] == "double" else (1, 1))) for p in pods}
    rows = max(r for r, _ in taken) + 1
    AW, AH = COLS * CELL[0], rows * CELL[1]

    still = Image.new("RGB", (AW, AH), (20, 18, 22))
    for p in pods:
        x, y, w, h = cells[p["id"]]
        still.paste(Image.open(CAT / f"{p['id']}.png").convert("RGB").resize((w, h), Image.LANCZOS), (x, y))
    still.save(out / "pods.jpg", quality=86)

    # The atlas video: every animated pod's seamless loop in its cell, the rest held still.
    inputs, layout, animated = [], [], []
    for p in pods:
        x, y, w, h = cells[p["id"]]
        mp4 = CAT / f"{p['id']}.mp4"
        if mp4.exists():
            cell = work / f"{p['id']}.mp4"
            if not cell.exists() or cell.stat().st_mtime < mp4.stat().st_mtime:
                cell_clip(mp4, (w, h), cell)
            inputs += ["-i", str(cell)]
            animated.append(p["id"])
        else:
            inputs += ["-loop", "1", "-framerate", str(FPS), "-t", str(SECONDS - FADE / FPS), "-i", str(CAT / f"{p['id']}.png")]
        layout.append(f"{x}_{y}")
    n = len(pods)
    scale = "".join(f"[{i}:v]scale={cells[p['id']][2]}:{cells[p['id']][3]},format=yuv420p,setsar=1[v{i}];" for i, p in enumerate(pods))
    graph = scale + "".join(f"[v{i}]" for i in range(n)) + f"xstack=inputs={n}:layout={'|'.join(layout)}:fill=0x141216[out]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[out]", "-r", str(FPS),
                    "-t", str(SECONDS - FADE / FPS), "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-g", str(FPS * 2),
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(out / "pods.mp4")], check=True)

    data = {
        "shelter": cat["shelter"],
        "size": shell["size"],
        "hull": dict(zip("xyr", shell["hull"])),
        "shell": f"assets/{cat['shelter']}/shell.webp",
        "atlas": {"still": f"assets/{cat['shelter']}/pods.jpg", "video": f"assets/{cat['shelter']}/pods.mp4", "size": [AW, AH]},
        "bays": [{k: b[k] for k in ("id", "ring", "size", "hole", "pod")} for b in shell["bays"]],
        "pods": {p["id"]: {"name": p["name"], "meter": p["meter"], "actions": p["actions"], "size": bays[p["bay"]]["size"],
                           "cell": cells[p["id"]], "animated": p["id"] in animated} for p in cat["pods"]},
        "start": {p["bay"]: p["id"] for p in cat["pods"] if bays[p["bay"]]["ring"] == 0},
        "home": {p["id"]: p["bay"] for p in cat["pods"]},
    }
    (app / "data" / f"{cat['shelter']}.json").write_text(json.dumps(data, indent=1))
    mb = lambda f: f"{f.stat().st_size / 1e6:.1f} MB"
    print(f"atlas {AW}x{AH}, {len(animated)}/{n} animated; shell {mb(out / 'shell.webp')}, pods.jpg {mb(out / 'pods.jpg')}, pods.mp4 {mb(out / 'pods.mp4')}")


if __name__ == "__main__":
    {"paint": paint, "animate": animate, "preview": lambda _: preview(), "export": lambda _: export()}[sys.argv[1]](sys.argv[2:])
