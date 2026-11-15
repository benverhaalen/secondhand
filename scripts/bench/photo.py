"""Deterministic photo fix, measured on Ben's 19 real listing photos.

For each photo: score it, then plant three faults a careless shot has (one stop dark, flat, one stop bright),
and let the no-model loop fix each one. Reports the score before and after, how far the item's color moved
(CIEDE2000, brightness taken out; the loop refuses more than 2.0), and the time per photo.
The faults are plain sRGB arithmetic, not the loop's own tweak(), so the fix is not undoing its own edit.

Run: python3 scripts/bench/photo.py [--out scripts/bench/out/photo.json]
"""
import glob
import json
import os
import sys
import time
from multiprocessing import Pool

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "research/studio/ben/prototype"))
from photo_score import item_mask, optimise, score, truthful, tweak  # noqa: E402
import cv2  # noqa: E402

FAULTS = {
    "dark": lambda im: np.clip(im.astype(np.float64) * 0.5, 0, 255),           # about one stop under, in sRGB
    "flat": lambda im: np.clip(im.astype(np.float64) * 0.6 + 0.4 * 128, 0, 255),  # contrast squeezed toward grey
    "bright": lambda im: np.clip(im.astype(np.float64) * 1.5, 0, 255),         # over, with real clipping
}


def one(path):
    t0 = time.perf_counter()
    img = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
    mask = item_mask(img)
    t_mask = time.perf_counter() - t0
    rows = []
    for name, f in [("original", lambda im: im), *FAULTS.items()]:
        src = f(img).astype(np.uint8)
        t1 = time.perf_counter()
        p, _ = optimise(src, mask)
        out = tweak(src, p)
        ok, de = truthful(src, out, mask)
        rows.append({"photo": os.path.relpath(path, ROOT), "case": name, "before": score(src, mask)["score"],
                     "after": score(out, mask)["score"], "original": score(img, mask)["score"],
                     "color_moved_de": de, "truthful": bool(ok), "fix_ms": round((time.perf_counter() - t1) * 1000)})
    for r in rows:
        r["mask_ms"] = round(t_mask * 1000)
    return rows


def main():
    photos = sorted(glob.glob(os.path.join(ROOT, "assets/demo-items/real/*/*.jpg")))
    with Pool(min(4, os.cpu_count() or 1)) as pool:
        rows = [r for rs in pool.map(one, photos) for r in rs]
    summary = {}
    for case in ["original", *FAULTS]:
        rs = [r for r in rows if r["case"] == case]
        summary[case] = {
            "n": len(rs),
            "before_median": float(np.median([r["before"] for r in rs])),
            "after_median": float(np.median([r["after"] for r in rs])),
            "original_median": float(np.median([r["original"] for r in rs])),
            "recovered_to_within_3_of_original": sum(r["after"] >= r["original"] - 3 for r in rs),
            "truthful": sum(r["truthful"] for r in rs),
            "color_moved_max": max(r["color_moved_de"] for r in rs),
            "fix_ms_median": float(np.median([r["fix_ms"] for r in rs])),
        }
    out = {"what": "deterministic photo fix on Ben's real photos", "photos": len(photos),
           "mask_ms_median": float(np.median([r["mask_ms"] for r in rows])), "summary": summary, "rows": rows}
    dst = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
    if dst:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        json.dump(out, open(dst, "w"), indent=1)
    print(json.dumps({k: v for k, v in out.items() if k != "rows"}, indent=1))


if __name__ == "__main__":
    main()
