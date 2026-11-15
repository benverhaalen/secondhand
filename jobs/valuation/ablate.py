"""Real-row, paired ablations of the served comp calculation (valuation.md §3-4).

PYTHONPATH=jobs ./.venv/bin/python -m valuation.ablate --rows R --calibrate-from D0 --test-from D1 --out O --cells C
The six switches are independent. D chooses 30/90 on pre-test calibration rows only; test outcomes never select it.
"""
from __future__ import annotations

import argparse
import bisect
import csv
import hashlib
import json
import math
import time
from decimal import Decimal
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

import numpy as np
from valuation import comps, experiment

SWITCHES = comps.SWITCHES
# This checkout predates the other worker's adapter. If it lands, retain its interface through inheritance.
EngineBase = getattr(experiment, 'EngineComps', object)
ALPHA = .2  # D6 target miss probability.
MIN_SCORES = 10  # D6 parent fallback for calibration groups.
HALF_LIVES = (30, 90)  # D1 priors, selected on pre-test rows, not on test outcomes.


def configurations():
    return {'engine_comps': dict(comps.LEGACY),
            **{letter: {**comps.LEGACY, switch: 1} for letter, switch in zip('ABCDEF', SWITCHES)},
            'all': dict(comps.DEFAULTS)}


def validate_rows(rows):
    for row in rows:
        for field in ('price_cents', 'retail_cents', 'buyer_shipping_cents'):
            if row.get(field) is not None:
                comps.money(row[field], field)


def load_rows(path):
    # Check before experiment.load's legacy int(float(...)) coercion can discard fractional cents.
    import gzip
    opener = gzip.open if str(path).endswith('.gz') else open
    with opener(path, 'rt', newline='') as f:
        raw = [json.loads(s, parse_float=Decimal) for s in f if s.strip()] if '.jsonl' in str(path) else list(csv.DictReader(f))
    for r in raw:
        for key in ('price_cents', 'retail_cents', 'buyer_shipping_cents'):
            if r.get(key) not in ('', None):
                value = Decimal(str(r[key]))
                if not value.is_finite() or value < 0 or value > comps.MAX_SAFE or value != value.to_integral_value():
                    raise ValueError(key + ' must be nonnegative safe integer cents')
    rows = experiment.load(str(path))
    for row, source in zip(rows, raw):
        if source.get('depreciation') not in ('', None):
            value = float(source['depreciation'])
            if not math.isfinite(value) or not 0 < value <= 1:
                raise ValueError('depreciation')
            row['depreciation'] = value
    validate_rows(rows)
    return rows


def product_base(row):
    pid, size = row['product_id'], row.get('size')
    return pid[:-len(str(size))-1] if size is not None and pid.endswith('|' + str(size)) else pid


def to_comp(row, level='variant'):
    grade = {'new': 'new_with_tags', 'used_good': 'good', 'like_new': 'excellent'}.get(row.get('condition'), row.get('condition') or 'good')
    return {'comp_id': row['row_id'], 'product_id': row['product_id'], 'family_id': row.get('family_id'),
            'cluster_id': row.get('cluster_id'), 'site': row['site'], 'sold_at': row['at'], 'price_cents': row['price_cents'],
            'kind': 'best_offer' if row.get('best_offer') == 'hidden' else 'sold', 'level': level,
            'condition': grade, 'size': row.get('size'), 'w_match': comps.DEFAULTS['w_match'][level] if level != 'category' else 1,
            'w_extract': 1, 'may_model': row.get('may_model', True), 'citation': row.get('url') or 'dataset:' + row['source']}


class Past:
    """Indexes and fits shared across switches, with explicit (cut, family, cluster) cache keys."""
    def __init__(self, index):
        self.index = index
        self.by_family, self.by_kind = {}, {}
        for r in index['sold']:
            for by, key in ((self.by_family, r.get('family_id')), (self.by_kind, r.get('kind'))):
                rs, times = by.setdefault(key, ([], []))
                rs.append(r); times.append(comps.ts(r['at']))
        self.date = None
        self.fits, self.predictions, self.bands, self.candidate_cache = {}, {}, {}, {}

    def reset_date(self, as_of):
        if self.date != as_of:
            self.date = as_of
            self.fits.clear(); self.predictions.clear(); self.bands.clear(); self.candidate_cache.clear()

    def rows(self, by, key, history):
        rows, times = by.get(key, ([], []))
        return history._ok(rows[:bisect.bisect_left(times, history.cut)])

    def kind_band(self, item, history, params):
        key = (item.get('kind'), item.get('condition'), history.cluster, params['dedupe_enabled'], params['age_enabled'])
        if key not in self.bands:
            rows = [to_comp(r, 'category') for r in self.rows(self.by_kind, item.get('kind'), history)]
            p = {**params, 'anchor_enabled': 0, 'index_enabled': 0, 'size_enabled': 0, 'blend_enabled': 0, 'timeIndex': lambda at: 0, 'size_ratios': {}}
            # Kind fallback is the condition-adjusted pooled sold distribution (valuation §3).
            result = comps.comparables({'condition': to_comp(item)['condition']}, rows, self.date, p)
            used = result['comps']
            if used:
                band = {q: comps.weighted_quantile([r['adjusted_cents'] for r in used], [r['w'] for r in used], v) for q, v in zip(('q10', 'q50', 'q90'), (.1, .5, .9))}
                band['n_eff'] = result['n_eff']
                ids = [r['comp_id'] for r in used]
                self.bands[key] = (band, ids, hashlib.sha256(json.dumps(ids).encode()).hexdigest())
            else:
                self.bands[key] = (None, [], None)
        return self.bands[key]

    def candidates(self, item, history, include_kind=True):
        key = (item.get('family_id'), item['product_id'], item.get('size'), item.get('kind'), history.cluster, include_kind)
        if key in self.candidate_cache:
            return self.candidate_cache[key]
        family = self.rows(self.by_family, item.get('family_id'), history) if item.get('family_id') else []
        if family:
            rows = [to_comp(r, 'variant' if r['product_id'] == item['product_id'] and r.get('size') == item.get('size') else 'product' if product_base(r) == product_base(item) else 'family') for r in family]
        else:
            exact = history.product(item['product_id'])
            rows = [to_comp(r, 'variant' if r.get('size') == item.get('size') else 'product') for r in exact] if exact else [to_comp(r, 'category') for r in self.rows(self.by_kind, item.get('kind'), history)] if include_kind else []
        self.candidate_cache[key] = rows
        return rows


class AblationEngine(EngineBase):
    """Params-only subclass when experiment.EngineComps is present; the pure twin owns every price."""
    def __init__(self, name, params, past=None):
        self.name, self.params, self.past = name, params, past
        self.settings = {k: v for k, v in params.items() if not callable(v)}

    def fit(self, train):
        # The comp engine is updated from each item's frozen history; no future outcome enters a batch fit.
        pass

    def predict(self, item, as_of, history):
        past = self.past or Past(history.index)
        past.reset_date(as_of)
        key = (self.name, item['product_id'], item.get('family_id'), item.get('size'), item.get('condition'), item.get('kind'), item.get('retail_cents'), item.get('depreciation'), history.cluster)
        if key in past.predictions:
            return dict(past.predictions[key])
        candidates = past.candidates(item, history, include_kind=not self.params['blend_enabled'])
        p = dict(self.params)
        family = item.get('family_id')
        if p['index_enabled'] or p['size_enabled']:
            fit_key = (family, history.cluster, p['dedupe_enabled'], p['index_half_life_days'], p['size_shrinkage_k'])
            if fit_key not in past.fits:
                past.fits[fit_key] = comps.fit_history(candidates, as_of, p)
            fitted = past.fits[fit_key]
            if p['index_enabled']:
                p['timeIndex'] = lambda at: fitted['index'](family, as_of) - fitted['index'](family, at)
            if p['size_enabled']:
                p['size_ratios'] = {**p['size_ratios'], **fitted['size_ratios'].get(family, {})}
            p['index_enabled'] = p['size_enabled'] = 0  # Equivalent precomputed past-only fit, avoiding a fit per variant.
        target = {'condition': to_comp(item)['condition'], 'size': item.get('size'), 'family_id': family, 'kind': item.get('kind'), 'retail_cents': item.get('retail_cents'), 'depreciation': item.get('depreciation')}
        parent_ids, parent_hash = [], None
        if p['blend_enabled']:
            band, parent_ids, parent_hash = past.kind_band(item, history, p)
            if band:
                target['kind_band'] = band
        # D1's hard back-off never consumes a parent once its trimmed variant basis suffices.
        exact = [c for c in candidates if c['level'] == 'variant']
        result = comps.comparables(target, exact if not p['blend_enabled'] else candidates, as_of, p)
        if not p['blend_enabled'] and result['state'] != 'ok' and len(exact) != len(candidates):
            result = comps.comparables(target, candidates, as_of, p)
        q = result['range']
        legacy = not self.params['blend_enabled']
        shown = q['q50'] is not None and (not legacy or (result['state'] == 'ok' and q['q90'] - q['q10'] <= q['q50']))
        prediction = {**q, 'shown': shown, 'comp_ids': [c['comp_id'] for c in result['comps']], 'n_eff': result['n_eff'], 'basis_level': result['basis_level'], 'parent_basis_hash': parent_hash, 'parent_comp_ids': parent_ids}
        past.predictions[key] = prediction
        return dict(prediction)


def fit_conformal(pairs, alpha=ALPHA):
    scores = sorted(max(math.log(e['q10'] / y), math.log(y / e['q90'])) for y, e in pairs if e['shown'] and e['q10'] > 0)
    if len(scores) < MIN_SCORES:
        return 0.0
    rank = min(len(scores), math.ceil((len(scores) + 1) * (1 - alpha)))
    return max(0.0, scores[rank - 1])


def widen(estimate, q):
    if not estimate['shown']:
        return dict(estimate)
    if not math.isfinite(q) or q < 0:
        raise ValueError('Q_g')
    return {**estimate, 'q10': comps.rounded(estimate['q10'] / math.exp(q)), 'q90': comps.rounded(estimate['q90'] * math.exp(q))}


def select_half_lives(observations):
    errors = defaultdict(lambda: defaultdict(list))
    for family, half, error in observations:
        errors[family][half].append(error)
    return {family: min(by, key=lambda h: (float(np.median(by[h])), h)) for family, by in errors.items()}


def group(item, est):
    n = est.get('n_eff', 0)
    return (item.get('kind'), experiment._band(est['q50']) if est['shown'] else 'not_priced', 'under10' if n < 10 else '10to30' if n <= 30 else 'over30', est.get('basis_level', 'product'))


def table(estimates, rows):
    by_c, by_id = defaultdict(dict), {r['row_id']: r for r in rows}
    for e in estimates:
        by_c[e['contestant']][e['item_id']] = e
    sets = [set(v) for v in by_c.values()]
    if sets and any(s != sets[0] for s in sets):
        raise ValueError('every contestant must score the same items')
    output = []
    ids = sorted(sets[0]) if sets else []
    slices = defaultdict(list)
    for i in ids:
        row = by_id[i]
        slices[('overall', 'overall')].append(i)
        slices[('dataset:' + row['source'], 'overall')].append(i)
        slices[('dataset:' + row['source'], row.get('family_id') or row.get('kind') or 'unknown')].append(i)
    for name, values in sorted(by_c.items()):
        for (data, family), group_ids in sorted(slices.items()):
            pairs = [(by_id[i]['price_cents'], values[i]) for i in group_ids]
            m = experiment._metrics(pairs, 1 if family == 'overall' else 10)
            result = {'data': data, 'family': family, 'contestant': name, 'n': m['n'], 'priced': m['priced'], 'hit_rate': m['hit_rate']}
            if m.get('too_few'):
                output.append({**result, 'too_few': True}); continue
            result.update(mdape=m['median_pct_off'], ppe20=m['within_20'], coverage=m['coverage'], coverage_wilson_95=m['coverage_wilson_95'], median_width_pct=m['median_range_width'])
            for base in ('last_sale', 'product_90d_median'):
                shared = [i for i in group_ids if base in by_c and values[i]['shown'] and by_c[base][i]['shown']]
                a = [int(abs(values[i]['q50'] - by_id[i]['price_cents']) / by_id[i]['price_cents'] <= .2) for i in shared]
                b = [int(abs(by_c[base][i]['q50'] - by_id[i]['price_cents']) / by_id[i]['price_cents'] <= .2) for i in shared]
                result['vs_' + base] = experiment._lift(a, b, [by_id[i]['product_id'] for i in shared]) if shared else None
                result['paired_mdape_vs_' + base] = {'ours': float(np.median([abs(values[i]['q50'] - by_id[i]['price_cents']) / by_id[i]['price_cents'] for i in shared])), 'baseline': float(np.median([abs(by_c[base][i]['q50'] - by_id[i]['price_cents']) / by_id[i]['price_cents'] for i in shared])), 'n': len(shared)} if shared else None
            output.append(result)
    return output


def run(rows, calibrate_from, test_from, log=None):
    if comps.ts(calibrate_from) >= comps.ts(test_from):
        raise ValueError('calibrate-from must precede test-from')
    validate_rows(rows)
    # Equal-date ties have an explicit row-id order, shared by every baseline.
    rows = sorted(rows, key=lambda r: (comps.ts(r['at']), r['row_id']))
    index = experiment.index_of(rows)
    past = Past(index)
    configs = configurations()
    contestants = [experiment.LastSale(), experiment.ProductMedian(), experiment.Model()] + [AblationEngine(name, p, past) for name, p in configs.items()]
    candidates = [AblationEngine('D_' + str(h), {**comps.LEGACY, 'age_enabled': 1, 'half_life_days': {'default': h, 'fast': h}}, past) for h in HALF_LIVES]
    tests, exclusions = experiment._tests(rows, calibrate_from, None)
    test_cut = comps.ts(test_from)
    calibration, observations, estimates = defaultdict(list), [], []
    pretest = [(a, b, it) for a, b, it in tests if comps.ts(it['at']) < test_cut]
    for number, (as_of, _, item) in enumerate(pretest):
        history = experiment.History(index, comps.ts(as_of), item.get('cluster_id'))
        for c, half in zip(candidates, HALF_LIVES):
            e = c.predict(item, as_of, history)
            if e['shown']:
                observations.append((item.get('family_id'), half, abs(e['q50'] - item['price_cents']) / item['price_cents']))
        if log and number % 1000 == 0:
            log.stage('ablate', 'age_selection_progress', rows=number, total=len(pretest))
    selected = select_half_lives(observations)
    for c in contestants:
        if isinstance(c, AblationEngine) and c.params['age_enabled']:
            c.params = {**c.params, 'family_half_life_days': selected}
    if log:
        log.stage('ablate', 'half_life_selection', families=selected, observations=len(observations))
    month, conformal = None, {}
    tests = sorted(tests, key=lambda v: (max(comps.ts(v[0]), test_cut) if comps.ts(v[2]['at']) >= test_cut else comps.ts(v[0]), v[2]['row_id']))
    model_fit_ids = []
    spent, predicted = defaultdict(float), 0
    by_id = {r['row_id']: r for r in rows}
    logged_basis = set()
    for as_of, freeze_basis, item in tests:
        is_test = comps.ts(item['at']) >= test_cut
        if is_test and comps.ts(as_of) < test_cut:
            as_of = test_from
            freeze_basis += '_clamped_to_test_from'
        if as_of[:7] != month:
            month = as_of[:7]
            cutoff = comps.ts(month + '-01T00:00:00Z') - experiment.GAP.total_seconds()
            train = [r for r in experiment._usable(rows) if comps.ts(r['at']) < cutoff]
            model_fit_ids = [r['row_id'] for r in train]
            for c in contestants:
                start = time.perf_counter(); c.fit(train); spent[c.name + '.fit'] += time.perf_counter() - start
            if log:
                log.stage('ablate', 'fit', month=month, fit_row_ids=model_fit_ids)
        history = experiment.History(index, comps.ts(as_of), item.get('cluster_id'))
        for c in contestants:
            start = time.perf_counter()
            e = c.predict(item, as_of, history)
            spent[c.name] += time.perf_counter() - start
            for cid in e.get('comp_ids', []):
                source = by_id[cid]
                if comps.ts(source['at']) >= history.cut or cid == item['row_id'] or (history.cluster and source.get('cluster_id') == history.cluster):
                    raise ValueError('leaked comp ' + cid)
            if e['shown']:
                for q in ('q10', 'q50', 'q90'):
                    e[q] = comps.rounded(e[q])
                if not 0 < e['q10'] <= e['q50'] <= e['q90']:
                    raise ValueError('invalid ordered price range')
            key = group(item, e)
            if not is_test:
                pair = (item['price_cents'], {k: v for k, v in e.items() if k not in ('comp_ids', 'parent_comp_ids')})
                for g in (key, (item.get('kind'),), ('*',)):
                    calibration[(c.name, g)].append(pair)
                continue
            if (c.name, key) not in conformal:
                pairs = next((calibration[(c.name, g)] for g in (key, (item.get('kind'),), ('*',)) if sum(p[1]['shown'] for p in calibration[(c.name, g)]) >= MIN_SCORES), [])
                conformal[(c.name, key)] = fit_conformal(pairs)
            q = conformal[(c.name, key)]
            parent_ids = e.pop('parent_comp_ids', [])
            parent_hash = e.get('parent_basis_hash')
            if log and parent_hash and parent_hash not in logged_basis:
                log.stage('ablate', 'basis', basis_hash=parent_hash, comp_ids=parent_ids)
                logged_basis.add(parent_hash)
            ids = e.pop('comp_ids', [])
            basis_hash = hashlib.sha256(json.dumps(ids).encode()).hexdigest()
            if log and basis_hash not in logged_basis:
                log.stage('ablate', 'basis', basis_hash=basis_hash, comp_ids=ids)
                logged_basis.add(basis_hash)
            for name, prediction in ((c.name, e), (c.name + '_conformal', widen(e, q))):
                value = {'contestant': name, 'item_id': item['row_id'], 'as_of': as_of, 'freeze_basis': freeze_basis, **prediction, 'basis_hash': basis_hash, 'Q_g': q if name.endswith('_conformal') else 0}
                estimates.append(value)
                if log:
                    log.stage('ablate', 'estimate', **value)
        predicted += 1
        if log and predicted % 1000 == 0:
            log.stage('ablate', 'progress', predicted=predicted, test_estimates=len(estimates), seconds=dict(spent))
    return {'table': table(estimates, rows), 'selected_half_lives': selected or {}, 'exclusions': exclusions,
            'adapter_base': 'experiment.EngineComps' if EngineBase is not object else 'missing experiment.EngineComps; local adapter over the shared twin',
            'calibration_rows': sum(comps.ts(it['at']) < test_cut for _, _, it in tests), 'seconds': dict(spent), 'estimates': estimates}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    for name in ('rows', 'calibrate-from', 'test-from', 'out', 'cells'):
        ap.add_argument('--' + name, required=True)
    args = ap.parse_args(argv)
    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    log_path = out.with_suffix('.log.jsonl')
    blobs = out.with_suffix('.blobs'); blobs.mkdir(exist_ok=True)
    log = experiment.create_log(src='job.valuation.ablate', build='eng-valuation-2', sink=experiment.file_sink(str(log_path)),
        blob=lambda i, text: (blobs / (i + '.json')).write_text(text), config={**vars(args), 'declared': comps.DECLARED, 'switches': {name: {k: p[k] for k in SWITCHES} for name, p in configurations().items()}, 'half_life_candidates': HALF_LIVES})
    log.job('ablate', 'valuation', 'running')
    start = time.perf_counter()
    try:
        rows = load_rows(args.rows)
        log.stage('ablate', 'input', rows=len(rows), sha256=hashlib.sha256(Path(args.rows).read_bytes()).hexdigest())
        result = run(rows, args.calibrate_from, args.test_from, log)
        estimates = result.pop('estimates')
        prediction_path = out.with_suffix('.predictions.jsonl')
        with prediction_path.open('w') as f:
            for e in estimates:
                f.write(json.dumps(e) + '\n')
        result.update(wall_seconds=time.perf_counter() - start, calibrate_from=args.calibrate_from, test_from=args.test_from,
                      rows=len(rows), predictions=str(prediction_path), data=sorted({'dataset:' + r['source'] for r in rows}))
        out.write_text(json.dumps(result, indent=2) + '\n')
        cells = Path(args.cells); cells.parent.mkdir(parents=True, exist_ok=True)
        with cells.open('w', newline='') as f:
            fields = sorted({k for r in result['table'] for k in r})
            writer = csv.DictWriter(f, fieldnames=fields); writer.writeheader()
            writer.writerows({k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in r.items()} for r in result['table'])
        log.job('ablate', 'valuation', 'done', wall_seconds=result['wall_seconds'], overall=[r for r in result['table'] if r['data'] == 'overall'])
    except BaseException as error:
        log.error('ablate', error); log.job('ablate', 'valuation', 'failed'); raise
    finally:
        log.end()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
