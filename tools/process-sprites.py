"""Turn raw generated pieces and textures into game assets.

Pieces are trimmed to their visible pixels and scaled down; textures are
resized for tiling.

    python3 tools/process-sprites.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art" / "raw"
SPRITES = ROOT / "assets" / "sprites"
TEXTURES = ROOT / "assets" / "textures"


def trim(im):
    alpha = im.getchannel("A").point(lambda a: 255 if a > 24 else 0)
    box = alpha.getbbox()
    return im.crop(box) if box else im


def mirror_tile(im):
    """2x2 mirrored copy: edges always meet, so the texture tiles without seams."""
    w, h = im.size
    out = Image.new("RGB", (w * 2, h * 2))
    out.paste(im, (0, 0))
    out.paste(im.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
    out.paste(im.transpose(Image.FLIP_TOP_BOTTOM), (0, h))
    out.paste(im.transpose(Image.ROTATE_180), (w, h))
    return out


def main():
    SPRITES.mkdir(parents=True, exist_ok=True)
    TEXTURES.mkdir(parents=True, exist_ok=True)
    for src in sorted(RAW.glob("sprite_*.png")):
        im = trim(Image.open(src).convert("RGBA"))
        im.thumbnail((512, 512), Image.LANCZOS)
        im.save(SPRITES / f"{src.stem[len('sprite_'):]}.webp", "WEBP", quality=88, method=4)
    for src in sorted(RAW.glob("tex_*.png")):
        im = Image.open(src).convert("RGB").resize((256, 256), Image.LANCZOS)
        im = mirror_tile(im)
        im.save(TEXTURES / f"{src.stem[len('tex_'):]}.webp", "WEBP", quality=85, method=4)
    print(f"{len(list(SPRITES.glob('*.webp')))} sprites, {len(list(TEXTURES.glob('*.webp')))} textures")


if __name__ == "__main__":
    main()
