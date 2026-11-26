#!/usr/bin/env python3
"""Build transparent sprite atlases from the named chroma-keyed artwork sheets.

Run with Python, Pillow and NumPy. The app build needs neither package.
"""
from argparse import ArgumentParser
from pathlib import Path

import numpy as np
from PIL import Image


SPRITES = {
    "directions": (4, 4, 110, 112, 117),
    "actions": (4, 4, 115, 110, 117),
    "heads": (4, 4, 110, 96, 111),
    "heads-profile": (4, 4, 110, 96, 111),
    "heads-back": (4, 4, 110, 96, 111),
    "garments": (4, 2, 98, 108, 117),
    "details": (4, 4, 110, 100, 122),
    "furnishings": (4, 4, 117, 118, 122),
    "relics": (4, 2, 111, 105, 122),
    "headwear": (4, 4, 114, 103, 119),
    "wardrobe": (4, 4, 103, 109, 117),
    "footwear": (4, 3, 110, 95, 117),
    "regional-objects": (2, 2, 111, 107, 122),
}


def chroma_key(image):
    rgb = np.array(image, dtype=np.int16)
    red, green, blue = rgb.transpose(2, 0, 1)
    background = (red > 140) & (blue > 130) & (red - green > 42) & (blue - green > 60)
    edge = (red > 140) & (blue > 94) & (blue > green + 36) & (blue > red * 0.58)
    alpha = np.where(background, 0, np.where(edge, 65, 255))
    red = np.where(edge, np.minimum(red, green + 72), red)
    blue = np.where(edge, np.minimum(blue, green + 24), blue)
    return Image.fromarray(np.stack([red, green, blue, alpha], axis=2).clip(0, 255).astype("uint8"))


def pack(input_file, target, kind):
    columns, rows, max_width, max_height, baseline = SPRITES[kind]
    image = Image.open(input_file).convert("RGB")
    atlas = Image.new("RGBA", (512, ((columns * rows + 3) // 4) * 128))
    for index in range(columns * rows):
        x, y = index % columns, index // columns
        sprite = chroma_key(image.crop((
            round(x * image.width / columns) + 3,
            round(y * image.height / rows) + 3,
            round((x + 1) * image.width / columns) - 3,
            round((y + 1) * image.height / rows) - 3,
        )))
        # The directional cap art is supplied facing left in columns 1 and 2.
        if kind == "headwear" and index in (9, 10):
            sprite = sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        alpha = sprite.getchannel("A")
        box = alpha.point(lambda pixel: 255 if pixel > 200 else 0).getbbox()
        if not box:
            raise ValueError(f"{kind}: empty sprite {index + 1}")
        left, top, right, bottom = box
        sprite = sprite.crop((max(0, left - 2), max(0, top - 2),
                              min(sprite.width, right + 2), min(sprite.height, bottom + 2)))
        sprite.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        if kind.startswith("heads") and sprite.height < 92:
            sprite = sprite.resize((min(113, round(sprite.width * 92 / sprite.height)), 92),
                                   Image.Resampling.LANCZOS)
        atlas.alpha_composite(sprite, (
            index % 4 * 128 + (128 - sprite.width) // 2,
            index // 4 * 128 + baseline - sprite.height,
        ))
    atlas.save(target, quality=90, method=6)


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=SPRITES)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    pack(args.source, args.output, args.kind)
