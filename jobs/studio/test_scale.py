"""Scale from a tape in the frame and from a print, on Ben's Marquette photos (checked by eye: about 122 px per inch on
the length photo, 100 on the chest photo, at 1080 px)."""
import os

import numpy as np
from PIL import Image

from studio.scale import print_px_per_inch, tape_px_per_inch

HERE = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "demo-items", "real", "marquette-tee")
BOX = [0.326, 0.537, 0.560, 0.761]  # the print on 03.jpg, as the vision read boxed it


def img(name):
    return np.asarray(Image.open(os.path.join(HERE, name)).convert("RGB"))


def test_tape_inch_on_both_tape_photos():
    assert abs(tape_px_per_inch(img("06.jpg"))["px_per_in"] / 122.3 - 1) < 0.02
    assert abs(tape_px_per_inch(img("07.jpg"))["px_per_in"] / 100.3 - 1) < 0.02


def test_no_tape_no_scale():
    assert tape_px_per_inch(img("01_cover.jpg")) is None


def test_print_scale_moves_with_the_print_and_refuses_a_cropped_print():
    a = print_px_per_inch(img("03.jpg"), img("01_cover.jpg"), BOX, 4.0)
    b = print_px_per_inch(img("03.jpg"), img("01_cover.jpg"), BOX, 2.0)
    assert a and b and abs(b["px_per_in"] / a["px_per_in"] - 2) < 0.01
    assert print_px_per_inch(img("03.jpg"), img("07.jpg"), BOX, 4.0) is None  # only TEAM shows: too bunched to trust
