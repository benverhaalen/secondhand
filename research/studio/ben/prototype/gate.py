"""Fidelity gate prototype: does a render still show the same item?

The render is required to keep the original framing (relight in place), so the
item is aligned with a feature-matched homography. Then four deterministic
checks run; each returns a number and a pass/fail against a threshold.

  chroma   item color, after removing the render's global light change
  struct   item structure (seams, print, stains), lighting-invariant
  regions  every protected box (logo, tag, each confirmed defect) on its own
  align    whether the render kept the framing at all

A VLM judge (Decisions API predicates) runs beside this; see the plan.
"""
import cv2
import numpy as np
from skimage.color import rgb2lab, deltaE_ciede2000
from color import srgb_to_linear, linear_to_srgb

THRESH = dict(
    align_inliers=0.60,     # share of matches that agree with one homography (0.35 let a mirrored pair of shoes through)
    chroma_de=4.5,          # median CIEDE2000 inside the item after light normalisation;
                            # benign relights scored 1.5-3.1, an 18 degree hue shift on denim 5.7 (3 items only)
    struct_floor=0.55,      # worst 5% of item tiles: gradient-orientation agreement
    region_floor=0.60,      # each protected box: same measure
)


def _gray(u8):
    return cv2.cvtColor(u8, cv2.COLOR_RGB2GRAY)


def align(src, dst, mask):
    """Homography taking src pixels onto dst. Returns H and inlier share."""
    sift = cv2.SIFT_create(4000)
    k1, d1 = sift.detectAndCompute(_gray(src), mask.astype(np.uint8) * 255)
    k2, d2 = sift.detectAndCompute(_gray(dst), None)
    if d1 is None or d2 is None or len(k1) < 12 or len(k2) < 12:
        return None, 0.0
    m = cv2.BFMatcher().knnMatch(d1, d2, k=2)
    good = [a for a, b in (p for p in m if len(p) == 2) if a.distance < 0.75 * b.distance]
    if len(good) < 12:
        return None, 0.0
    p1 = np.float32([k1[g.queryIdx].pt for g in good])
    p2 = np.float32([k2[g.trainIdx].pt for g in good])
    H, inl = cv2.findHomography(p1, p2, cv2.RANSAC, 4.0)
    return H, float(inl.sum()) / len(good) if H is not None else 0.0


def warp(img, H, shape):
    return cv2.warpPerspective(img, H, (shape[1], shape[0]), flags=cv2.INTER_LINEAR)


def normalise_light(src, dst, mask, preset_cast=(1.0, 1.0, 1.0)):
    """Undo the light the preset declared, plus one brightness scalar.

    A free per-channel gain would also undo a real colour change on a one-colour
    item (brown jacket turned olive is indistinguishable from olive light), so
    only the preset's known cast is removed. Studio declares neutral light.
    """
    m = mask.astype(bool)
    ls = srgb_to_linear(src)
    ld = srgb_to_linear(dst) / np.array(preset_cast)
    lum = np.array([0.2126, 0.7152, 0.0722])
    s = np.median(ls[m] @ lum) / max(np.median(ld[m] @ lum), 1e-4)
    return linear_to_srgb(ld * s)


def chroma_delta(src, dst, mask):
    m = mask.astype(bool)
    de = deltaE_ciede2000(rgb2lab(src[m][None]), rgb2lab(dst[m][None]))
    return float(np.median(de))


def _orient(u8):
    g = cv2.GaussianBlur(_gray(u8).astype(np.float32), (0, 0), 1.2)
    gx, gy = cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1)
    return gx, gy


def tile_structure(src, dst, mask, tile=32):
    """Per-tile agreement of gradient fields (normalised cross-correlation of gx, gy).

    Gradient direction survives a change of light much better than raw
    intensity, but vanishes when a logo, seam or stain is painted out.
    Tiles with almost no texture in the source are skipped (they carry no evidence).
    """
    sx, sy = _orient(src)
    dx, dy = _orient(dst)
    h, w = mask.shape
    scores = []
    for y in range(0, h - tile + 1, tile // 2):
        for x in range(0, w - tile + 1, tile // 2):
            if mask[y:y + tile, x:x + tile].mean() < 0.9:
                continue
            a = np.stack([sx[y:y + tile, x:x + tile], sy[y:y + tile, x:x + tile]]).ravel()
            b = np.stack([dx[y:y + tile, x:x + tile], dy[y:y + tile, x:x + tile]]).ravel()
            if np.linalg.norm(a) < 1e-3 * a.size * 4:
                continue
            scores.append(((y, x), float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-6))))
    return scores


def region_score(src, dst, box):
    x, y, w, h = box
    s = tile_structure(src[y:y + h, x:x + w], dst[y:y + h, x:x + w],
                       np.ones((h, w), np.uint8), tile=min(16, w, h))
    return float(np.median([v for _, v in s])) if s else 0.0


def gate(src, render, mask, protected, preset_cast=(1.0, 1.0, 1.0)):
    """src: color-corrected original (RGB u8). render: generated image (RGB u8),
    resized to src. mask: item mask on src. protected: {name: (x,y,w,h)} on src."""
    out = {}
    H, inl = align(src, render, mask)
    out["align"] = (inl, inl >= THRESH["align_inliers"])
    if H is None or inl < THRESH["align_inliers"]:
        out["verdict"] = "reject: framing changed, cannot verify"
        return out
    # bring render into the source frame
    back = warp(render, np.linalg.inv(H), src.shape)
    valid = warp(np.ones(render.shape[:2], np.uint8), np.linalg.inv(H), src.shape)
    m = (mask.astype(bool) & valid.astype(bool)).astype(np.uint8)
    norm = normalise_light(src, back, m, preset_cast)
    de = chroma_delta(src, norm, m)
    out["chroma"] = (de, de <= THRESH["chroma_de"])
    tiles = tile_structure(src, back, m)
    worst = float(np.percentile([v for _, v in tiles], 5)) if tiles else 0.0
    out["struct"] = (worst, worst >= THRESH["struct_floor"])
    for name, box in protected.items():
        r = region_score(src, back, box)
        out[f"region:{name}"] = (r, r >= THRESH["region_floor"])
    fails = [k for k, v in out.items() if isinstance(v, tuple) and not v[1]]
    out["verdict"] = "pass" if not fails else "reject: " + ", ".join(fails)
    out["_worst_tiles"] = sorted(tiles, key=lambda t: t[1])[:5]
    return out
