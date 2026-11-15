"""Does the fidelity gate catch an edit that lies about the item? Measured on Ben's 19 real listing photos.

For each real photo we know the truth, because we make the edits ourselves:
  honest   two relights (warm and cool light, soft falloff, new background, slight turn): must pass
  lie      a detail painted out (a logo, a print, a flaw), at three sizes; the box is a detail of the item, so it is protected
  lie      the item's color shifted by 12, 24 or 40 degrees of hue, when the shift is visible (over 4.5 CIEDE2000;
           a shift under that on a faded item is counted apart as invisible)
  lie      a detail swapped for another patch of the same item (a tag's text or a print changed, texture kept)
  lie      the item stretched 4% or 8% wider (a shape change)
  lie      the photo mirrored and recropped
A detail box is the most textured patch on the item, which is where a print, a logo or a flaw sits.
The gate is research/studio/ben/prototype/gate.py, unchanged. No model is called.

Run: python3 scripts/bench/gate.py [--out scripts/bench/out/gate.json] [--pictures DIR]
"""
import glob
import json
import os
import sys
from multiprocessing import Pool

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "research/studio/ben/prototype"))
import cv2  # noqa: E402
from gate import gate, tile_structure  # noqa: E402
from lab import deltaE_ciede2000, rgb2lab  # noqa: E402
from seeded_faults import hue_shift, item_mask, paint_out, relight  # noqa: E402

SIDE = 640  # the size the gate was tuned at
WARM, COOL = (1.08, 1.0, 0.86), (0.85, 0.95, 1.12)


def detail_box(img, mask, size):
    """The most textured size x size patch fully on the item."""
    g = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float64)
    energy = np.abs(cv2.Laplacian(g, cv2.CV_64F))
    best, at = -1.0, None
    step = max(8, size // 4)
    for y in range(0, g.shape[0] - size, step):
        for x in range(0, g.shape[1] - size, step):
            if mask[y:y + size, x:x + size].mean() < 0.98:
                continue
            e = energy[y:y + size, x:x + size].mean()
            if e > best:
                best, at = e, (x, y, size, size)
    return at


def far_box(img, mask, box):
    """A second textured patch on the item, well away from box: what a swapped-in detail is taken from."""
    x0, y0, size, _ = box
    g = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float64)
    energy = np.abs(cv2.Laplacian(g, cv2.CV_64F))
    best, at = -1.0, None
    for y in range(0, g.shape[0] - size, 10):
        for x in range(0, g.shape[1] - size, 10):
            if abs(x - x0) < 2 * size and abs(y - y0) < 2 * size or mask[y:y + size, x:x + size].mean() < 0.98:
                continue
            e = energy[y:y + size, x:x + size].mean()
            if e > best:
                best, at = e, (x, y)
    return at


def swap(img, box, donor):
    x, y, w, h = box
    out = img.copy()
    out[y:y + h, x:x + w] = img[donor[1]:donor[1] + h, donor[0]:donor[0] + w]
    return out


def stretch(img, pct):
    """The whole render made pct% wider about its centre, cut back to size."""
    h, w = img.shape[:2]
    wide = cv2.resize(img, (int(round(w * (1 + pct / 100))), h), interpolation=cv2.INTER_LINEAR)
    x = (wide.shape[1] - w) // 2
    return wide[:, x:x + w]


def heat(src, render, mask):
    """Per-tile structure agreement as an overlay: red where the render no longer matches the real photo."""
    scores = tile_structure(src, render, mask, tile=24)
    over = cv2.cvtColor(src.astype(np.uint8), cv2.COLOR_RGB2BGR).copy()
    layer = np.zeros_like(over)
    alpha = np.zeros(src.shape[:2], np.float32)
    for (y, x), v in scores:
        bad = float(np.clip((0.8 - v) / 0.6, 0, 1))
        layer[y:y + 24, x:x + 24] = (0, 0, 255)
        alpha[y:y + 24, x:x + 24] = np.maximum(alpha[y:y + 24, x:x + 24], 0.75 * bad)
    a = alpha[..., None]
    return (over * (1 - a) + layer * a).astype(np.uint8)


def hue_de(src, mask, deg):
    m = mask.astype(bool)
    return float(np.median(deltaE_ciede2000(rgb2lab(src[m][None]), rgb2lab(hue_shift(src, mask, deg)[m][None]))))


def one(path):
    src = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
    src = cv2.resize(src, (SIDE, SIDE), interpolation=cv2.INTER_AREA)
    mask = item_mask(src)
    name = os.path.relpath(path, ROOT)
    rows = []

    def check(variant, kind, render, protected, cast, **extra):
        out = gate(src, render, mask, protected, preset_cast=cast)
        rows.append({"photo": name, "variant": variant, "kind": kind, "got": "pass" if out["verdict"] == "pass" else "reject",
                     "verdict": out["verdict"], **{k: round(v[0], 3) for k, v in out.items() if isinstance(v, tuple)}, **extra})

    box = detail_box(src, mask, 40)
    protected = {"detail": box} if box else {}
    check("relight_warm", "honest", relight(src, mask, gain=WARM), protected, WARM)
    check("relight_cool", "honest", relight(src, mask, gain=COOL, grad=0.5), protected, COOL)
    for size in (24, 40, 64):
        b = detail_box(src, mask, size)
        if b:
            check(f"detail_removed_{size}px", "lie", relight(paint_out(src, b), mask, gain=WARM), {"detail": b}, WARM,
                  box=list(b), share_of_frame=round(size * size / SIDE / SIDE, 4))
    b = detail_box(src, mask, 40)
    donor = b and far_box(src, mask, b)
    if b and donor:
        check("detail_swapped_40px", "lie", relight(swap(src, b, donor), mask, gain=WARM), {"detail": b}, WARM, box=list(b))
    for pct in (4, 8):
        check(f"stretched_{pct}pct", "lie", stretch(relight(src, mask, gain=WARM), pct), protected, WARM)
    for deg in (12, 24, 40):
        # On a faded or grey item a hue turn barely shows. Below the gate's own 4.5 it is not a lie a buyer could see.
        truth = round(hue_de(src, mask, deg), 2)
        check(f"hue_{deg}deg", "lie" if truth > 4.5 else "invisible", relight(hue_shift(src, mask, deg), mask, gain=WARM),
              protected, WARM, truth_de=truth)
    check("mirrored", "lie", cv2.resize(cv2.flip(relight(src, mask, gain=WARM), 1)[40:600, 40:600], (SIDE, SIDE)), protected, WARM)
    return rows


def picture(rows, dst):
    """One image a judge reads in seconds: the real photo, an honest relight that passed, a lie that was caught."""
    photo = next(r["photo"] for r in rows if r["variant"] == "detail_removed_40px" and r["got"] == "reject")
    src = cv2.cvtColor(cv2.imread(os.path.join(ROOT, photo)), cv2.COLOR_BGR2RGB)
    src = cv2.resize(src, (SIDE, SIDE), interpolation=cv2.INTER_AREA)
    mask = item_mask(src)
    b = detail_box(src, mask, 40)
    honest = relight(src, mask, gain=WARM)
    lie = relight(paint_out(src, b), mask, gain=WARM)
    r_ok = gate(src, honest, mask, {"detail": b}, preset_cast=WARM)
    r_bad = gate(src, lie, mask, {"detail": b}, preset_cast=WARM)
    x, y, w, h = b
    d = os.path.dirname(dst)
    for name, img in (("original", src), ("honest", honest), ("lie", lie)):
        cv2.imwrite(os.path.join(d, f"gate-{name}.jpg"), cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])
    hm = heat(src, lie, mask)
    cv2.imwrite(os.path.join(d, "gate-heat.jpg"), hm, [cv2.IMWRITE_JPEG_QUALITY, 88])
    panels = []
    for img, title, colour, res in [(src, "Real photo", (40, 40, 40), None), (honest, "Relit: shown", (20, 140, 60), r_ok),
                                    (lie, "Detail painted out: held", (200, 30, 30), r_bad)]:
        p = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2BGR).copy()
        cv2.rectangle(p, (x - 4, y - 4), (x + w + 4, y + h + 4), colour[::-1], 3)
        bar = np.full((90, SIDE, 3), 255, np.uint8)
        cv2.putText(bar, title, (16, 38), cv2.FONT_HERSHEY_SIMPLEX, 1.0, colour[::-1], 2, cv2.LINE_AA)
        if res:
            line = f"detail match {res['region:detail'][0]:.2f}  color dE {res['chroma'][0]:.1f}"
            cv2.putText(bar, line, (16, 74), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 1, cv2.LINE_AA)
        panels.append(np.vstack([bar, p]))
    bar = np.full((90, SIDE, 3), 255, np.uint8)
    cv2.putText(bar, "Where it differs", (16, 38), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (30, 30, 200), 2, cv2.LINE_AA)
    cv2.putText(bar, "red: structure no longer matches the real photo", (16, 74), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 1, cv2.LINE_AA)
    panels.append(np.vstack([bar, hm]))
    gap = np.full((SIDE + 90, 12, 3), 255, np.uint8)
    cv2.imwrite(dst, np.hstack([panels[0], gap, panels[1], gap, panels[2], gap, panels[3]]), [cv2.IMWRITE_JPEG_QUALITY, 88])
    return photo


def main():
    photos = sorted(glob.glob(os.path.join(ROOT, "assets/demo-items/real/*/*.jpg")))
    with Pool(min(4, os.cpu_count() or 1)) as pool:
        rows = [r for rs in pool.map(one, photos) for r in rs]
    honest = [r for r in rows if r["kind"] == "honest"]
    lies = [r for r in rows if r["kind"] == "lie"]
    by = {}
    for r in lies:
        v = r["variant"]
        by.setdefault(v, {"n": 0, "caught": 0})
        by[v]["n"] += 1
        by[v]["caught"] += r["got"] == "reject"
    for r in lies:
        if "truth_de" in r:
            by[r["variant"]].setdefault("truth_de", []).append(r["truth_de"])
    for v in by.values():
        if "truth_de" in v:
            v["truth_de_median"] = float(np.median(v.pop("truth_de")))
    out = {"what": "fidelity gate on planted edits of Ben's real photos", "photos": len(photos),
           "honest": {"n": len(honest), "passed": sum(r["got"] == "pass" for r in honest)},
           "lies": {"n": len(lies), "caught": sum(r["got"] == "reject" for r in lies), "by_variant": by},
           "invisible_shifts": {"n": sum(r["kind"] == "invisible" for r in rows), "held": sum(r["kind"] == "invisible" and r["got"] == "reject" for r in rows)},
           "held_by": {k: sum(r["kind"] == "honest" and k in r["verdict"] for r in rows) for k in ("struct", "shape", "chroma", "region:detail", "framing changed")},
           "false_holds": [r for r in honest if r["got"] != "pass"], "missed": [r for r in lies if r["got"] == "pass"], "rows": rows}
    if "--pictures" in sys.argv:
        d = sys.argv[sys.argv.index("--pictures") + 1]
        os.makedirs(d, exist_ok=True)
        out["picture_photo"] = picture(rows, os.path.join(d, "gate-side-by-side.jpg"))
    dst = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
    if dst:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        json.dump(out, open(dst, "w"), indent=1)
    print(json.dumps({k: v for k, v in out.items() if k not in ("rows",)}, indent=1))


if __name__ == "__main__":
    main()
