"""M17 kept-ready equivalents, filtered by editable style (§3.8).

Similarity is M17's precomputed material/build/quality score, not image distance.
Hard bars precede the personal ordering. Removed values and known size conflicts
are excluded before producing a referral-free projection.
"""
from .rank import matching_facets


def alternatives(target, neighbours, state, *, recipient=None, similarity_bar=.75, price_ratio=.75):
    if not target.get('material') or not target.get('condition') or target.get('p50') is None:
        return []
    result=[]
    for row in neighbours:
        if row['category']!=target['category'] or row['function']!=target['function']:
            continue
        if not row.get('material') or not row.get('condition') or row.get('p50') is None:
            continue
        if row['similarity']<similarity_bar or row['p50']>target['p50']*price_ratio:
            continue
        active={(f.get('recipient'),f['name'],f['value']) for f in state.facets if not f.get('removed_at')}
        if any(rec==recipient and row['attrs'].get(name)==value and (rec,name,value) not in active for rec,name,value in state.removed):
            continue
        sizes=[f for f in state.facets if f['name']=='size' and f.get('recipient')==recipient and
               (not f.get('category') or f['category']==row['category']) and
               (not f.get('brand') or f['brand']==row['attrs'].get('brand'))]
        if sizes and not any(f['value']==row['attrs'].get('size') for f in sizes):
            continue
        matched=matching_facets(row,state,recipient)
        result.append(dict(id=row['id'],similarity=row['similarity'],p50=row['p50'],
                           score=row['similarity']*(1+sum(f['weight'] for f in matched))))
    return sorted(result,key=lambda r:(-r['score'],r['p50'],r['id']))
