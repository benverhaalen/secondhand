from identity.cluster import cluster_comps


def comp(id, **changes):
    return {"id": id, "site": "depop", "price_cents": 8000,
            "phash": [0], "listed_at_source": "2026-11-01T00:00:00Z",
            "seller_ref_hash": id, "title": "black jacket", **changes}


def test_cross_post_one_cluster_keeps_every_site_price():
    rows = cluster_comps([comp("a"), comp("b", site="poshmark", price_cents=7500, phash=[7])])
    assert len(rows) == 1
    assert [(p["site"], p["price_cents"]) for p in rows[0]["prices"]] == [("depop", 8000), ("poshmark", 7500)]


def test_stock_photo_matching_retail_is_kept_apart():
    assert len(cluster_comps([comp("a"), comp("b")], retail_phashes=[0])) == 2


def test_stock_photo_under_five_sellers_is_kept_apart():
    assert len(cluster_comps([comp(str(i)) for i in range(5)])) == 5


def test_stock_photo_does_not_disable_independent_seller_evidence():
    assert len(cluster_comps([comp("a"), comp("b", seller_ref_hash="a")], retail_phashes=[0])) == 1


def test_blocked_pair_cannot_rejoin_through_third_comp():
    rows = cluster_comps([comp("a"), comp("b"), comp("c")], blocked_pairs={frozenset(("a", "c"))})
    assert len(rows) == 2
    assert not any({"a", "c"} <= set(r["comp_ids"]) for r in rows)


def test_date_and_price_boundaries_and_missing_seller():
    assert len(cluster_comps([comp("a"), comp("b", price_cents=10000)])) == 2
    assert len(cluster_comps([comp("a"), comp("b", listed_at_source="2026-12-02T00:00:00Z")])) == 2
    assert len(cluster_comps([comp("a", phash=[], seller_ref_hash=None), comp("b", phash=[], seller_ref_hash=None)])) == 2


def test_hash_distance_not_lexical_hash_and_order_is_stable():
    a, b = comp("a", phash=["0000000000000000"]), comp("b", phash=["00000000000000ff"])
    assert cluster_comps([a, b]) == cluster_comps([b, a])
    assert len(cluster_comps([a, b])) == 1
    assert len(cluster_comps([a, comp("c", phash=[511])])) == 2
