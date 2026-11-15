import hashlib
import copy
import json
import subprocess

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


def test_hash_covers_canonical_rows_in_utf16_order():
    r = [{'id': '～', 'source': 'ebay', 'at': '2026-11-10'},
         {'id': '😀', 'source': 'ebay', 'at': '2026-11-10'}]
    assert sorted([x['id'] for x in r], key=utf16_sort_key) == ['😀', '～']
    from proof import canonical
    frozen = [{**row, 'weight': 1, 'price_cents': None} for row in r[::-1]]
    assert basisHash(r) == hashlib.sha256(canonical(frozen).encode()).hexdigest()
    assert basisHash(r) == basisHash(r[::-1])
    for key, value in [('source', 'depop'), ('at', '2026-11-11'), ('weight', 2), ('price_cents', 1)]:
        changed = copy.deepcopy(r)
        changed[0][key] = value
        assert basisHash(changed) != basisHash(r)


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
    with pytest.raises(ValueError, match='basis date must be valid and not after now'):
        basisOf(rows(1, '2026-11-15T04:00:00.001Z'), NOW, [])


@pytest.mark.parametrize('r', [[], [{'id': 'x', 'source': 'ebay', 'at': 'bad'}],
                             [{'source': 'ebay', 'at': '2026-11-10'}],
                             [{'id': 'x', 'at': '2026-11-10'}]])
def test_invalid_basis_refuses(r):
    assert answer(42, r, CITE, NOW) == {'ok': False, 'refused': 'no_basis'}


def test_citation_and_all_guard_reasons_in_order():
    a = answer(42, rows(), CITE, NOW)
    assert a['citation']['id'].startswith('cit_')
    assert len(a['citation']['id']) == 68
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


@pytest.mark.parametrize('value,expected', [
    (1.0, '1'), (0.1 + 0.2, '0.30000000000000004'), (1e21, '1e+21'),
    (5e-7, '5e-7'), (-0.0, '0'), (0.5, '0.5'), (1e20, '100000000000000000000'),
    (1e-6, '0.000001'), (1.0000000000000001e18, '1000000000000000100'),
])
def test_canonical_numbers(value, expected):
    from proof import canonical
    assert canonical(value) == expected


def test_canonical_strings_match_every_javascript_escape():
    from proof import canonical
    values = [chr(i) for i in range(32)] + ['"', '\\', '\n', 'é', '😀', '/', '\u2028', '\u2029', '\ud800', '\udc00', '\ud83d\ude00']
    result = subprocess.run(['node', '--input-type=module', '-e',
                             'let s="";for await (const c of process.stdin)s+=c;process.stdout.write(JSON.stringify(JSON.parse(s).map(JSON.stringify)));'],
                            input=json.dumps(values), text=True, capture_output=True, check=True)
    assert [canonical(v) for v in values] == json.loads(result.stdout)


def test_canonical_utf16_keys_null_and_lists():
    from proof import canonical
    assert canonical({'～': None, '😀': [True, False, 1.0]}) == '{"😀":[true,false,1],"～":null}'


@pytest.mark.parametrize('value', [float('nan'), float('inf'), -float('inf'), object()])
def test_canonical_refuses_nonfinite_or_non_json(value):
    from proof import canonical, CitationIdentityMustBeFiniteJSON
    with pytest.raises(CitationIdentityMustBeFiniteJSON, match='citation identity must be finite JSON'):
        canonical(value)


@pytest.mark.parametrize('mutate,message', [
    (lambda r: r.append(dict(r[0])), 'duplicate basis id obs_0'),
    (lambda r: r[0].update(weight=-1), 'weight must be finite and nonnegative'),
    (lambda r: r[0].update(weight=float('nan')), 'weight must be finite and nonnegative'),
    (lambda r: r[0].update(weight=float('inf')), 'weight must be finite and nonnegative'),
    (lambda r: r[0].update(price_cents=-1), 'price_cents must be nonnegative safe integer cents'),
    (lambda r: r[0].update(price_cents=0.5), 'price_cents must be nonnegative safe integer cents'),
    (lambda r: r[0].update(price_cents=None), 'price_cents must be nonnegative safe integer cents'),
    (lambda r: r[0].update(price_cents=2**53), 'price_cents must be nonnegative safe integer cents'),
])
def test_row_validation_in_all_entrypoints(mutate, message):
    r = rows()
    mutate(r)
    for call in [lambda: basisHash(r), lambda: basisOf(r, NOW, []), lambda: answer(1, r, CITE, NOW)]:
        with pytest.raises(ValueError, match=message):
            call()


@pytest.mark.parametrize('r,now,message', [
    (rows(), 'bad', 'now must be a valid date'),
    ([], NOW, 'basis must contain rows'),
    (rows(1, 'bad'), NOW, 'basis date must be valid and not after now'),
    (rows(1, '2026-11-16'), NOW, 'basis date must be valid and not after now'),
])
def test_basis_of_raises_but_answer_refuses_invalid_evidence(r, now, message):
    with pytest.raises(ValueError, match=message):
        basisOf(r, now, [])
    assert answer(1, r, CITE, now) == {'ok': False, 'refused': 'no_basis'}


@pytest.mark.parametrize('scale', [1e308, 1e-300])
def test_effective_count_normalizes_before_summing(scale):
    r = rows(3)
    for row, weight in zip(r, [scale, scale / 2, 0]):
        row['weight'] = weight
    assert basisOf(r, NOW, [])['n_eff'] == 1.8


@pytest.mark.parametrize('change', [
    {'metric': 'other'}, {'filters': {'site': 'ebay'}}, {'param_versions': {'proof_min_n_eff': 1}},
    {'table_versions': [{'table': 'comp', 'version': 2}]}, {'definition_version': 'd2'},
    {'code_version': 'c2'}, {'model_version': 'm1'},
])
def test_citation_id_covers_entire_identity(change):
    original = answer(1, rows(), CITE, NOW)
    changed = answer(1, rows(), {**CITE, **change}, NOW)
    assert original['citation']['basis_hash'] == changed['citation']['basis_hash']
    assert original['citation']['id'] != changed['citation']['id']


def test_citation_clones_input_and_sorts_ids_only_in_citation():
    cite = copy.deepcopy(CITE)
    cite['filters'] = {'a': []}
    r = rows()[::-1]
    a = answer(1, r, cite, NOW)
    cite['filters']['a'].append(2)
    assert a['citation']['filters'] == {'a': []}
    assert a['basis']['ids'] == [row['id'] for row in r]
    assert a['citation']['basis_ids'] == sorted(a['basis']['ids'])


@pytest.mark.parametrize('key', ['min_n_eff', 'max_age_days'])
@pytest.mark.parametrize('value', [0, -1, float('nan'), float('inf'), None, True])
def test_guard_validates_rules_before_refusal(key, value):
    with pytest.raises(ValueError, match=f'{key} must be finite and positive'):
        guard({'ok': False, 'refused': 'no_basis'}, {**RULES, key: value})


@pytest.mark.parametrize('value,message', [
    (float('nan'), 'value must be finite'), (float('inf'), 'value must be finite'),
    ({'lo': 2, 'hi': 1}, 'range must have finite ordered bounds'),
    ({'lo': 0, 'hi': float('inf')}, 'range must have finite ordered bounds'),
])
def test_guard_validates_value_before_hiding(value, message):
    with pytest.raises(ValueError, match=message):
        guard(answer(value, rows(1), CITE, NOW), RULES)


def test_guard_uses_fractional_age_and_overflow_safe_range():
    assert guard(answer(1, rows(8, '2026-11-01T03:59:59Z'), CITE, NOW), RULES)['hide_reason'] == 'stale'
    assert guard(answer({'lo': 6e307, 'hi': 1.7e308}, rows(), CITE, NOW), RULES)['state'] == 'shown'


def test_canonical_binary64_printing_matches_javascript_across_exponents():
    import math
    import random
    import struct
    from proof import canonical

    rng = random.Random(17)
    numbers = [struct.unpack('>d', rng.getrandbits(64).to_bytes(8, 'big'))[0] for _ in range(2048)]
    numbers = [v for v in numbers if math.isfinite(v)]
    result = subprocess.run(['node', '--input-type=module', '-e',
                             'let s="";for await (const c of process.stdin)s+=c;process.stdout.write(JSON.stringify(JSON.parse(s).map(JSON.stringify)));'],
                            input=json.dumps(numbers), text=True, capture_output=True, check=True)
    assert [canonical(v) for v in numbers] == json.loads(result.stdout)
