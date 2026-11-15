"""Is a redrawn whole-item slide still honest about the item? Checks for the re-lay, where the item moves, so the in-place
gate (research/studio/ben/prototype/gate.py, which aligns the render onto the photo) cannot run.

Pixel checks, no model, cheapest first:
  prints   every print and logo close-up is found again in the render (SIFT plus one homography), and looks the same there
  color    the item's median CIEDE2000 against the real photo, after the color is pushed back to the real one
  shape    width over length against the tape (8% band); with no tape reading the redraw is never shown (Ben, 2026-11-15)
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

BAND = {"tape": 0.08}  # honest pants redraws read 1 to 6% against the tape
PRINT_MIN_INLIERS = 14
PRINT_NCC = 0.45
PRINT_COVER = 0.5  # share of the print's box the matched points span
COLOR_DRAWN = 10.0  # before push-back: past this the model drew a differently colored item, and no correction is trusted
SIDE = 1080


def fit(img: np.ndarray, side: int = SIDE) -> np.ndarray:
    h, w = img.shape[:2]
    s = side / max(h, w)
    return cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA) if s < 1 else img


def mask_of(img: np.ndarray) -> np.ndarray:
    """The item's outline. GrabCut runs at 540 px (four times faster than full size) and the mask is scaled back."""
    small = fit(img, 540)
    m = item_mask(small, inset=max(6, min(small.shape[:2]) // 54))
    return cv2.resize(m, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)


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


def _match(ref: np.ndarray, ren: np.ndarray):
    """SIFT matches from a real print to the render, and one homography. Returns (H, inlier points on ref, n, ref gray)."""
    sift = cv2.SIFT_create(3000)
    r = fit(ref, 900)
    g1, g2 = cv2.cvtColor(r, cv2.COLOR_RGB2GRAY), cv2.cvtColor(ren, cv2.COLOR_RGB2GRAY)
    k1, d1 = sift.detectAndCompute(g1, None)
    k2, d2 = sift.detectAndCompute(g2, None)
    if d1 is None or d2 is None or len(k1) < 8 or len(k2) < 8:
        return None, None, 0, r
    pairs = cv2.BFMatcher().knnMatch(d1, d2, k=2)
    good = [a for a, b in (p for p in pairs if len(p) == 2) if a.distance < 0.8 * b.distance]
    if len(good) < 8:
        return None, None, len(good), r
    p1 = np.float32([k1[g.queryIdx].pt for g in good])
    p2 = np.float32([k2[g.trainIdx].pt for g in good])
    H, inl = cv2.findHomography(p1, p2, cv2.RANSAC, 6.0)
    n = int(inl.sum()) if inl is not None else 0
    return H, (p1[inl.ravel().astype(bool)] if n else None), n, r


def find_print(ref: np.ndarray, ren: np.ndarray, box=None) -> dict:
    """Where the real print sits in the render, and how alike the two look there (before anything is pasted)."""
    H, pts, n, r = _match(ref, ren)
    if H is None or n < PRINT_MIN_INLIERS:
        return {"found": False, "inliers": n}
    if np.linalg.det(H[:2, :2]) < 0:  # a print that only matches flipped was mirrored; letters like CHICO match both ways
        return {"found": False, "inliers": n, "mirrored": True}
    g1 = cv2.cvtColor(r, cv2.COLOR_RGB2GRAY)
    back = cv2.warpPerspective(cv2.cvtColor(ren, cv2.COLOR_RGB2GRAY), np.linalg.inv(H), (g1.shape[1], g1.shape[0]))
    m = np.zeros_like(g1)
    cv2.fillConvexPoly(m, cv2.convexHull(pts.astype(np.int32)), 1)
    a, b = g1[m > 0].astype(np.float32), back[m > 0].astype(np.float32)
    ncc = float(((a - a.mean()) * (b - b.mean())).mean() / (a.std() * b.std() + 1e-6)) if a.size > 100 else 0.0
    # the matches must spread over the whole print, not a few letters that read the same either way round (H, I, O)
    cover = 1.0
    if box:
        bm = box_mask(r, box) > 0
        cover = float((bm & (m > 0)).sum() / max(bm.sum(), 1))
    return {"found": ncc >= PRINT_NCC and cover >= PRINT_COVER, "inliers": n, "ncc": round(ncc, 3), "cover": round(cover, 2),
            "H": H, "pts": pts, "ref": r}


def ink(ref: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """Where to paste: the hull of the densest cluster of matched points. A print is where the matches crowd; a collar,
    a tag or a fold at the edge of the close-up gets a few stray matches and stays out."""
    h, w = ref.shape[:2]
    m = np.zeros((h, w), np.uint8)
    if pts is None or len(pts) < 4:
        return m
    r = 0.12 * max(h, w)
    d = np.linalg.norm(pts[:, None, :] - pts[None, :, :], axis=2)
    near = (d < r).sum(axis=1)
    core = pts[near >= 0.4 * near.max()]
    cv2.fillConvexPoly(m, cv2.convexHull(core.astype(np.int32)), 255)
    return cv2.dilate(m, np.ones((13, 13), np.uint8))


def box_mask(ref: np.ndarray, box) -> np.ndarray:
    """The print's box on the close-up (fractions), as a mask at the size find_print matched at."""
    h, w = ref.shape[:2]
    m = np.zeros((h, w), np.uint8)
    x0, y0, x1, y1 = box
    m[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = 255
    return m


def _lab(img):
    return cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.float32)


def paste_print(ren: np.ndarray, hit: dict, box=None) -> np.ndarray:
    """The real print's ink, warped onto where the model drew it, and nothing around it.
    Inside the print's box, ink is what is far from the fabric at the box's edge; the fabric between the letters stays
    the render's, so no square patch shows. The ink keeps its real contrast to the fabric, moved to the render's light."""
    ref, H = hit["ref"], hit["H"]
    area = box_mask(ref, box) if box else ink(ref, hit["pts"])
    if area.sum() == 0:
        return ren
    inner = cv2.erode(area, np.ones((15, 15), np.uint8))
    ring = (area > 0) & (inner == 0)
    lr = _lab(ref)
    fab_ref = np.median(lr[ring], axis=0) if ring.sum() > 20 else np.median(lr[area > 0], axis=0)
    diff = lr - fab_ref
    far = np.sqrt((0.5 * diff[..., 0]) ** 2 + diff[..., 1] ** 2 + diff[..., 2] ** 2) > 18
    inkm = (far & (area > 0)).astype(np.uint8)
    inkm = cv2.morphologyEx(inkm, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    inkm = cv2.dilate(inkm, np.ones((5, 5), np.uint8)) * 255
    h, w = ren.shape[:2]
    warped = cv2.warpPerspective(ref, H, (w, h), flags=cv2.INTER_AREA)
    wink = cv2.warpPerspective(inkm, H, (w, h)) > 127
    wring = cv2.warpPerspective(ring.astype(np.uint8) * 255, H, (w, h)) > 127
    if wink.sum() < 30 or wring.sum() < 20:
        return ren
    lren = _lab(ren)
    lw = _lab(warped)
    lw[wink] += np.median(lren[wring], axis=0) - fab_ref  # same offset from the fabric as on the real shirt
    warped = cv2.cvtColor(np.clip(lw, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
    f = cv2.GaussianBlur(wink.astype(np.float32), (0, 0), 1.2)[..., None]
    return (warped * f + ren * (1 - f)).astype(np.uint8)


PRESS = 0.35  # share of the fold shading taken out. 60% (run 20261115-0836) left blotches that could read as stains; 35% did not


def press(img: np.ndarray, mask: np.ndarray, k: float = PRESS) -> np.ndarray:
    """The last of the wrinkles, without a model: take out a share of the fold-sized shading ripples (the same band
    lay.wrinkle measures) on plain cloth only. Prints, tags and anything not the cloth's color are left alone, and only
    lightness moves, never hue, so nothing can be drawn in. Coarser tone (fading across a panel) is outside the band.
    Used on tops only: on faded denim and canvas the fading itself sits in this band."""
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.float32)
    s = max(img.shape[:2]) / 1080
    m = cv2.erode(mask.astype(np.uint8), np.ones((int(9 * s) | 1,) * 2, np.uint8)).astype(bool)
    if m.sum() < 500:
        return img
    med = np.median(lab[m], axis=0)
    off = (np.hypot(lab[..., 1] - med[1], lab[..., 2] - med[2]) > 14) | (np.abs(lab[..., 0] - med[0]) > 60)
    off = cv2.dilate(off.astype(np.uint8), np.ones((int(15 * s) | 1,) * 2, np.uint8)).astype(bool)
    L = lab[..., 0]
    band = cv2.GaussianBlur(L, (0, 0), 7 * s) - cv2.GaussianBlur(L, (0, 0), 45 * s)
    w = cv2.GaussianBlur((m & ~off).astype(np.float32), (0, 0), 6 * s)
    lab[..., 0] = L - k * band * w
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)


def _scale_once(ren, mr, s):
    """Wider by s about the centre, if the item still fits the frame; else shorter by 1/s with the floor mirrored into
    the gap, only when the rows mirrored are bare floor. None when neither is possible."""
    h, w = ren.shape[:2]
    xs = np.nonzero(mr.any(axis=0))[0]
    ys = np.nonzero(mr.any(axis=1))[0]
    if s >= 1 and (xs.max() - xs.min()) * s < 0.96 * w:
        wide = cv2.resize(ren, (round(w * s), h), interpolation=cv2.INTER_CUBIC)
        x = (wide.shape[1] - w) // 2
        return wide[:, x:x + w]
    nh = round(h / s)
    if nh >= h:
        img = cv2.resize(ren, (w, nh), interpolation=cv2.INTER_CUBIC)
        y = (nh - h) // 2
        top, bottom = ys.min() * nh / h - y, ys.max() * nh / h - y
        return img[y:y + h] if top > 0 and bottom < h else None
    img = cv2.resize(ren, (w, nh), interpolation=cv2.INTER_AREA)
    t = (h - nh) // 2
    gap = max(t, h - nh - t) + 2
    if ys.min() * nh / h < gap or (h - ys.max()) * nh / h < gap:
        return None
    return cv2.copyMakeBorder(img, t, h - nh - t, 0, 0, cv2.BORDER_REFLECT)


def set_shape(ren: np.ndarray, mr: np.ndarray, kind: str, truth: float) -> tuple[np.ndarray, float]:
    """Scale the render so the garment's width over length is the tape's. The model decides how long a shirt is, and
    decided it differently every time (8% spread in the build plan); the tape does not. Two passes, since the outline
    is measured again after each. Returns (image, total scale)."""
    total = 1.0
    for _ in range(2):
        s = truth / proportions(mr, kind)["ratio"]
        if abs(s - 1) < 0.015:
            break
        nxt = _scale_once(ren, mr, s)
        if nxt is None:
            break
        ren, mr = nxt, mask_of(nxt)
        total *= s
    return ren, total


def check(src: np.ndarray, ren: np.ndarray, template: str | None, prints: list[np.ndarray],
          tape_ratio: float | None = None, laid_well: bool = True, repair: bool = True) -> dict:
    """src: the real whole-item photo. ren: one candidate. prints: real close-ups (or cuts) of each print on this side.
    Order: drift test, shape to the tape, find each print, paste the real print back, color back to the real item, shape test.
    Returns {ok, reasons, numbers, image}."""
    src, ren = fit(src), fit(ren)
    ms, mr = mask_of(src), mask_of(ren)
    out = {"numbers": {}, "reasons": [], "repairs": []}
    if mr.mean() < 0.05:
        return {**out, "ok": False, "reasons": ["no item found in the render"], "image": ren}
    # the push-back makes the color right; it is never what proves the color was right, so the drift before it is the test
    drawn = color_delta(src, ms, ren, mr)
    out["numbers"]["color_before"] = round(drawn, 2)
    if drawn > COLOR_DRAWN:
        out["reasons"].append(f"the model drew the item {drawn:.0f} color units away from the real one")
    kind = template or "shirt"
    if template and tape_ratio and repair:
        first = proportions(mr, kind)["ratio"]
        out["numbers"]["shape_drawn"] = {"render": first, "tape": round(tape_ratio, 3), "off": round(first / tape_ratio - 1, 3)}
        if abs(first / tape_ratio - 1) > 0.2:
            out["reasons"].append(f"drawn {first / tape_ratio - 1:+.0%} off the tape, too far to set right")
        else:
            ren, sc = set_shape(ren, mr, kind, tape_ratio)
            mr = mask_of(ren)
            out["repairs"].append(f"width set to the tape (x{sc:.2f})")
    for i, pr in enumerate(prints):
        ref, box = (pr["img"], pr.get("box")) if isinstance(pr, dict) else (pr, None)
        if min(ref.shape[:2]) < 96:
            out["numbers"][f"print_{i}"] = {"skipped": "too small to match; the judge reads it"}
            continue
        r = find_print(ref, ren, box)
        out["numbers"][f"print_{i}"] = {k: v for k, v in r.items() if k in ("found", "inliers", "ncc", "cover", "mirrored")}
        if not r["found"]:
            out["reasons"].append(f"print {i} not found as it is in the real photo")
        elif repair:
            ren = paste_print(ren, r, box)
            out["repairs"].append(f"print {i} is the real pixels")
    ren = push_color(src, ms, ren, mr)
    out["numbers"]["color"] = round(color_delta(src, ms, ren, mr), 2)
    if template:
        got = proportions(mr, kind)["ratio"]
        if tape_ratio:
            off = got / tape_ratio - 1
            out["numbers"]["shape"] = {"render": got, "truth": round(tape_ratio, 3), "against": "tape", "off": round(off, 3)}
            if abs(off) > BAND["tape"]:
                out["reasons"].append(f"proportions {off:+.0%} against the tape")
        else:
            # Ben, 2026-11-15 08:09: a redraw is only trusted when the item has dimensions. The model sets the length by
            # itself (the tee came back about 2 in narrow), and a photo outline is not a measurement, so without a tape
            # reading the redraw is dropped and the real photo is used. The outline comparison is kept as a number only.
            out["reasons"].append("no tape reading: a redraw is shown only when the tape can check its size")
            if laid_well:
                truth = proportions(ms, kind)["ratio"]
                out["numbers"]["shape"] = {"render": got, "truth": round(truth, 3), "against": "photo",
                                           "off": round(got / truth - 1, 3), "note": "informational; the tape decides"}
            else:
                out["numbers"]["shape"] = {"against": None, "note": "no tape, and the real photo is not laid flat"}
        lay = layout(mr)
        out["numbers"]["layout"] = {"template": lay["template"], "overlap": lay["overlap"], "tilt": lay["tilt_deg"]}
    out["ok"] = not out["reasons"]
    out["image"] = ren
    return out


JUDGE = """Image 1 is a real photo of a second-hand {name}. {refs}The last image is a redrawn listing photo of it, meant to show
the same item laid out flatter and neater, nothing else. Smoothed wrinkles, a straighter lay and a neck tag tucked out
of sight are intended and are not differences; judge only the item itself.

Compare the last image with the real photos and answer one JSON object:
{{
 "same_item": true if it is the same garment (cut, color, fabric, wear), false if anything about the item itself changed,
 "text_exact": true if every printed letter on the item matches the real photos exactly, false if any letter is missing, added or changed,
 "text_seen": the printed text you can read in the last image,
 "invented": anything in the last image that is not on the real item (a tag, label, text, logo, button, pocket, pattern), or [],
 "lost": anything on the real item missing from the last image (a print, a logo, a patch, a stain or other flaw: {flaws}), or [],
 "wear_kept": true if the fading, discoloration, pilling, thinning and stains on the real item are still there in the same places and at the same strength, false if the item looks newer, darker or more evenly colored than the real one,
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
    if j.get("wear_kept") is False:
        r.append("judge: wear or fading removed")
    if j.get("color") == "different hue":
        r.append("judge: different hue")
    return r
