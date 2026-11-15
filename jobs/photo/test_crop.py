"""ph-3: crops and export size against the frozen mask fixture."""
import numpy as np
from PIL import Image

from photo import crop


def mask_box(path):
    m = np.array(Image.open(path)) > 0
    ys, xs = np.where(m)
    return m, [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]


def test_every_mask_fixture_case(load_fixture, fixture_path):
    d = load_fixture("mask/cases.json")
    fr = (d["frame"]["w"], d["frame"]["h"])
    margin = d["margin_px"] / d["square_side"]
    for c in d["cases"]:
        m, box = mask_box(fixture_path("mask/" + c["mask"]))
        e = c["expected"]
        assert box == e["box"], c["id"]
        sq = crop.crop_for("depop", m, fr, margin=margin)
        assert sq["item_cut"] is e["item_cut"], c["id"]
        if e["square"]:
            assert sq["crop"] == e["square"], c["id"]
        assert crop.crop_for("poshmark", m, fr, margin=margin)["crop"] == e["poshmark"], c["id"]
        g = crop.crop_for("grailed", m, fr, margin=margin)
        assert (None if g["item_cut"] else g["crop"]) == e["grailed"], c["id"]


def test_item_at_edge_is_slid_never_padded():
    m = np.zeros((400, 300), bool); m[0:100, 100:200] = True
    assert crop.crop_for("depop", m, (300, 400))["crop"] == [0, 0, 300, 300]


def test_landscape_frame_slides_along_x():
    m = np.zeros((300, 400), bool); m[100:200, 380:400] = True
    assert crop.crop_for("depop", m, (400, 300))["crop"] == [100, 0, 400, 300]


def test_tiny_export_is_none_below_site_minimum_never_upscaled():
    m = np.zeros((400, 300), bool); m[150:250, 100:200] = True
    assert crop.crop_for("ebay", m, (300, 400))["export_px"] is None  # 300 < 500 px


def test_export_is_cover_size_when_source_holds_it():
    m = np.zeros((4000, 3000), bool); m[1500:2500, 1000:2000] = True
    assert crop.crop_for("ebay", m, (3000, 4000))["export_px"] == 1600


def test_export_is_native_size_when_between_minimum_and_cover():
    m = np.zeros((1200, 1000), bool); m[400:800, 300:700] = True
    assert crop.crop_for("ebay", m, (1000, 1200))["export_px"] == 1000


def test_no_site_minimum_means_native_export():
    m = np.zeros((400, 300), bool); m[150:250, 100:200] = True
    assert crop.crop_for("depop", m, (300, 400))["export_px"] == 300
