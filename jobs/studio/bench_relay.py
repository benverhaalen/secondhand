"""Does the re-lay check catch a redraw that lies? Planted lies on honest redraws, the way scripts/bench/gate.py does it
for the in-place gate. No model is called: only the pixel checks in check.py run, so this is their floor; the judge is
a second net on top.

  python3 jobs/studio/bench_relay.py <run dir> [out.json]

For each kept candidate in a run (cand_<slide>_<k>.jpg with its manifest), the honest versions must pass and each lie
must be dropped:
  honest  as drawn; 8% brighter; turned 3 degrees; 5% smaller
A stretched lie on an item with a tape reading is not dropped but set back to the tape, which is the output the buyer
sees; it is counted as set to the tape. A color change too small to see on that cloth is counted apart.
  lie     the print painted out; the print swapped for another item's print; the item's hue turned 30 and 60 degrees;
          the item 35% darker; stretched 12% wider; stretched 12% taller; mirrored
"""
import json
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from studio import check as C  # noqa: E402
from studio import slides_run as R  # noqa: E402

OTHER_PRINT = {"chico-hoodie": "assets/demo-items/real/marquette-tee/03.jpg"}  # another item's print
DEFAULT_OTHER = "assets/demo-items/real/chico-hoodie/04.jpg"
VISIBLE = 4.5  # a color lie under this CIEDE2000 cannot be seen (black cloth turned in hue), so it is counted apart


def print_hull(ref, ren):
    sift = cv2.SIFT_create(3000)
    g1, g2 = (cv2.cvtColor(x, cv2.COLOR_RGB2GRAY) for x in (C.fit(ref, 900), ren))
    k1, d1 = sift.detectAndCompute(g1, None)
    k2, d2 = sift.detectAndCompute(g2, None)
    pairs = cv2.BFMatcher().knnMatch(d1, d2, k=2)
    good = [a for a, b in (p for p in pairs if len(p) == 2) if a.distance < 0.8 * b.distance]
    p1 = np.float32([k1[g.queryIdx].pt for g in good]); p2 = np.float32([k2[g.trainIdx].pt for g in good])
    H, inl = cv2.findHomography(p1, p2, cv2.RANSAC, 6.0)
    pts = p2[inl.ravel().astype(bool)]
    x0, y0 = pts.min(0).astype(int); x1, y1 = pts.max(0).astype(int)
    return max(0, x0 - 6), max(0, y0 - 6), x1 + 6, y1 + 6


def paint(img, box):
    m = np.zeros(img.shape[:2], np.uint8); x0, y0, x1, y1 = box; m[y0:y1, x0:x1] = 255
    return cv2.inpaint(img, m, 9, cv2.INPAINT_TELEA)


def swap(img, box, other):
    x0, y0, x1, y1 = box; out = img.copy()
    out[y0:y1, x0:x1] = cv2.resize(other, (x1 - x0, y1 - y0)); return out


def hue(img, mask, deg):
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV); m = mask.astype(bool)
    hsv[..., 0][m] = (hsv[..., 0][m].astype(int) + deg // 2) % 180
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)


def stretch(img, sx, sy):
    h, w = img.shape[:2]; big = cv2.resize(img, (int(w * sx), int(h * sy)))
    y, x = (big.shape[0] - h) // 2, (big.shape[1] - w) // 2
    if sx >= 1 and sy >= 1:
        return big[y:y + h, x:x + w]
    out = np.full_like(img, int(np.median(img[:20]))); out[-y:-y + big.shape[0], -x:-x + big.shape[1]] = big; return out


def turn(img, deg, scale=1.0):
    h, w = img.shape[:2]; M = cv2.getRotationMatrix2D((w / 2, h / 2), deg, scale)
    return cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)


def cases(ren, box, other):
    m = C.mask_of(ren)
    dark = ren.copy(); dark[m.astype(bool)] = (dark[m.astype(bool)] * 0.65).astype(np.uint8)
    return {"honest": {"as drawn": ren, "8% brighter": np.clip(ren * 1.08, 0, 255).astype(np.uint8),
                       "turned 3 degrees": turn(ren, 3), "5% smaller": turn(ren, 0, 0.95)},
            "lie": {"print painted out": paint(ren, box), "print swapped": swap(ren, box, other),
                    "hue +30": hue(ren, m, 30), "hue +60": hue(ren, m, 60), "35% darker": dark,
                    "12% wider": stretch(ren, 1.12, 1.0), "12% taller": stretch(ren, 1.0, 1.12), "mirrored": ren[:, ::-1].copy()}}


def main(run_dir, out=None):
    rows = []
    for item in sorted(os.listdir(run_dir)):
        mf = os.path.join(run_dir, item, "manifest.json")
        if not os.path.exists(mf):
            continue
        man = json.load(open(mf))
        folder = os.path.join("assets/demo-items/real", item)
        names = sorted(f for f in os.listdir(folder) if f.endswith(".jpg"))
        for s in man["slides"]:
            if s["type"] not in ("cover", "back") or not s.get("ai_marked"):
                continue
            k = next(i for i, c in enumerate([c for c in man["candidates"] if c["slide"] == s["type"]]) if c["ok"])
            ren = C.fit(R.rgb(os.path.join(run_dir, item, f"cand_{s['type']}_{k}.jpg")))
            src = R.rgb(os.path.join(folder, s["photo"] + ".jpg"))
            side = "back" if s["type"] == "back" else "front"
            imgs = {os.path.splitext(n)[0]: R.rgb(os.path.join(folder, n)) for n in names}
            refs = R.print_refs({"photos": man_plan_photos(man, names)}, side, imgs)
            if not refs:
                continue
            tpl = R.P.SPEC["kinds"][man["kind"]]["template"]
            other = R.rgb(OTHER_PRINT.get(item, DEFAULT_OTHER))
            photo = next(p for p in man["read"]["photos"] if p["index"] == names.index(s["photo"] + ".jpg"))
            laid = bool(photo.get("laid_well"))
            meas = {(p.get("measure") or {}).get("name"): (p.get("measure") or {}).get("value_in") for p in man["read"]["photos"] if p.get("measure")}
            tape = meas["pit_to_pit"] / meas["length"] if tpl != "pants" and meas.get("pit_to_pit") and meas.get("length") else None
            ms0 = C.mask_of(ren)
            box = print_hull(refs[0]["img"], ren)
            for truth, cs in cases(ren, box, other).items():
                for name, img in cs.items():
                    r = C.check(src, img, tpl, refs, tape, laid_well=laid)
                    seen = C.color_delta(ren, ms0, img, C.mask_of(img)) if name in ("hue +30", "hue +60", "35% darker") else None
                    t = "invisible" if seen is not None and seen < VISIBLE else truth
                    rows.append({"item": item, "slide": s["type"], "case": name, "truth": t, "dropped": not r["ok"], "reasons": r["reasons"],
                                 "shape_checked": bool(tape) or laid,
                                 "set_to_tape": any(x.startswith("width set") and "x1.00" not in x for x in r.get("repairs", []))})
                    print(json.dumps(rows[-1]), flush=True)
    honest = [r for r in rows if r["truth"] == "honest"]; lies = [r for r in rows if r["truth"] == "lie"]
    blind = [r for r in lies if not r["shape_checked"] and r["case"] in ("12% wider", "12% taller")]
    summary = {"shape_lies_with_no_truth": len(blind), "invisible_color_changes": sum(r["truth"] == "invisible" for r in rows), "honest_kept": sum(not r["dropped"] for r in honest), "honest": len(honest),
               "lies_dropped": sum(r["dropped"] for r in lies),
               "shape_lies_set_to_tape": sum((not r["dropped"]) and r["set_to_tape"] and r["case"] in ("12% wider", "12% taller") for r in lies), "lies": len(lies), "rows": rows}
    print(json.dumps({k: v for k, v in summary.items() if k != "rows"}))
    if out:
        json.dump(summary, open(out, "w"), indent=1)


def man_plan_photos(man, names):
    from studio import look as L
    paths = [os.path.join("assets/demo-items/real", man["item"], n) for n in names]
    return L.to_plan_input(man["read"], paths, [os.path.splitext(n)[0] for n in names])["photos"]


if __name__ == "__main__":
    main(*sys.argv[1:])
