import copy
import json
from pathlib import Path

from parity.parity import compare, proof_case

HERE = Path(__file__).parent


def test_serverless_parity_resolves_explicit_root(serverless_entrypoint, tmp_path):
    module = serverless_entrypoint('databricks/tasks/parity_job.py', ['--root', str(tmp_path)])
    assert module['ROOT'] == tmp_path
    assert str(tmp_path / 'databricks') in module['sys'].path
    assert str(tmp_path / 'log') in module['sys'].path
    folder = tmp_path / 'databricks/parity'
    (folder / 'fixtures').mkdir(parents=True)
    (folder / 'fixtures/proof.json').write_text('[]')
    (folder / 'proof.ts-out.json').write_text('[]')
    assert module['run']() == []


def inputs():
    return (json.loads((HERE / 'fixtures/proof.json').read_text()),
            json.loads((HERE / 'proof.ts-out.json').read_text()))


def test_every_committed_typescript_case_matches_python():
    fixtures, ts = inputs()
    results = compare(fixtures, ts, proof_case)
    assert len(results) >= 12
    assert all(r['equal'] for r in results), [r for r in results if not r['equal']]


def test_changed_typescript_string_and_integer_are_unequal():
    fixtures, ts = inputs()
    changed = copy.deepcopy(ts)
    changed[0]['value']['hash'] = 'wrong'
    assert compare(fixtures, changed, proof_case)[0]['equal'] is False
    assert compare([{'case': 'int'}], [{'case': 'int', 'value': 2}], lambda _: 3)[0]['equal'] is False


def test_only_floats_round_to_six_places():
    assert compare([{'case': 'ratio'}], [{'case': 'ratio', 'value': {'n': 1.12345641}}],
                   lambda _: {'n': 1.12345642})[0]['equal']
    assert not compare([{'case': 'type'}], [{'case': 'type', 'value': 1}], lambda _: True)[0]['equal']


def test_workspace_job_reads_committed_fixtures_and_serializes_table_values():
    from datetime import datetime, timezone
    from parity.parity import table_rows
    from tasks.parity_job import run

    results = run()
    checked_at = datetime.now(timezone.utc)
    rows = table_rows(results, 'fixture_build', checked_at)
    assert all(r['equal'] for r in rows)
    assert len(rows) == len(inputs()[0])
    assert all(r['checked_at'] == checked_at and r['code_sha'] == 'fixture_build' for r in rows)
    assert json.loads(rows[0]['ts_value']) == results[0]['ts_value']
    assert json.loads(rows[0]['py_value']) == results[0]['py_value']


def test_identity_variants_share_basis_but_have_distinct_citation_ids():
    fixtures, _ = inputs()
    cases = {c['case']: c for c in fixtures}
    values = [proof_case(cases[name]) for name in ['ordinary', 'citation_metric', 'citation_filters', 'citation_param_version']]
    assert len({v['hash'] for v in values}) == 1
    assert len({v['answer']['citation']['id'] for v in values}) == 4


def test_refusals_are_compared_as_errors_and_old_cases_remain():
    fixtures, ts = inputs()
    original = {'ordinary', 'unsorted_ids', 'missing_price', 'weights', 'astral_utf16', 'bad_date', 'empty',
                'too_few', 'stale', 'too_wide', 'shown', 'guard_precedence', 'zero_weights', 'iso_offsets',
                'missing_source', 'empty_id', 'guard_boundary', 'submillisecond_truncation',
                'end_of_day_iso', 'short_month_normalization'}
    assert original <= {c['case'] for c in fixtures}
    results = {r['case']: r['value'] for r in ts}
    assert results['duplicate_ids_basisHash']['error'] == {'name': 'RangeError', 'message': 'duplicate basis id obs_0'}
    assert results['bad_now_answer'] == {'ok': False, 'refused': 'no_basis'}
    assert results['future_date_answer'] == {'ok': False, 'refused': 'no_basis'}


def test_binary64_numbers_can_be_printed_as_integers_without_losing_parity():
    assert compare([{'case': 'binary64'}], [{'case': 'binary64', 'value': 1000000000000000100}],
                   lambda _: 1.0000000000000001e18)[0]['equal']
    assert not compare([{'case': 'cents'}], [{'case': 'cents', 'value': 9007199254740991}],
                       lambda _: 9007199254740990)[0]['equal']


def test_declared_fixture_errors_match_typescript_and_python():
    fixtures, ts = inputs()
    expected = {row['case']: row['value'] for row in ts}
    for case in fixtures:
        if 'expect_error' in case:
            error = {'error': {'name': 'RangeError', 'message': case['expect_error']}}
            assert expected[case['case']] == error, case['case']
            assert proof_case(case) == error, case['case']
    assert expected['undefined_dropped'] == expected['undefined_absent']
