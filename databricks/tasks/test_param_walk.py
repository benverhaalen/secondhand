"""Local contract: ./.venv/bin/python -m pytest databricks/tasks/test_param_walk.py -q."""
import sys
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'databricks/tasks'), str(ROOT / 'jobs'), str(ROOT / 'log')]
import param_walk as p
from param.registry import MemoryStore


def sale(i, at, cents=10000, product='shoe'):
    return {'row_id': str(i), 'at': at, 'price_cents': cents, 'product_id': product,
            'source': 'synthetic', 'kind': 'shoes', 'site': 'stockx', 'price_type': 'sold', 'may_model': True}


def market():
    start = datetime(2018, 1, 1, tzinfo=timezone.utc)
    rows = []
    rng = random.Random(19)
    # Fast trends first. Then stable prices with independent transient shocks:
    # long history filters the shocks while a short half-life chases them.
    for day in range(610):
        for product in range(8):
            price = 10000 + day * 200 if day < 300 else (70000 if rng.random() < .4 else 45000)
            rows.append(sale(f'{day}-{product}', (start + timedelta(days=day)).isoformat(), price, f'shoe-{product}'))
    return rows


def test_challenger_without_held_out_score_raises_from_registry():
    with pytest.raises(ValueError, match='held-out'):
        MemoryStore().propose(p.param_row(90, None, 1, 'hash'), 0)


def test_rollback_without_earlier_promoted_version_raises():
    store = MemoryStore()
    store.propose(p.param_row(90, 0.5, 1, 'hash'), 0)
    store.promote(p.NAME, p.SCOPE, 1, 0, '2018-01-01')
    with pytest.raises(ValueError, match='earlier promoted'):
        store.rollback(p.NAME, p.SCOPE, '2018-02-01')


def test_estimator_excludes_target_future_and_older_than_365_days_and_returns_int_money():
    rows = [sale('old', '2016-01-01', 1), sale('a', '2018-12-01'), sale('b', '2018-12-02'),
            sale('c', '2018-12-03'), sale('same', '2019-01-01', 999999), sale('future', '2019-02-01', 999999)]
    assert p.estimate(sale('test', '2019-01-01'), rows, 90) == 10000
    assert type(p.estimate(sale('test', '2019-01-01'), rows, 90)) is int
    assert p.estimate(sale('test', '2019-01-01'), rows[:3], 90) is None


def test_age_weighted_median_changes_with_half_life():
    rows = [sale('a', '2018-07-01'), sale('b', '2018-07-02'), sale('c', '2018-07-03'),
            sale('d', '2018-12-31', 30000)]
    target = sale('t', '2019-01-01')
    assert p.estimate(target, rows, 7) == 30000
    assert p.estimate(target, rows, 365) == 10000


def test_fit_spy_rejects_sale_on_or_after_scoring_month():
    seen = []
    def spy(rows, month):
        assert all(p.timestamp(r['at']) < p.timestamp(month) for r in rows), 'fit leaked a sale on or after month m'
        seen.append(month)
        return p.fit_half_life(rows, month)
    out = p.walk(market(), fit_fn=spy)
    assert seen
    assert len(seen) == len(out['months'])


def test_changed_market_promotes_after_change_and_same_seed_same_moves():
    a = p.walk(market(), seed=7)
    b = p.walk(market(), seed=7)
    assert a['moves'] == b['moves']
    assert any(m['action'] == 'promote' and m['month'] >= '2018-11-01' for m in a['moves']), 'changed market never promoted a learned half-life'
    assert all(m['data'] == 'synthetic' for m in a['moves']), 'measures row lacks data provenance'


def test_planted_bad_next_month_rolls_back_new_champion():
    # Exercise the real walk/registry; only the month scorer is planted to isolate the watch.
    def scores(rows, month, value):
        if month < '2018-05-01':
            rate = 0.2 if value == 90 else 0.9
        else:
            rate = 0.9 if value == 90 else 0.2
        return {'score': rate, 'priced_share': 1.0, 'outcomes': {str(i): float(i < rate * 100) for i in range(100)},
                'priced_rows': [sale(i, month) for i in range(100)]}
    out = p.walk(market()[:182 * 8], fit_fn=lambda rows, month: 7, score_fn=scores)
    assert any(m['action'] == 'rollback' for m in out['moves']), 'bad next month failed to roll back'
    snap = next(s for s in out['months'] if any(m['action'] == 'rollback' for m in s['moves']))
    assert next(r for r in snap['params'] if r['status'] == 'champion')['value_or_hyperparams'] == 90


def test_equal_value_proposal_is_held_and_month_snapshots_are_independent():
    out = p.walk(market()[:182 * 8], fit_fn=lambda rows, month: 90)
    assert any(m['action'] == 'hold' for m in out['moves'])
    assert sum(r['status'] == 'champion' for r in out['months'][0]['params']) == 1
    assert len(out['months'][0]['params']) == 2
    assert out['months'][-1]['month'] == '2018-06-01'


def test_month_score_keeps_priced_share_and_kish_effective_size():
    rows = [sale('a', '2018-12-01'), sale('b', '2018-12-02'), sale('c', '2018-12-03'),
            sale('d', '2019-01-01'), sale('nope', '2019-01-02', product='other')]
    result = p.score_month(rows, '2019-01-01', 90)
    assert result['score'] == 1.0
    assert result['priced_share'] == 0.5
    assert p.effective_size(result['priced_rows'], '2019-02-01') == pytest.approx(1)


def test_month_scoring_matches_individual_estimator_and_future_price_does_not_leak():
    rows = market()[:182 * 8]
    month = '2018-05-01'
    for value in [7, 90, 365]:
        scored = p.score_month(rows, month, value)
        for row in scored['priced_rows']:
            estimate = p.estimate(row, rows, value)
            assert scored['outcomes'][row['row_id']] == float(abs(estimate - row['price_cents']) <= .2 * row['price_cents'])
    future = sale('future', '2019-01-01', 9999999, 'shoe-0')
    assert p.score_month(rows + [future], month, 90) == p.score_month(rows, month, 90)


def test_fit_rejects_leak_instead_of_silently_using_it():
    with pytest.raises(ValueError, match='fit leak'):
        p.fit_half_life([sale('leak', '2019-01-01')], '2019-01-01')


def test_walk_fit_excludes_the_seven_day_gap_before_scoring_month():
    def fit(rows, month):
        cutoff = p.timestamp(month) - 7 * 86400
        assert all(p.timestamp(r['at']) < cutoff for r in rows), 'fit included a sale inside the seven-day gap'
        return 90
    p.walk(market()[:121 * 8], fit_fn=fit)
    with pytest.raises(ValueError, match='fit leak'):
        p.fit_half_life([sale('gap', '2018-03-25')], '2018-04-01')


def test_default_fitting_scorer_uses_gap_filtered_training_rows():
    seen = []
    def score(rows, month, value):
        if month == '2018-03-01':
            assert all(p.timestamp(r['at']) < p.timestamp('2018-03-25') for r in rows), 'fit scorer bypassed the training cutoff'
            seen.append(value)
        return p.score_month(rows, month, value)
    p.walk(market()[:121 * 8], score_fn=score)
    assert seen, 'default fitting never scored its prior month'


def test_registry_rows_global_owner_money_metadata_and_measure_schema():
    import json
    import re
    out = p.walk(market()[:182 * 8], fit_fn=lambda rows, month: 90)
    rows = p.registry_rows(out['months'][0], 'run')
    assert all(r['user_id'] is None for r in rows)
    assert all(json.loads(r['scope']) == p.SCOPE for r in rows)
    sql = (ROOT / 'databricks/sql/04_learning.sql').read_text()
    body = re.search(r'CREATE TABLE IF NOT EXISTS secondhand.measures.param_moves \((.*?)\n\)', sql, re.S)[1]
    columns = {re.match(r'\s*(\w+)', line)[1] for line in body.strip().splitlines()}
    assert columns == set(out['moves'][0]) | {'run_id', 'mlflow_run_id'}
    assert 'data STRING NOT NULL' in body
    assert all(' COMMENT ' in line for line in body.strip().splitlines())


def test_second_rollback_restores_watched_incumbent_not_rejected_old_promotion():
    def scores(rows, month, value):
        prior_wins = month in ('2018-05-01', '2018-07-01', '2018-08-01')
        rate = .9 if (value == 90) == prior_wins else .2
        return {'score': rate, 'priced_share': 1.0,
                'outcomes': {str(i): float(i < rate * 100) for i in range(100)},
                'priced_rows': [sale(i, month) for i in range(100)]}
    out = p.walk(market()[:244 * 8], fit_fn=lambda rows, month: 7, score_fn=scores)
    for month in ['2018-05-01', '2018-07-01']:
        snap = next(s for s in out['months'] if s['month'] == month)
        assert any(m['action'] == 'rollback' for m in snap['moves'])
        champion = next(r for r in snap['params'] if r['status'] == 'champion')
        assert champion['value_or_hyperparams'] == 90, 'rollback restored a previously rejected promotion'


def test_serverless_walk_has_no_file_global(serverless_entrypoint):
    serverless_entrypoint('databricks/tasks/param_walk.py', ['--root', str(ROOT)])


@pytest.mark.parametrize('option, expected', [([], '/Shared/secondhand/param-walk'),
                                              (['--experiment', '/Shared/custom walk'], '/Shared/custom walk')])
def test_experiment_argument_reaches_mlflow(monkeypatch, option, expected):
    from unittest.mock import MagicMock
    class Stop(Exception):
        pass
    spark = MagicMock()
    spark.sql.return_value.first.return_value = {'version': 1}
    spark.table.return_value.where.return_value.collect.return_value = []
    sql = MagicMock()
    sql.SparkSession.getActiveSession.return_value = spark
    mlflow = MagicMock()
    mlflow.set_experiment.side_effect = Stop
    monkeypatch.setitem(sys.modules, 'pyspark.sql', sql)
    monkeypatch.setitem(sys.modules, 'delta.tables', MagicMock())
    monkeypatch.setitem(sys.modules, 'mlflow', mlflow)
    monkeypatch.setattr(p, 'walk', lambda rows, seed: {})
    with pytest.raises(Stop):
        p.main(option)
    mlflow.set_experiment.assert_called_once_with(expected)


def test_move_reasons_name_centered_paired_bootstrap_noise():
    out = p.walk(market()[:182 * 8], fit_fn=lambda rows, month: 90)
    judged = [m for m in out['moves'] if m['action'] == 'hold']
    assert judged
    assert all('95th percentile of |d* - mean d|' in m['reason'] for m in judged)
    assert all('centered paired bootstrap' in m['reason'] for m in judged)
    a = {'outcomes': {str(i): 1.0 for i in range(20)}}
    b = {'outcomes': {str(i): 0.0 for i in range(20)}}
    assert p.bootstrap_noise(a, b) == 0.0, 'uniform paired wins have zero centered noise'
