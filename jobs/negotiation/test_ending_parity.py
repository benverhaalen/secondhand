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


@pytest.mark.parametrize('value', [float('nan'), -1, -float('inf'), float('inf')])
@pytest.mark.parametrize('field', ['cents', 'lo_cents', 'hi_cents'])
def test_rounding_refuses_invalid_amount_with_field_name(value, field):
    if field == 'hi_cents' and value == float('inf'):
        assert round_to_ending(7100, hi_cents=value) == 6800
        return
    args = dict(cents=7100, lo_cents=0, hi_cents=8000)
    args[field] = value
    with pytest.raises(ValueError, match=field):
        round_to_ending(**args)
    if field != 'cents':
        with pytest.raises(ValueError, match=field):
            endings(args['lo_cents'], args['hi_cents'])
