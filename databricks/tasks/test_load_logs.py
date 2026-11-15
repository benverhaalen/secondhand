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


@pytest.mark.parametrize('bad_mode', [False, True])
def test_load_checks_all_batches_before_first_write_and_persists_only_refusals(monkeypatch, tmp_path, bad_mode):
    import sys
    from pathlib import Path
    from types import SimpleNamespace as NS
    from tasks import load_logs
    from guard import GuardRefused

    path = tmp_path / 'input.jsonl'
    rows = [{**BASE, 'event': 'decision.answer', 'kind': 'first_post', 'mode': 'ask'},
            {**BASE, 'seq': 2, 'event': 'decision.answer', 'kind': 'first_post',
             'mode': 'broken' if bad_mode else 'never'},
            {**BASE, 'seq': 3, 'event': 'decision.answer', 'kind': 'first_post', 'user_id': 'usr_erased'}]
    path.write_text('\n'.join(json.dumps(r) for r in rows))
    monkeypatch.setattr(Path, 'glob', lambda *_: [path])
    writes = []

    class Spark:
        def __init__(self):
            self.sources = {}

        def createDataFrame(self, rows, schema):
            sources = self.sources

            class Frame:
                def dropDuplicates(self, keys):
                    return self

                def createOrReplaceTempView(self, name):
                    sources[name] = list(rows)

                @property
                def write(self):
                    return self

                def mode(self, mode):
                    assert mode == ('append' if bad_mode else 'overwrite')
                    return self

                def saveAsTable(self, table):
                    assert not table.startswith('secondhand.core.'), 'core tables must never be overwritten'
                    writes.append((table, list(rows)))
            return Frame()

        def sql(self, statement, args=None):
            if "`governance`" in statement:
                return NS(collect=lambda: [])
            if statement == 'SELECT user_id FROM secondhand.governance.erasure':
                return NS(collect=lambda: [{'user_id': 'usr_erased'}])
            import re
            match = re.fullmatch(r'MERGE INTO (secondhand.core.\w+) t USING (\w+) s ON .* WHEN NOT MATCHED THEN INSERT \*', statement)
            assert match
            table, source = match.groups()
            writes.append((table, self.sources[source]))
            return NS(collect=lambda: [])

    spark = Spark()
    monkeypatch.setitem(sys.modules, 'pyspark.sql', NS(SparkSession=NS(getActiveSession=lambda: spark)))
    if bad_mode:
        with pytest.raises(GuardRefused) as refused:
            load_logs.main()
        assert refused.value.violations[0]['rule'] == 'decision_policy_mode'
        assert [table for table, _ in writes] == ['secondhand.measures.guard_refusals'], 'a refused load partly overwrote core tables'
        refusal, = writes[0][1]
        assert refusal['job'] == 'load_logs' and refusal['data'] == 'example'
        assert refusal['row_id'] == parse([json.dumps(rows[1])], 'fixture').decisions[0]['id']
    else:
        assert load_logs.main()['loaded'] == 2
        assert [table for table, _ in writes] == ['secondhand.core.log_event', 'secondhand.core.decision', 'secondhand.measures.load_report']
        report, = writes[-1][1]
        assert report['lines'] == 3 and report['loaded'] == 2 and report['rejected'] == 1
        assert json.loads(report['reasons']) == {'erased user skipped': 1}


@pytest.mark.parametrize('owner_field', ['user', 'user_id'])
def test_erased_user_line_is_skipped_and_counted(owner_field):
    row = {**BASE, 'event': 'decision.answer', 'kind': 'first_post', owner_field: 'usr_erased'}
    result = parse([json.dumps(row)], 'erased.jsonl', erased_users={'usr_erased'})
    assert not result.log_events and not result.decisions
    assert result.rejects == [{'file': 'erased.jsonl', 'line': 1, 'reason': 'erased user skipped'}]


def test_either_owner_field_blocks_a_line_even_if_the_other_is_not_erased():
    row = {**BASE, 'event': 'note', 'user': 'usr_kept', 'user_id': 'usr_erased'}
    assert not parse([json.dumps(row)], 'x', erased_users={'usr_erased'}).log_events


def test_reloading_logs_is_insert_only_and_preserves_external_decisions():
    from tasks.load_logs import merge_logs
    import sqlite3
    db = sqlite3.connect(':memory:')
    db.execute('CREATE TABLE log_event (session, seq, user_id, data)')
    db.execute('CREATE TABLE decision (id, user_id, data)')
    db.execute('CREATE TABLE principal_map (principal, user_id, grant_id)')
    db.execute('CREATE TABLE break_glass (id, principal, reason, started_at, ended_at)')
    db.execute("INSERT INTO principal_map VALUES ('runner', 'system', NULL)")
    db.execute("INSERT INTO decision VALUES ('purge_audit', 'system', 'live:secondhand')")

    class Spark:
        def createDataFrame(self, rows, schema):
            class Frame:
                def dropDuplicates(self, keys):
                    self.keys = keys
                    return self

                def createOrReplaceTempView(self, name):
                    db.execute(f'DROP TABLE IF EXISTS {name}')
                    columns = list(rows[0])
                    db.execute(f'CREATE TABLE {name} ({", ".join(columns)})')
                    unique = {tuple(row[k] for k in self.keys): row for row in rows}
                    db.executemany(f'INSERT INTO {name} VALUES ({", ".join("?" for _ in columns)})',
                                   [list(row.values()) for row in unique.values()])
            return Frame()

        def sql(self, statement, args=None):
            import re
            from types import SimpleNamespace as NS
            result = NS(collect=lambda: [])
            if '`governance`' in statement:
                sql = statement.replace('`', '').replace('secondhand.governance.', '')
                sql = sql.replace('current_user()', "'runner'").replace('current_timestamp()', 'CURRENT_TIMESTAMP')
                db.execute(sql, args)
                return result
            match = re.fullmatch(r'MERGE INTO secondhand.core.(\w+) t USING (\w+) s ON (.*?) WHEN NOT MATCHED THEN INSERT \*', statement)
            assert match, 'core writes must use an insert-only MERGE'
            table, source, predicate = match.groups()
            visible = "(t.user_id IN (SELECT user_id FROM principal_map WHERE principal = 'runner') OR EXISTS (SELECT 1 FROM principal_map WHERE principal = 'runner' AND user_id = '*'))"
            db.execute(f'INSERT INTO {table} SELECT * FROM {source} s WHERE NOT EXISTS (SELECT 1 FROM {table} t WHERE {predicate} AND {visible})')
            return result

    from secondhand_log import create_log, memory_sink
    log = create_log(src='job.test', build='fixture', sink=memory_sink())
    spark = Spark()
    for _ in range(2):
        merge_logs(spark, log,
                   [{'session': 's_fixture', 'seq': 1, 'user_id': 'usr_other', 'data': 'example'}] * 2,
                   [{'id': 'dec_fixture', 'user_id': 'usr_other', 'data': 'example'}] * 2)
    assert db.execute('SELECT * FROM log_event').fetchall() == [('s_fixture', 1, 'usr_other', 'example')]
    assert db.execute('SELECT * FROM decision ORDER BY id').fetchall() == [('dec_fixture', 'usr_other', 'example'), ('purge_audit', 'system', 'live:secondhand')]
    assert not db.execute("SELECT * FROM principal_map WHERE user_id = '*'").fetchall()
    assert db.execute('SELECT count(*) FROM break_glass WHERE ended_at IS NOT NULL').fetchone()[0] == 2
    db.close()
