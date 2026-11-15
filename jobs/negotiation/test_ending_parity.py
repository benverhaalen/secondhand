import json
from pathlib import Path
import pytest
from negotiation.ending import endings, round_to_ending

CASES = json.loads((Path(__file__).resolve().parents[2] / 'app/src/engines/money/fixtures/ending-parity.json').read_text())


@pytest.mark.parametrize('case', CASES, ids=lambda c: c['name'])
def test_shared_ending(case):
    c = case
    if c.get('error'):
        with pytest.raises(ValueError):
            round_to_ending(c['cents'], c.get('rule'), c['lo'], c['hi'])
        return
    assert round_to_ending(c['cents'], c.get('rule'), c['lo'], c['hi']) == c['expected']
    if 'endings' in c:
        assert endings(c['lo'], c['hi'], c.get('rule')) == c['endings']
