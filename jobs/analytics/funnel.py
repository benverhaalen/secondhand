"""Listing rollups and raw site money, platform-analytics §3.2–4.

Daily flow deltas add; gauges take their last reported value. Missing fields retain
flags beside totals. Orders deduplicate by item before site grouping; unknown
payouts remain unknown. Cross-site attention metrics are refused, never blended.
"""
from collections import defaultdict
from datetime import datetime
from statistics import median

from .normalise import SITES, STAGES


def sale_orders(orders):
    seen, sales = set(), []
    for order in orders:
        if order['kind'] != 'sale' or order['state'] in ('cancelled', 'refunded'):
            continue
        if order['item_id'] not in seen:
            seen.add(order['item_id'])
            sales.append(order)
    return sales


def listing_funnel(rows):
    rows = sorted(rows, key=lambda r: r['day'])
    if not rows or len({(r['listing_id'], r['site']) for r in rows}) != 1:
        raise ValueError('one listing and site required')
    site = rows[0]['site']
    stages, flags = {}, {f for r in rows for f in r['flags']}
    for stage in {s for r in rows for s in r['stages']}:
        values = [r['stages'].get(stage) for r in rows if 'counter_reset' not in r['flags']]
        values = [v for v in values if v is not None]
        stages[stage] = (values[-1] if stage in SITES[site]['gauge'] else sum(values)) if values else None
    return dict(listing_id=rows[0]['listing_id'], site=site, item_id=rows[0]['item_id'], stages=stages,
                furthest_stage=next((s for s in reversed(STAGES) if stages.get(s)), None),
                terms=rows[-1]['terms'], flags=sorted(flags), days=len({r['day'] for r in rows}),
                rates={s: v / len({r['day'] for r in rows}) if v is not None else None for s, v in stages.items()})


def metric(rows, name):
    if name not in ('sales', 'offers', 'messages') and len({r['site'] for r in rows}) > 1:
        raise ValueError('cross-site metric definition differs')
    value = len({r['item_id'] for r in rows}) if name == 'sales' else (
        sum(r['value'] for r in rows if r['value'] is not None) if any(r['value'] is not None for r in rows) else None)
    return dict(value=value, flags=sorted({f for r in rows for f in r['flags']}))


def money_rows(listings, orders, log=None):
    by_id = {r['id']: r for r in listings}
    first_post = {}
    for listing in listings:
        key = (listing['item_id'], listing['site'])
        first_post[key] = min(first_post.get(key, listing['posted_at']), listing['posted_at'])
    result = defaultdict(lambda: dict(sales=0, kept_cents=0, kept_unknown=0, days_to_sell=[], flags=[], share_of_asking=None))
    pairs = defaultdict(list)
    for order in sale_orders(orders):
        row = result[order['site']]
        row['sales'] += 1
        lines = order['lines']
        if order.get('payout_cents') is None:
            row['kept_unknown'] += 1
            row['flags'].append('not_reported')
        else:
            row['kept_cents'] += order['payout_cents'] - sum(l['amount_cents'] for l in lines if l['kind'] in ('label', 'promotion_spend'))
        if any(l['source'] == 'estimated' for l in lines):
            row['flags'].append('estimated')
        listing = by_id.get(order.get('listing_id'))
        if listing and listing.get('ended_at'):
            row['days_to_sell'].append((datetime.fromisoformat(listing['ended_at'].replace('Z', '+00:00')) -
                                        datetime.fromisoformat(first_post[(listing['item_id'], listing['site'])].replace('Z', '+00:00'))).total_seconds() / 86400)
        if listing and listing.get('price_cents'):
            pairs[order['site']].append(order['price_cents'] / listing['price_cents'])
    for site, row in result.items():
        row['flags'] = sorted(set(row['flags']))
        row['share_of_asking'] = median(pairs[site]) if len(pairs[site]) >= 6 else None
        row['kept_per_sold_item_cents'] = row['kept_cents'] / (row['sales'] - row['kept_unknown']) if row['sales'] > row['kept_unknown'] else None
    if log:
        log.note('analytics.money', sites=len(result), sales=sum(r['sales'] for r in result.values()))
    return dict(result)


def site_funnels(rows):
    listings = defaultdict(list)
    for row in rows:
        listings[(row['site'], row['listing_id'])].append(row)
    sites = defaultdict(list)
    for batch in listings.values():
        sites[batch[0]['site']].append(listing_funnel(batch))
    result = {}
    for site, rollups in sites.items():
        stages, terms = {}, {}
        for row in rollups:
            for stage, definition in row['terms'].items():
                if stage in terms and terms[stage] != definition:
                    raise ValueError('metric definition changed within site')
                terms[stage] = definition
        for stage in {s for r in rollups for s in r['stages']}:
            values = [r['stages'].get(stage) for r in rollups]
            reported = [v for v in values if v is not None]
            stages[stage] = sum(reported) if reported else None
        result[site] = dict(stages=stages, terms=terms, items=len({r['item_id'] for r in rollups}),
                            flags=sorted({f for r in rollups for f in r['flags']}))
    return result
