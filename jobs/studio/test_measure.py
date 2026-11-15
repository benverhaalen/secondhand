"""The ruler, on outlines whose true pit to pit and length are known, and on the same outline stretched."""
import pytest

cv2 = pytest.importorskip("cv2", reason="studio measurements require optional OpenCV")
import numpy as np

from studio.measure import against_tape, measure


def tee(pit=420, length=540, sleeve_drop=0.55, w=1080, h=1080):
    """A flat tee: body pit x length, collar dip, short sleeves angled down from the shoulders. Armpit 0.33 down."""
    m = np.zeros((h, w), np.uint8)
    cx, top = w // 2, (h - length) // 2
    x0, x1 = cx - pit // 2, cx + pit // 2
    arm = top + int(0.33 * length)
    body = np.array([(x0, top + 20), (cx - 70, top), (cx + 70, top), (x1, top + 20), (x1, top + length), (x0, top + length)], np.int32)
    cv2.fillPoly(m, [body], 1)
    for s in (-1, 1):
        sx = x1 if s == 1 else x0
        sl = np.array([(sx, top + 20), (sx + s * 200, top + 20 + int(200 * sleeve_drop)),
                       (sx + s * 150, top + 20 + int(200 * sleeve_drop) + 110), (sx, arm)], np.int32)
        cv2.fillPoly(m, [sl], 1)
    cv2.circle(m, (cx, top + 10), 45, 0, -1)       # the neck opening
    cv2.ellipse(m, (cx, top + 10), (45, 30), 0, 0, 180, 1, -1)  # the back collar seen through it
    return m


def test_reads_a_known_tee():
    mx = measure(tee(), 27.0)
    assert abs(mx["pit_px"] / 420 - 1) < 0.02
    assert abs(mx["length_px"] / 540 - 1) < 0.03


def test_tape_check_is_exact_on_a_true_outline():
    r = against_tape(measure(tee(), 27.0), {"length": 27.0, "pit_to_pit": 27.0 * 420 / 540})
    assert r["tested"] and abs(r["off"]) < 0.03


def test_a_stretch_shows_up_in_the_reading():
    for k in (0.92, 0.95, 1.05, 1.08):
        m = tee()
        wide = cv2.resize(m, (round(m.shape[1] * k), m.shape[0]), interpolation=cv2.INTER_NEAREST)
        pad = np.zeros((1080, max(1080, wide.shape[1])), np.uint8)
        pad[:, :wide.shape[1]] = wide
        r = against_tape(measure(pad, 27.0), {"length": 27.0, "pit_to_pit": 27.0 * 420 / 540})
        assert abs(r["off"] - (k - 1)) < 0.02, (k, r)


def test_no_pit_line_when_the_sleeves_hug_the_body():
    m = tee()
    cv2.rectangle(m, (540 - 260, 300), (540 + 260, 640), 1, -1)  # arms folded down over the sides
    mx = measure(m, 27.0)
    assert mx["pit_px"] is None and mx["note"]
