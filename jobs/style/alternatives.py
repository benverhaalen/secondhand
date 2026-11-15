"""M17 kept-ready equivalents, filtered by editable style (§3.8).

Similarity is M17's precomputed material/build/quality score, not image distance.
Hard bars precede the personal ordering. Removed values and known size conflicts
are excluded before producing a referral-free projection.
"""
from .rank import matching_facets, active_sizes
from .params import resolved
from .evidence import money, publish
import math


def alternatives(target, neighbours, state, *, recipient=None, similarity_bar=None, price_ratio=None, params=None, as_of=None):
    params=resolved(params)
    v=params['values']
    similarity_bar=v['style_similarity_bar'] if similarity_bar is None else similarity_bar
    price_ratio=v['style_price_ratio'] if price_ratio is None else price_ratio
    if not target.get('material') or not target.get('condition') or target.get('p50') is None:
        return []
    money(target['p50'],'target.p50',positive=True)
    result=[]
    for row in neighbours:
        if row['category']!=target['category'] or row['function']!=target['function']:
            continue
        if not row.get('material') or not row.get('condition') or row.get('p50') is None:
            continue
        money(row['p50'],'p50',positive=True)
        if not math.isfinite(row['similarity']) or not 0 <= row['similarity'] <= 1:
            raise ValueError('similarity must be in [0,1]')
        if row['similarity']<similarity_bar or row['p50']>target['p50']*price_ratio:
            continue
        active={(f.get('recipient'),f['name'],f['value']) for f in state.facets if not f.get('removed_at')}
        if any(rec==recipient and row['attrs'].get(name)==value and (rec,name,value) not in active for rec,name,value in state.removed):
            continue
        sizes=active_sizes(row,state,recipient)
        if sizes and not any(f['value']==row['attrs'].get('size') for f in sizes):
            continue
        matched=matching_facets(row,state,recipient)
        result.append(dict(id=row['id'],similarity=row['similarity'],p50=row['p50'],
                           score=row['similarity']*(1+sum(f['weight'] for f in matched)),
                           **publish({'p50':row['p50'],'similarity':row['similarity']},
                                     [dict(id=row['id'],p50=row['p50'],similarity=row['similarity'],attrs=row['attrs']),
                                      dict(id='target:'+str(target.get('id','input')),target=target)],as_of,params,metric='alternatives')))
    return sorted(result,key=lambda r:(-r['score'],r['p50'],r['id']))
