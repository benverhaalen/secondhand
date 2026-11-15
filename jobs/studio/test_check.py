"""Ben, 2026-11-15 08:09: an AI redraw "can only ai beautify if you have dimensions or else you cannot trust it", and
"we only let it pass once its accurate". The model alone does not keep size (the Marquette tee came back about 2 in too
narrow), so a whole-item redraw with no tape reading is never shown; the real photo is used."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from studio import check as C  # noqa: E402


def shirt(w=260, h=380):
    img = np.full((600, 600, 3), 235, np.uint8)
    x0, y0 = (600 - w) // 2, (600 - h) // 2
    img[y0:y0 + h, x0:x0 + w] = (40, 70, 160)
    return img


def test_no_tape_means_no_redraw_even_when_laid_flat():
    for laid in (False, True):
        r = C.check(shirt(), shirt(), "shirt", [], tape_ratio=None, laid_well=laid)
        assert r["ok"] is False
        assert any("tape" in why for why in r["reasons"]), r["reasons"]


def test_a_redraw_that_matches_the_tape_passes():
    r = C.check(shirt(), shirt(), "shirt", [], tape_ratio=0.7)
    assert r["ok"] is True, r["reasons"]
    assert r["numbers"]["shape"]["against"] == "tape"


def test_a_redraw_drawn_far_off_the_tape_is_dropped():
    r = C.check(shirt(), shirt(w=380, h=380), "shirt", [], tape_ratio=0.7, repair=False)
    assert r["ok"] is False
