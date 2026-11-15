"""Exercise the guard against owner-filtered data and governance windows offline."""
import json
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from break_glass import break_glass
from secondhand_log import create_log, memory_sink


def test_audit_is_unconditional_and_precedes_the_grant():
    calls = []

    def sql(statement, args):
        calls.append((statement, args))
        if statement.startswith('INSERT INTO `secondhand`.`governance`.`break_glass`'):
            raise RuntimeError('audit unavailable')

    with pytest.raises(RuntimeError, match='audit unavailable'):
        with break_glass(sql, 'guard check'):
            pytest.fail('unaudited access')
    assert 'break_glass' in calls[0][0]
    assert not any(s.startswith('INSERT INTO `secondhand`.`governance`.`principal_map`') for s, _ in calls)


class Database:
    def __init__(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.db.execute('CREATE TABLE principal_map (principal, user_id)')
        self.db.execute('CREATE TABLE break_glass (id, principal, reason, started_at, ended_at, reason_closed)')
        self.db.execute('CREATE TABLE violation (user_id, table_name, row_id, rule, data)')
        self.db.execute("INSERT INTO principal_map VALUES ('runner', 'system')")
        self.db.execute("INSERT INTO principal_map VALUES ('runner', 'usr_backtest')")
        self.now = datetime.now(timezone.utc).replace(tzinfo=None)
        self.calls = []

    def __call__(self, statement, args):
        self.calls.append((statement, args))
        sql = statement.replace('`', '').replace('secondhand.governance.', '')
        sql = sql.replace('current_user()', "'runner'").replace('current_timestamp()', ':now')
        sql = sql.replace(':now - INTERVAL 60 MINUTES', ':cutoff')
        args = {**args, 'now': self.now.isoformat(' '), 'cutoff': (self.now - timedelta(minutes=60)).isoformat(' ')}
        if 'secondhand.measures.guard_violations' in sql:
            sql = "SELECT table_name, row_id, rule, data FROM violation WHERE user_id IN (SELECT user_id FROM principal_map WHERE principal = 'runner') OR EXISTS (SELECT 1 FROM principal_map WHERE principal = 'runner' AND user_id = '*')"
        return [dict(row) for row in self.db.execute(sql, args).fetchall()]


def test_sweep_closes_stale_windows_and_unlogged_wildcards_but_leaves_fresh_access():
    from tasks.guard_job import sweep
    sql = Database()
    for principal, age, ended in [('stale', 61, None), ('fresh', 59, None), ('boundary', 60, None), ('closed', 90, sql.now)]:
        sql.db.execute('INSERT INTO principal_map VALUES (?, ?)', (principal, '*'))
        sql.db.execute('INSERT INTO break_glass VALUES (?, ?, ?, ?, ?, NULL)',
                       (principal, principal, 'maintenance', (sql.now - timedelta(minutes=age)).isoformat(' '), ended.isoformat(' ') if ended else None))
    sql.db.execute("INSERT INTO principal_map VALUES ('rogue', '*')")
    found = sweep(sql)
    assert {r['row_id'] for r in found} == {'closed', 'rogue'}
    assert all(r['rule'] == 'principal_map_unlogged_wildcard' for r in found)
    assert [tuple(row) for row in sql.db.execute("SELECT principal FROM principal_map WHERE user_id = '*'")] == [('fresh',), ('boundary',)]
    stale = sql.db.execute("SELECT * FROM break_glass WHERE id = 'stale'").fetchone()
    assert stale['ended_at'] and stale['reason_closed'] == 'swept by guard'
    assert sql.db.execute("SELECT ended_at FROM break_glass WHERE id = 'fresh'").fetchone()[0] is None
    assert sql.db.execute("SELECT count(*) FROM break_glass WHERE reason = 'unlogged wildcard found by guard' AND ended_at IS NOT NULL").fetchone()[0] == 2


@pytest.mark.parametrize('bad_row', [False, True])
def test_snapshot_sees_other_owners_and_fails_only_after_access_is_revoked(bad_row):
    from tasks.guard_job import run_guard
    sql = Database()
    if bad_row:
        sql.db.execute("INSERT INTO violation VALUES ('usr_other', 'decision', 'bad', 'decision_policy_mode', 'captured')")
    saved = []
    log = create_log(src='job.guard', build='fixture', sink=memory_sink())

    class Spark:
        def createDataFrame(self, rows, schema):
            class Frame:
                @property
                def write(self):
                    return self

                def mode(self, mode):
                    assert mode == 'append'
                    return self

                def saveAsTable(self, table):
                    assert sql.db.execute("SELECT count(*) FROM principal_map WHERE principal = 'runner' AND user_id = '*'").fetchone()[0] == 1
                    saved.append((table, rows))
            return Frame()

    if bad_row:
        with pytest.raises(ValueError, match='guard violations'):
            run_guard(Spark(), log, sql)
    else:
        run_guard(Spark(), log, sql)
    assert not sql.db.execute("SELECT * FROM principal_map WHERE user_id = '*'").fetchall()
    assert sql.db.execute("SELECT ended_at FROM break_glass WHERE reason = 'guard check'").fetchone()[0]
    snapshot = next(rows[0] for table, rows in saved if table == 'secondhand.measures.guard_snapshot')
    assert snapshot['violations'] == int(bad_row)
    assert json.loads(snapshot['by_rule']) == ({'decision_policy_mode': 1} if bad_row else {})
    assert snapshot['data'] == 'live:secondhand'
    if bad_row:
        assert saved[0][0] == 'secondhand.measures.guard_snapshot_rows'
        assert saved[0][1][0]['row_id'] == 'bad'
        assert saved[0][1][0]['checked_at'] == snapshot['checked_at']
    statements = [s for s, _ in sql.calls]
    opened = next(i for i, s in enumerate(statements) if s.startswith('INSERT INTO `secondhand`.`governance`.`break_glass`'))
    assert statements[opened + 1].startswith('INSERT INTO `secondhand`.`governance`.`principal_map`')


def test_swept_unlogged_access_is_still_in_the_failure_snapshot():
    from tasks.guard_job import run_guard
    from types import SimpleNamespace as NS
    sql = Database()
    sql.db.execute("INSERT INTO principal_map VALUES ('rogue', '*')")
    saved = {}
    spark = NS(createDataFrame=lambda rows, schema: NS(write=NS(mode=lambda _: NS(saveAsTable=lambda table: saved.update({table: rows})))))
    with pytest.raises(ValueError, match='guard violations'):
        run_guard(spark, create_log(src='job.guard', build='fixture', sink=memory_sink()), sql)
    assert saved['secondhand.measures.guard_snapshot'][0]['violations'] == 1
    assert saved['secondhand.measures.guard_snapshot_rows'][0]['rule'] == 'principal_map_unlogged_wildcard'


def test_serverless_guard_resolves_explicit_root(serverless_entrypoint):
    root = Path(__file__).resolve().parents[2]
    serverless_entrypoint('databricks/tasks/guard_job.py', ['--root', str(root)])
