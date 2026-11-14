"""Masked repair: put the real pixels back where a render changed the item.

The agent loop is render -> gate -> repair the flagged boxes -> gate again.
For each flagged box the source is warped into the render's frame, matched to
the render's local light (per-channel mean and contrast inside the box), and
blended in through a feathered mask. The scene and the light stay generated;
the logo, tag or defect is the real one.
"""
import cv2
import numpy as np
from gate import align, gate


def _match_light(src_patch, ren_patch):
    """Give the source patch the render's local brightness and colour cast.
    Uses a ring-free global fit: per-channel gain from medians, so the patch's
    own contrast (the print, the stain) is kept."""
    s = src_patch.astype(np.float32)
    g = (np.median(ren_patch.reshape(-1, 3), 0) + 1) / (np.median(s.reshape(-1, 3), 0) + 1)
    return np.clip(s * g, 0, 255)


def repair(src, render, mask, boxes, pad=10, feather=9):
    """src, render: RGB u8 at the same size. boxes: {name: (x, y, w, h)} on src.
    Returns the repaired render, or None when alignment is too weak to trust."""
    H, inl = align(src, render, mask)
    if H is None or inl < 0.60:
        return None
    h, w = render.shape[:2]
    warped = cv2.warpPerspective(src, H, (w, h))
    out = render.astype(np.float32)
    for x, y, bw, bh in boxes.values():
        m = np.zeros(src.shape[:2], np.float32)
        m[max(0, y - pad):y + bh + pad, max(0, x - pad):x + bw + pad] = 1
        m = cv2.warpPerspective(m, H, (w, h))
        ys, xs = np.where(m > 0.5)
        if len(ys) == 0:
            continue
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        # light from a ring around the box, so a painted-out logo doesn't skew it
        ring = cv2.dilate(m, np.ones((31, 31), np.uint8)) - m
        rr = ring > 0.5
        g = (np.median(render[rr], 0).astype(np.float32) + 1) / (np.median(warped[rr], 0).astype(np.float32) + 1)
        patch = np.clip(warped[y0:y1, x0:x1].astype(np.float32) * g, 0, 255)
        a = cv2.GaussianBlur(m, (0, 0), feather / 3)[y0:y1, x0:x1, None]
        out[y0:y1, x0:x1] = a * patch + (1 - a) * out[y0:y1, x0:x1]
    return np.clip(out, 0, 255).astype(np.uint8)


def loop(src, render, mask, protected, preset_cast=(1, 1, 1), max_rounds=2):
    """Gate, repair what failed, gate again. Returns (image, history)."""
    history = []
    for _ in range(max_rounds + 1):
        res = gate(src, render, mask, protected, preset_cast)
        history.append(res["verdict"])
        bad = {k.split(":", 1)[1]: protected[k.split(":", 1)[1]]
               for k, v in res.items() if k.startswith("region:") and not v[1]}
        if res["verdict"] == "pass" or not bad:
            break
        fixed = repair(src, render, mask, bad)
        if fixed is None:
            break
        render = fixed
    return render, history


if __name__ == "__main__":
    import sys
    import seeded_faults as sf
    sf.A = sys.argv[1] if len(sys.argv) > 1 else sf.A
    for name, c in sf.CASES.items():
        src = sf.load(name)
        mask = sf.item_mask(src)
        for fname, regions in c["faults"].items():
            bad = src.copy()
            for r in regions:
                bad = sf.paint_out(bad, c["protected"][r])
            render = sf.relight(bad, mask)
            out, hist = loop(src, render, mask, c["protected"], preset_cast=(1.08, 1.0, 0.86))
            cv2.imwrite(f"out/{name[:-4]}__{fname}__repaired.jpg", cv2.cvtColor(out, cv2.COLOR_RGB2BGR))
            cv2.imwrite(f"out/{name[:-4]}__{fname}__before.jpg", cv2.cvtColor(render, cv2.COLOR_RGB2BGR))
            print(name, fname, " -> ".join(hist))
