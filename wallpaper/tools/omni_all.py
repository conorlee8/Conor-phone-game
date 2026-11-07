"""Animates every station tile that doesn't have a clip yet, four at a time."""
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TILES = ROOT / "video" / "tiles"


def run(tid):
    out = TILES / f"{tid}.mp4"
    for attempt in (1, 2):
        r = subprocess.run([sys.executable, str(ROOT / "tools" / "omni.py"), str(TILES / f"{tid}.png"), str(out)],
                           capture_output=True, text=True)
        if out.exists() and out.stat().st_size > 100000:
            print(f"{tid}: done", flush=True)
            return
        print(f"{tid}: attempt {attempt} failed: {(r.stdout + r.stderr).strip().splitlines()[-1][:200]}", flush=True)


todo = [t["id"] for t in json.loads((TILES / "tiles.json").read_text())["tiles"] if not (TILES / f"{t['id']}.mp4").exists()]
print(f"{len(todo)} tiles to animate", flush=True)
with ThreadPoolExecutor(4) as pool:
    list(pool.map(run, todo))
print("all done", flush=True)
