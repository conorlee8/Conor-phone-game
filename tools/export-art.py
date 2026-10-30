"""Compress the raw paintings in art/raw/ into phone-sized WebP files the game
loads from assets/bases/. Re-run after generating new art.

    python3 tools/export-art.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art" / "raw"
OUT = ROOT / "assets" / "bases"

# game name -> raw painting
STAGES = {}
for base, raw in {
    "train_car": ["base_train_car", "base_train_car_s1", "base_train_car_s2", "base_train_car_kitted"],
    "water_tower": ["base_water_tower", "base_water_tower_s1", "base_water_tower_s2", "base_water_tower_kitted"],
    "raft": ["base_raft_s0", "base_raft_s1", "base_raft_s2", "base_raft_kitted"],
}.items():
    for i, name in enumerate(raw):
        STAGES[f"{base}_{i}"] = name


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, raw in STAGES.items():
        src = RAW / f"{raw}.png"
        if not src.exists():
            print(f"missing {src.name}")
            continue
        dst = OUT / f"{name}.webp"
        Image.open(src).convert("RGB").save(dst, "WEBP", quality=82, method=4)
        print(f"{name}: {dst.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
