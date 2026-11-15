"""Owned items' cost of waiting against fit, recommendation-and-style §3.9.

Read only shown 12-week price forecasts as of now. Price snapshots, purchase
facets and current facets are explicit inputs; missing purchase basis is flagged
rather than inventing a fit ratio. No listing or other action is performed.
"""
from statistics import mean
from .rank import matching_facets
from .params import resolved
from .evidence import money, publish


def sell_now(items, forecasts, state, purchase_facets, now, *, recipient=None, log=None, params=None):
    params=resolved(params)
    shown, hidden = [], 0
    for item in items:
        if item['state']!='owned' or item['person']!=state.person:
            continue
        if item.get('p50_now') is not None:
            money(item['p50_now'],'p50_now',positive=True)
        fc=[f for f in forecasts if f['subject']==dict(kind='product',id=item['product_id']) and
            f['metric']=='median_sold_price_cents' and f['horizon_weeks']==12 and f['as_of']<=now.date().isoformat()]
        fc=max(fc,key=lambda f:(f['as_of'],f['id']),default=None)
        if fc is None or fc.get('state')!='shown' or not item.get('p50_now'):
            hidden+=1
            continue
        money(fc['p50'],'p50',positive=True)
        old=purchase_facets.get(item['id'])
        old_state=type(state)(state.person,facets=old or [])
        before=[f['weight'] for f in matching_facets(item,old_state,recipient)]
        if not before or mean(before)<=0:
            hidden+=1
            continue
        current={f['name']:f['weight'] for f in matching_facets(item,state,recipient)}
        fit=min(1,mean(current.get(f['name'],0) for f in matching_facets(item,old_state,recipient))/mean(before))
        drop=1-fc['p50']/item['p50_now']
        shown.append(dict(id=item['id'],forecast_id=fc['id'],drop=drop,fit_now=fit,sell_now=max(drop,0)*(params['values']['style_sell_fit_base']-fit),
                          **publish({'drop':drop,'fit_now':fit,'sell_now':max(drop,0)*(params['values']['style_sell_fit_base']-fit)},
                                    [dict(id=item['id'],p50_now=item['p50_now'],attrs=item['attrs'],purchase_facets=old,current_facets=state.facets),
                                     dict(id=fc['id'],forecast=fc)],now,params,metric='sell_now')))
    shown.sort(key=lambda r:(-r['sell_now'],r['id']))
    if log:
        log.note('style.sell_now',person_id=state.person,count=len(shown),hidden_count=hidden)
    return dict(items=shown,hidden_count=hidden)
