"""Is a redrawn whole-item slide still honest about the item? Checks for the re-lay, where the item moves, so the in-place
gate (research/studio/ben/prototype/gate.py, which aligns the render onto the photo) cannot run.

Pixel checks, no model, cheapest first:
  prints   every print and logo close-up is found again in the render (SIFT plus one homography), and looks the same there
  color    the item's median CIEDE2000 against the real photo, after the color is pushed back to the real one
  shape    width over length against the tape (8% band) or against the real photo's outline (12% band)
  layout   the outline matches the kind's template (ranks only)
A model check (judge) reads the render against the real photos: same item, every letter the same, no invented label,
every flaw still there. Either kind of miss drops the render; the real photo is used instead. Nothing here ranks a lie up.
"""
from __future__ import annotations

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "research", "studio", "ben", "prototype"))
from lab import deltaE_ciede2000, rgb2lab  # noqa: E402
from lay import layout, proportions  # noqa: E402
from seeded_faults import item_mask  # noqa: E402

BAND = {"tape": 0.08, "photo": 0.12}
PRINT_MIN_INLIERS = 14
PRINT_NCC = 0.45
COLOR_DRAWN = 10.0  # before push-back: past this the model drew a differently colored item, and no correction is trusted
SIDE = 1080


def fit(img: np.ndarray, side: int = SIDE) -> np.ndarray:
    h, w = img.shape[:2]
    s = side / max(h, w)
    return cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA) if s < 1 else img


def mask_of(img: np.ndarray) -> np.ndarray:
    return item_mask(img, inset=max(8, min(img.shape[:2]) // 54))


def _med_lab(img, m):
    return np.median(rgb2lab(img)[m.astype(bool)], axis=0)


def color_delta(src, ms, ren, mr) -> float:
    a, b = _med_lab(src, ms), _med_lab(ren, mr)
    return float(deltaE_ciede2000(a[None, None], b[None, None])[0, 0])


def push_color(src, ms, ren, mr) -> np.ndarray:
    """Real color wins: move the render's item to the real item's median L, a, b inside a feathered mask.
    Light falloff and texture stay the render's; the hue and depth of the cloth are the real ones."""
    lab = cv2.cvtColor(ren, cv2.COLOR_RGB2LAB).astype(np.float32)
    slab = cv2.cvtColor(src, cv2.COLOR_RGB2LAB).astype(np.float32)
    rm, sm = mr.astype(bool), ms.astype(bool)
    d = np.median(slab[sm], axis=0) - np.median(lab[rm], axis=0)
    feather = cv2.GaussianBlur(mr.astype(np.float32), (0, 0), 3)[..., None]
    out = np.clip(lab + d[None, None, :] * feather, 0, 255).astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_LAB2RGB)


def find_print(ref: np.ndarray, ren: np.ndarray) -> dict:
    """Where the print close-up `ref` sits in the render, and how alike the two look there."""
    sift = cv2.SIFT_create(3000)
    g1 = cv2.cvtColor(fit(ref, 900), cv2.COLOR_RGB2GRAY)
    g2 = cv2.cvtColor(ren, cv2.COLOR_RGB2GRAY)
    k1, d1 = sift.detectAndCompute(g1, None)
    k2, d2 = sift.detectAndCompute(g2, None)
    if d1 is None or d2 is None or len(k1) < 8 or len(k2) < 8:
        return {"found": False, "inliers": 0}
    pairs = cv2.BFMatcher().knnMatch(d1, d2, k=2)
    good = [a for a, b in (p for p in pairs if len(p) == 2) if a.distance < 0.8 * b.distance]
    if len(good) < 8:
        return {"found": False, "inliers": len(good)}
    p1 = np.float32([k1[g.queryIdx].pt for g in good])
    p2 = np.float32([k2[g.trainIdx].pt for g in good])
    H, inl = cv2.findHomography(p1, p2, cv2.RANSAC, 6.0)
    n = int(inl.sum()) if inl is not None else 0
    if H is None or n < PRINT_MIN_INLIERS:
        return {"found": False, "inliers": n}
    # compare the matched region: the render pulled back into the close-up's frame, inside the matched points' hull
    back = cv2.warpPerspective(g2, np.linalg.inv(H), (g1.shape[1], g1.shape[0]))
    hull = cv2.convexHull(p1[inl.ravel().astype(bool)].astype(np.int32))
    m = np.zeros_like(g1)
    cv2.fillConvexPoly(m, hull, 1)
    a, b = g1[m > 0].astype(np.float32), back[m > 0].astype(np.float32)
    ncc = float(((a - a.mean()) * (b - b.mean())).mean() / (a.std() * b.std() + 1e-6)) if a.size > 100 else 0.0
    return {"found": ncc >= PRINT_NCC, "inliers": n, "ncc": round(ncc, 3)}


def check(src: np.ndarray, ren: np.ndarray, template: str | None, prints: list[np.ndarray],
          tape_ratio: float | None = None) -> dict:
    """src: the real whole-item photo. ren: one candidate. prints: real close-ups (or cuts) of each print on this side.
    Returns {ok, reasons, numbers, image}; image is the render after the color push-back."""
    src, ren = fit(src), fit(ren)
    ms, mr = mask_of(src), mask_of(ren)
    out = {"numbers": {}, "reasons": []}
    if mr.mean() < 0.05:
        return {**out, "ok": False, "reasons": ["no item found in the render"], "image": ren}
    # the push-back makes the color right; it is never what proves the color was right, so the drift before it is the test
    drawn = color_delta(src, ms, ren, mr)
    out["numbers"]["color_before"] = round(drawn, 2)
    ren2 = push_color(src, ms, ren, mr)
    out["numbers"]["color"] = round(color_delta(src, ms, ren2, mr), 2)
    if drawn > COLOR_DRAWN:
        out["reasons"].append(f"the model drew the item {drawn:.0f} color units away from the real one")
    for i, ref in enumerate(prints):
        r = find_print(ref, ren2)
        out["numbers"][f"print_{i}"] = r
        if not r["found"]:
            out["reasons"].append(f"print {i} not found as it is in the real photo")
    kind = template or "shirt"
    if template:
        truth, band = (tape_ratio, BAND["tape"]) if tape_ratio else (proportions(ms, kind)["ratio"], BAND["photo"])
        got = proportions(mr, kind)["ratio"]
        off = got / truth - 1
        out["numbers"]["shape"] = {"render": got, "truth": round(truth, 3), "against": "tape" if tape_ratio else "photo", "off": round(off, 3)}
        if abs(off) > band:
            out["reasons"].append(f"proportions moved {off:+.0%} against the {'tape' if tape_ratio else 'photo'}")
        lay = layout(mr)
        out["numbers"]["layout"] = {"template": lay["template"], "overlap": lay["overlap"], "tilt": lay["tilt_deg"]}
    out["ok"] = not out["reasons"]
    out["image"] = ren2
    return out


JUDGE = """Image 1 is a real photo of a second-hand {name}. {refs}The last image is a redrawn listing photo of it, meant to show
the same item laid out flatter and neater, nothing else.

Compare the last image with the real photos and answer one JSON object:
{{
 "same_item": true if it is the same garment (cut, color, fabric, wear), false if anything about the item itself changed,
 "text_exact": true if every printed letter on the item matches the real photos exactly, false if any letter is missing, added or changed,
 "text_seen": the printed text you can read in the last image,
 "invented": anything in the last image that is not on the real item (a tag, label, text, logo, button, pocket, pattern), or [],
 "lost": anything on the real item missing from the last image (a print, a logo, a patch, a stain or other flaw: {flaws}), or [],
 "color": "same", "lighter", "darker" or "different hue",
 "flat": 0 still crumpled to 3 smooth and flat like an ironed garment,
 "laid": 0 messy to 3 straight, symmetric and complete like a catalog flat lay,
 "why": one sentence
}}"""


def judge(model: str, name: str, real: list[bytes], ren: bytes, flaws: list[str]) -> tuple[dict | None, dict]:
    from studio import openrouter
    refs = f"Images 2 to {len(real)} are close-ups of the same item. " if len(real) > 1 else ""
    prompt = JUDGE.format(name=name, refs=refs, flaws=", ".join(flaws) if flaws else "none were found")
    return openrouter.read(model, prompt, real + [ren], max_tokens=1500)


def judge_blocks(j: dict | None) -> list[str]:
    if not j:
        return ["the judge did not answer"]
    r = []
    if not j.get("same_item", False):
        r.append("judge: not the same item")
    if not j.get("text_exact", False):
        r.append("judge: printed text changed")
    if j.get("invented"):
        r.append("judge: invented " + ", ".join(map(str, j["invented"]))[:120])
    if j.get("lost"):
        r.append("judge: lost " + ", ".join(map(str, j["lost"]))[:120])
    if j.get("color") == "different hue":
        r.append("judge: different hue")
    return r
