"""Pick the reference set the image model sees for one item: far, close and angles.

The same idea as a character sheet for a person: the model holds an item's identity better
when it sees it whole, from the other side, and close on the parts it must not redraw
(tag, print, fabric, flaws). Given every frame from a capture, this picks at most `k`:

  1. the anchor: the first frame where the whole item is in view (the cover)
  2. the far frame least like the anchor (in practice the back)
  3. close-ups, sharpest first, skipping any that look like one already picked

No model. Run from the repo root: python3 research/studio/ben/prototype/refset.py <folder> [k]
"""
import glob
import json
import os
import sys

import cv2
import numpy as np


SIDE = 360


def _ring(lab, share=0.06):
    h, w = lab.shape[:2]
    b = max(2, int(share * min(h, w)))
    return np.concatenate([lab[:b].reshape(-1, 3), lab[-b:].reshape(-1, 3), lab[b:-b, :b].reshape(-1, 3), lab[b:-b, -b:].reshape(-1, 3)])


def describe(path, floor=None):
    """floor: the surface color (Lab) learned from the first frame's edge. A frame whose
    edge is mostly that surface shows the whole item; one whose edge is item is a close-up."""
    img = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
    f = SIDE / max(img.shape[:2])
    small = cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
    lab = cv2.cvtColor(cv2.GaussianBlur(small, (0, 0), 3), cv2.COLOR_RGB2LAB).astype(np.float32)
    ring = _ring(lab)
    if floor is None:
        floor = np.median(ring, axis=0)
    d = ring - floor
    edge = float((np.sqrt((d[:, 0] / 3) ** 2 + d[:, 1] ** 2 + d[:, 2] ** 2) < 9).mean())   # share of the edge that is floor
    gray = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)
    sharp = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    hist = cv2.calcHist([cv2.cvtColor(small, cv2.COLOR_RGB2HSV)], [0, 1, 2], None, [12, 6, 6], [0, 180, 0, 256, 0, 256])
    hist = cv2.normalize(hist, None).flatten()
    tiny = cv2.resize(gray, (24, 24), interpolation=cv2.INTER_AREA).astype(np.float32).ravel()
    tiny = (tiny - tiny.mean()) / (tiny.std() + 1e-6)
    return dict(path=path, far=bool(edge >= 0.55), edge=round(edge, 2), sharp=round(sharp, 1), hist=hist, tiny=tiny, floor=floor)


def unlike(a, b):
    """0 = same picture, 1 = nothing alike. Layout and color, half each."""
    layout = 1 - float(np.dot(a["tiny"], b["tiny"]) / len(a["tiny"]))
    color = 1 - float(cv2.compareHist(a["hist"], b["hist"], cv2.HISTCMP_CORREL))
    return 0.5 * min(layout, 1) + 0.5 * min(color, 1)


def pick(paths, k=6, min_unlike=0.18):
    first = describe(paths[0])            # the capture's first frame is the cover: its edge is the floor
    d = [first] + [describe(p, first["floor"]) for p in paths[1:]]
    far = [x for x in d if x["far"]]      # capture order: the first whole-item frame is the cover the person chose
    close = sorted([x for x in d if not x["far"]], key=lambda x: -x["sharp"])
    if not far:                       # no whole-item frame: the capture is missing its most important shot
        return [], d, "no frame shows the whole item: ask for one"
    chosen = [dict(far[0], role="anchor, whole item")]
    rest = [x for x in far[1:]]
    if rest:
        other = max(rest, key=lambda x: unlike(x, far[0]))
        if unlike(other, far[0]) >= min_unlike / 3:
            chosen.append(dict(other, role="whole item, other side or angle"))
    for x in close:
        if len(chosen) >= k:
            break
        if all(unlike(x, c) >= min_unlike for c in chosen):
            chosen.append(dict(x, role="close-up"))
    note = "" if any(c["role"] == "close-up" for c in chosen) else "no close-ups: tag and print will rest on the far frames"
    return chosen, d, note


def from_manifest(folder, k=6):
    """Capture's hand-off (research/capture/ben/capture-coaching-and-frames.md, 6.6): when
    manifest.json names each frame's role, use the roles and skip the guessing. Order: the
    cover, the back, then the frames the model must not redraw (tag, graphic, fabric, flaws).
    Tape-measure frames are never references."""
    frames = json.load(open(f"{folder}/manifest.json"))
    frames = frames.get("frames", frames) if isinstance(frames, dict) else frames
    frames = [f for f in frames if "image_model" in f.get("feeds", ["image_model"]) and not str(f.get("role", "")).startswith("tape")]
    rank = {"front": 0, "back": 1, "tag": 2, "graphic": 3, "fabric": 4, "flaw": 5}
    def key(f):
        r = str(f.get("role", ""))
        return (0 if f.get("cover") else 1, min([v for n, v in rank.items() if r.startswith(n)] or [9]), f.get("order", 99))
    return [{"file": f.get("file") or f.get("path"), "role": f.get("role")} for f in sorted(frames, key=key)[:k]]


def main():
    folder = sys.argv[1]
    k = int(sys.argv[2]) if len(sys.argv) > 2 else 6
    if os.path.exists(f"{folder}/manifest.json"):
        chosen = from_manifest(folder, k)
        print("picked from manifest:", chosen)
        return chosen
    paths = [p for p in sorted(glob.glob(f"{folder}/*.jpg")) if os.path.basename(p) != "contact.jpg"]
    chosen, d, note = pick(paths, k)
    for x in d:
        print(f"  {os.path.basename(x['path']):14s} far={x['far']!s:5s} floor at edge={x['edge']} sharp={x['sharp']}")
    print("picked:", [(os.path.basename(c["path"]), c["role"]) for c in chosen], note)
    return [{"file": os.path.basename(c["path"]), "role": c["role"]} for c in chosen]


if __name__ == "__main__":
    main()
