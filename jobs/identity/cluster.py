"""Cross-post collapse; rejected pairs are constraints on whole components."""
from datetime import datetime
from hashlib import sha256
from identity.pair import text_similarity
from identity.params import use
from identity.validation import money


def phash(value):
    number = int(value, 16) if isinstance(value, str) else value
    if not isinstance(number, int) or isinstance(number, bool) or not 0 <= number < 2**64:
        raise ValueError("phash must contain 64-bit hashes")
    return number


def hamming(left, right):
    return (phash(left) ^ phash(right)).bit_count()


def instant(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("listed_at_source must include timezone")
    return result


def cluster_comps(comps, *, retail_phashes=(), blocked_pairs=(), params=(), scope=None, log=None, resolved=None):
    comps = sorted(comps, key=lambda c: c["id"])
    if len({c["id"] for c in comps}) != len(comps):
        raise ValueError("duplicate comp id")
    scope = scope or {}
    resolved = use(resolved, params, scope)
    v = resolved['values']
    distance = v['identity_phash_distance']
    price_tolerance = v['identity_price_tolerance']
    days = v['identity_date_days']
    for row in comps:
        money(row['price_cents'], 'price_cents')
    hashes = {c["id"]: tuple(phash(h) for h in c.get("phash", ())) for c in comps}
    retail = tuple(phash(h) for h in retail_phashes)
    close = lambda a, b: hamming(a, b) <= distance
    # Detect reuse across the whole input before any union. For large ingest,
    # the caller supplies the warm retail/reuse index as retail_phashes.
    all_hashes = set(h for values in hashes.values() for h in values)
    stock = set()
    for h in all_hashes:
        sellers = {c["seller_ref_hash"] for c in comps if c.get("seller_ref_hash")
                   and any(close(h, other) for other in hashes[c["id"]])}
        if len(sellers) >= v["identity_stock_sellers"] or any(close(h, other) for other in retail):
            stock.add(h)
    parent = list(range(len(comps)))
    members = {i: {c["id"]} for i, c in enumerate(comps)}
    blocked = {frozenset(p) for p in blocked_pairs}

    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, a in enumerate(comps):
        for j in range(i + 1, len(comps)):
            b = comps[j]
            ri, rj = root(i), root(j)
            if ri == rj or any(frozenset((x, y)) in blocked for x in members[ri] for y in members[rj]):
                continue
            seller = (bool(a.get("seller_ref_hash")) and a["seller_ref_hash"] == b.get("seller_ref_hash")
                      and text_similarity(a.get("title", ""), b.get("title", "")) >= v["identity_seller_text"])
            photos = (not a.get("stock_photo") and not b.get("stock_photo") and
                      any(close(x, y) for x in hashes[a["id"]] if x not in stock
                          for y in hashes[b["id"]] if y not in stock))
            prices = a.get("price_cents"), b.get("price_cents")
            price_ok = (all(p is not None and p > 0 for p in prices)
                        and abs(prices[0] - prices[1]) / max(prices) <= price_tolerance)
            # Fixed unit conversion: 86400 seconds per day.
            date_ok = (a.get("listed_at_source") and b.get("listed_at_source") and
                       abs((instant(a["listed_at_source"]) - instant(b["listed_at_source"])).total_seconds()) <= days * 86400)
            if seller or (photos and price_ok and date_ok):
                parent[rj] = ri
                members[ri].update(members.pop(rj))
    result = []
    for ids in members.values():
        rows = [c for c in comps if c["id"] in ids]
        cluster_id = "cluster_" + sha256("\0".join(sorted(ids)).encode()).hexdigest()[:24]
        result.append({"cluster_id": cluster_id, "comp_ids": sorted(ids),
                       "prices": [{"comp_id": c["id"], "site": c["site"], "price_cents": c["price_cents"]} for c in rows]})
    if log:
        log.note("identity.cluster", comp_count=len(comps), cluster_count=len(result))
    return result
