"""Seeded-fault test for the gate: known-good and known-bad 'renders' made from a
real photo, so we know the right answer for each (the evaluator must reject the
faults and pass the benign relights). Run: python3 seeded_faults.py <assets dir>"""
import sys, json
import cv2
import numpy as np
from color import srgb_to_linear, linear_to_srgb, white_reference_gain, apply_gain
from gate import gate

A = sys.argv[1] if len(sys.argv) > 1 else "../../../../../assets/demo-items"
rng = np.random.default_rng(0)


def load(name):
    return cv2.cvtColor(cv2.imread(f"{A}/{name}"), cv2.COLOR_BGR2RGB)


def item_mask(img, inset=20):
    m = np.zeros(img.shape[:2], np.uint8)
    bg, fg = np.zeros((1, 65)), np.zeros((1, 65))
    r = (inset, inset, img.shape[1] - 2 * inset, img.shape[0] - 2 * inset)
    cv2.grabCut(cv2.cvtColor(img, cv2.COLOR_RGB2BGR), m, r, bg, fg, 5, cv2.GC_INIT_WITH_RECT)
    m = np.where((m == 1) | (m == 3), 1, 0).astype(np.uint8)
    # fill holes: GrabCut drops bright logo patches and tags as "background"
    ff = m.copy(); h, w = m.shape
    cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 1)
    m = m | (1 - ff)
    return cv2.erode(m, np.ones((9, 9), np.uint8))


def relight(img, mask, gain=(1.08, 1.0, 0.86), grad=0.35, bg=(236, 236, 232)):
    """Benign: new light colour, a soft directional falloff, new background,
    slight rotation and scale. This is roughly what a faithful render does."""
    lin = srgb_to_linear(img) * np.array(gain)
    h, w = mask.shape
    ramp = np.linspace(1 + grad / 2, 1 - grad / 2, w)[None, :, None]
    lin = lin * ramp
    out = linear_to_srgb(lin)
    out[mask == 0] = bg
    M = cv2.getRotationMatrix2D((w / 2, h / 2), 3.0, 0.96)
    out = cv2.warpAffine(out, M, (w, h), borderValue=bg)
    return cv2.GaussianBlur(out, (3, 3), 0.6)


def paint_out(img, box):
    x, y, w, h = box
    m = np.zeros(img.shape[:2], np.uint8); m[y:y + h, x:x + w] = 255
    return cv2.cvtColor(cv2.inpaint(cv2.cvtColor(img, cv2.COLOR_RGB2BGR), m, 7, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)


def hue_shift(img, mask, deg=18):
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
    hsv[..., 0] = np.where(mask == 1, (hsv[..., 0].astype(int) + deg // 2) % 180, hsv[..., 0])
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)


CASES = {
    "carhartt-jacket.jpg": dict(
        protected={"chest_patch": (382, 254, 34, 30), "collar_label": (300, 90, 34, 30),
                   "zip_pocket": (350, 218, 96, 24)},
        faults={"logo_removed": ("chest_patch",), "label_removed": ("collar_label",)}),
    "levis-501.jpg": dict(protected={}, faults={}),
    "nike-dunks.jpg": dict(
        protected={"toe_scuff": (212, 392, 44, 40), "swoosh_right": (400, 360, 90, 50)},
        faults={"defect_removed": ("toe_scuff",), "swoosh_removed": ("swoosh_right",)}),
}

def main():
    results = []
    for name, c in CASES.items():
        src = load(name)
        mask = item_mask(src)
        variants = {
            "benign_relight": relight(src, mask),
            "benign_cool_light": relight(src, mask, gain=(0.85, 0.95, 1.12), grad=0.5),
            "color_shift": relight(hue_shift(src, mask), mask),
            "reframed": cv2.flip(relight(src, mask), 1)[:, ::1][40:600, 40:600],
        }
        for fname, regions in c["faults"].items():
            bad = src.copy()
            for r in regions:
                bad = paint_out(bad, c["protected"][r])
            variants[fname] = relight(bad, mask)
        for vname, r in variants.items():
            r = cv2.resize(r, (src.shape[1], src.shape[0]))
            cast = (0.85, 0.95, 1.12) if vname == "benign_cool_light" else (1.08, 1.0, 0.86)
            out = gate(src, r, mask, c["protected"], preset_cast=cast)
            expect = "pass" if vname.startswith("benign") else "reject"
            if vname == "color_shift":
                # a hue shift on a grey item is invisible; expect a reject only when
                # the seeded change is itself visible (truth dE over the threshold)
                from skimage.color import rgb2lab, deltaE_ciede2000
                mm = mask.astype(bool)
                truth = float(np.median(deltaE_ciede2000(rgb2lab(src[mm][None]), rgb2lab(hue_shift(src, mask)[mm][None]))))
                expect = "reject" if truth > 4.5 else "pass"
                vname = f"color_shift(truth_dE={truth:.1f})"
            got = "pass" if out["verdict"] == "pass" else "reject"
            row = {"item": name, "variant": vname, "expect": expect, "got": got,
                   "verdict": out["verdict"],
                   **{k: round(v[0], 3) for k, v in out.items() if isinstance(v, tuple)}}
            results.append(row)
            cv2.imwrite(f"out/{name[:-4]}__{vname}.jpg", cv2.cvtColor(r, cv2.COLOR_RGB2BGR))

    # white-card correction check: add a known cast, put a card in frame, recover it
    src = load("carhartt-jacket.jpg")
    card = np.zeros(src.shape[:2], np.uint8); card[560:620, 20:110] = 1
    truth = src.copy(); truth[card == 1] = (200, 200, 200)
    cast = apply_gain(truth, np.array([1.25, 1.0, 0.7]))
    fixed = apply_gain(cast, white_reference_gain(cast, card, target_lum=float(srgb_to_linear(np.uint8([[200]]))[0, 0])))
    from skimage.color import rgb2lab, deltaE_ciede2000
    m = card == 0
    de_cast = float(np.median(deltaE_ciede2000(rgb2lab(truth[m][None]), rgb2lab(cast[m][None]))))
    de_fix = float(np.median(deltaE_ciede2000(rgb2lab(truth[m][None]), rgb2lab(fixed[m][None]))))
    results.append({"item": "carhartt-jacket.jpg", "variant": "white_card_correction",
                    "median_dE_with_cast": round(de_cast, 2), "median_dE_after_card": round(de_fix, 2)})

    print(json.dumps(results, indent=1))
    ok = all(r.get("expect") == r.get("got") for r in results if "expect" in r)
    print("ALL AS EXPECTED" if ok else "MISMATCHES ABOVE")


if __name__ == "__main__":
    main()
