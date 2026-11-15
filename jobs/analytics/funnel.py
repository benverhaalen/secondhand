"""Listing rollups and raw site money, platform-analytics §3.2–4.

Daily flow deltas add; gauges take their last reported value. Missing fields retain
flags beside totals. Orders deduplicate by item before site grouping; unknown
payouts remain unknown. Cross-site attention metrics are refused, never blended.
"""
from collections import defaultdict
from datetime import datetime
from statistics import median

from .normalise import SITES, STAGES
from .money import cents, rounded
from .params import selected, value
from .guarded import guarded


def sale_orders(orders):
    sales = {}
    for order in orders:
        if order['kind'] != 'sale' or order['state'] in ('cancelled', 'refunded'):
            continue
        key = order['item_id']
        if key in sales:
            # Retry ids may differ, but immutable sale facts must agree.
            if {k: v for k, v in order.items() if k != 'id'} != {k: v for k, v in sales[key].items() if k != 'id'}:
                raise ValueError(f'conflicting sale for item {key}')
            sales[key] = min((sales[key], order), key=lambda o: o['id'])
        else:
            sales[key] = order
    return [sales[k] for k in sorted(sales)]


def listing_funnel(rows):
    daily, ids = {}, {}
    for row in rows:
        if row.get('id'):
            identity = (row['site'], row['id'])
            if identity in ids and ids[identity] != row:
                raise ValueError('conflicting observation id')
            ids[identity] = row
        key = (row['site'], row['listing_id'], row['day'])
        if key in daily and row != daily[key]:
            previous = daily[key]
            if not row.get('read_at') or not previous.get('read_at') or row['read_at'] == previous['read_at']:
                raise ValueError('ambiguous daily snapshot')
            daily[key] = max((row, previous), key=lambda r: r['read_at'])
        else:
            daily[key] = row
    rows = sorted(daily.values(), key=lambda r: r['day'])
    if not rows or len({(r['listing_id'], r['site']) for r in rows}) != 1:
        raise ValueError('one listing and site required')
    site = rows[0]['site']
    stages, flags = {}, {f for r in rows for f in r['flags']}
    start = min(r.get('posted_at', r['day'])[:10] for r in rows)
    end = max(r.get('ended_at', r['day'])[:10] for r in rows)
    days = (datetime.fromisoformat(end) - datetime.fromisoformat(start)).days + 1
    complete = len({r['day'] for r in rows}) == days
    if not complete:
        flags.add('not_reported')
    for stage in {s for r in rows for s in r['stages']}:
        values = [r['stages'].get(stage) for r in rows if 'counter_reset' not in r['flags']]
        values = [v for v in values if v is not None]
        stages[stage] = (values[-1] if stage in SITES[site]['gauge'] else sum(values)) if values else None
    return dict(listing_id=rows[0]['listing_id'], site=site, item_id=rows[0]['item_id'], stages=stages,
                furthest_stage=next((s for s in reversed(STAGES) if stages.get(s)), None),
                terms=rows[-1]['terms'], flags=sorted(flags), days=days,
                rates={s: v / days if v is not None and complete and all(r['stages'].get(s) is not None and 'counter_reset' not in r['flags'] for r in rows) else None for s, v in stages.items()})


def metric(rows, name):
    if name not in ('sales', 'offers', 'messages') and len({r['site'] for r in rows}) > 1:
        raise ValueError('cross-site metric definition differs')
    value = len({r['item_id'] for r in rows}) if name == 'sales' else (
        sum(r['value'] for r in rows if r['value'] is not None) if any(r['value'] is not None for r in rows) else None)
    return dict(value=value, flags=sorted({f for r in rows for f in r['flags']}))


def money_rows(listings, orders, log=None, *, params=None):
    params = selected(params)
    for record in [*listings, *orders]:
        for field, amount in record.items():
            if field.endswith('_cents') and amount is not None:
                cents(amount, field)
        for line in record.get('lines', []):
            cents(line['amount_cents'], 'amount_cents')
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
        cents(row['kept_cents'], 'kept_cents')
        row['flags'] = sorted(set(row['flags']))
        row['share_of_asking'] = median(pairs[site]) if len(pairs[site]) >= value(params, 'share_pairs') else None
        row['kept_per_sold_item_cents'] = rounded(row['kept_cents'] / (row['sales'] - row['kept_unknown']), 'kept_per_sold_item_cents') if row['sales'] > row['kept_unknown'] else None
        basis = sorted([r for r in sale_orders(orders) if r['site'] == site] + [r for r in listings if r['site'] == site], key=lambda r: r['id'])
        row['metrics'] = {name: guarded(name, amount, basis, versions=params['versions'],
                          filters={'site': site}, unit='cents' if name.endswith('_cents') else 'days' if name == 'days_to_sell' else 'count' if name == 'sales' else 'ratio',
                          missing=(bool(row['kept_unknown']) if name.endswith('_cents') else len(amount) != row['sales'] if name == 'days_to_sell' else False))
                          for name, amount in row.items() if name not in ('flags', 'kept_unknown')}
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
