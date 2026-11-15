import hashlib
import json

import pytest

from tasks.load_logs import parse

BASE = {'ts': '2026-11-15T08:09:07.685Z', 'session': 's_x', 'seq': 1, 'src': 'walk', 'level': 'info'}


def test_serverless_load_logs_resolves_explicit_root(serverless_entrypoint, tmp_path):
    module = serverless_entrypoint('databricks/tasks/load_logs.py', ['--root', str(tmp_path)])
    assert module['ROOT'] == tmp_path
    assert str(tmp_path / 'log') in module['sys'].path


@pytest.mark.parametrize('fields, expected', [
    ({'src': 'policy_sweep', 'site': 'ebay'}, 'synthetic'),
    ({'src': 'policy_sweep', 'fixture': True, 'site': 'ebay'}, 'synthetic'),
    ({'src': 'walk', 'site': 'ebay'}, 'example'),
    ({'src': 'edge', 'fixture': True, 'site': 'ebay'}, 'example'),
    ({'src': 'edge', 'fixture': False, 'site': 'ebay'}, 'live:ebay'),
    ({'src': 'edge', 'site': 'depop'}, 'live:depop'),
    ({'src': 'edge'}, 'example'),
    ({'src': 'edge', 'site': ''}, 'example'),
    ({'src': 'edge', 'site': '   '}, 'example'),
])
def test_log_and_decision_provenance(fields, expected):
    row = {**BASE, 'event': 'decision.answer', 'kind': 'first_post', **fields}
    result = parse([json.dumps(row)], 'fixture.jsonl')
    assert not result.rejects
    assert result.log_events[0]['data'] == expected
    assert result.decisions[0]['data'] == expected


def test_non_decision_log_provenance_and_spark_schemas():
    from tasks.load_logs import LOG_SCHEMA, DECISION_SCHEMA

    result = parse([json.dumps({**BASE, 'src': 'edge', 'event': 'note', 'site': 'ebay'})], 'x')
    assert result.log_events[0]['data'] == 'live:ebay'
    assert 'data STRING' in LOG_SCHEMA
    assert 'data STRING' in DECISION_SCHEMA


def test_walk_and_policy_lines_load_with_counted_rejects():
    lines = [json.dumps({**BASE, 'event': 'job.stage', 'job': 'walk', 'stage': 'capture', 'state': 'started'}),
             json.dumps({**BASE, 'seq': 2, 'event': 'decision.answer', 'decision': 'walk_first_post',
                         'option': 'yes', 'item': 'walk_item', 'fixture': True}),
             json.dumps({**BASE, 'seq': 3, 'src': 'policy_sweep', 'event': 'decision.answer',
                         'action': 'refund', 'kind': 'refund', 'site': 'ebay', 'mode': 'never',
                         'allow': False, 'promoted': True, 'policy_version': 'abc123', 'why': 'handoff'}),
             'not json', json.dumps({**BASE, 'seq': 4})]
    result = parse(lines, 'walk.jsonl')
    assert len(result.log_events) == 3
    assert len(result.decisions) == 2
    assert len(result.rejects) == 2
    assert all(r['reason'] and r['file'] == 'walk.jsonl' for r in result.rejects)
    assert [r['line'] for r in result.rejects] == [4, 5]
    assert result.log_events[0]['user_id'] == 'system'
    assert json.loads(result.log_events[0]['body']) == {'stage': 'capture', 'state': 'started'}
    walk, policy = result.decisions
    assert walk['id'] == 'dec_' + hashlib.sha256(b's_x:2').hexdigest()[:16]
    assert (walk['kind'], walk['action'], walk['actor'], walk['policy_mode'], walk['policy_version']) == ('first_post', 'first_post', 'user', 'ask', 'walk')
    assert walk['item_id'] == 'walk_item'
    assert (policy['kind'], policy['action'], policy['actor'], policy['policy_mode']) == ('refund', 'refund', 'auto', 'never')
    assert json.loads(policy['policy_result'])['allow'] is False
    assert policy['state'] == 'answered'


def test_bad_envelope_types_dates_and_empty_values_are_rejected():
    valid = {**BASE, 'event': 'note', 'msg': 'fixture'}
    bad = [{'ts': 'bad'}, {'seq': True}, {'seq': -1}, {'session': ''}, {'event': None}]
    result = parse([json.dumps({**valid, **delta}) for delta in bad] + ['[]'], 'bad.jsonl')
    assert not result.log_events
    assert len(result.rejects) == 6


def test_user_and_optional_fields_are_preserved():
    r = parse([json.dumps({**BASE, 'event': 'note', 'user': 'usr_fixture', 'msg': 'ok'})], 'x')
    assert r.log_events[0]['user_id'] == 'usr_fixture'
    assert json.loads(r.log_events[0]['body']) == {'msg': 'ok'}


def test_real_writer_session_start_at_sequence_zero_is_loaded():
    from secondhand_log import create_log, memory_sink

    sink = memory_sink()
    log = create_log(src='walk', build='fixture', sink=sink, session='s_fixture', seed=1)
    log.end()
    result = parse(sink.lines, 'writer.jsonl')
    assert not result.rejects
    assert [r['seq'] for r in result.log_events] == [0, 1]
