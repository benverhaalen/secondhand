import json
import sys
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from trust.fit import predict
FIXTURE = Path(__file__).resolve().parents[2] / 'app/src/engines/trust/fixtures/calibration-parity.json'
@pytest.mark.parametrize('case', json.loads(FIXTURE.read_text())['cases'])
def test_calibration_twins(case):
    assert predict(case['cal'], case['z']) == pytest.approx(case['expected'], rel=1e-14, abs=1e-30)
