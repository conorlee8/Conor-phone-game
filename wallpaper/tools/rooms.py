"""The ten custom rooms for the Duo wallpaper test (Top Ten Rooms page).

Each room comes from Conor's answers on the Top Ten Rooms artifact: who is in
it (with photos), what kind of room it is, what they're into, how it feels,
what's going on, and must-have details. Rank sets the bay: #1 gets the big
two-storey hall in the middle, #2-6 the core rooms by the elevator, #7-10
the first ring. People's likeness comes from their approved character
drawing when there is one, plus their photos.

Room docs and photos live in wallpaper/pods/work/rooms/ (git-ignored: they
are personal). Paintings go to wallpaper/pods/custom/<room>_<n>.png.

    python3 wallpaper/tools/rooms.py paint r1 [--n 2]
    python3 wallpaper/tools/rooms.py animate r1      # seamless loop of the room's chosen painting
"""
import argparse
import base64
import json
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gpaint import MODEL, call, jpeg  # noqa: E402
from pods import STYLE_CROP, guide  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "pods" / "work"
OUT = ROOT / "pods" / "custom"
RANK_BAYS = {1: "b08", 2: "b06", 3: "b09", 4: "b11", 5: "b13", 6: "b15", 7: "b02", 8: "b04", 9: "b10", 10: "b12"}

# Approved character drawings and descriptions from the Pod Planner, by resident id.
APPROVED = {
    "conor": ("people/person-tbipto/sheet_1.png", "person"),
    "elliot": ("people/elliot/sheet_1.png", "elliot"),
    "colenzo": ("people/colenzo/sheet_5a.png", "colenzo"),
}


EXTRA = {"colenzo": "His docked tail is about the length of a hand, held up and angled back, not a tiny nub."}


def looks(db_name):
    f = WORK / "_db" / f"{db_name}.json"
    if not f.exists():
        return EXTRA.get(db_name, "")
    d = json.loads(f.read_text())
    d = d.get("data", d)
    return (d.get("looks", "").rstrip(".") + ". " + EXTRA.get(db_name, "")).strip()


def resident_looks(m):
    """How a resident looks: the approved drawing's notes, else the private notes in rooms/_looks.json."""
    if m["id"] in APPROVED:
        return looks(APPROVED[m["id"]][1])
    f = WORK / "rooms" / "_looks.json"
    return json.loads(f.read_text()).get(m["id"], "") if f.exists() else ""


def owner_of(room):
    o = (room.get("owner") or "").strip()
    for suffix in ("'s", "’s"):
        if o.lower().endswith(suffix):
            o = o[: -len(suffix)].strip()
    return o or "a friend"


def answer(a, key):
    v = a.get(key)
    vals = v if isinstance(v, list) else [v] if v else []
    vals = [x for x in vals if x and x != "Other"]
    if a.get(key + "Other"):
        vals.append(a[key + "Other"].strip())
    return vals


def prompt_for(room, double):
    a = room.get("answers", {})
    owner = owner_of(room)
    people = room.get("people", [])
    who = []
    for i, m in enumerate(people):
        desc = m.get("name") or ("a friend" if m.get("kind") == "Person" else "a pet")
        if m.get("kind") != "Person":
            desc += f" (a {m.get('kind', 'pet').lower()})"
        extra = resident_looks(m)
        if extra:
            desc += f": {extra}"
        who.append(desc)
    parts = [f"Paint {owner}'s room."]
    kind, into, vibe, scene, details = (answer(a, k) for k in ("type", "into", "vibe", "scene", "details"))
    if kind:
        k = ", ".join(kind).lower()
        parts.append(f"It is {'an' if k[:1] in 'aeiou' else 'a'} {k}.")
    if vibe:
        parts.append(f"It feels {'; '.join(vibe)}.")
    if into:
        parts.append(f"{owner} is into {', '.join(into).lower()}, and the room shows it everywhere.")
    if scene:
        parts.append(f"Right now: {'; '.join(scene).lower()}.")
    if details:
        parts.append(f"Must-have details: {', '.join(details).lower()}.")
    if room.get("notes"):
        parts.append(f"More from {owner}: {room['notes'].strip()}")
    parts.append("The people and animals in this room, each drawn so their friends would recognise them instantly, "
                 "matching their reference drawings and photos (face, hair, build, coat colours and markings): " + " ".join(w.rstrip(".") + "." for w in who))
    if double:
        parts.append("This is the biggest and best room on the station: a two-storey space with a mezzanine floor across the middle, "
                     "packed with even more detail than any other room. The owner is the clear centre of attention.")
    return " ".join(parts)


def refs_for(room, rid):
    """Reference images: each resident's approved drawing (if any), then up to two of their photos."""
    imgs, labels = [], []
    for m in room.get("people", []):
        name = m.get("name") or m["id"]
        if m["id"] in APPROVED and (WORK / APPROVED[m["id"]][0]).exists():
            imgs.append(Image.open(WORK / APPROVED[m["id"]][0]))
            labels.append(f"the approved character drawing of {name}")
        drawn = m["id"] in APPROVED
        photos = sorted((WORK / "rooms" / rid / m["id"]).glob("*.jpg"))[: 2 if drawn else 3]
        for p in photos:
            imgs.append(ImageOps.exif_transpose(Image.open(p)))
            labels.append(f"a photo of {name}")
    return imgs, labels


def paint(rid, n=1):
    room = json.loads((WORK / "rooms" / "_db" / "rooms" / f"{rid}.json").read_text())
    room = room.get("data", room)
    double = room.get("rank") == 1
    imgs, labels = refs_for(room, rid)
    ref = Image.open(ROOT / "shelters" / "station" / "style_ref.jpg").crop(STYLE_CROP)
    lead = ("The first image is a layout guide for one room: paint over it. The dark band at the bottom is the floor and the band at the top "
            "is the ceiling" + (", and the band across the middle is the mezzanine floor" if double else "") + ". The grey figures show exactly "
            "how tall people are in this room: paint every person at that height, busy and natural, placed wherever the scene needs them. "
            "The second image shows the painting style, linework, colour and level of detail to match: its look, not its layout or its people. ")
    lead += "".join(f"Image {i + 3} is {lab}. " for i, lab in enumerate(labels))
    tail = (" Whatever the room is for, it is built like a futuristic space-station bunker: curved riveted metal bulkheads and wall panels, "
            "glowing control panels and screens built into the walls, chunky retro-future tech, a round porthole onto starry space, "
            "neat cable runs and soft built-in light strips. Tidy and well kept unless the owner asked for mess."
            " This is one room of a cozy, crammed space station, seen straight on as a cutaway, like a dollhouse room with the front wall removed: "
            "a flat back wall, the floor along the bottom, the ceiling along the top, no deep perspective. Fill every part of it with detail and life, "
            "Stephen Biesty levels of detail, in a lofi anime night painting style with crisp ink linework and warm lamp glow. Keep the people and the "
            "main action away from the outer edges, which sit behind a door frame. Writing only where it would really exist in the room, in English, "
            "short and legible. No real brands or logos other than any named above. No border, no door frame, no outer wall: the room fills the whole image edge to edge.")
    text = lead + prompt_for(room, double) + tail
    parts = [jpeg(guide(double)), jpeg(ref.resize((ref.width * 2, ref.height * 2), Image.LANCZOS))] + [jpeg(i, 1024) for i in imgs] + [{"text": text}]
    OUT.mkdir(parents=True, exist_ok=True)
    (WORK / "rooms" / rid / "prompt.txt").write_text(text)
    have = len(list(OUT.glob(f"{rid}_*.png")))
    for k in range(n):
        out = OUT / f"{rid}_{have + k + 1}.png"
        body = {"_model": MODEL, "contents": [{"parts": parts}],
                "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "16:9", "imageSize": "2K"}}}
        try:
            r = call(body)
        except RuntimeError as e:
            sys.exit(f"FAILED: {e}")
        if isinstance(r, list):
            r = r[0] if r else {}
        if "error" in r:
            sys.exit("FAILED: " + json.dumps(r["error"])[:400])
        pics = [p["inlineData"] for c in r.get("candidates", []) for p in c.get("content", {}).get("parts", []) if "inlineData" in p]
        if not pics:
            sys.exit("FAILED: no image " + json.dumps(r)[:300])
        Image.open(BytesIO(base64.b64decode(pics[-1]["data"]))).convert("RGB").save(out)
        print("wrote", out.relative_to(ROOT.parent), f"(bay {RANK_BAYS.get(room.get('rank'))})")


def animate(rid):
    """A seamless 8 s loop of the room's chosen painting (Gemini Omni; the painting is the first and last frame)."""
    import subprocess
    from pods import cell_clip
    room = json.loads((WORK / "rooms" / "_db" / "rooms" / f"{rid}.json").read_text())
    room = room.get("data", room)
    renders = room.get("renders", [])
    art = room.get("animFrom") or room.get("chosen") or (renders[-1]["asset"] if renders else None)
    local = json.loads((WORK / "rooms" / "_renders.json").read_text()).get(art)
    if not local:
        sys.exit(f"FAILED: no local painting for asset {art}")
    owner = owner_of(room)
    people = ", ".join((m.get("name") or m.get("kind", "")) + ("" if m.get("kind") == "Person" else f" the {m.get('kind', 'pet').lower()}")
                       for m in room.get("people", []))
    wish = (room.get("animPrompt") or "").strip()
    prompt = ("Use this image as both the starting frame and the final frame. Bring this painting of " + owner + "'s room on a cozy space station "
              "to life in one continuous shot. The camera is completely locked: no zoom, no pan, no cuts. The walls, furniture, signs and objects stay "
              "exactly where they are. " + (f"In the room: {people}. " if people else "") +
              (f"What happens: {wish}. " if wish else "Everyone keeps busy and moves naturally, pets fidget, breathe, wag and look around. ") +
              "Screens flicker and play, fish swim, lights glow gently, steam drifts. Everyone keeps exactly the same face, hair, clothes and markings. "
              "Nobody leaves the frame and nothing new appears. Keep exactly the same hand-painted lofi anime style, ink linework, colours and lighting. "
              "Sound: soft room ambience. No music, no dialogue, no on-screen text changes.")
    still = WORK / "rooms" / rid / "anim_still.jpg"
    Image.open(OUT / local).convert("RGB").resize((1280, 720), Image.LANCZOS).save(still, quality=92)
    raw = WORK / "rooms" / rid / "anim_raw.mp4"
    res = subprocess.run([sys.executable, str(Path(__file__).parent / "omni.py"), str(still), str(raw), "--prompt", prompt], capture_output=True, text=True)
    print(res.stdout.strip().splitlines()[-1] if res.stdout.strip() else "", res.stderr.strip()[-300:])
    if res.returncode:
        sys.exit("FAILED")
    out = OUT / f"{rid}_anim.mp4"
    cell_clip(raw, (1280, 720), out, crf=21)
    print("wrote", out.relative_to(ROOT.parent), f"({out.stat().st_size // 1024} KB) from {local}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["paint", "prompt", "animate"])
    ap.add_argument("room")
    ap.add_argument("--n", type=int, default=1)
    a = ap.parse_args()
    if a.cmd == "paint":
        paint(a.room, a.n)
    elif a.cmd == "animate":
        animate(a.room)
    else:
        room = json.loads((WORK / "rooms" / "_db" / "rooms" / f"{a.room}.json").read_text())
        room = room.get("data", room)
        print(prompt_for(room, room.get("rank") == 1))
