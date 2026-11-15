"""Measure a flat-laid top in pixels the way a seller measures it with a tape, so a photo can be held to the tape.

A photo has no scale: nothing in it says how many pixels make an inch. So one tape number calibrates the photo and every
other tape number is a test. For a tee that is one test (pit to pit, with the length as the ruler); a sweatshirt or hoodie
with the sleeve taped gives two. The lines this draws are the same lines a person would lay a ruler on, so anyone can
check the numbers by eye.

  pit_to_pit  straight across the body one inch below the armpits, edge to edge (slides.json "measurements")
  length      from the highest point of the shoulder beside the collar or hood straight down to the hem

measure(mask) returns pixel lengths and the end points of each line in the image's own coordinates, or None for a line
it cannot place (a sleeve folded against the body hides the armpit, so there is no honest pit line to draw).
"""
from __future__ import annotations

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "research", "studio", "ben", "prototype"))
from lay import _deskew  # noqa: E402

INCH_GUESS = 28.0  # inches in a top's length, only to place the pit line one inch under the armpit before the tape is known


def _runs(row: np.ndarray) -> list[tuple[int, int]]:
    d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
    return list(zip(np.nonzero(d == 1)[0], np.nonzero(d == -1)[0] - 1))


def _run_at(row: np.ndarray, x: int) -> tuple[int, int] | None:
    runs = _runs(row)
    if not runs:
        return None
    inside = [r for r in runs if r[0] <= x <= r[1]]
    return inside[0] if inside else min(runs, key=lambda r: min(abs(r[0] - x), abs(r[1] - x)))


def _clean(mask: np.ndarray) -> np.ndarray:
    m = (mask > 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n > 1:
        m = (lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    k = max(3, int(min(m.shape) / 180) | 1)
    return cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))


def measure(mask: np.ndarray, length_in: float | None = None) -> dict:
    """mask: the item's outline (any size). length_in: the taped length, to place the pit line exactly one inch down."""
    m = _clean(mask)
    _, tilt = _deskew(m)
    ys, xs = np.nonzero(m)
    c = (float(xs.mean()), float(ys.mean()))
    R = cv2.getRotationMatrix2D(c, tilt, 1.0)
    up = cv2.warpAffine(m, R, (m.shape[1], m.shape[0]), flags=cv2.INTER_NEAREST)
    Ri = cv2.invertAffineTransform(R)
    back = lambda x, y: tuple(float(v) for v in Ri @ np.array([x, y, 1.0]))

    ys, xs = np.nonzero(up)
    y0, y1 = int(ys.min()), int(ys.max())
    H = y1 - y0
    # body: the run through the item's middle, in the lower body where no sleeve reaches
    lower = up[y0 + int(0.6 * H): y0 + int(0.88 * H)]
    cx = int(np.median(np.nonzero(lower)[1]))
    widths = [(r[1] - r[0] + 1) for r in (_run_at(row, cx) for row in lower) if r]
    W = float(np.median(widths))

    # hem: the bottom of the body in its middle third
    cols = range(int(cx - W / 6), int(cx + W / 6))
    bottoms = [np.nonzero(up[:, x])[0].max() for x in cols if up[:, x].any()]
    hem = float(np.median(bottoms))

    # shoulders beside the collar or hood: walk out from the middle along the top edge. A hood (or a collar standing up)
    # is a step down in the top edge; the shoulder starts past the biggest step. No step: the highest point near the neck.
    def top(x):
        col = np.nonzero(up[:, int(x)])[0]
        return float(col.min()) if col.size else np.nan

    hps = []
    for sgn in (-1, 1):
        xs_side = [cx + sgn * f * W for f in np.linspace(0.05, 0.5, 46)]
        t = np.array([top(x) for x in xs_side])
        steps = np.diff(t)
        k = int(np.nanargmax(steps)) if np.isfinite(steps).any() else 0
        if np.isfinite(steps).any() and steps[k] > 0.06 * H:
            j = min(k + 2, len(t) - 1)
            hps.append((xs_side[j], t[j]))
        else:
            near = [(x, v) for x, v in zip(xs_side, t) if 0.12 * W <= abs(x - cx) <= 0.3 * W and np.isfinite(v)]
            hps.append(min(near, key=lambda q: q[1]))
    hps_y = float(np.mean([h[1] for h in hps]))
    length_px = hem - hps_y
    out = {"tilt_deg": round(tilt, 1), "length_px": round(length_px, 1),
           "length_line": [back(cx, hps_y), back(cx, hem)], "hps": [back(*h) for h in hps], "body_px": round(W, 1)}

    # armpit: the top of the gap between each sleeve and the body. The gap is background inside the item's convex hull,
    # running down the body's side; its highest point is where the sleeve joins the body.
    inch = length_px / (length_in or INCH_GUESS)
    hull = np.zeros_like(up)
    cv2.fillPoly(hull, [cv2.convexHull(np.stack(np.nonzero(up)[::-1], 1).astype(np.int32))], 1)
    gaps = ((hull > 0) & (up == 0)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(gaps, 8)
    pits = {}
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if area < 0.002 * up.size or y + h < hps_y + 0.45 * length_px:
            continue  # small, or not reaching down the body's side
        side = -1 if x + w / 2 < cx else 1
        # only where the gap touches the body's side: its far end is the sleeve's cuff, which sits higher than the armpit
        edge = cx + side * W / 2
        lo, hi = sorted((int(edge - side * 0.03 * W), int(edge + side * 0.08 * W)))
        band = (lab[:, max(lo, 0):hi] == i)
        rows = np.nonzero(band.any(axis=1))[0]
        top = int(rows.min()) if rows.size and rows.min() > hps_y + 0.12 * length_px else None
        if top is not None and (side not in pits or top < pits[side]):
            pits[side] = top
    if len(pits) < 2 or abs(pits[-1] - pits[1]) > 0.08 * length_px:
        out.update(pit_px=None, pit_line=None, note="no armpit on one side or both: a sleeve lies against the body, so no pit line")
        return out
    pit_y = max(pits.values())
    if not 0.2 * length_px <= pit_y - hps_y <= 0.5 * length_px:
        # an armpit sits a fifth to a half of the way down; lower means a sleeve lies along the body and the gap seen
        # is under a cuff
        out.update(pit_px=None, pit_line=None, note=f"the gap under the sleeve starts {(pit_y - hps_y) / length_px:.0%} of the way down, so a sleeve lies along the body")
        return out
    y = int(round(pit_y + inch))
    r = _run_at(up[y], cx)
    w = r[1] - r[0] + 1
    if not 0.85 * W <= w <= 1.25 * W:
        out.update(pit_px=None, pit_line=None, note=f"the pit row runs {w / W:.2f}x the body: a sleeve overlaps it")
        return out
    out.update(pit_px=float(w), pit_line=[back(r[0], y), back(r[1] + 1, y)], armpit_y=pit_y)
    return out


def against_tape(mx: dict, tape: dict) -> dict:
    """Calibrate on the length, test the pit to pit. Returns inches read off the photo and the error."""
    if not mx.get("pit_px") or not tape.get("length") or not tape.get("pit_to_pit"):
        return {"tested": False}
    ppi = mx["length_px"] / tape["length"]
    pit_in = mx["pit_px"] / ppi
    return {"tested": True, "px_per_in": round(ppi, 2), "length_in": tape["length"], "pit_in": round(pit_in, 2),
            "pit_tape": tape["pit_to_pit"], "off_in": round(pit_in - tape["pit_to_pit"], 2),
            "off": round(pit_in / tape["pit_to_pit"] - 1, 4)}
