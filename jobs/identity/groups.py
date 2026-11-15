"""Offer groups use catalogue product ids, never item/comp apparel sizes."""
from statistics import median
from identity.params import use
from identity.validation import money, half_up
from identity.citation import citation
from identity.cluster import instant
from identity.lots import single_product_comps

RELATIONS = {"same_product", "successor", "functional_equivalent"}


def group_offers(comps, *, retail_offers=(), now, resolved=None):
    resolved = use(resolved)
    v = resolved["values"]
    groups = {}
    rows = [(c, False) for c in single_product_comps(comps)]
    rows += [(r, True) for r in retail_offers]
    for row, retail in rows:
        for field in ('price_cents', 'shipping_cents', 'tax_cents'):
            if row.get(field) is not None:
                money(row[field], field)
        if retail:
            age = (now - instant(row["fetched_at"])).total_seconds()
            if age < 0 or age > v["identity_retail_cache_seconds"]:
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
        if total is not None:
            money(total, 'delivered_total_cents')
        cite = citation('delivered_total_cents', row, resolved, sources=[row['id']] if row.get('id') else [],
                        at=now.isoformat(), allowed=total is not None and bool(row.get('id')))
        groups.setdefault(key, []).append({**row, "delivered_total_cents": total, 'citation': cite,
                                           'guarded_total': {'value': total, 'state': cite['guard']['state'], 'citation_id': cite['id']}})
    return [{"product_id": p, "relation": r, "condition": c, "offers": offers}
            for (p, r, c), offers in sorted(groups.items())]


def variant_range(family_range, variant_sold_prices, family_sold_prices, *, resolved=None):
    resolved = use(resolved)
    for field in ('low', 'high'):
        money(family_range[field], 'family_range.' + field)
    if family_range['low'] > family_range['high']:
        raise ValueError('family_range must be ordered')
    for field, prices in [('variant_sold_prices', variant_sold_prices), ('family_sold_prices', family_sold_prices)]:
        for price in prices:
            money(price, field, positive=True)
    n = len(variant_sold_prices) if family_sold_prices else 0
    k = resolved['values']['identity_variant_blend']
    weight = n / (n + k) if n + k else 0.
    ratio = median(variant_sold_prices) / median(family_sold_prices) if n else 1.
    scale = (1 - weight) + weight * ratio
    low = half_up(family_range['low'] * scale, 'low')
    high = half_up(family_range['high'] * scale, 'high')
    inputs = {'family_range': family_range, 'variant_sold_prices': list(variant_sold_prices),
              'family_sold_prices': list(family_sold_prices)}
    cite = citation('variant_range', inputs, resolved, sources=family_range.get('basis_ids', []))
    return {**family_range, 'low': low, 'high': high, 'basis': 'from other variants',
            'basis_level': 'variant' if n else 'family', 'rung': 'variant' if n else 'family',
            'confidence': weight, 'citation': cite,
            'guarded_range': {'value': {'lo': low, 'hi': high}, 'state': 'shown', 'citation_id': cite['id']}}
