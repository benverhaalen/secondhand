"""Three checks for a garment that gets laid out again or ironed by the image model.

wrinkle(img, mask)             how wrinkled the fabric looks, as one number; the ratio between
                               a render and its source says what share of the wrinkles went
layout(mask)                   is the item laid out well: which template it matches, how well,
                               how tilted, how lopsided; and what to do about it
proportions(mask, kind)        flat proportions from the outline (shirt: chest to length)
audit(render_mask, kind, truth_ratio or src_mask)
                               does the render keep the garment's real proportions, within a band

No model. Bands are agent proposals from one tee. Run from the repo root:
  python3 research/studio/ben/prototype/lay.py <source> [<render> ...]
"""
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seeded_faults import item_mask  # noqa: E402
from templates import SHAPES  # noqa: E402

BAND = dict(overlap=0.75, tilt_deg=5.0, lopsided=0.85, proportion=0.05)


def wrinkle(img, mask):
    """Mean strength of mid-size shading ripples on the fabric. Print and seams are left out
    (they are color edges, not shading), and so is the item's edge."""
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.float32)
    s = max(img.shape[:2]) / 1080.0
    m = cv2.erode(mask.astype(np.uint8), np.ones((int(25 * s) | 1,) * 2, np.uint8)).astype(bool)
    if m.sum() < 500:
        return 0.0
    med = np.median(lab[m], axis=0)
    off = np.hypot(lab[..., 1] - med[1], lab[..., 2] - med[2]) > 14        # print, tag, anything not fabric colored
    off = cv2.dilate(off.astype(np.uint8), np.ones((int(15 * s) | 1,) * 2, np.uint8)).astype(bool)
    L = lab[..., 0]
    band = cv2.GaussianBlur(L, (0, 0), 3 * s) - cv2.GaussianBlur(L, (0, 0), 16 * s)   # ripples a few mm to a few cm wide
    keep = m & ~off
    return float(np.abs(band[keep]).mean() / max(np.median(L[keep]), 1) * 100)


def _deskew(mask):
    """Rotate so the garment's long axis is upright. Returns (mask, tilt in degrees)."""
    ys, xs = np.where(mask > 0)
    pts = np.stack([xs, ys], 1).astype(np.float32)
    mean, vec = cv2.PCACompute(pts, mean=None)[:2]
    ang = np.degrees(np.arctan2(vec[0, 1], vec[0, 0]))          # long axis
    tilt = ((ang + 45) % 90) - 45                               # distance from the nearest frame axis
    h, w = mask.shape
    R = cv2.getRotationMatrix2D((float(mean[0, 0]), float(mean[0, 1])), tilt, 1.0)
    return cv2.warpAffine(mask.astype(np.uint8), R, (w, h), flags=cv2.INTER_NEAREST), float(tilt)


def _box(mask):
    ys, xs = np.where(mask > 0)
    return mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def _shape(name, h, w):
    c = np.zeros((h, w), np.uint8)
    cv2.fillPoly(c, [np.array([(x * (w - 1), y * (h - 1)) for x, y in SHAPES[name]], np.int32)], 1)
    return c


def layout(mask):
    up, tilt = _deskew(mask)
    b = _box(up)
    h, w = b.shape
    fits = {}
    for name in SHAPES:
        t = _shape(name, h, w)
        best = 0.0
        for cand in (t, t[::-1], t[:, ::-1], t[::-1, ::-1]):      # the garment may be upside down or facing the other way
            best = max(best, float((b & cand).sum() / max((b | cand).sum(), 1)))
        fits[name] = round(best, 2)
    kind = max(fits, key=fits.get)
    lop = float((b & b[:, ::-1]).sum() / max((b | b[:, ::-1]).sum(), 1)) if kind != "pants" else 1.0
    problems = []
    if fits[kind] < BAND["overlap"]:
        problems.append("does not fill the template shape: sleeves or legs are folded, bunched or hidden")
    if abs(tilt) > BAND["tilt_deg"]:
        problems.append(f"tilted {tilt:+.0f} degrees")
    if lop < BAND["lopsided"]:
        problems.append("lopsided: one side is laid differently from the other")
    return {"template": kind, "overlap": fits[kind], "all": fits, "tilt_deg": round(tilt, 1), "even_sides": round(lop, 2),
            "ok": not problems, "problems": problems,
            "do": "nothing" if not problems else "at capture: coach the person to the outline; after capture: offer a re-lay into the template"}


def proportions(mask, kind="shirt"):
    """Flat proportions from the outline, upright. Shirt and sweatshirt: body width across the
    lower third (below the sleeves) over the length, collar to hem. Pants: waist over length."""
    b = _box(_deskew(mask)[0])
    h, w = b.shape
    if kind == "pants":
        long_ax = max(h, w)
        b2 = b if h >= w else b.T
        waist = np.median(b2[: int(0.08 * long_ax)].sum(axis=1))
        return {"length_px": int(long_ax), "width_px": float(waist), "ratio": round(float(waist) / long_ax, 3)}
    rows = b[int(0.62 * h):int(0.92 * h)]
    width = float(np.median(rows.sum(axis=1)))
    return {"length_px": int(h), "width_px": width, "ratio": round(width / h, 3)}


def audit(render_mask, kind, truth_ratio):
    """truth_ratio: chest/length (or waist/length) from the tape or LiDAR at capture. A render
    whose proportions are off by more than the band has reshaped the garment."""
    r = proportions(render_mask, kind)
    off = r["ratio"] / truth_ratio - 1
    return {"render_ratio": r["ratio"], "truth_ratio": truth_ratio, "off": round(off, 3), "ok": abs(off) <= BAND["proportion"]}


def main():
    src = cv2.cvtColor(cv2.imread(sys.argv[1]), cv2.COLOR_BGR2RGB)
    sm = item_mask(src)
    lay = layout(sm)
    w0 = wrinkle(src, sm)
    p0 = proportions(sm, lay["template"])
    print("source  layout", lay, "\n        wrinkle", round(w0, 2), "proportions", p0)
    for path in sys.argv[2:]:
        r = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
        r = cv2.resize(r, (src.shape[1], src.shape[0]), interpolation=cv2.INTER_AREA)
        rm = item_mask(r)
        l2, w1 = layout(rm), wrinkle(r, rm)
        print(os.path.basename(path), "layout ok", l2["ok"], l2["overlap"], l2["tilt_deg"], l2["even_sides"],
              "| wrinkles removed", f"{(1 - w1 / w0) * 100:.0f}%", "| proportions", proportions(rm, lay["template"]))


if __name__ == "__main__":
    main()
