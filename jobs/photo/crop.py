"""ph-3: crop per site and export size (capture-shots card 8, photo.md section 3 step 4). Never pads."""
import json
from functools import lru_cache
from pathlib import Path

import numpy as np

FIT_PATH = Path(__file__).resolve().parents[2] / "research" / "list" / "ben" / "platforms" / "platform-fit.json"
MIN_PX = {"ebay": 500}  # longest side; platform-fit has no per-site pixel minimum, ebay.md states this one


@lru_cache(maxsize=1)
def _fit() -> dict:
    return json.loads(FIT_PATH.read_text(encoding="utf-8"))


def _inside(inner: list, outer: list) -> bool:
    return inner[0] >= outer[0] and inner[1] >= outer[1] and inner[2] <= outer[2] and inner[3] <= outer[3]


def crop_for(site: str, mask: np.ndarray, frame_wh: tuple, fit: dict | None = None, margin: float = 0.02) -> dict:
    photos = (fit or _fit())["platforms"][site]["photos"]
    w, h = frame_wh
    cw, ch = (int(v) for v in photos["cover_px"].split("x"))
    ys, xs = np.nonzero(mask)
    side = min(w, h)
    m = round(margin * side)
    ex = [int(xs.min()) - m, int(ys.min()) - m, int(xs.max()) + 1 + m, int(ys.max()) + 1 + m]  # box with margin
    ratio = photos["cover_ratio"]

    if ratio == "3:4":  # poshmark: the full 3:4 frame; nothing is cut by cropping
        tw, th = (w, w * 4 // 3) if w * 4 <= h * 3 else (h * 3 // 4, h)
        x0, y0 = (w - tw) // 2, (h - th) // 2
        box, cut = [x0, y0, x0 + tw, y0 + th], False
    else:
        long_x = w > h
        lo, hi = (ex[0], ex[2]) if long_x else (ex[1], ex[3])
        cross = (ex[1], ex[3]) if long_x else (ex[0], ex[2])
        L = w if long_x else h
        # the margin may poke past the frame on the cross axis only if the box itself fits: size is the test
        cut = hi - lo > side or cross[1] - cross[0] > side
        start = min(max((L - side) // 2, hi - side), lo)
        start = max(0, min(start, L - side))
        sq = [start, 0, start + side, side] if long_x else [0, start, side, start + side]
        box = sq
        if not cut and ratio == "4:5":  # 4:5 centred on the square, sliding to stay in frame
            if long_x:
                gh, gw = h, h * 4 // 5
                gx = max(0, min(start + side // 2 - gw // 2 - (0 if (start + side // 2 - gw // 2) >= 0 else 0), w - gw))
                gx = max(0, min(int(start + side / 2 - gw / 2), w - gw))
                box = [gx, 0, gx + gw, gh]
            else:
                gh = min(h, side * 5 // 4)
                gy = max(0, min(int(start + side / 2 - gh / 2), h - gh))
                box = [side * 0, gy, side, gy + gh]
            cut = not _inside([max(0, ex[0]), max(0, ex[1]), min(w, ex[2]), min(h, ex[3])], box)

    bw, bh = box[2] - box[0], box[3] - box[1]
    if cut and ratio != "3:4":
        export = None
    elif max(bw, bh) < MIN_PX.get(site, 0):
        export = None
    else:
        export = min(cw, bw) if cw <= ch or ratio == "3:4" else min(cw, bw)  # never upscaled; native size when smaller
    return {"crop": box, "export_px": export, "item_cut": cut}
