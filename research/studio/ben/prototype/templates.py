"""Blank garment templates, sized from the framing of Ben's own Depop photos.

For each garment type: a generic hand-drawn lay (no folds, nothing item-specific), sized to
the box the item fills in one of Ben's covers and laid the way he lays it, placed in a 3:4
frame with the item inside the centred square, which is the one capture that serves every
platform crop.

A template is used three ways: as the overlay the person lines the item up with at capture,
as the layout reference handed to the image model, and as the target the result is checked
against (templates.json carries the numbers).

Run from the repo root: python3 research/studio/ben/prototype/templates.py
"""
import json
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seeded_faults import item_mask  # noqa: E402

SRC = "assets/demo-items/real"
OUT = "research/studio/ben/templates"
W, H = 1200, 1600          # 3:4; the centred square is rows 200..1400
MARGIN = 0.07

TYPES = {
    "shirt":      dict(src="marquette-tee/01_cover.jpg", mirror=True),
    "sweatshirt": dict(src="chico-hoodie/01_cover.jpg", mirror=True),
    "pants":      dict(src="carhartt-pants/01_cover.jpg", mirror=False),
}

SHOTS = {  # the reference set: far, close and angles, in the order studio wants them
    "shirt":      ["front, whole item", "back, whole item", "neck tag", "print or logo, close", "fabric, close", "hem and cuffs", "any flaw, close"],
    "sweatshirt": ["front, whole item", "back, whole item", "neck tag", "print or logo, close", "fabric and cuff rib, close", "hood and drawstrings", "any flaw, close"],
    "pants":      ["front, whole item", "back, whole item", "waist tag and size", "fly and button, close", "fabric, close", "hems", "any flaw, close"],
}


def _sym(right):
    """Right half of a symmetric garment (x from 0.5 to 1) -> full outline."""
    return right + [(1 - x, y) for x, y in reversed(right)]


# Generic lay for each type, in a unit box (x right, y down). Hand-drawn, agent proposal.
SHAPES = {
    "shirt": _sym([(0.5, 0.10), (0.60, 0.03), (0.71, 0.07), (1.0, 0.30), (0.90, 0.47), (0.77, 0.37), (0.79, 1.0), (0.5, 1.0)]),
    "sweatshirt": _sym([(0.5, 0.0), (0.60, 0.03), (0.65, 0.14), (0.62, 0.23), (0.77, 0.28), (0.97, 0.68), (1.0, 0.86),
                        (0.88, 0.90), (0.79, 0.58), (0.80, 0.95), (0.77, 1.0), (0.5, 1.0)]),
    "pants": [(0.0, 0.04), (1.0, 0.0), (1.0, 0.42), (0.34, 0.48), (1.0, 0.58), (1.0, 1.0), (0.0, 0.96)],   # waist on the left, as Ben lays them
}


def outline(mask, name):
    """The generic shape, sized to the box Ben's own item fills in his photo."""
    ys, xs = np.where(mask > 0)
    bw, bh = xs.max() - xs.min(), ys.max() - ys.min()
    side = W * (1 - 2 * MARGIN)
    s = side / max(bw, bh)
    w, h = bw * s, bh * s
    x0, y0 = (W - w) / 2, (H - h) / 2
    poly = np.array([(x0 + x * w, y0 + y * h) for x, y in SHAPES[name]], np.int32)
    canvas = np.zeros((H, W), np.uint8)
    cv2.fillPoly(canvas, [poly], 255)
    k = int(W * 0.03) | 1                       # round the corners
    canvas = (cv2.GaussianBlur(canvas, (k, k), 0) > 127).astype(np.uint8)
    cs, _ = cv2.findContours(canvas, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    return max(cs, key=cv2.contourArea)[:, 0, :]


def draw(pts, path, dash=26, gap=18):
    img = np.full((H, W, 3), 255, np.uint8)
    cv2.rectangle(img, (0, (H - W) // 2), (W - 1, (H + W) // 2), (225, 225, 225), 2)   # the centred square
    n, i = len(pts), 0
    while i < n:                                                                       # dashes by distance along the outline
        seg = pts[i:min(i + dash, n)].reshape(-1, 1, 2)
        cv2.polylines(img, [seg], False, (40, 40, 40), 5, cv2.LINE_AA)
        i += dash + gap
    cv2.imwrite(path, img)
    cv2.imwrite(path.replace(".png", "_1x1.png"), img[(H - W) // 2:(H + W) // 2])   # the square crop, for 1:1 sources


def main():
    os.makedirs(OUT, exist_ok=True)
    spec = {}
    for name, t in TYPES.items():
        img = cv2.cvtColor(cv2.imread(f"{SRC}/{t['src']}"), cv2.COLOR_BGR2RGB)
        pts = outline(item_mask(img), name)
        draw(pts, f"{OUT}/{name}.png")
        x, y, w, h = cv2.boundingRect(pts)
        d = "M " + " L ".join(f"{int(px)} {int(py)}" for px, py in pts[::6]) + " Z"
        open(f"{OUT}/{name}.svg", "w").write(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><path d="{d}" fill="none" '
            f'stroke="#282828" stroke-width="5" stroke-dasharray="14 10"/></svg>\n')
        spec[name] = {
            "frame": [W, H], "ratio": "3:4", "centred_square": [0, (H - W) // 2, W, W],
            "item_box": [int(x), int(y), int(w), int(h)],
            "fill_of_square": round(w * h / (W * W), 2),
            "outline_png": f"{name}.png", "outline_svg": f"{name}.svg",
            "sized_from": t["src"], "shots": SHOTS[name],
        }
        print(name, spec[name]["item_box"], spec[name]["fill_of_square"], len(pts), "points")
    json.dump(spec, open(f"{OUT}/templates.json", "w"), indent=1)


if __name__ == "__main__":
    main()
