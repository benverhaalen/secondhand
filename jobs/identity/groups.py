"""Offer groups use catalogue product ids, never item/comp apparel sizes."""
from statistics import median
from identity.cluster import instant
from identity.lots import single_product_comps

RELATIONS = {"same_product", "successor", "functional_equivalent"}


def group_offers(comps, *, retail_offers=(), now):
    groups = {}
    rows = [(c, False) for c in single_product_comps(comps)]
    rows += [(r, True) for r in retail_offers]
    for row, retail in rows:
        if retail:
            age = (now - instant(row["fetched_at"])).total_seconds()
            if age < 0 or age > 600:
                continue
        relation = row.get("relation", "same_product")
        if relation not in RELATIONS:
            raise ValueError("unknown retail_offer relation")
        condition = row["condition"]
        if condition == "refurbished" and row.get("seller_kind") not in {"maker", "certified_refurbisher"}:
            condition = "good"
        key = row["product_id"], relation, condition
        amounts = [row.get(k) for k in ("price_cents", "shipping_cents", "tax_cents")]
        total = sum(amounts) if all(v is not None for v in amounts) else None
        groups.setdefault(key, []).append({**row, "delivered_total_cents": total})
    return [{"product_id": p, "relation": r, "condition": c, "offers": offers}
            for (p, r, c), offers in sorted(groups.items())]


def variant_range(family_range, variant_sold_prices, family_sold_prices):
    ratio = 1.0
    if len(variant_sold_prices) >= 3 and family_sold_prices:
        denominator = median(family_sold_prices)
        if denominator <= 0:
            raise ValueError("family sold median must be positive")
        ratio = median(variant_sold_prices) / denominator
    return {**family_range, "low": round(family_range["low"] * ratio),
            "high": round(family_range["high"] * ratio), "basis": "from other variants"}
