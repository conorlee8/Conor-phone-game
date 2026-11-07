"""Paints with Google's image model (Gemini image), using the same job files
as paint.mjs. The Gemini key lives in the session's network secrets (header
x-goog-api-key); the proxy adds it, so this script never sees it.

The first image of a job is the layout guide. Gemini only paints set aspect
ratios, so the guide is padded out to the nearest one and the painting is
cropped back to the job's size afterwards: the layout keeps its exact pixels.

    python3 wallpaper/tools/gpaint.py wallpaper/shelters/station/paint.json [--only painted] [--n 2]
"""
import argparse
import base64
import json
import subprocess
import sys
import time
from io import BytesIO
from pathlib import Path

from PIL import Image

API = "https://generativelanguage.googleapis.com/v1beta"
MODEL = "gemini-3-pro-image"
RATIOS = {"1:1": 1, "2:3": 2 / 3, "3:2": 3 / 2, "3:4": 3 / 4, "4:3": 4 / 3, "4:5": 4 / 5, "5:4": 5 / 4,
          "9:16": 9 / 16, "16:9": 16 / 9, "21:9": 21 / 9}


def jpeg(img, long_side=1600):
    img = img.convert("RGB")
    s = long_side / max(img.size)
    if s < 1:
        img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=90)
    return {"inlineData": {"mimeType": "image/jpeg", "data": base64.b64encode(buf.getvalue()).decode()}}


def pad_to_ratio(img):
    """Pads an image with its corner colour to the closest supported ratio; returns (padded, ratio name, box)."""
    w, h = img.size
    name = min(RATIOS, key=lambda k: abs(RATIOS[k] - w / h))
    r = RATIOS[name]
    pw, ph = (round(h * r), h) if r > w / h else (w, round(w / r))
    out = Image.new("RGB", (pw, ph), img.convert("RGB").getpixel((0, 0)))
    x0, y0 = (pw - w) // 2, (ph - h) // 2
    out.paste(img.convert("RGB"), (x0, y0))
    return out, name, (x0, y0, x0 + w, y0 + h)


def call(body, timeout=600):
    res = subprocess.run(["curl", "-sS", "--max-time", str(timeout), "-X", "POST",
                          f"{API}/models/{body.pop('_model')}:generateContent",
                          "-H", "Content-Type: application/json", "--data-binary", "@-"],
                         input=json.dumps(body).encode(), capture_output=True)
    if res.returncode:
        raise RuntimeError(res.stderr.decode()[:400])
    try:
        return json.loads(res.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(res.stdout.decode()[:400])


def paint(job_path, only=None, n=1, size="2K"):
    job_path = Path(job_path)
    job = json.loads(job_path.read_text())
    base = job_path.parent / job.get("out", ".")
    W, H = map(int, job["size"].split("x"))
    for a in job["assets"]:
        if only and a["id"] != only:
            continue
        imgs = [Image.open(job_path.parent / p) for p in a.get("images", [])]
        guide, ratio, box = pad_to_ratio(imgs[0].resize((W, H), Image.LANCZOS))
        parts = [jpeg(guide, 2048)] + [jpeg(i) for i in imgs[1:]] + [{"text": a["prompt"]}]
        for k in range(n):
            out = base / (f"{a['id']}.png" if n == 1 else f"{a['id']}_{k + 1}.png")
            t0 = time.time()
            print(f"painting {out.name} ({ratio}, {size}) ...", flush=True)
            body = {"_model": job.get("gemini_model", MODEL), "contents": [{"parts": parts}],
                    "generationConfig": {"responseModalities": ["IMAGE"],
                                         "imageConfig": {"aspectRatio": ratio, "imageSize": size}}}
            try:
                r = call(body)
            except RuntimeError as e:
                print("  FAILED:", e)
                continue
            if "error" in r:
                print("  FAILED:", json.dumps(r["error"])[:400])
                continue
            pics = [p["inlineData"] for c in r.get("candidates", []) for p in c.get("content", {}).get("parts", [])
                    if "inlineData" in p]
            if not pics:
                print("  FAILED: no image", json.dumps(r)[:400])
                continue
            img = Image.open(BytesIO(base64.b64decode(pics[-1]["data"]))).convert("RGB")
            img = img.resize(guide.size, Image.LANCZOS).crop(box)
            img.save(out)
            print(f"  done {out} ({round(time.time() - t0)}s)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("job")
    ap.add_argument("--only")
    ap.add_argument("--n", type=int, default=1)
    ap.add_argument("--size", default="2K")
    a = ap.parse_args()
    paint(a.job, a.only, a.n, a.size)
