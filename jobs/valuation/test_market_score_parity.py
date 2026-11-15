"""The handwritten fixture pins experiment.py and the TypeScript online scorer."""
import json
import math
from pathlib import Path

import numpy as np
from valuation import experiment


FIXTURE = Path(__file__).parents[2] / 'app/src/engines/valuation/fixtures/market-score-parity.json'


def metrics(events, pair_min_n=10):
    pairs = [(e['sale']['price_cents'], {**e['frozen'], 'shown': e['frozen']['q50'] is not None}) for e in events]
    m = experiment._metrics(pairs)
    result = {k: m[k] for k in ('n', 'priced', 'hit_rate', 'within_20', 'median_pct_off', 'coverage', 'coverage_wilson_95', 'median_range_width')}
    shown = [e for e in events if e['frozen']['q50'] is not None]
    hits = sum(abs(e['frozen']['q50'] - e['sale']['price_cents']) / e['sale']['price_cents'] <= .2 for e in shown)
    result['within_20_wilson_95'] = [round(v, 4) for v in experiment._wilson(hits, len(shown))]
    for name in ('last_sale', 'median_90d'):
        paired = [e for e in shown if name + '_cents' in e['baselines']]
        differences = [int(abs(e['frozen']['q50'] - e['sale']['price_cents']) / e['sale']['price_cents'] <= .2)
                       - int(abs(e['baselines'][name + '_cents'] - e['sale']['price_cents']) / e['sale']['price_cents'] <= .2) for e in paired]
        # Online interval: paired event differences, not ablate._lift's product-block bootstrap.
        mean = float(np.mean(differences)) if differences else None
        interval = None
        if len(differences) >= pair_min_n:
            sd = float(np.std(differences, ddof=1))
            half = math.sqrt(2 * math.log(40) / len(differences)) if sd == 0 else 1.96 * sd / len(differences) ** .5
            interval = [round(max(-1, mean - half), 4), round(min(1, mean + half), 4)]
        result['vs_' + name] = {'n': len(paired), 'diff': round(mean, 4) if mean is not None else None, 'interval_95': interval}
    return result


def test_parity_drift_between_the_languages():
    fixture = json.loads(FIXTURE.read_text())
    assert len(fixture['events']) == 42
    assert len(fixture['expected']) == 3
    for key, expected in fixture['expected'].items():
        scope = None if key == 'overall' else json.loads(key)
        events = [e for e in fixture['events'] if scope is None or all(e['sale'][k] == v for k, v in scope.items())]
        assert metrics(events) == expected, key


def test_fixture_separates_coverage_and_accuracy_and_nonzero_90d_gap():
    fixture = json.loads(FIXTURE.read_text())
    for key, expected in fixture['expected'].items():
        assert expected['coverage'] != expected['within_20'], key
        assert expected['vs_median_90d']['diff'] != 0, key
    # After the two added narrow, accurate events: coverage=(29+0+0)/37.
    assert fixture['expected']['overall']['coverage'] == .7838
    # Accuracy=(29+1+1)/37=31/37=.837837..., rounded to four decimals.
    assert fixture['expected']['overall']['within_20'] == .8378
    # Median-90d paired differences: (4-4+1+1)/(26+2)=2/28=.071428...
    assert fixture['expected']['overall']['vs_median_90d']['diff'] == .0714


def test_two_identical_paired_differences_have_no_interval():
    fixture = json.loads(FIXTURE.read_text())
    result = metrics(fixture['events'][-2:])
    assert result['vs_median_90d']['n'] == 2
    assert result['vs_median_90d']['interval_95'] is None


def test_identical_pairs_above_the_floor_retain_uncertainty():
    fixture = json.loads(FIXTURE.read_text())
    bounds = metrics([fixture['events'][-1]] * 10)['vs_median_90d']['interval_95']
    assert bounds is not None and bounds[0] < 1 and bounds[1] == 1
