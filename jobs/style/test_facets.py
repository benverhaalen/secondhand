"""rs-1: events to facets. Each test names the break it guards."""
import json
from datetime import datetime, timedelta

import pytest

from style.facets import START, Event, compute, pool_offsets, profiles

NOW = datetime(2026, 11, 14)


def ev(i, source, days_ago, recipient=None, listed_after=None, sold=False, **attrs):
    at = NOW - timedelta(days=days_ago)
    return Event(id=i, person="a", source=source, at=at, attrs=attrs, recipient=recipient, sold=sold,
                 listed_at=None if listed_after is None else at + timedelta(days=listed_after))


def find(p, name, **kw):
    return [f for f in p.facets if f["name"] == name and all(f.get(k) == v for k, v in kw.items())]


def test_worked_example_brand_weight():
    # spec worked example: 1 purchase last year, 3 kept items, 2 saves -> a = 2.81, weight 0.58
    es = [ev("p", "purchase", 365, brand="Patagonia"), *[ev(f"k{i}", "kept", 1 + i * 3, brand="Patagonia") for i in range(3)],
          ev("s1", "save", 1, brand="Patagonia"), ev("s2", "save", 2, brand="Patagonia")]
    # kept events are within a day or two so decay is ~1; compare with the formula, not a rounded number
    (f,) = find(compute(es, NOW), "brand", value="Patagonia")
    a = sum(START[s][0] * 0.5 ** (d / 365) for s, d in [("purchase", 365), ("kept", 1), ("kept", 4), ("kept", 7), ("save", 1), ("save", 2)])
    assert f["weight"] == pytest.approx(a / (a + 2))
    assert f["count"] == 6 and f["from"] == "saved"


def test_thin_facet_is_not_shown():
    # 3 events needed, from at least 2 days
    assert not find(compute([ev(str(i), "save", 1, brand="X") for i in range(2)], NOW), "brand")
    assert not find(compute([Event(str(i), "a", "save", NOW, {"brand": "X"}) for i in range(3)], NOW), "brand")


def test_purchase_listed_within_a_week_is_not_taste():
    es = [ev(str(i), "purchase", 20 + i, listed_after=6, brand="Nike") for i in range(10)]
    assert compute(es, NOW).facets == []


def test_purchase_listed_after_a_month_is_taste():
    es = [ev(str(i), "purchase", 20 + i, listed_after=45, brand="Nike") for i in range(3)]
    assert find(compute(es, NOW), "brand", value="Nike")


def test_sold_item_counts_zero_for_taste_and_size():
    es = [ev(f"s{i}", "sold", 10 + i, brand="Nike", category="shoe", size="10") for i in range(5)]
    es += [ev(f"p{i}", "purchase", 100 + i, sold=True, brand="Nike", category="shoe", size="10") for i in range(5)]
    assert compute(es, NOW).facets == []


def test_two_brands_two_sizes_both_kept():
    es = [ev(f"m{i}", "kept", 100 + i, brand="Patagonia", category="jacket", size="M") for i in range(3)]
    es += [ev(f"l{i}", "kept", 100 + i, brand="Uniqlo", category="jacket", size="L") for i in range(3)]
    sizes = {(f["brand"], f["value"]) for f in find(compute(es, NOW), "size")}
    assert sizes == {("Patagonia", "M"), ("Uniqlo", "L")}


def test_pooled_offset_merges_brand_sizes_into_one_true_size():
    es = [ev(f"m{i}", "kept", 100 + i, brand="Patagonia", category="jacket", size="M") for i in range(3)]
    es += [ev(f"l{i}", "kept", 100 + i, brand="Uniqlo", category="jacket", size="L") for i in range(3)]
    (f,) = find(compute(es, NOW, offsets={("Uniqlo", "jacket"): 1}), "size")
    assert f["value"] == "M" and f.get("brand") is None


def test_pool_offsets_needs_five_people():
    def people(n):
        return {f"p{i}": {("A", "jacket"): "M", ("B", "jacket"): "L"} for i in range(n)}
    assert pool_offsets(people(4)) == {}
    off = pool_offsets(people(5))
    assert off[("B", "jacket")] - off[("A", "jacket")] == 1


def test_child_size_steps_up_with_months():
    es = [ev(f"o{i}", "purchase", 365 + i, recipient="son", category="shoe", size="8") for i in range(3)]
    es += [ev(f"n{i}", "purchase", 20 + i * 5, recipient="son", category="shoe", size="10") for i in range(3)]
    (f,) = find(compute(es, NOW, children={"son"}), "size", recipient="son")
    assert f["value"] == "10"


def test_adult_size_does_not_step_up_in_months():
    es = [ev(f"o{i}", "purchase", 365 + i, category="shoe", size="8") for i in range(3)]
    es += [ev(f"n{i}", "purchase", 20 + i * 5, category="shoe", size="10") for i in range(3)]
    assert not find(compute(es, NOW), "size")  # 50/50 style split: neither passes 0.7 yet


def test_off_size_purchase_waits_unassigned():
    es = [ev(f"k{i}", "kept", 100 + i, category="jacket", size="M") for i in range(3)]
    es.append(ev("gift", "purchase", 5, category="jacket", size="XXL"))
    p = compute(es, NOW)
    assert [u["event"] for u in p.unassigned] == ["gift"]
    assert find(p, "size", value="M")
    es.append(ev("gift2", "purchase", 3, category="jacket", size="XXL"))  # a second event confirms it
    assert compute(es, NOW).unassigned == []


def test_recipient_facets_never_reach_own_profile():
    es = [ev(f"c{i}", "purchase", 10 + i * 3, recipient="son", brand="Nike", category="shoe", size="10") for i in range(4)]
    p = compute(es, NOW)
    assert p.facets and all(f["recipient"] == "son" for f in p.facets)


def test_not_for_me_penalty_on_cluster_and_brand():
    p = compute([ev("n", "not_for_me", 0, brand="Nike", cluster="c1")], NOW)
    assert p.penalties == {"cluster:c1": -1.0, "brand:Nike": -0.3}


def test_person_b_byte_identical_after_person_a_events():
    b = [Event(f"b{i}", "b", "save", NOW - timedelta(days=i), {"brand": "Arcteryx", "category": "shell"}) for i in range(4)]
    a = [Event(f"a{i}", "a", "save", NOW - timedelta(days=i), {"brand": "Arcteryx"}) for i in range(5)]
    only_b = json.dumps(profiles(b, NOW)["b"].as_dict(), sort_keys=True)
    both = json.dumps(profiles(a + b, NOW)["b"].as_dict(), sort_keys=True)
    assert only_b == both and "a" in profiles(a + b, NOW)


def test_compute_refuses_mixed_people():
    with pytest.raises(ValueError, match="one person"):
        compute([Event("1", "a", "save", NOW, {}), Event("2", "b", "save", NOW, {})], NOW)


def test_unknown_source_refused():
    with pytest.raises(ValueError):
        Event("1", "a", "referral_click", NOW, {})
