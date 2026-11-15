"""ph-5 on the planted-change fixture: every planted change blocks, clean edits pass, level 0 is exact,
and marks follow what drew the pixels (§9 tests 3 and 4)."""
import io

import numpy as np
import pytest
from PIL import Image

from photo import export as E
from photo import gates as G


@pytest.fixture
def fx(load_fixture, fixture_path):
    cases = load_fixture("planted/cases.json")

    def img(name):
        return np.asarray(Image.open(fixture_path(f"planted/{name}")).convert("RGB"))

    return cases, img


def tag_reader(cases):
    """The fixture's stand-in for OCR: each 8 px cell's columns are the bits of a character."""
    y, cell, n = cases["tag_strip"]["y"], cases["tag_strip"]["cell"], cases["tag_strip"]["chars"]

    def read(im):
        row = im[y + 1, :, :].max(axis=1) > 128
        return "".join(chr(sum(int(row[i * cell + b]) << b for b in range(8))) for i in range(n))
    return read


def test_reader_decodes_every_base(fx):
    cases, img = fx
    read = tag_reader(cases)
    for b in cases["bases"]:
        assert read(img(b["file"])) == b["tag_text"]


def test_planted_change_caught(fx):
    cases, img = fx
    bases = {b["file"]: b for b in cases["bases"]}
    read = tag_reader(cases)
    for c in cases["planted"]:
        b = bases[c["base"]]
        g = G.check(img(c["base"]), img(c["edited"]), [tuple(b["flaw_box"])], read_tag=read)
        assert g == {"block": True, "reason": c["expected"]["reason"]}, c["id"]


def test_clean_edits_pass(fx):
    cases, img = fx
    bases = {b["file"]: b for b in cases["bases"]}
    read = tag_reader(cases)
    for c in cases["clean"]:
        g = G.check(img(c["base"]), img(c["edited"]), [tuple(bases[c["base"]]["flaw_box"])], read_tag=read)
        assert not g["block"], c["id"]


def test_level0_never_differs_outside_its_transform(fx):
    cases, img = fx
    for c in cases["level0"]:
        got = G.differs_outside_transform(img(c["base"]), img(c["output"]), c["transform"]["gain_percent"])
        assert got == c["expected"]["differs_outside_transform"], c["id"]


def test_an_edited_photo_never_hides_a_defect_repair_then_kept_real(fx):
    cases, img = fx
    c = next(p for p in cases["planted"] if p["change"] == "vanished_flaw")
    base = next(b for b in cases["bases"] if b["file"] == c["base"])
    original, bad = img(c["base"]), img(c["edited"])
    r = G.run(original, lambda: bad, [tuple(base["flaw_box"])], read_tag=tag_reader(cases))
    assert r["status"] == "repaired" and r["attempts"] == 2
    assert not G.check(original, r["image"], [tuple(base["flaw_box"])])["block"]
    always_bad = G.run(original, lambda: bad[:-1], [tuple(base["flaw_box"])])
    assert always_bad["status"] == "kept_real" and always_bad["image"] is original


def test_retry_once_then_pass(fx):
    cases, img = fx
    c = next(p for p in cases["planted"] if p["change"] == "vanished_flaw")
    base = next(b for b in cases["bases"] if b["file"] == c["base"])
    renders = iter([img(c["edited"]), img(c["base"])])
    r = G.run(img(c["base"]), lambda: next(renders), [tuple(base["flaw_box"])])
    assert r["status"] == "passed" and r["attempts"] == 2


def test_same_item_floor_drops():
    assert G.rank(0.89)["drop"] and not G.rank(0.9)["drop"]


# Marks: photos the person took carry no AI tag; generated or retouched ones do; retouch is off unless asked.
def _jpeg_with_exif():
    im = Image.new("RGB", (64, 48), (120, 80, 60))
    ex = Image.Exif()
    ex[0x8825] = {2: (44.0, 58.0, 0.0)}  # GPS latitude, planted
    ex[0x010F] = "PhoneMaker"
    buf = io.BytesIO()
    im.save(buf, "JPEG", exif=ex.tobytes())
    return Image.open(io.BytesIO(buf.getvalue()))


@pytest.mark.parametrize("how", ["raw", "level0"])
def test_real_photo_carries_no_ai_tag_under_any_mark(how):
    for mark in E.MARKS:
        data, meta = E.export(_jpeg_with_exif(), how, mark, site_requires_tag=True)
        assert meta["ai_marked"] is False and meta["export_tag"] is None
        assert b"digitalsourcetype" not in data.lower()


@pytest.mark.parametrize("how", ["level1", "level2", "relay", "render"])
def test_retouched_or_generated_is_ai_marked_and_tagged_when_asked(how):
    data, meta = E.export(_jpeg_with_exif(), how, "retouched")
    assert meta["ai_marked"] is True and b"DigitalSourceType" in data
    _, quiet = E.export(_jpeg_with_exif(), how, "none")
    assert quiet["ai_marked"] is True and quiet["export_tag"] is None  # the mark never removes ai_marked


def test_mark_missing_fails():
    with pytest.raises(ValueError):
        E.export(_jpeg_with_exif(), "level1", "watermark")
    with pytest.raises(ValueError):
        E.export(_jpeg_with_exif(), "mystery_model", "none")


def test_export_strips_exif_and_location():
    data, meta = E.export(_jpeg_with_exif(), "level0", "none")
    out = Image.open(io.BytesIO(data))
    assert not out.getexif() and b"Exif" not in data and b"PhoneMaker" not in data
    assert meta["exif_stripped"]


def test_retouch_is_off_unless_asked():
    assert E.route_for(None) == "level0" and E.route_for(0) == "level0" and E.route_for(1) == "level1"
    assert E.ai_marked(E.route_for(None)) is False


def test_export_mark_changes_only_bytes_not_order_or_marks():
    metas = [E.export(_jpeg_with_exif(), "level1", m, site_requires_tag=True)[1] for m in E.MARKS]
    assert {m["ai_marked"] for m in metas} == {True}
    assert [m["export_tag"] is not None for m in metas] == [False, True, True]


def test_never_upscaled():
    _, meta = E.export(_jpeg_with_exif(), "level0", "none", export_px=1600)
    assert meta["size"] == (64, 48)
