from studio import plan as P


def ph(i, role, **kw):
    return {"id": i, "role": role, "px": kw.pop("px", [4032, 4032]), "sharp": kw.pop("sharp", 1.0), **kw}


def types(p):
    return [s["type"] for s in p["slides"]]


def test_tee_from_casual_photos_is_ordered_cover_back_print_tag_measure():
    look = {"kind": "t-shirt", "photos": [
        ph("m", "measure"), ph("t", "tag"), ph("b", "back"),
        ph("f", "front", graphics=[{"zone": "chest_centre", "box": [0.4, 0.3, 0.6, 0.45], "text": "MARQUETTE 74"}]),
        ph("g", "graphic", zone="chest_centre")], "measured": {"pit_to_pit": 21.25, "length": 27.0}, "measured_by": "lidar"}
    p = P.plan(look)
    assert p["kind"] == "tee" and p["whole_route"] == "relay"
    assert types(p) == ["cover", "back", "graphic", "tag", "fabric", "measure"]
    assert p["slides"][2]["photo"] == "g" and p["slides"][2]["crop"] is None
    assert p["asks"] == []


def test_no_back_photo_means_no_back_slide_and_an_ask():
    p = P.plan({"kind": "hoodie", "photos": [ph("f", "front"), ph("t", "tag")]})
    assert "back" not in types(p)
    assert [a["type"] for a in p["asks"]] == ["back", "measure"]


def test_a_small_print_in_a_small_photo_is_asked_for_not_upscaled():
    g = [{"zone": "left_chest", "box": [0.6, 0.3, 0.68, 0.36], "text": "R"}]
    small = P.plan({"kind": "tee", "photos": [ph("f", "front", px=[1080, 1080], graphics=g), ph("b", "back"), ph("t", "tag")]})
    assert "graphic" not in types(small) and small["asks"][0]["type"] == "graphic"
    big = P.plan({"kind": "tee", "photos": [ph("f", "front", px=[4032, 4032], graphics=[{**g[0], "box": [0.4, 0.3, 0.6, 0.45]}]), ph("b", "back"), ph("t", "tag")]})
    cut = [s for s in big["slides"] if s["type"] == "graphic"][0]
    assert cut["photo"] == "f" and cut["crop"] is not None


def test_every_flaw_gets_a_slide_even_when_only_seen_from_far_away():
    f = [{"kind": "stain", "zone": "chest", "box": [0.45, 0.5, 0.48, 0.53], "severity": "minor"}]
    p = P.plan({"kind": "tee", "photos": [ph("f", "front", px=[1080, 1080], flaws=f), ph("b", "back"), ph("t", "tag")]})
    fl = [s for s in p["slides"] if s["type"] == "flaw"]
    assert len(fl) == 1 and fl[0]["route"] == "as_shot" and fl[0].get("low_res")
    assert any(a["type"] == "flaw" for a in p["asks"])


def test_tag_flaw_and_measure_slides_are_never_redrawn():
    p = P.plan({"kind": "pants", "photos": [ph("f", "front"), ph("b", "back"), ph("t", "tag"), ph("x", "flaw", zone="hem"), ph("m", "measure")]})
    for s in p["slides"]:
        if s["type"] in ("tag", "flaw", "measure", "care", "graphic", "fabric"):
            assert s["route"] in ("level0", "as_shot")


def test_shoes_are_only_relit_never_relaid():
    p = P.plan({"kind": "sneakers", "photos": [ph("f", "front"), ph("b", "back"), ph("t", "tag")]})
    assert p["kind"] == "shoes" and p["slides"][0]["route"] == "light"


def test_a_site_cap_keeps_cover_tag_and_every_flaw():
    photos = [ph("f", "front"), ph("b", "back"), ph("t", "tag"), ph("x1", "flaw", zone="hem"), ph("x2", "flaw", zone="cuff"),
              ph("d", "detail"), ph("m", "measure"), ph("c", "care")]
    p = P.plan({"kind": "sweatshirt", "photos": photos})
    cut = P.for_site(p, 4)
    kept = [s["type"] for s in p["slides"] if s["slot"] in cut["slots"]]
    assert sorted(kept) == ["cover", "flaw", "flaw", "tag"]


def test_kind_names_pick_the_longest_match():
    assert P.kind_of("Hooded Sweatshirt") == "hoodie"
    assert P.kind_of("crewneck") == "sweatshirt"
    assert P.kind_of("levi's jeans") == "pants"
    assert P.kind_of("long sleeve tee") == "long_sleeve"


def test_only_a_lidar_measurement_opens_the_relay():
    tee = {"kind": "tee", "photos": [ph("f", "front"), ph("b", "back"), ph("t", "tag")]}
    sized = {"pit_to_pit": 21.25, "length": 27.0}
    assert P.plan(tee)["slides"][0]["route"] == "light"
    assert P.plan({**tee, "measured": sized, "measured_by": "tape"})["slides"][0]["route"] == "light"
    assert P.plan({**tee, "measured": sized, "measured_by": "lidar"})["slides"][0]["route"] == "relay"
    pants = {"kind": "jeans", "photos": [ph("f", "front"), ph("t", "tag")], "measured": {"waist": 19, "inseam": 32}, "measured_by": "lidar"}
    assert P.plan(pants)["slides"][0]["route"] == "light"  # no ruler for pants yet
