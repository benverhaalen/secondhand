"""Analytics replay, empirical priors and held-out promotion (§4).

Fold immutable sale/end events by listing, decay their sufficient statistics and
retain a missing-exposure flag. Nightly marginal fits use only opted-in non-eBay
aggregates; promotion compares paired losses on the last 30 days, never train.
"""
import hashlib
import math
import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from scipy.optimize import minimize_scalar
from scipy.special import gammaln
from .site_effect import adjusted_probability, sale_effect, sufficient
from .params import selected, value
from param.registry import complete_row


def _at(s):
    dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def fold_events(events, now, half_life=None, log=None, *, params=None):
    params = selected(params)
    half_life = value(params, "half_life_days") if half_life is None else half_life
    latest = {}
    for event in sorted(events, key=lambda e: (e['at'], e['id'])):
        latest[(event['site'], event['listing_id'])] = event
    out = defaultdict(lambda: dict(O=0., E=0., u_sum=0., n_eff=0., flags=[]))
    sold = set()
    for e in latest.values():
        row = out[e['site']]
        age = max(0, (_at(now) - _at(e['at'])).total_seconds()/86400)
        w = .5 ** (age / half_life)
        if e['E'] is None:
            row['E'] = None
            row['flags'] = ['not_reported']
        elif row['E'] is not None:
            row['E'] += e['E'] * w
        if e['kind'] == 'sale' and e['item_id'] not in sold:
            sold.add(e['item_id'])
            row['O'] += w
            if e.get('u') is not None:
                row['u_sum'] += e['u'] * w
                row['n_eff'] += w
    if log:
        log.note('analytics.fold', event_count=len(latest), sites=len(out))
    return dict(out)


def fit_priors(rows, *, params=None):
    params = selected(params)
    rows = [r for r in rows if r['consent'] and r['site'] != 'ebay' and r.get('E') is not None]
    if not rows:
        return dict(m=value(params, 'sale_prior'), m_g=value(params, 'price_prior'), basis_count=0)
    def gamma_loss(log_m):
        m = math.exp(log_m)
        return -sum(gammaln(r['O']+m)-gammaln(m)+m*math.log(m)-(r['O']+m)*math.log(m+r['E']) for r in rows)
    price_rows = [(sufficient(r.get('u', r)), r['sigma']) for r in rows if r['sigma'] > 0]
    price_rows = [(stats, sigma) for stats, sigma in price_rows if stats[1] > 0]
    def normal_loss(log_m):
        m = math.exp(log_m)
        return sum(.5*(math.log(sigma**2*(1/stats[1]+1/m)) +
                         (stats[0]/stats[1])**2/(sigma**2*(1/stats[1]+1/m))) for stats, sigma in price_rows)
    # Fixed numerical search limits: positive representable precision around unity.
    m = math.exp(minimize_scalar(gamma_loss, bounds=(math.log(math.ulp(1.0)), -math.log(math.ulp(1.0))), method='bounded').x)
    mg = math.exp(minimize_scalar(normal_loss, bounds=(math.log(math.ulp(1.0)), -math.log(math.ulp(1.0))), method='bounded').x) if price_rows else value(params, 'price_prior')
    return dict(m=m, m_g=mg, basis_count=len(rows))


def _loss(p, y):
    p = max(math.ulp(1.0), min(1-math.ulp(1.0), p))  # Fixed floating-point log domain.
    return -y*math.log(p)-(1-y)*math.log(1-p)


def nightly(store, train, held, at, scope, *, seed, draws=None, min_ended=None, log=None, params=None):
    params = selected(params)
    draws = value(params, 'draws') if draws is None else draws
    min_ended = value(params, 'promotion_min_ended') if min_ended is None else min_ended
    cutoff, now = _at(at)-timedelta(days=value(params, 'holdout_days')), _at(at)
    held_ids = {r['id'] for r in held}
    for row in train:
        if row['id'] in held_ids or not row.get('at') or _at(row['at']) >= cutoff:
            raise ValueError('training requires disjoint ids and dates before holdout cutoff')
    held = list({r['id']: r for r in held if cutoff <= _at(r['at']) < now}.values())
    if len(held) < min_ended:
        return dict(promoted=False, fallback='parent' if scope else 'prior')
    train = list({r['id']: r for r in train if r['consent'] and r['site'] != 'ebay' and r.get('E') is not None}.values())
    values = fit_priors(train, params=params)
    if values['basis_count'] == 0:
        return dict(promoted=False, fallback='parent' if scope else 'prior')
    champion = store.champion('site_effect.prior', scope)
    champion_m = champion['value_or_hyperparams']['m'] if champion else value(params, 'sale_prior')
    candidate = [adjusted_probability(r['P'], sale_effect(r['O'], r['E'], values['m'], params=params)['mean']) for r in held]
    baseline = [adjusted_probability(r['P'], sale_effect(r['O'], r['E'], champion_m, params=params)['mean']) for r in held]
    diffs = [_loss(a, r['y']) - _loss(b, r['y']) for r, a, b in zip(held, baseline, candidate)]
    rng = random.Random(seed)
    boots = sorted(sum(rng.choices(diffs, k=len(diffs))) / len(diffs) for _ in range(draws))
    latest = max((r['version'] for r in store.history('site_effect.prior', scope)), default=0)
    score = -sum(_loss(p, r['y']) for r, p in zip(held, candidate))/len(held)
    ch = store.propose(complete_row(dict(name='site_effect.prior', scope=scope, family='model_ref', value_or_hyperparams=values,
                            prior=dict(m=value(params, 'sale_prior'), m_g=value(params, 'price_prior')), n_eff=len(held), metric='neg_logloss_30d', held_out_score=score,
                            fitted_on_ids_hash=hashlib.sha256('\n'.join(sorted(r['id'] for r in train)).encode()).hexdigest())), latest)
    ok, why = (store.promote('site_effect.prior', scope, ch['version'], 0, at) if boots[int(value(params, 'interval_tail')*draws)] > 0 else (False, 'bootstrap noise'))
    if log:
        log.change('param', 'site_effect.prior', 'champion' if ok else 'challenger', version=ch['version'], seed=seed)
    return dict(promoted=ok, why=why, version=ch['version'], interval=(boots[int(value(params, 'interval_tail')*draws)], boots[min(draws-1, int((1-value(params, 'interval_tail'))*draws))]))


def guard_effect(effect, previous, se, guard=None, log=None, *, params=None):
    params = selected(params)
    guard = (value(params, 'effect_lo'), value(params, 'effect_hi')) if guard is None else guard
    if not all(math.isfinite(v) for v in (effect, previous, se)) or se < 0:
        raise ValueError('effect, previous and se must be finite; se nonnegative')
    out = dict(value=max(guard[0], min(guard[1], effect)), anomaly=abs(effect-previous) > value(params, 'anomaly_se')*se)
    if out['anomaly'] and log:
        log.change('anomaly', 'site_effect.sale', 'open', value=out['value'])
    return out
