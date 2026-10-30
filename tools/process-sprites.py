"""Turn raw generated pieces into game sprites.

Trims each cut-out to its visible pixels, scales it down, and for the pixel
style snaps it to a coarse pixel grid on a shared palette so every piece looks
like it came from the same artist.

    python3 tools/process-sprites.py            # style test pieces
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art" / "raw"
OUT = ROOT / "assets" / "sprites"

PIXELS_PER_UNIT = 40  # pixel style: art pixels per grid unit
HEIGHT_UNITS = {
    "bunk_bed": 2.2, "generator": 1.1, "purifier": 2, "battery_bank": 1.2, "shelf": 2.2,
    "planter": 1.6, "workbench": 1.4, "wall_lamp": 0.6,
}


def trim(im):
    alpha = im.getchannel("A").point(lambda a: 255 if a > 24 else 0)
    box = alpha.getbbox()
    return im.crop(box) if box else im


def painted(src, dst):
    im = trim(Image.open(src).convert("RGBA"))
    im.thumbnail((512, 512), Image.LANCZOS)
    im.save(dst.with_suffix(".webp"), "WEBP", quality=88, method=6)


def pixel(src, dst, units):
    im = trim(Image.open(src).convert("RGBA"))
    h = max(8, round(units * PIXELS_PER_UNIT / 2))  # half-resolution art pixels
    w = max(8, round(im.width * h / im.height))
    small = im.resize((w, h), Image.BOX)
    alpha = small.getchannel("A").point(lambda a: 255 if a > 110 else 0)
    rgb = small.convert("RGB").quantize(colors=40, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    out.save(dst.with_suffix(".png"))


def tile(src, dst, pixelate):
    im = Image.open(src).convert("RGB")
    if pixelate:
        im = im.resize((96, 96), Image.BOX).quantize(colors=32, dither=Image.NONE).convert("RGB")
        im.save(dst.with_suffix(".png"))
    else:
        im.resize((384, 384), Image.LANCZOS).save(dst.with_suffix(".webp"), "WEBP", quality=85)


def main():
    for style in ("painted", "pixel"):
        out = OUT / style
        out.mkdir(parents=True, exist_ok=True)
        for src in sorted(RAW.glob(f"test_{style}_*.png")):
            name = src.stem[len(f"test_{style}_"):]
            dst = out / name
            if name in ("wall", "floor"):
                tile(src, dst, style == "pixel")
            elif style == "pixel":
                pixel(src, dst, HEIGHT_UNITS.get(name, 1.5))
            else:
                painted(src, dst)
            print(f"{style}/{name}")


if __name__ == "__main__":
    main()
