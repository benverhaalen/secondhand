"""Past-only monthly half-life walk, using the existing param registry.

Contract: python -m pytest databricks/tasks/test_param_walk.py -q.
Rests on spec/databricks-build.md §6 and comps.ts Params.half_life_days.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import numpy as np

ROOT = Path(__file__).resolve().parents[2] if '__file__' in globals() else None
if __name__ == '__main__':
    root_parser = argparse.ArgumentParser(add_help=False)
    root_parser.add_argument('--root', type=Path, default=ROOT, required=ROOT is None)
    ROOT = root_parser.parse_known_args()[0].root.resolve()
sys.path[:0] = [str(ROOT / 'jobs'), str(ROOT / 'log'), str(ROOT / 'databricks'), str(ROOT / 'databricks/tasks')]

from param.registry import MemoryStore, scope_key  # noqa: E402
from backtest import append_rows, job_log, log_training_input, provenance, require_snapshot_version, table_frame, to_runner_rows  # noqa: E402

# Agent proposal: no registry name exists for comps.ts Params.half_life_days.
NAME = 'comps_half_life_days'
SCOPE = {'kind': 'shoes', 'site': 'stockx'}
PRIOR = 90
GRID = (7, 15, 30, 45, 60, 90, 120, 180, 365)
DAY = 86400
FIT_GAP_DAYS = 7  # spec/databricks-build.md §6.
NOISE_METHOD = 'centered paired bootstrap: 95th percentile of |d* - mean d|, 200 resamples'


def timestamp(value):
    dt = datetime.fromisoformat(value.replace('Z', '+00:00')) if isinstance(value, str) else value
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).timestamp()


def shift_month(month, count):
    dt = datetime.fromisoformat(month[:10])
    year, m = divmod(dt.year * 12 + dt.month - 1 + count, 12)
    return f'{year:04d}-{m + 1:02d}-01'


def _sold(rows):
    return [r for r in rows if r.get('price_type') == 'sold' and r.get('may_model', True)
            and (r.get('price_cents') or 0) > 0 and r.get('kind') == SCOPE['kind'] and r.get('site') == SCOPE['site']]


def estimate(item, rows, half_life):
    at = timestamp(item['at'])
    comps = [r for r in _sold(rows) if r['product_id'] == item['product_id']
             and at - 365 * DAY <= timestamp(r['at']) < at]
    if len(comps) < 3:
        return None
    comps.sort(key=lambda r: (r['price_cents'], r['row_id']))
    weights = np.array([.5 ** ((at - timestamp(r['at'])) / DAY / half_life) for r in comps])
    index = int(np.searchsorted(weights.cumsum(), weights.sum() / 2, side='left'))
    return int(comps[index]['price_cents'])


def score_month(rows, month, half_life):
    lo, hi = timestamp(month), timestamp(shift_month(month, 1))
    sold = _sold(rows)
    tests = [r for r in sold if lo <= timestamp(r['at']) < hi]
    products = {r['product_id'] for r in tests}
    groups = {product: [] for product in products}
    for row in sold:
        if row['product_id'] in products:
            groups[row['product_id']].append(row)
    outcomes, priced = {}, []
    for product in sorted(products):
        comps = sorted(groups[product], key=lambda r: (r['price_cents'], r['row_id']))
        times = np.array([timestamp(r['at']) for r in comps])
        prices = np.array([int(r['price_cents']) for r in comps], dtype=np.int64)
        # Common scaling cancels in a weighted median; anchor near the scoring month.
        weights = np.exp2((times - hi) / DAY / half_life)
        at_groups = {}
        for row in comps:
            at = timestamp(row['at'])
            if lo <= at < hi:
                at_groups.setdefault(at, []).append(row)
        for at, targets in sorted(at_groups.items()):
            mask = (times >= at - 365 * DAY) & (times < at)
            if int(mask.sum()) < 3:
                continue
            cumulative = np.cumsum(np.where(mask, weights, 0.0))
            value = int(prices[np.searchsorted(cumulative, cumulative[-1] / 2, side='left')])
            for row in targets:
                outcomes[row['row_id']] = float(abs(value - row['price_cents']) <= .2 * row['price_cents'])
                priced.append(row)
    return {'score': float(np.mean(list(outcomes.values()))) if outcomes else None,
            'priced_share': len(priced) / len(tests) if tests else 0.0,
            'outcomes': outcomes, 'priced_rows': sorted(priced, key=lambda r: r['row_id'])}


def fit_half_life(rows, month, *, score_fn=score_month):
    if any(timestamp(r['at']) >= timestamp(month) - FIT_GAP_DAYS * DAY for r in rows):
        raise ValueError('fit leak: sale inside the seven-day gap or on or after month m')
    months = [shift_month(month, k) for k in (-3, -2, -1)]
    def mean_score(value):
        scores = [score_fn(rows, m, value)['score'] for m in months]
        available = [s for s in scores if s is not None]
        return float(np.mean(available)) if available else -float('inf')
    # A grid-order tie is deterministic, including all-unpriced fits.
    return max(GRID, key=mean_score)


def effective_size(rows, at):
    weights = np.array([.5 ** ((timestamp(at) - timestamp(r['at'])) / DAY / 30) for r in rows])
    return float(weights.sum() ** 2 / np.square(weights).sum()) if len(weights) else 0.0


def bootstrap_noise(a, b, seed=7):
    """95th percentile of centered paired bootstrap errors, 200 sale resamples."""
    ids = sorted(set(a['outcomes']) & set(b['outcomes']))
    if not ids:
        return 1.0
    differences = np.array([a['outcomes'][i] - b['outcomes'][i] for i in ids])
    rng = np.random.default_rng(seed)
    observed = float(differences.mean())
    errors = [abs(float(rng.choice(differences, len(differences), replace=True).mean()) - observed) for _ in range(200)]
    return float(np.quantile(errors, .95))


def param_row(value, score, n_eff, fitted_hash):
    return {'name': NAME, 'scope': dict(SCOPE), 'family': 'scalar', 'value_or_hyperparams': value,
            'prior': PRIOR, 'fitted_on_ids_hash': fitted_hash, 'n_eff': n_eff,
            'metric': 'within_20_priced', 'held_out_score': score, 'guard_lo': min(GRID), 'guard_hi': max(GRID)}


def walk(rows, *, seed=7, fit_fn=None, score_fn=score_month):
    sold = sorted(_sold(rows), key=lambda r: (timestamp(r['at']), r['row_id']))
    if not sold:
        raise ValueError('no eligible sold rows for the param walk')
    sources = {r['source'] for r in sold}
    if len(sources) != 1:
        raise ValueError('param walk needs one provenance source')
    data = provenance(next(iter(sources)))
    first = sold[0]['at'][:7] + '-01'
    last = sold[-1]['at'][:7] + '-01'  # latest observed month may be incomplete
    month = shift_month(first, 3)
    store = MemoryStore()
    moves, snapshots, watch = [], [], None
    cache = {}
    def scored(m, value):
        key = m, value
        if key not in cache:
            available = [r for r in sold if timestamp(r['at']) < timestamp(shift_month(m, 1))]
            cache[key] = score_fn(available, m, value)
        return cache[key]
    def record(action, row, challenger_score, champion_score, noise, reason, priced_share):
        champion = store.champion(NAME, SCOPE)
        move = {'month': month, 'name': NAME, 'scope': scope_key(SCOPE), 'action': action,
                'version': row['version'], 'value': row['value_or_hyperparams'], 'held_out_score': challenger_score,
                'champion_version': champion['version'], 'champion_score': champion_score,
                'diff': None if challenger_score is None or champion_score is None else challenger_score - champion_score,
                'noise': noise, 'reason': f'{reason}; noise: {NOISE_METHOD}', 'priced_share': priced_share, 'data': data}
        moves.append(move)
        return move
    while month < last:
        training = [r for r in sold if timestamp(r['at']) < timestamp(month) - FIT_GAP_DAYS * DAY]
        fitted_hash = hashlib.sha256('\n'.join(sorted(r['row_id'] for r in training)).encode()).hexdigest()
        value = fit_fn(training, month) if fit_fn else fit_half_life(training, month, score_fn=score_fn)
        fresh = scored(month, value)
        n_eff = effective_size(fresh['priced_rows'], shift_month(month, 1))
        month_start = len(moves)
        if store.champion(NAME, SCOPE) is None:
            initial = scored(month, PRIOR)
            prior = store.propose(param_row(PRIOR, initial['score'], effective_size(initial['priced_rows'], shift_month(month, 1)), fitted_hash), 0)
            store.promote(NAME, SCOPE, prior['version'], 0, month)
            record('propose', prior, initial['score'], initial['score'], 0.0, 'prior proposed', initial['priced_share'])
            record('promote', prior, initial['score'], initial['score'], 0.0, 'first champion', initial['priced_share'])
        champion = store.champion(NAME, SCOPE)
        current = scored(month, champion['value_or_hyperparams'])
        noise = bootstrap_noise(fresh, current, seed)
        if watch and watch['month'] == shift_month(month, -1):
            retired = scored(month, watch['previous']['value_or_hyperparams'])
            watch_noise = bootstrap_noise(current, retired, seed)
            if current['score'] is not None and retired['score'] is not None and retired['score'] - current['score'] > watch_noise:
                # MemoryStore restores the highest earlier promoted version. After a
                # previous rollback that may be a rejected intermediate version.
                losing = current
                while store.champion(NAME, SCOPE)['version'] != watch['previous']['version']:
                    restored = store.rollback(NAME, SCOPE, month)
                    restored_score = scored(month, restored['value_or_hyperparams'])
                    record('rollback', restored, restored_score['score'], losing['score'], watch_noise,
                           'new champion lost next month beyond noise; restoring watched incumbent', restored_score['priced_share'])
                    losing = restored_score
                champion = store.champion(NAME, SCOPE)
                current = retired
                noise = bootstrap_noise(fresh, current, seed)
        watch = None
        latest = max(r['version'] for r in store.history(NAME, SCOPE))
        challenger = store.propose(param_row(value, fresh['score'], n_eff, fitted_hash), latest)
        record('propose', challenger, fresh['score'], current['score'], noise, 'past-three-month grid fit', fresh['priced_share'])
        previous = copy.deepcopy(champion)
        promoted, reason = store.promote(NAME, SCOPE, challenger['version'], noise, month, champion_score=current['score'])
        record('promote' if promoted else 'hold', challenger, fresh['score'], current['score'], noise, reason, fresh['priced_share'])
        if promoted:
            watch = {'month': month, 'previous': previous}
        snapshots.append({'month': month, 'params': store.history(NAME, SCOPE), 'moves': copy.deepcopy(moves[month_start:]),
                          'champion_priced_share': current['priced_share'], 'priced_share': fresh['priced_share']})
        month = shift_month(month, 1)
    return {'moves': moves, 'months': snapshots, 'params': store.history(NAME, SCOPE),
            'noise_method': NOISE_METHOD, 'seed': seed}


def registry_rows(snapshot, run_id):
    month = snapshot['month']
    moved = {m['version']: m['action'] for m in snapshot['moves'] if m['action'] != 'hold'}
    out = []
    for row in snapshot['params']:
        identity = hashlib.sha256(f"{NAME}:{scope_key(SCOPE)}:{row['version']}".encode()).hexdigest()[:24]
        # Rows are global: owner_only exposes user_id NULL to all readers.
        out.append({**row, 'id': 'par_' + identity, 'user_id': None,
                    'scope': scope_key(row['scope']), 'value_or_hyperparams': json.dumps(row['value_or_hyperparams']),
                    'prior': json.dumps(row['prior']), 'created_at': snapshot.get('created', {}).get(row['version'], month),
                    'updated_at': month, 'moved_by': moved.get(row['version'], 'retire' if row['status'] == 'retired' else 'score') + ':' + run_id})
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', type=Path, default=ROOT)
    ap.add_argument('--source', default='stockx_2019', choices=['stockx_2019'])
    ap.add_argument('--experiment', default='/Shared/secondhand/param-walk')
    ap.add_argument('--seed', type=int, default=7)
    args = ap.parse_args(argv)
    from pyspark.sql import SparkSession, functions as F
    from delta.tables import DeltaTable
    import mlflow

    log = job_log('param_walk', vars(args))
    run_id = 'pw_' + uuid4().hex
    log.job(run_id, 'param_walk', 'running')
    try:
        spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
        version = log.call('db', 'comp_version', {}, lambda: spark.sql('DESCRIBE HISTORY secondhand.market.comp LIMIT 1').first()['version'])
        raw = log.call('db', 'read_comps', {'source': args.source},
                       lambda: spark.table('secondhand.market.comp_for_model').where((F.col('source') == args.source) & (F.col('price_type') == 'sold')).collect(),
                       describe=lambda rs: {'rows': len(rs)})
        after_version = log.call('db', 'comp_version_after_read', {}, lambda: spark.sql('DESCRIBE HISTORY secondhand.market.comp LIMIT 1').first()['version'])
        require_snapshot_version(version, after_version)
        rows = to_runner_rows(raw)
        result = log.timed('param.walk', lambda: walk(rows, seed=args.seed))
        log.call('mlflow', 'tracking', {}, lambda: mlflow.set_tracking_uri('databricks'))
        log.call('mlflow', 'experiment', {}, lambda: mlflow.set_experiment(args.experiment))
        with mlflow.start_run(run_name=run_id) as parent:
            log_training_input(mlflow, log, version)
            log.call('mlflow', 'params', {}, lambda: mlflow.log_params({'source': args.source, 'seed': args.seed, 'grid': json.dumps(GRID), 'prior': PRIOR, 'noise_method': result['noise_method'], 'market_comp_version': int(version)}))
            log.call('mlflow', 'tags', {}, lambda: mlflow.set_tag('code_sha', os.environ.get('SECONDHAND_CODE_SHA', os.environ.get('SECONDHAND_BUILD', 'unknown'))))
            created = {}
            for snapshot in result['months']:
                month = snapshot['month']
                for row in snapshot['params']:
                    created.setdefault(row['version'], month)
                snapshot['created'] = dict(created)
                records = registry_rows(snapshot, run_id)
                # Exactly one MERGE per month: all version status changes share a Delta commit.
                def merge_month():
                    frame = table_frame(spark, 'secondhand.core.param', records)
                    DeltaTable.forName(spark, 'secondhand.core.param').alias('t').merge(
                        frame.alias('s'), 't.name = s.name AND t.scope = s.scope AND t.version = s.version'
                    ).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
                log.call('db', 'merge_param_month', {'month': month, 'versions': len(records)}, merge_month)
                for move in snapshot['moves']:
                    log.change('param', NAME, move['action'], month=month, version=move['version'], reason=move['reason'])
                final = snapshot['moves'][-1]
                with mlflow.start_run(run_name=month, nested=True):
                    log.call('mlflow', 'month_params', {'month': month}, lambda: mlflow.log_params({'value': final['value'], 'champion_version': final['champion_version']}))
                    metrics = {k: float(final[k]) for k in ('held_out_score', 'champion_score', 'noise', 'priced_share') if final[k] is not None}
                    metrics['champion_priced_share'] = snapshot['champion_priced_share']
                    log.call('mlflow', 'month_metrics', {'month': month}, lambda: mlflow.log_metrics(metrics))
                    log.call('mlflow', 'month_action', {'month': month}, lambda: mlflow.set_tag('action', ','.join(m['action'] for m in snapshot['moves'] if m['action'] != 'propose')))
            append_rows(spark, log, 'secondhand.measures.param_moves', [{**m, 'run_id': run_id, 'mlflow_run_id': parent.info.run_id} for m in result['moves']])
            log.call('mlflow', 'report', {}, lambda: mlflow.log_dict(result, 'report.json'))
        log.job(run_id, 'param_walk', 'done', months=len(result['months']), moves=len(result['moves']))
        return result
    except Exception as error:
        log.error('param_walk', error)
        log.job(run_id, 'param_walk', 'failed')
        raise


if __name__ == '__main__':
    main()
