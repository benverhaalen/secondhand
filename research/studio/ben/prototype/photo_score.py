"""Photo score and no-model tweaks for a listing photo.

score(img, mask)        -> 0..100 and the parts it is made of (measured, no model)
tweak(img, mask, p)     -> the photo with exposure, contrast, shadows, highlights, sharpen applied
crop_for(img, mask, r)  -> largest crop of ratio r that holds the item with a margin (never pads)
optimise(img, mask)     -> tweak settings that raise the score most without changing the item's color

Every band and weight below is an agent proposal read off platform guidance and one study
(Ma et al. 2019, arXiv 1811.10648); none is calibrated against real sales. See ../photo-score.md.

Run: python3 photo_score.py <photo> [<photo> ...] [--out DIR]
"""
import itertools
import json
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from color import linear_to_srgb, srgb_to_linear  # noqa: E402
from gate import chroma_delta, normalise_light  # noqa: E402
from seeded_faults import item_mask  # noqa: E402

LUM = np.array([0.2126, 0.7152, 0.0722])

# part: (weight, zero_low, full_low, full_high, zero_high). Score is 1 inside [full_low, full_high]
# and falls in a straight line to 0 at zero_low and zero_high.
PARTS = {
    "exposure":   (0.20, 0.25, 0.50, 0.72, 0.92),   # mean frame brightness, 0..1
    "clipping":   (0.10, -1.0, -1.0, 0.02, 0.15),   # share of item pixels blown out or crushed (prints count, so the band is wide)
    "contrast":   (0.15, 0.25, 0.60, 1.00, 2.00),   # spread between 2nd and 98th brightness percentile
    "sharpness":  (0.15, 30.0, 150.0, 1e9, 2e9),    # variance of the Laplacian on the item
    "fill":       (0.15, 0.15, 0.45, 0.80, 0.97),   # item box area / frame area
    "centering":  (0.10, -1.0, -1.0, 0.03, 0.20),   # item box centre offset, share of frame
    "background": (0.15, -1.0, -1.0, 0.04, 0.18),   # brightness unevenness behind the item
}
EDITABLE = ("exposure", "clipping", "contrast", "sharpness")  # what tweak() can move
CROPPABLE = ("fill", "centering")                              # what crop_for() can move
# "background" moves only with a retake: the touch-up rule forbids changing it.

LIMITS = dict(ev=(-0.7, 0.7), contrast=(-0.15, 0.30), shadows=(0.0, 0.4), highlights=(0.0, 0.4), sharpen=(0.0, 0.6))
TRUTH = dict(chroma_de=2.0, item_clip=0.01)  # a tweak that moves the item's color more than this is refused


def _band(x, zl, fl, fh, zh):
    if fl <= x <= fh:
        return 1.0
    if x < fl:
        return float(np.clip((x - zl) / (fl - zl), 0, 1))
    return float(np.clip((zh - x) / (zh - fh), 0, 1))


def measure(img, mask):
    m = mask.astype(bool)
    g = (img.astype(np.float64) @ np.array([0.3, 0.6, 0.1])) / 255.0   # brightness as in Ma et al.
    scale = 1080.0 / max(img.shape[:2])
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    small = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else gray
    sm = cv2.resize(mask, (small.shape[1], small.shape[0]), interpolation=cv2.INTER_NEAREST).astype(bool)
    lap = cv2.Laplacian(small, cv2.CV_64F)
    ys, xs = np.where(m)
    h, w = mask.shape
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    item = img[m]
    bg = cv2.GaussianBlur(g, (0, 0), max(h, w) / 60.0)[~m]   # blur so floor texture does not count as clutter
    return {
        "exposure": float(g.mean()),
        "clipping": float(((item.max(axis=1) >= 250) | (item.max(axis=1) <= 5)).mean()),
        "contrast": float(np.percentile(g, 98) - np.percentile(g, 2)),
        "sharpness": float(lap[sm].var()),
        "fill": float((x1 - x0) * (y1 - y0) / (h * w)),
        "centering": float(max(abs((x0 + x1) / 2 - w / 2) / w, abs((y0 + y1) / 2 - h / 2) / h)),
        "background": float(bg.std()) if bg.size else 0.0,
    }


def score(img, mask):
    raw = measure(img, mask)
    parts = {k: _band(raw[k], *PARTS[k][1:]) for k in PARTS}
    total = 100 * sum(PARTS[k][0] * parts[k] for k in PARTS)
    return {"score": round(total, 1), "parts": {k: round(v, 2) for k, v in parts.items()},
            "raw": {k: round(v, 4) for k, v in raw.items()}}


def tweak(img, p):
    """Brightness-only edits: every pixel keeps its red:green:blue ratio, so hue and saturation
    are not edited. Sharpen is a light unsharp mask on brightness."""
    lin = srgb_to_linear(img)
    y = np.maximum(lin @ LUM, 1e-6)
    y2 = y * 2.0 ** p.get("ev", 0.0)
    y2 = y2 * (1 + 1.5 * p.get("shadows", 0.0) * np.clip(1 - y2, 0, 1) ** 3)
    y2 = y2 * (1 - p.get("highlights", 0.0) * np.clip(y2 - 0.6, 0, None))
    v = np.clip(y2, 0, 1) ** (1 / 2.2)
    v = np.clip(0.5 + (v - 0.5) * (1 + p.get("contrast", 0.0)), 0, 1)
    y2 = v ** 2.2
    a = p.get("sharpen", 0.0)
    if a > 0:
        blur = cv2.GaussianBlur(y2, (0, 0), 1.2)
        y2 = np.clip(y2 + a * (y2 - blur), 0, 1)
    return linear_to_srgb(lin * (y2 / y)[..., None])


def truthful(src, out, mask):
    """The item's color, with brightness taken out, must not move; and the item must not clip."""
    de = chroma_delta(src, normalise_light(src, out, mask), mask)
    item = out[mask.astype(bool)]
    clip = float(((item.max(axis=1) >= 250) | (item.max(axis=1) <= 5)).mean())
    base = src[mask.astype(bool)]
    clip0 = float(((base.max(axis=1) >= 250) | (base.max(axis=1) <= 5)).mean())
    return de <= TRUTH["chroma_de"] and clip <= max(TRUTH["item_clip"], clip0), round(de, 2)


def optimise(img, mask, steps=5, passes=2):
    """Coordinate search: move one setting at a time, keep a move only if the score rises
    and the photo stays truthful. Returns settings, before and after."""
    full, full_mask = img, mask
    f = 480.0 / max(img.shape[:2])           # search on a small copy; sharpen is judged at full size at the end
    if f < 1:
        img = cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
        mask = cv2.resize(mask, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)
    def obj(im):   # only the parts an edit may honestly move; flattening contrast to hide an uneven floor does not count
        pr = score(im, mask)["parts"]
        return 100 * sum(PARTS[k][0] * pr[k] for k in EDITABLE) / sum(PARTS[k][0] for k in EDITABLE)
    p = {k: 0.0 for k in LIMITS}
    best = obj(img)
    trail = [(dict(p), best)]
    for _ in range(passes):
        for k, (lo, hi) in LIMITS.items():
            for v in np.linspace(lo, hi, steps * 2 + 1):
                q = dict(p, **{k: float(round(v, 3))})
                out = tweak(img, q)
                s = obj(out)
                if s > best + 0.2 and truthful(img, out, mask)[0]:
                    p, best = q, s
                    trail.append((dict(p), best))
    # the search ran on a small copy: confirm at full size, backing off the edit that clips first
    for k in ("sharpen", "contrast", "ev"):
        while p[k] > 0 and not truthful(full, tweak(full, p), full_mask)[0]:
            p[k] = round(max(0.0, p[k] - 0.1), 3)
    return p, trail


def crop_for(img, mask, ratio, margin=0.06):
    """Largest w:h = ratio crop inside the frame, centred on the item, that holds the item box
    plus a margin. Never pads. Returns (crop, crop_mask, fits)."""
    h, w = mask.shape
    ys, xs = np.where(mask.astype(bool))
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    bw, bh = (x1 - x0) * (1 + 2 * margin), (y1 - y0) * (1 + 2 * margin)
    cw = max(bw, bh * ratio)                 # smallest crop that holds the item
    cw = min(cw, w, h * ratio)               # but never larger than the frame allows
    ch = cw / ratio
    fits = cw >= (x1 - x0) and ch >= (y1 - y0)   # the item itself is whole, even if the margin is thin
    cx = np.clip((x0 + x1) / 2, cw / 2, w - cw / 2)
    cy = np.clip((y0 + y1) / 2, ch / 2, h - ch / 2)
    xa, ya = int(round(cx - cw / 2)), int(round(cy - ch / 2))
    xb, yb = xa + int(cw), ya + int(ch)
    return img[ya:yb, xa:xb], mask[ya:yb, xa:xb], bool(fits)


RATIOS = {"1:1": 1.0, "3:4": 0.75, "4:5": 0.8}


def advice(parts):
    out = []
    if parts["background"] < 0.6:
        out.append("background is uneven or cluttered: retake on a plainer surface")
    if parts["sharpness"] < 0.5:
        out.append("soft or blurry: retake, hold still or tap to focus")
    if parts["fill"] < 0.6:
        out.append("item is small or cut off in the frame: retake closer, whole item in view")
    if parts["clipping"] < 0.3:
        out.append("parts of the item are blown out or crushed: retake in softer light")
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out_dir = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
    if out_dir:
        args.remove(out_dir)
        os.makedirs(out_dir, exist_ok=True)
    report = {}
    for path in args:
        img = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
        mask = item_mask(img)
        before = score(img, mask)
        p, trail = optimise(img, mask)
        out = tweak(img, p)
        ok, de = truthful(img, out, mask)
        after = score(out, mask)
        crops = {}
        for name, r in RATIOS.items():
            c, cm, fits = crop_for(out, mask, r)
            crops[name] = {"score": score(c, cm)["score"], "fits": fits}
            if out_dir:
                key = os.path.basename(os.path.dirname(path)) + "_" + name.replace(":", "x")
                cv2.imwrite(f"{out_dir}/{key}.jpg", cv2.cvtColor(c, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])
        report[path] = {"before": before, "settings": p, "after": after, "item_color_moved": de,
                        "truthful": ok, "steps": len(trail) - 1, "crops": crops, "advice": advice(after["parts"])}
        print(f"{path}\n  {before['score']} -> {after['score']}  settings {p}  color moved {de}\n"
              f"  crops {crops}\n  advice {report[path]['advice']}")
    if out_dir:
        json.dump(report, open(f"{out_dir}/report.json", "w"), indent=1)


if __name__ == "__main__":
    main()
