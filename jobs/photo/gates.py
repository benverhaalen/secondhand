"""ph-5: the gates, cheapest first, then repair (spec/engines/photo.md §3 step 6, §8).

Blocks: a vanished flaw (the flaw box loses its dark pixels), changed tag text (read by the OCR reader the
job injects), a changed protected box. Level 0 is exact by construction: the output must equal the same
per-channel gain of the source everywhere. Ranks (never block): ΔE00 and `render_same_item`, which drops a
render under 0.90. On a block: retry once, then paste the real pixels back into every protected box for up
to 2 rounds, then the photo is kept real.
"""
from __future__ import annotations

from typing import Callable, Sequence

import numpy as np

FLAW_DARK_MAX = 45  # a pixel is flaw-dark when every channel is at most this (planted fixture)
FLAW_KEEP = 0.5  # the edit must keep at least half the flaw box's dark pixels
SAME_ITEM_FLOOR = 0.90
REPAIR_ROUNDS = 2

Box = tuple[int, int, int, int]  # [x0, y0, x1, y1)


def _dark(img: np.ndarray, box: Box) -> int:
    x0, y0, x1, y1 = box
    return int((img[y0:y1, x0:x1].max(axis=2) <= FLAW_DARK_MAX).sum())


def check(original: np.ndarray, edited: np.ndarray, flaw_boxes: Sequence[Box] = (), protected: Sequence[Box] = (),
          read_tag: Callable[[np.ndarray], str] | None = None) -> dict:
    """{block, reason}; cheapest first."""
    if original.shape != edited.shape:
        return {"block": True, "reason": "size_changed"}
    for box in flaw_boxes:
        before = _dark(original, box)
        if before and _dark(edited, box) < FLAW_KEEP * before:
            return {"block": True, "reason": "flaw_vanished"}
    for x0, y0, x1, y1 in protected:
        if not np.array_equal(original[y0:y1, x0:x1], edited[y0:y1, x0:x1]):
            return {"block": True, "reason": "protected_box_changed"}
    if read_tag is not None and read_tag(original) != read_tag(edited):
        return {"block": True, "reason": "tag_text_changed"}
    return {"block": False, "reason": None}


def level0(src: np.ndarray, gain_percent: list[int]) -> np.ndarray:
    """White balance and exposure only: a per-channel gain, rounded half up, clipped."""
    out = np.floor(src.astype(np.float64) * np.asarray(gain_percent, dtype=np.float64) / 100 + 0.5)
    return np.minimum(out, 255).astype(np.uint8)


def differs_outside_transform(src: np.ndarray, out: np.ndarray, gain_percent: list[int]) -> bool:
    return not np.array_equal(level0(src, gain_percent), out)


def rank(same_item: float, delta_e: float | None = None) -> dict:
    """Ranks a passed render; drops it under the same-item floor."""
    return {"drop": same_item < SAME_ITEM_FLOOR, "same_item": same_item, "delta_e": delta_e}


def paste_back(original: np.ndarray, edited: np.ndarray, boxes: list[Box]) -> np.ndarray:
    out = edited.copy()
    for x0, y0, x1, y1 in boxes:
        out[y0:y1, x0:x1] = original[y0:y1, x0:x1]
    return out


def run(original: np.ndarray, render: Callable[[], np.ndarray], flaw_boxes: Sequence[Box] = (), protected: Sequence[Box] = (),
        read_tag: Callable[[np.ndarray], str] | None = None, tag_box: Box | None = None) -> dict:
    """One render through the gates: {status: passed|repaired|kept_real, image, attempts, reasons}."""
    reasons = []
    edited = render()
    for attempt in (1, 2):  # the render, then one retry
        g = check(original, edited, flaw_boxes, protected, read_tag)
        if not g["block"]:
            return {"status": "passed", "image": edited, "attempts": attempt, "reasons": reasons}
        reasons.append(g["reason"])
        if attempt == 1:
            edited = render()
    boxes = list(flaw_boxes) + list(protected) + ([tag_box] if tag_box else [])
    for _ in range(REPAIR_ROUNDS):
        edited = paste_back(original, edited, boxes)
        g = check(original, edited, flaw_boxes, protected, read_tag)
        if not g["block"]:
            return {"status": "repaired", "image": edited, "attempts": 2, "reasons": reasons}
        reasons.append(g["reason"])
    return {"status": "kept_real", "image": original, "attempts": 2, "reasons": reasons}
