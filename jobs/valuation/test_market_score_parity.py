"""The handwritten fixture pins experiment.py and the TypeScript online scorer."""
import json
from pathlib import Path

import numpy as np
from valuation import experiment


FIXTURE = Path(__file__).parents[2] / 'app/src/engines/valuation/fixtures/market-score-parity.json'


def metrics(events):
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
        mean = float(np.mean(differences))
        half = 1.96 * float(np.std(differences, ddof=1)) / len(differences) ** .5
        result['vs_' + name] = {'n': len(paired), 'diff': round(mean, 4), 'interval_95': [round(max(-1, mean - half), 4), round(min(1, mean + half), 4)]}
    return result


def test_parity_drift_between_the_languages():
    fixture = json.loads(FIXTURE.read_text())
    assert len(fixture['events']) == 40
    assert len(fixture['expected']) == 3
    for key, expected in fixture['expected'].items():
        scope = None if key == 'overall' else json.loads(key)
        events = [e for e in fixture['events'] if scope is None or all(e['sale'][k] == v for k, v in scope.items())]
        assert metrics(events) == expected, key
