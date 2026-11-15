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
