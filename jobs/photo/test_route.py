"""ph-4: route choice and pass rates."""
from photo import route

COVER = dict(photo_id="c", role="front", cover=True, kind="coat", use="real")
BACK = dict(photo_id="b", role="back", cover=False, kind="coat", use="real")
R5 = {("level1", "coat"): (10, 10)}  # mean 0.5 with enough trials: no exploration bonus


def test_n_for_half_is_three():
    assert route.n_for(0.5) == 3


def test_n_for_caps_and_edges():
    assert route.n_for(0.0) == 4 and route.n_for(0.99) == 1 and route.n_for(0.05) == 4


def test_worked_example_cover_and_back():
    o = {x["photo_id"]: x for x in route.offers([COVER, BACK], 1, 0.04, 120, R5)}
    assert o["c"]["level"] == 1 and o["c"]["n"] == 3
    assert round(o["c"]["value"], 2) == 5.88 and round(o["c"]["cost"], 2) == 0.12
    assert round(o["b"]["value"], 2) == 0.60


def test_route_that_fails_is_demoted_for_the_untried_one():
    rates = {("level1", "coat"): (2, 22)}  # 20 fails
    assert route.offers([COVER], 2, 0.04, 120, rates)[0]["level"] == 2


def test_new_route_is_explored_with_mean_plus_sd():
    assert route.offers([COVER], 1, 0.04, 120, {})[0]["n"] == 3  # the bare Beta(2, 2) prior gives n = 3 (photo.md §4)
    o = route.offers([COVER], 1, 0.04, 120, {("level1", "coat"): (3, 3)})[0]
    assert o["n"] == 2  # 2 trials: p = .5 + sd .19 = .69 -> n 2, where a settled .5 gives 3


def test_protected_roles_and_raw_are_level_zero():
    ps = [dict(COVER, photo_id=r, role=r) for r in ("tag", "care_label", "flaw", "screenshot")]
    ps.append(dict(COVER, photo_id="raw", use="raw"))
    ps.append(dict(COVER, photo_id="ser", role="detail", serial=True))
    for o in route.offers(ps, 2, 0.04, 120, R5):
        assert (o["level"], o["reason"]) == (0, "protected_role"), o["photo_id"]


def test_negative_value_is_light_already_even():
    o = route.offers([BACK], 2, 0.50, 10, R5)[0]
    assert (o["level"], o["reason"], o["n"]) == (0, "light_already_even", 0)


def test_update_does_not_mutate():
    r = {("level1", "coat"): (2, 2)}
    r2 = route.update(r, "level1", "coat", True)
    assert r == {("level1", "coat"): (2, 2)} and r2[("level1", "coat")] == (3, 2)
    assert route.update({}, "level2", "x", False)[("level2", "x")] == (2, 3)
