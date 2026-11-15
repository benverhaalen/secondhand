"""Where a photo's inches come from. A photo has no scale of its own; these find one.

tape_px_per_inch(img)   a cloth tape in the frame: the tick marks repeat every inch, so the strongest repeat along the
                        tape is pixels per inch. Reads the scale only; the number at the garment's edge is still read
                        by eye or by the vision model.
print_px_per_inch(ref, img, ref_box, width_in)
                        a print on the garment as a ruler: a screen print hardly folds or stretches, so once its width in
                        inches is known (taped once, or read off a photo with the tape beside it), every photo that shows
                        it has a scale: the scrunched phone photo, the redraw, the published slide. None when the match is
                        too thin or too bunched to trust a scale from.
"""
from __future__ import annotations

import cv2
import numpy as np


def _tape_band(img: np.ndarray) -> tuple[np.ndarray, str] | None:
    f = img.astype(np.float32)
    white = (f.min(axis=2) > 170) & (f.max(axis=2) - f.min(axis=2) < 40)
    for axis, name in ((1, "across"), (0, "down")):
        share = white.mean(axis=axis)
        rows = np.nonzero(share > 0.3)[0]
        if rows.size >= 0.03 * img.shape[1 - axis]:
            lo, hi = rows.min(), rows.max() + 1
            band = img[lo:hi] if axis == 1 else img[:, lo:hi].transpose(1, 0, 2)
            return band, name
    return None


def tape_px_per_inch(img: np.ndarray) -> dict | None:
    """The tape's inch in pixels. Ticks sit every eighth of an inch with a long mark and a number every inch, so the
    autocorrelation of the ink along the tape peaks at an eighth and every multiple; the inch is the multiple of eight
    whose peaks at one, two and three inches are strongest."""
    tb = _tape_band(img)
    if tb is None:
        return None
    band, way = tb
    ink = 255.0 - band.astype(np.float32).min(axis=2)
    p = ink.mean(axis=0)
    p = p - p.mean()
    ac = np.correlate(p, p, "full")[len(p) - 1:]
    if ac[0] <= 0:
        return None
    ac = ac / ac[0]
    best = None
    for inch in range(24, len(ac) // 3):
        score = sum(max(ac[k * inch - 1:k * inch + 2]) for k in (1, 2, 3)) / 3
        if best is None or score > best[1]:
            best = (inch, score)
    if best is None or best[1] < 0.3:
        return None
    # refine on the three-inch peak
    k3 = 3 * best[0]
    lo, hi = k3 - 4, k3 + 5
    peak = lo + int(np.argmax(ac[lo:hi]))
    return {"px_per_in": round(peak / 3, 2), "tape": way, "strength": round(float(best[1]), 2)}


def print_px_per_inch(ref: np.ndarray, img: np.ndarray, ref_box: list[float] | None, width_in: float) -> dict | None:
    """ref: a close-up of the print; ref_box: the print's box on it as [x0, y0, x1, y1] fractions; width_in: the print's
    real width. Finds the print in img by its own texture and returns img's pixels per inch at the print."""
    g1 = cv2.cvtColor(ref, cv2.COLOR_RGB2GRAY)
    g2 = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    h, w = g1.shape
    x0, y0, x1, y1 = ref_box or [0, 0, 1, 1]
    mask = np.zeros_like(g1)
    mask[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = 255
    sift = cv2.SIFT_create(6000)
    k1, d1 = sift.detectAndCompute(g1, mask)
    k2, d2 = sift.detectAndCompute(g2, None)
    if d1 is None or d2 is None or len(k1) < 8 or len(k2) < 8:
        return None
    good = [a for a, b in (m for m in cv2.BFMatcher().knnMatch(d1, d2, k=2) if len(m) == 2) if a.distance < 0.75 * b.distance]
    if len(good) < 12:
        return None
    src = np.float32([k1[m.queryIdx].pt for m in good])
    dst = np.float32([k2[m.trainIdx].pt for m in good])
    A, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=4)
    if A is None or inl.sum() < 12:
        return None
    pts = src[inl.ravel() > 0]
    box_w = (x1 - x0) * w
    spread = (pts[:, 0].max() - pts[:, 0].min()) / max(box_w, 1)
    if spread < 0.4:  # matches bunched in one corner of the print give a scale off by tens of percent
        return None
    s = float(np.hypot(A[0, 0], A[1, 0]))
    return {"px_per_in": round(box_w * s / width_in, 2), "inliers": int(inl.sum()), "spread": round(float(spread), 2)}
