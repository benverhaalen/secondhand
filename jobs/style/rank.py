"""Style score, search bands and For you cache (§3.5–7, §8).

Scoring projects explicit attributes and never reads payment fields. The shelf
stores only ids and reasons. Reset owns this same PersonState cache, so old
scores cannot survive a reset. A stale rebuild discards every recipient's cache.
"""
import math
from copy import deepcopy
from datetime import timedelta


def matching_facets(row, state, recipient=None):
    return [f for f in state.facets if f.get('recipient') == recipient and not f.get('removed_at') and
            row['attrs'].get(f['name']) == f['value'] and
            (not f.get('category') or row['attrs'].get('category') == f['category']) and
            (not f.get('brand') or row['attrs'].get('brand') == f['brand'])]


def score(row, state, *, recipient=None, intent=(), penalties=None, deal_range=(1., .5), quality_range=(.8, 1.2)):
    if row['state'] != 'live' or not row['fits'] or row['recalled'] or row.get('person') == state.person:
        return None
    if row.get('product_id') and row['label'] not in ('exact','likely_same_model'):
        return None
    facets = matching_facets(row,state,recipient)
    sizes = [f for f in state.facets if f['name']=='size' and f.get('recipient')==recipient and
             (not f.get('category') or f['category']==row['attrs'].get('category')) and
             (not f.get('brand') or f['brand']==row['attrs'].get('brand')) and not f.get('removed_at')]
    if sizes and not any(f['value']==row['attrs'].get('size') for f in sizes):
        return None
    span = row['high']-row['low']
    position = max(0.,min(1.,(row['delivered_cents']-row['low'])/span)) if span > 0 else float(row['delivered_cents'] > row['high'])
    deal = deal_range[0]+position*(deal_range[1]-deal_range[0])
    qrow = row.get('quality')
    q = quality_range[0] + max(0.,min(100.,qrow['value']))/100*(quality_range[1]-quality_range[0]) if qrow and qrow['state']=='shown' else 1.
    slots = sum(s['confidence'] for s in intent if row['attrs'].get(s['name'])==s['value'] and s.get('recipient')==recipient)
    penalties = penalties or {}
    penalty = sum(penalties.get(f'{name}:{value}',0) for name,value in (('brand',row['attrs'].get('brand')),('cluster',row.get('cluster_id'))))
    value = (sum(f['weight'] for f in facets)+slots+penalty)*deal*q
    # Return a projection; attaching a referral to the input cannot leak into output.
    return dict(id=row['id'], score=value, reason=[dict(name=f['name'],value=f['value'],count=f['count']) for f in facets],
                source='for_you', cluster_id=row.get('cluster_id'), product_id=row.get('product_id'), seller_ref_hash=row['seller_ref_hash'])


def within_bands(rows, state, **kw):
    scored = [(r,score(r,state,**kw),i) for i,r in enumerate(rows)]
    return [r for r,s,i in sorted((x for x in scored if x[1] is not None), key=lambda x:(x[0]['band'],-x[1]['score'],x[2]))]


def for_you(state, rows, now, *, opted_in, signal_count, recipient=None, limit=40, log=None, **kw):
    if not opted_in or signal_count < 3:
        return []
    if state.stale:
        state.shelf = []
        state.stale = False
    cached = next((r for r in (state.shelf or []) if r['recipient']==recipient), None)
    if cached:
        return deepcopy(cached['shelf'])
    scored = [(r,score(r,state,recipient=recipient,**kw)) for r in rows]
    scored = [(r,s) for r,s in scored if s is not None]
    scored.sort(key=lambda x:(-x[1]['score'],x[0]['posted_at'],x[0]['id']),reverse=False)
    # Stable newest-first ties; score remains the primary ordering.
    scored.sort(key=lambda x:x[0]['posted_at'],reverse=True)
    scored.sort(key=lambda x:-x[1]['score'])
    shelf, products = [], {}
    for r,s in scored:
        product = r.get('product_id') or r['id']
        if products.get(product,0)>=2 or sum(x['seller_ref_hash']==s['seller_ref_hash'] for x in shelf[-19:])>=3:
            continue
        shelf.append(s)
        products[product] = products.get(product,0)+1
        if len(shelf)>=limit:
            break
    bar = sorted(x['score'] for x in shelf)[max(0,math.ceil(.9*len(shelf))-1)] if shelf else None
    state.alert_bar = bar if recipient is None else state.alert_bar
    state.shelf = (state.shelf or []) + [dict(recipient=recipient,shelf=shelf,built_at=now,alert_bar=bar)]
    if log:
        log.change('for_you_cache',state.person,'built',recipient=recipient,count=len(shelf))
    return deepcopy(shelf)


def alert(state, row, now, *, recipient=None, spacing_days=7, log=None, **kw):
    result = score(row,state,recipient=recipient,**kw)
    cache = next((r for r in (state.shelf or []) if r['recipient']==recipient), None)
    bar = state.alert_bar if recipient is None else cache['alert_bar'] if cache else None
    if state.stale or result is None or bar is None or result['score']<=bar:
        return False
    if any(product==row.get('product_id') and now-at<timedelta(days=spacing_days) for _,product,at in state.alerts_sent):
        return False
    state.alerts_sent.append((row['id'],row.get('product_id'),now))
    if log:
        log.change('match',row['id'],'new',source='for_you')
    return True
