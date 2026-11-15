"""cap-5 on the requirement fixture: follow-ups."""
from capture.follow_ups import follow_ups


def _rows(fx, kind):
    return [r for r in fx["rows"] if r["item_kind"] == kind]


def test_fixture_cases(load_fixture):
    fx, cases = load_fixture("requirement/requirement.json"), load_fixture("requirement/cases.json")["cases"]
    for c in cases:
        got = [{"field": f["field"], "preselect": f["preselect"]} for f in follow_ups(_rows(fx, c["kind"]), c["facts"])]
        assert got == c["expected"]["follow_ups"], c["name"]


def test_at_most_three_and_condition_first(load_fixture):
    fx, cases = load_fixture("requirement/requirement.json"), load_fixture("requirement/cases.json")["cases"]
    for c in cases:
        got = follow_ups(_rows(fx, c["kind"]), c["facts"])
        assert len(got) <= 3
        assert not got or got[0]["field"] == "condition"


def test_function_never_preselected(load_fixture):
    fx, c = load_fixture("requirement/requirement.json"), load_fixture("requirement/cases.json")["cases"][3]
    facts = {**c["facts"], "function": {"state": "empty", "p_preselect_right": 0.99, "preselect": "works"}}
    got = {f["field"]: f for f in follow_ups(_rows(fx, "electronics"), facts)}
    assert got["function"]["preselect"] is None


def test_settled_or_asked_never_asked_again(load_fixture):
    fx, c = load_fixture("requirement/requirement.json"), load_fixture("requirement/cases.json")["cases"][0]
    rows = _rows(fx, "apparel")
    facts = {**c["facts"], "size_label": {"state": "settled"}}
    fields = [f["field"] for f in follow_ups(rows, facts, asked={"brand"})]
    assert "size_label" not in fields and "brand" not in fields


def test_a_field_the_process_needs_gets_its_own_input_past_the_cap(load_fixture):
    fx, c = load_fixture("requirement/requirement.json"), load_fixture("requirement/cases.json")["cases"][3]
    charger = {"id": "req_electronics_charger", "field": "charger", "priority": "low", "role": "attribute",
               "fill_ladder": [{"rung": "asked", "route": "clarify"}], "views_needed": [], "seconds": 0, "effort": 3}
    rows = _rows(fx, "electronics") + [charger]
    facts = {**c["facts"], "charger": {"state": "empty", "p_preselect_right": 0.5, "preselect": None}}
    plain = follow_ups(rows, facts)
    more = follow_ups(rows, facts, process_fields={"charger"})
    assert len(plain) == 3 and len(more) == 4
    assert more[0]["field"] == "condition"


def test_find_asks_no_condition_and_purpose_is_checked(load_fixture):
    import pytest
    fx, c = load_fixture("requirement/requirement.json"), load_fixture("requirement/cases.json")["cases"][0]
    rows = _rows(fx, "apparel")
    assert "condition" not in [f["field"] for f in follow_ups(rows, c["facts"], purpose="find")]
    assert follow_ups(rows, c["facts"], purpose="appraise") == follow_ups(rows, c["facts"])
    with pytest.raises(ValueError):
        follow_ups(rows, c["facts"], purpose="browse")
