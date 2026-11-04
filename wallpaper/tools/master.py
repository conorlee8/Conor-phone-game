"""Puts every painted pod back into the station: the master painting.

For each pin, the chosen version (the one marked "next version builds on this",
else the latest) is pasted into the base painting at the pin's room, with a
slightly feathered edge. The result is the map the Pod Planner shows and the
source the final cover and inner wallpapers are cut from.

    python3 wallpaper/tools/master.py wallpaper/pods/work/_db/pins
    # writes wallpaper/pods/work/master.png and wallpaper/pods/station.jpg
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "raw" / "r8_inner.png"
WORK = ROOT / "pods" / "work"
MASTER = WORK / "master.png"
STATION = ROOT / "pods" / "station.jpg"


LIVE = WORK / "live.json"     # {pin id: file in its work folder} to place a specific version


def chosen_pod(pid, pin):
    live = json.loads(LIVE.read_text()) if LIVE.exists() else {}
    if pid in live:
        pod, meta = WORK / pid / live[pid], WORK / pid / "meta.json"
        if pod.exists() and meta.exists():
            return pod, json.loads(meta.read_text())
    paints = [r for r in pin.get("renders", []) if r.get("kind") == "paint"]
    if not paints:
        return None
    pick = len(paints)
    if pin.get("base"):
        for i, r in enumerate(paints, 1):
            if r["asset"] == pin["base"]:
                pick = i
    meta = WORK / pid / "meta.json"
    pod = WORK / pid / f"pod_{pick}.png"
    if not pod.exists() or not meta.exists():
        print(f"  {pid}: version {pick} isn't on this machine, skipped")
        return None
    return pod, json.loads(meta.read_text())


def build(pins_dir):
    master = Image.open(BASE).convert("RGB")
    placed = 0
    for f in sorted(Path(pins_dir).glob("*.json")):
        doc = json.loads(f.read_text())
        pin = doc.get("data", doc)
        pid = f.stem
        if not pin.get("room"):
            continue
        found = chosen_pod(pid, pin)
        if not found:
            continue
        pod, meta = found
        c = meta["crop"]
        x0, y0, x1, y1 = pin["room"]
        tile = Image.open(pod).convert("RGB").resize((c[2] - c[0], c[3] - c[1]), Image.LANCZOS)
        m = Image.new("L", tile.size, 0)
        ImageDraw.Draw(m).rectangle([x0 - c[0] + 1, y0 - c[1] + 1, x1 - c[0] - 1, y1 - c[1] - 1], fill=255)
        m = m.filter(ImageFilter.GaussianBlur(1.2))
        master.paste(tile, (c[0], c[1]), m)
        placed += 1
        print(f"  pin {pin.get('n')}: placed")
    master.save(MASTER)
    master.save(STATION, quality=88)
    print(f"{placed} pods in the station -> {STATION.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else WORK / "_db" / "pins")
