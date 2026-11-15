from datetime import datetime, timezone
import pytest
from identity.groups import group_offers, variant_range
from identity.lots import lot_card, single_product_comps

NOW = datetime(2026, 11, 14, tzinfo=timezone.utc)


def test_size_variants_are_one_group_with_delivered_totals():
    rows = [{"id": "a", "product_id": "pr_shoe", "size": "8", "condition": "good", "price_cents": 1000,
             "shipping_cents": 200, "tax_cents": 70},
            {"id": "b", "product_id": "pr_shoe", "size": "9", "condition": "good", "price_cents": 900}]
    groups = group_offers(rows, now=NOW)
    assert len(groups) == 1 and len(groups[0]["offers"]) == 2
    assert groups[0]["offers"][0]["delivered_total_cents"] == 1270
    assert groups[0]["offers"][1]["delivered_total_cents"] is None


def test_lot_of_three_is_one_card_with_parts_and_no_single_item_price():
    row = {"id": "cmp_lot", "title": "lot of 3 jackets", "quantity": 3, "price_cents": 9000,
           "product_id": "pr_jacket"}
    card = lot_card(row, identified_parts=["pr_a", "pr_b", "pr_c"])
    assert card["lot_parts"] == ["pr_a", "pr_b", "pr_c"]
    assert card["price_cents"] == 9000
    assert single_product_comps([card]) == []


def test_unidentified_lot_and_vision_count_are_also_excluded():
    for row in ({"title": "bundle of jackets"}, {"quantity": 3}, {"vision_count": 2}):
        assert single_product_comps([lot_card(row)]) == []


def test_catalogue_set_is_one_product_even_with_missing_parts():
    row = {"title": "LEGO set of 300 pieces", "quantity": 300, "catalogue_set": True, "condition": "parts"}
    assert single_product_comps([lot_card(row)]) == [row]


def test_refurbished_groups_and_retail_cache_expiry():
    base = {"product_id": "pr_1", "relation": "same_product", "condition": "refurbished",
            "price_cents": 1000, "shipping_cents": 0, "tax_cents": 0,
            "fetched_at": "2026-11-13T23:55:00Z", "seller_kind": "maker"}
    rows = [dict(base, id="a"), dict(base, id="b", seller_kind="private"),
            dict(base, id="c", fetched_at="2026-11-13T23:49:59Z")]
    groups = group_offers([], retail_offers=rows, now=NOW)
    assert {g["condition"] for g in groups} == {"refurbished", "good"}
    assert sum(len(g["offers"]) for g in groups) == 2


def test_variant_range_requires_three_sold_not_three_asking():
    family = {"low": 100, "high": 200}
    assert variant_range(family, [200, 200], [100, 100, 100])["low"] == 100
    assert variant_range(family, [200, 200, 200], [100, 100, 100])["low"] == 200


def test_unknown_relation_is_an_input_error():
    with pytest.raises(ValueError, match="relation"):
        group_offers([{"product_id": "pr_1", "relation": "similar", "condition": "good"}], now=NOW)
