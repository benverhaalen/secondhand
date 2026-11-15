import json
from pathlib import Path

import pytest
from negotiation.params import DECLARED, resolve, validate

FIXTURE = json.loads((Path(__file__).resolve().parents[2] / 'app/src/engines/negotiation/fixtures/declared.json').read_text())


def test_declared_parameters_match_shared_fixture_and_typescript_for_every_common_name():
    fields = ('name', 'family', 'prior', 'guard_lo', 'guard_hi')
    actual = sorted(({key: d.get(key) for key in fields} for d in DECLARED), key=lambda d: d['name'])
    assert actual == FIXTURE['python']
    by_name = {d['name']: d for d in actual}
    for typescript in FIXTURE['typescript']:
        if typescript['name'] in by_name:
            assert by_name[typescript['name']] == typescript, typescript['name']


@pytest.mark.parametrize('name', [d['name'] for d in DECLARED])
@pytest.mark.parametrize('version', [True, False, -1, 1.5])
def test_versions_refuse_booleans_and_nonnegative_nonintegers(name, version):
    params = resolve()
    params['versions'][name] = version
    with pytest.raises(ValueError, match=f'{name} version'):
        validate(params)


def test_nonnegative_integer_versions_resolve():
    priors = {d['name']: d['prior'] for d in DECLARED}
    for version in (0, 7):
        params = resolve(lambda name, scope: {'value': priors[name], 'version': version})
        assert all(v == version for v in params['versions'].values())
