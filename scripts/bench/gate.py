"""Does the fidelity gate catch an edit that lies about the item? Measured on Ben's 19 real listing photos.

For each real photo we know the truth, because we make the edits ourselves:
  honest   two relights (warm and cool light, soft falloff, new background, slight turn): must pass
  lie      a detail painted out (a logo, a print, a flaw), at three sizes; the box is a detail of the item, so it is protected
  lie      the item's color shifted by 12, 24 or 40 degrees of hue, when the shift is visible (over 4.5 CIEDE2000;
           a shift under that on a faded item is counted apart as invisible)
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
from gate import gate  # noqa: E402
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
    gap = np.full((SIDE + 90, 12, 3), 255, np.uint8)
    cv2.imwrite(dst, np.hstack([panels[0], gap, panels[1], gap, panels[2]]), [cv2.IMWRITE_JPEG_QUALITY, 88])
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
           "held_by": {k: sum(r["kind"] == "honest" and r["verdict"].endswith(k) for r in rows) for k in ("struct", "chroma", "region:detail", "framing changed, cannot verify")},
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
