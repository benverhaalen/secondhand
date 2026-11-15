"""cap-4 on the requirement fixture: next view and stop."""
from capture.next_view import next_view, stop
from capture.process import process_for


def _rows(fx, kind):
    return [r for r in fx["rows"] if r["item_kind"] == kind]


def _args(fx, c):
    return (_rows(fx, c["kind"]), c["unmet"], c["kept_views"], c["p_view_fills"], c["value_at_stake"], c["bar"])


def test_fixture_cases(load_fixture):
    fx, cases = load_fixture("requirement/requirement.json"), load_fixture("requirement/cases.json")["cases"]
    for c in cases:
        got = next_view(*_args(fx, c))
        assert got == c["expected"]["next_view"], c["name"]


def test_enough_views_stops_with_not_visible(load_fixture):
    fx, cases = load_fixture("requirement/requirement.json"), load_fixture("requirement/cases.json")["cases"]
    c = cases[1]  # tee with front, back, tag kept
    assert stop(*_args(fx, c)) == [{"field": "fabric", "unknown_reason": "not_visible"},
                                   {"field": "condition", "unknown_reason": "not_visible"}]
    assert stop(*_args(fx, cases[0])) is None  # the tag is still worth asking


def test_below_bar_view_not_asked_but_process_step_is(load_fixture):
    fx = load_fixture("requirement/requirement.json")
    rows = _rows(fx, "apparel")
    args = (rows, ["size_label"], ["front"], {"tag": {"size_label": 0.05}}, {"size_label": 0.1}, 5.0)
    assert next_view(*args) is None
    tee = tuple(s["role"] for s in process_for("apparel", True))
    assert next_view(*args, process_views=tee)["view"] == "tag"


def test_two_retakes_on_a_row_stops_asking_it(load_fixture):
    fx, c = load_fixture("requirement/requirement.json"), load_fixture("requirement/cases.json")["cases"][0]
    got = next_view(*_args(fx, c), retakes={"req_apparel_size_label": 2})
    assert got["row_id"] != "req_apparel_size_label"


def test_done_stops(load_fixture):
    fx, c = load_fixture("requirement/requirement.json"), load_fixture("requirement/cases.json")["cases"][0]
    assert next_view(*_args(fx, c), done=True) is None
    assert {"field": "size_label", "unknown_reason": "not_visible"} in stop(*_args(fx, c), done=True)


def test_a_kept_view_is_never_asked_again(load_fixture):
    fx, c = load_fixture("requirement/requirement.json"), load_fixture("requirement/cases.json")["cases"][0]
    rows, unmet, kept, p, v, bar = _args(fx, c)
    assert next_view(rows, unmet, kept + ["tag"], p, v, bar)["view"] != "tag"
