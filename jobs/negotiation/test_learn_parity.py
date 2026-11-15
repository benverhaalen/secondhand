"""Shared event fixture and the real nightly fitter used by the TS lifecycle proof."""
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'jobs'))
from negotiation.fit import Logistic, online_update, fit, nightly, log_loss, calibration_error
from param.registry import MemoryStore

FIXTURE = ROOT / 'app/src/engines/negotiation/fixtures/learn-parity.json'


def model_from(value):
    return Logistic(copy.deepcopy(value['terms']), list(value['weights']),
                    copy.deepcopy(value.get('prior_terms')), copy.deepcopy(value.get('prior_weights')),
                    copy.deepcopy(value.get('precision', {})))


def snapshot(model, row=None):
    value = dict(terms=model.terms, weights=model.weights, prior_terms=model.prior_terms,
                 prior_weights=model.prior_weights, precision=model.precision)
    if row is not None:
        value['p'] = model.predict(row)
    return value


def generate_fixture():
    feature_order = json.loads(FIXTURE.read_text())['feature_order']
    sequences = []
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for case in range(8):
        terms = {'global': (case - 3) / 4, 'site:poshmark': 0., 'category:jackets': .2,
                 'cell:poshmark:jackets': -.1, 'site:ebay': .3}
        weights = [(-1 if case % 2 else 1) * .5, 0., .1, -.1, 0., .05, 0., -.02]
        model = Logistic(terms, weights)
        initial = snapshot(model)
        previous = start
        events = []
        for i, day in enumerate([0, 1, 1, 31, 121, 122]):
            at = start + timedelta(days=day)
            values = dict(gap_ratio=.9, counter_ask_ratio=.98, round=float(i), days_listed=float(day),
                          last_concession_share=.2, response_latency_hours=2., watcher_count=10., like_count=5.)
            row = {'site': 'poshmark', 'category': 'jackets',
                   'features': [values[name] for name in feature_order],
                   'accepted': (i + case) % 2, 'may_model': True}
            if case == 6:
                row['features'][feature_order.index('gap_ratio')] = 1e12  # event influence caps, prediction still uses the raw feature
            if case == 7:
                row['features'][feature_order.index('last_concession_share')] = -1e12
            model = online_update(model, row, (at - previous).total_seconds() / 86400)
            events.append({'at': at.isoformat(), 'row': row, 'expected': snapshot(model, row)})
            previous = at
        sequences.append({'name': f'ordered-{case}', 'initial': initial, 'at': start.isoformat(), 'events': events})
    return {'feature_order': feature_order, 'sequences': sequences}


def test_feature_order_and_eight_dated_sequences():
    fixture = json.loads(FIXTURE.read_text())
    assert len(fixture['feature_order']) == len(set(fixture['feature_order'])) == 8
    assert len(fixture['sequences']) >= 8
    gaps = set()
    for sequence in fixture['sequences']:
        previous = datetime.fromisoformat(sequence['at'])
        for event in sequence['events']:
            at = datetime.fromisoformat(event['at'])
            gaps.add((at - previous).days)
            previous = at
    assert {30, 90} <= gaps


@pytest.mark.parametrize('case', range(8))
def test_online_update_parity(case):
    saved = json.loads(FIXTURE.read_text())['sequences'][case]
    model = model_from(saved['initial'])
    previous = datetime.fromisoformat(saved['at'])
    for event in saved['events']:
        at = datetime.fromisoformat(event['at'])
        model = online_update(model, event['row'], (at - previous).total_seconds() / 86400)
        actual, expected = snapshot(model, event['row']), event['expected']
        assert actual['terms'] == pytest.approx(expected['terms'], abs=1e-9)
        assert actual['weights'] == pytest.approx(expected['weights'], abs=1e-9)
        assert actual['precision'] == pytest.approx(expected['precision'], abs=1e-9)
        assert actual['p'] == pytest.approx(expected['p'], abs=1e-9)
        previous = at


def nightly_cases(value):
    champion = model_from(value['model'])
    base = value['row']
    def rows(prefix, numerator):
        return [{**base, 'outcome_id': f'{prefix}:{i}', 'accepted': int(i % 20 < numerator),
                 'returned': int(i % 5 == 0)} for i in range(400)]
    cases = {}
    for name, train_n, held_n in [('worse', 19, 1), ('better', 1, 1)]:
        training, held = rows('training', train_n), rows('held', held_n)
        candidate = fit(training, champion)
        result = nightly(training, held, champion, MemoryStore(), {}, '2026-01-31T00:00:00Z')
        cases[name] = dict(model=candidate.payload(), loss=log_loss(candidate, held),
                           champion_loss=log_loss(champion, held), calibration_error=calibration_error(candidate, held),
                           state=result['state'], n=len(training),
                           hash=hashlib.sha256('\n'.join(sorted(r['outcome_id'] for r in training)).encode()).hexdigest())
    return cases


if __name__ == '__main__':
    if sys.argv[1:] == ['--write-fixture']:
        FIXTURE.parent.mkdir(parents=True, exist_ok=True)
        FIXTURE.write_text(json.dumps(generate_fixture(), indent=2) + '\n')
    elif sys.argv[1:] == ['--nightly']:
        sys.stdout.write(json.dumps(nightly_cases(json.load(sys.stdin))))
    else:
        raise ValueError('expected --write-fixture or --nightly')
