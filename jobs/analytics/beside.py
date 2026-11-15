"""Both definitions beside every comparison, platform-analytics §3.13, §4.

Distinct orders form rates; ship duration uses only orders with both clocks.
A gap opens an anomaly on our metric. Ranking changes mask view stages without
throwing away sales or mutating the underlying observations.
"""
from copy import deepcopy
from datetime import datetime
from statistics import mean
import math
from .params import selected, value


def beside(site, ours, site_figure, gap_bar=None, log=None, *, params=None):
    params = selected(params)
    gap_bar = value(params, "gap_rate") if gap_bar is None else gap_bar
    flags = set(ours['flags'])
    missing = ours.get('value') is None or site_figure is None or site_figure.get('value') is None
    if missing:
        flags.add('not_reported')
    gap = None if missing else abs(ours['value'] - site_figure['value'])
    unit = ours.get('unit', 'ratio')
    if site_figure and site_figure.get('unit', unit) != unit:
        raise ValueError('comparison units differ')
    if gap is not None and not math.isfinite(gap):
        raise ValueError('comparison values must be finite')
    flagged = unit == 'ratio' and gap is not None and gap > gap_bar and not math.isclose(gap, gap_bar, rel_tol=0, abs_tol=math.ulp(gap_bar))
    if flagged:
        flags.add('data_quality')
        if log:
            log.change('anomaly', f'{site}:data_quality', 'open', site=site, gap=gap)
    return dict(site=site, ours=deepcopy(ours), site_figure=deepcopy(site_figure), gap=gap,
                data_quality=flagged, flags=sorted(flags))


def own_figure(orders, site, metric):
    rows = list({o['item_id']: o for o in orders if o['site'] == site and o['kind'] == 'sale'}.values())
    if metric == 'cancel_rate':
        values = [int(o['state'] == 'cancelled') for o in rows]
        definition = 'cancelled orders / orders since linked'
    elif metric == 'ship_days':
        values = [(datetime.fromisoformat(o['clocks']['shipped_at'].replace('Z', '+00:00')) -
                   datetime.fromisoformat(o['clocks']['paid_at'].replace('Z', '+00:00'))).total_seconds() / 86400
                  for o in rows if o['clocks'].get('paid_at') and o['clocks'].get('shipped_at')]
        definition = 'mean days from payment to shipment since linked'
    else:
        raise ValueError(f'unknown metric {metric}')
    return dict(unit='days' if metric == 'ship_days' else 'ratio', value=mean(values) if values else None, definition=definition, basis_count=len(values),
                flags=['not_reported'] if not values or len(values) != len(rows) else [])


def comparison_stages(row, *, ranker_changed=False, adapter_frozen=False):
    out = deepcopy(row)
    if ranker_changed:
        for stage in ('exposure', 'attention'):
            if stage in out['stages']:
                out['stages'][stage] = None
        out['flags'] = sorted(set(out['flags']) | {'ranker_changed'})
    if adapter_frozen:
        out['flags'] = sorted(set(out['flags']) | {'adapter_frozen'})
    return out
