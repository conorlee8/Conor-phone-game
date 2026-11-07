"""Animates a station tile with Gemini Omni Flash (Google's video model) as a
seamless loop: the painting is both the first and the last frame, so the
clip starts and ends on exactly the painted picture.

The Gemini key lives in the session's network secrets (header x-goog-api-key);
the proxy adds it, so this script never sees it.

    python3 wallpaper/tools/omni.py wallpaper/video/tiles/t22.png wallpaper/video/tiles/t22.mp4 [--seconds 8]
"""
import argparse
import base64
import json
import subprocess
import sys
import time
from pathlib import Path

API = "https://generativelanguage.googleapis.com/v1beta"
MODEL = "gemini-omni-1.2-flash"

PROMPT = (
    "Use this image as both the starting frame and the final frame. "
    "Bring this painting of a cozy space station cutaway to life in a single continuous shot. "
    "The camera is completely locked: no zoom, no pan, no camera movement, no scene cuts. "
    "Every wall, room, floor, pipe, sign, poster and piece of furniture stays exactly where it is. "
    "The people and animals move naturally inside their own rooms the whole time: they eat, drink and chat at tables, "
    "cooks cook, people play basketball, lift weights, play games and skate, people work, fix things and stock shelves, "
    "doors slide open and closed as people come and go, dogs and cats wander and sniff around, lights and screens flicker gently. "
    "Nobody walks through walls. Do not add anything new to the scene: no new buildings, pods, modules, ships or objects appear, and the empty starry space stays empty apart from twinkling stars and what is already painted there. Keep exactly the same hand-painted lofi anime style, ink linework, colours and warm lighting. "
    "Sound: soft ambient station hum and distant chatter. No music, no dialogue, no on-screen text."
)


def curl(args, data=None):
    cmd = ["curl", "-sS", "--max-time", "1500"] + args
    res = subprocess.run(cmd, input=data, capture_output=True)
    if res.returncode:
        raise RuntimeError(res.stderr.decode()[:500])
    return res.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("out")
    ap.add_argument("--seconds", type=int, default=8)
    ap.add_argument("--resolution", default="720p")
    ap.add_argument("--prompt", default=PROMPT)
    a = ap.parse_args()

    # Send a compact JPEG: large request bodies fail at the network proxy.
    from io import BytesIO
    from PIL import Image
    buf = BytesIO()
    Image.open(a.image).convert("RGB").save(buf, "JPEG", quality=92)
    img = {"type": "image", "data": base64.b64encode(buf.getvalue()).decode(), "mime_type": "image/jpeg"}
    body = {
        "model": MODEL,
        "input": [img, img, {"type": "text", "text": a.prompt}],
        "response_format": {"type": "video", "delivery": "uri", "aspect_ratio": "16:9",
                            "duration": f"{a.seconds}s", "resolution": a.resolution},
    }
    t0 = time.time()
    print(f"generating {a.seconds}s at {a.resolution} from {a.image} ...", flush=True)
    # Background mode: the request returns at once and we poll, because long
    # waits get cut off by the network proxy.
    body["background"] = True
    raw = curl(["-X", "POST", f"{API}/interactions", "-H", "Content-Type: application/json", "--data-binary", "@-"],
               json.dumps(body).encode())
    try:
        r = json.loads(raw)
    except json.JSONDecodeError:
        sys.exit("FAILED: " + raw.decode()[:600])
    if "error" in r:
        sys.exit("FAILED: " + json.dumps(r["error"])[:600])
    iid = r.get("id") or r.get("name", "").split("/")[-1]
    print(f"  job {iid}: {r.get('status')}", flush=True)
    while r.get("status") not in ("completed", "failed", "cancelled", "incomplete"):
        time.sleep(10)
        try:
            r = json.loads(curl([f"{API}/interactions/{iid}"]))
        except (json.JSONDecodeError, RuntimeError) as e:
            print(f"  poll hiccup: {str(e)[:120]}", flush=True)
            continue
        if "error" in r and "status" not in r:
            sys.exit("FAILED: " + json.dumps(r["error"])[:600])
        print(f"  {r.get('status')} ({round(time.time() - t0)}s)", flush=True)
    if r.get("status") != "completed":
        sys.exit("FAILED: " + json.dumps(r.get("error") or r)[:800])
    Path(a.out).with_suffix(".json").write_text(json.dumps({k: v for k, v in r.items() if k != "outputs"}, indent=1)[:20000])
    # Find the video in the outputs, wherever the response puts it.
    found = []

    def walk(x):
        if isinstance(x, dict):
            if x.get("type") == "video" or "video" in str(x.get("mime_type", "")):
                found.append(x)
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    walk(r.get("outputs", r))
    if not found:
        Path(a.out).with_suffix(".raw.json").write_text(json.dumps(r)[:200000])
        sys.exit(f"FAILED: no video in the response (saved {Path(a.out).with_suffix('.raw.json')})")
    found = [f for f in found if f.get('uri') or f.get('data')] or found
    v = found[-1]
    if v.get("data"):
        Path(a.out).write_bytes(base64.b64decode(v["data"]))
    else:
        uri = v["uri"]
        if uri.startswith("files/"):
            uri = f"{API}/{uri}:download?alt=media"
        Path(a.out).write_bytes(curl(["-L", uri]))
    print(f"done {a.out} ({Path(a.out).stat().st_size // 1024} KB, {round(time.time() - t0)}s)")


if __name__ == "__main__":
    main()
