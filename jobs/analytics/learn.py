"""Analytics replay, empirical priors and held-out promotion (§4).

Fold immutable sale/end events by listing, decay their sufficient statistics and
retain a missing-exposure flag. Nightly marginal fits use only opted-in non-eBay
aggregates; promotion compares paired losses on the last 30 days, never train.
"""
import hashlib
import math
import random
from collections import defaultdict
from datetime import datetime, timedelta

from scipy.optimize import minimize_scalar
from scipy.special import gammaln
from .site_effect import adjusted_probability, sale_effect


def _at(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00'))


def fold_events(events, now, half_life=90, log=None):
    latest = {}
    for event in sorted(events, key=lambda e: e['at']):
        latest[(event['site'], event['listing_id'])] = event
    out = defaultdict(lambda: dict(O=0., E=0., u_sum=0., n=0., flags=[]))
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
                row['n'] += w
    if log:
        log.note('analytics.fold', event_count=len(latest), sites=len(out))
    return dict(out)


def fit_priors(rows):
    rows = [r for r in rows if r['consent'] and r['site'] != 'ebay' and r.get('E') is not None]
    if not rows:
        return dict(m=5., m_g=5., basis_count=0)
    def gamma_loss(log_m):
        m = math.exp(log_m)
        return -sum(gammaln(r['O']+m)-gammaln(m)+m*math.log(m)-(r['O']+m)*math.log(m+r['E']) for r in rows)
    price_rows = [r for r in rows if r['u'] and r['sigma'] > 0]
    def normal_loss(log_m):
        m = math.exp(log_m)
        return sum(.5*(math.log(r['sigma']**2*(1/len(r['u'])+1/m)) +
                         (sum(r['u'])/len(r['u']))**2/(r['sigma']**2*(1/len(r['u'])+1/m))) for r in price_rows)
    m = math.exp(minimize_scalar(gamma_loss, bounds=(-8, 12), method='bounded').x)
    mg = math.exp(minimize_scalar(normal_loss, bounds=(-8, 12), method='bounded').x) if price_rows else 5.
    return dict(m=m, m_g=mg, basis_count=len(rows))


def _loss(p, y):
    p = max(1e-12, min(1-1e-12, p))
    return -y*math.log(p)-(1-y)*math.log(1-p)


def nightly(store, train, held, at, scope, *, seed, draws=1000, min_ended=300, log=None):
    cutoff, now = _at(at)-timedelta(days=30), _at(at)
    held = list({r['id']: r for r in held if cutoff <= _at(r['at']) < now}.values())
    if len(held) < min_ended:
        return dict(promoted=False, fallback='parent' if scope else 'prior')
    train = list({r['id']: r for r in train if r['consent'] and r['site'] != 'ebay' and r.get('E') is not None}.values())
    values = fit_priors(train)
    if values['basis_count'] == 0:
        return dict(promoted=False, fallback='parent' if scope else 'prior')
    champion = store.champion('site_effect.prior', scope)
    champion_m = champion['value_or_hyperparams']['m'] if champion else 5.
    candidate = [adjusted_probability(r['P'], sale_effect(r['O'], r['E'], values['m'])['mean']) for r in held]
    baseline = [adjusted_probability(r['P'], sale_effect(r['O'], r['E'], champion_m)['mean']) for r in held]
    diffs = [_loss(a, r['y']) - _loss(b, r['y']) for r, a, b in zip(held, baseline, candidate)]
    rng = random.Random(seed)
    boots = sorted(sum(rng.choices(diffs, k=len(diffs))) / len(diffs) for _ in range(draws))
    latest = max((r['version'] for r in store.history('site_effect.prior', scope)), default=0)
    score = -sum(_loss(p, r['y']) for r, p in zip(held, candidate))/len(held)
    ch = store.propose(dict(name='site_effect.prior', scope=scope, family='model_ref', value_or_hyperparams=values,
                            prior=dict(m=5, m_g=5), n_eff=len(held), metric='neg_logloss_30d', held_out_score=score,
                            fitted_on_ids_hash=hashlib.sha256('\n'.join(sorted(r['id'] for r in train)).encode()).hexdigest()), latest)
    ok, why = (store.promote('site_effect.prior', scope, ch['version'], 0, at) if boots[int(.05*draws)] > 0 else (False, 'bootstrap noise'))
    if log:
        log.change('param', 'site_effect.prior', 'champion' if ok else 'challenger', version=ch['version'], seed=seed)
    return dict(promoted=ok, why=why, version=ch['version'], interval=(boots[int(.05*draws)], boots[int(.95*draws)]))


def guard_effect(value, previous, se, guard=(.33, 3), log=None):
    out = dict(value=max(guard[0], min(guard[1], value)), anomaly=abs(value-previous) > 2*se)
    if out['anomaly'] and log:
        log.change('anomaly', 'site_effect.sale', 'open', value=out['value'])
    return out
