"""The Python reference and TypeScript inversion share a frozen SciPy fixture."""
import json
from pathlib import Path

import pytest

from demand.velocity import Week, velocity

FIXTURE = Path(__file__).resolve().parents[2] / 'app/src/engines/demand/fixtures/velocity-parity.json'
CASES = json.loads(FIXTURE.read_text())['cases']


@pytest.mark.parametrize('case', CASES, ids=lambda case: case['id'])
def test_velocity_matches_shared_fixture(case):
    result = velocity([Week(**week) for week in case['weeks']], case['prior'])
    for field in ('shape', 'rate', 'mean', 'p10', 'p90'):
        assert getattr(result, field) == pytest.approx(case['expected'][field], abs=1e-10, rel=0), case['id'] + '.' + field


def test_fixture_exercises_small_and_large_shapes():
    assert len(CASES) >= 10
    assert any(case['expected']['shape'] < 1 for case in CASES)
    assert any(case['expected']['shape'] >= 1000 for case in CASES)
