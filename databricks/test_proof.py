import hashlib

import pytest

from proof import answer, basisHash, basisOf, guard, utf16_sort_key

NOW = '2026-11-15T04:00:00.000Z'
CITE = {'metric': 'sold_range', 'filters': {}, 'table_versions': [],
        'definition_version': 'd1', 'code_version': 'c1', 'param_versions': {}, 'model_version': None}
RULES = {'min_n_eff': 6, 'max_age_days': 14}


def test_serverless_fold_resolves_explicit_root_and_module_file(serverless_entrypoint, tmp_path, capsys):
    import json

    folder = tmp_path / 'jobs/probe'
    folder.mkdir(parents=True)
    entry = folder / 'fit.py'
    entry.write_text('def main():\n    return __file__\n')
    serverless_entrypoint('deploy/tasks/fold.py', ['probe', '--root', str(tmp_path)], spark=False)
    result = json.loads(capsys.readouterr().out)
    assert result == {'engine': 'probe', 'state': 'ran', 'result': str(entry)}


def rows(n=8, at='2026-11-10'):
    return [{'id': f'obs_{i}', 'source': 'ebay', 'at': at, 'price_cents': 100 + i} for i in range(n)]


def test_hash_uses_utf16_order_and_empty_missing_price():
    r = [{'id': '\uff5e', 'price_cents': None}, {'id': '\U0001f600'}]
    assert sorted([x['id'] for x in r], key=utf16_sort_key) == ['\U0001f600', '\uff5e']
    assert basisHash(r) == hashlib.sha256('😀:\n～:'.encode()).hexdigest()
    assert basisHash(r) == basisHash(r[::-1])
    assert basisHash([{'id': 'a'}]) == hashlib.sha256(b'a:').hexdigest()
    assert basisHash([{'id': 'a', 'price_cents': 1}]) != basisHash([{'id': 'a'}])


def test_basis_dates_weights_sources_and_order():
    r = rows(3)
    r[0].update(at='2026-11-09T23:00:00-01:00', weight=2, source='～')
    r[1].update(at='2026-11-11T04:00:00', weight=1, source='😀')
    r[2].update(weight=0, source='😀')
    b = basisOf(r, NOW, ['claim_check'])
    assert b == {'ids': ['obs_0', 'obs_1', 'obs_2'], 'sources': ['😀', '～'], 'count': 3,
                 'n_eff': 1.8, 'oldest': '2026-11-10T00:00:00.000Z',
                 'newest': '2026-11-11T04:00:00.000Z', 'age_days': 4, 'passed': ['claim_check']}
    assert basisOf([{**r[0], 'weight': 0}], NOW, [])['n_eff'] == 0
    assert basisOf(rows(1, '2026-11-15T04:00:00.001Z'), NOW, [])['age_days'] == -1


@pytest.mark.parametrize('r', [[], [{'id': 'x', 'source': 'ebay', 'at': 'bad'}],
                             [{'source': 'ebay', 'at': '2026-11-10'}],
                             [{'id': 'x', 'at': '2026-11-10'}]])
def test_invalid_basis_refuses(r):
    assert answer(42, r, CITE, NOW) == {'ok': False, 'refused': 'no_basis'}


def test_citation_and_all_guard_reasons_in_order():
    a = answer(42, rows(), CITE, NOW)
    assert a['citation']['id'] == 'cit_' + basisHash(rows())[:16]
    assert a['citation']['computed_at'] == NOW
    assert guard(a, RULES)['state'] == 'shown'
    assert guard(answer(1, [], CITE, NOW), RULES) == {'state': 'hidden', 'hide_reason': 'source_gap', 'basis_count': 0}
    assert guard(answer({'lo': 10, 'hi': 90}, rows(2, '2026-10-01'), CITE, NOW), RULES)['hide_reason'] == 'too_few'
    assert guard(answer({'lo': 10, 'hi': 90}, rows(8, '2026-10-01'), CITE, NOW), RULES)['hide_reason'] == 'stale'
    assert guard(answer({'lo': 10, 'hi': 90}, rows(), CITE, NOW), RULES)['hide_reason'] == 'too_wide'
    assert guard(answer({'lo': 10, 'hi': 30}, rows(6, '2026-11-01T04:00:00Z'), CITE, NOW), RULES)['state'] == 'shown'


def test_submillisecond_dates_are_truncated_before_age_arithmetic():
    b = basisOf(rows(1, '2026-11-15T04:00:00.0009Z'), '2026-11-15T04:00:00.0001Z', [])
    assert b['age_days'] == 0
    assert b['newest'] == '2026-11-15T04:00:00.000Z'


@pytest.mark.parametrize('at, expected', [
    ('2026-11-10T24:00:00Z', '2026-11-11T00:00:00.000Z'),
    ('2026-02-30', '2026-03-02T00:00:00.000Z'),
])
def test_javascript_iso_date_normalization(at, expected):
    a = answer(42, rows(1, at), CITE, NOW)
    assert a['ok']
    assert a['basis']['newest'] == expected


@pytest.mark.parametrize('at', ['2026-13-01', '2026-11-32', '2026-11-10T24:01:00Z'])
def test_invalid_iso_components_refuse(at):
    assert not answer(42, rows(1, at), CITE, NOW)['ok']
