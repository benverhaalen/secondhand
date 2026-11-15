"""Offline checks of the purge statement plan and temporary cross-user access."""
import builtins
import json
from io import BytesIO
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'databricks'))
sys.path.insert(0, str(ROOT / 'log'))
sys.path.insert(0, str(ROOT / 'deploy' / 'tasks'))


def modules():
    from break_glass import break_glass
    import purge
    return break_glass, purge


class SQL:
    def __init__(self, fail=None, remaining=0):
        self.calls = []
        self.fail = fail
        self.remaining = remaining

    def __call__(self, statement, args):
        self.calls.append((statement, args))
        if self.fail and self.fail in statement:
            raise RuntimeError(f'failed: {self.fail}')
        if statement == 'SELECT current_timestamp() AS vacuum_started_at':
            return [{'vacuum_started_at': '2026-11-15T04:00:00Z'}]
        return [{'n': self.remaining}] if statement.startswith('SELECT count(*)') else []


def test_delete_failure_revokes_grant_and_closes_break_glass_without_done_decision():
    _, purge = modules()
    sql = SQL(fail='DELETE FROM `secondhand`.`core`.`observation`')
    with pytest.raises(RuntimeError, match='observation'):
        purge.run_purge(sql, 'usr_fixture', 'secondhand', ['observation', 'evidence'], lambda: 0, lambda: None)
    statements = [s for s, _ in sql.calls]
    assert statements[0].startswith('INSERT INTO `secondhand`.`governance`.`principal_map`')
    assert any(s.startswith('DELETE FROM `secondhand`.`governance`.`principal_map`') for s in statements), 'failed purge leaked cross-user access'
    assert 'ended_at = current_timestamp()' in statements[-1]
    assert not any('REORG TABLE' in s or 'INSERT INTO `secondhand`.`core`.`decision`' in s for s in statements)


@pytest.mark.parametrize('failure', ['INSERT INTO `secondhand`.`governance`.`break_glass`',
                                    'INSERT INTO `secondhand`.`governance`.`principal_map`'])
def test_partial_acquisition_also_revokes(failure):
    break_glass, _ = modules()
    sql = SQL(fail=failure)
    with pytest.raises(RuntimeError, match='INSERT INTO'):
        with break_glass(sql, 'delete_user usr_fixture'):
            pytest.fail('failed acquisition must not enter the purge')
    assert any(s.startswith('DELETE FROM `secondhand`.`governance`.`principal_map`') for s, _ in sql.calls)


def test_revocation_failure_is_raised_and_not_recorded_as_ended():
    break_glass, _ = modules()
    sql = SQL(fail='DELETE FROM `secondhand`.`governance`.`principal_map`')
    with pytest.raises(RuntimeError, match='principal_map'):
        with break_glass(sql, 'delete_user usr_fixture'):
            pass
    assert not any('ended_at = current_timestamp()' in s for s, _ in sql.calls)


@pytest.mark.parametrize('user', ['', 'usr_', 'usr_a/b', "usr_a'; DELETE", 'other', 'usr_é', 'usr_a\n'])
def test_bad_user_is_refused_before_any_statement(user):
    _, purge = modules()
    sql = SQL()
    with pytest.raises(ValueError, match='user id'):
        purge.run_purge(sql, user, 'secondhand', ['observation'], lambda: pytest.fail('logs touched'), lambda: pytest.fail('captures touched'))
    assert sql.calls == []


def test_pure_plan_orders_all_deletes_before_all_reorgs_and_counts():
    _, purge = modules()
    names = ['observation', 'new_owned_table', 'decision']
    before = names.copy()
    plan = purge.plan('usr_fixture', 'secondhand', names)
    assert names == before
    assert plan == purge.plan('usr_fixture', 'secondhand', names)
    assert len(plan.deletes) == len(plan.reorgs) == len(plan.counts) == 3
    for name, delete, reorg, count in zip(names, plan.deletes, plan.reorgs, plan.counts):
        table = f'`secondhand`.`core`.`{name}`'
        assert delete == (f'DELETE FROM {table} WHERE user_id = :user_id', {'user_id': 'usr_fixture'})
        assert reorg == (f'REORG TABLE {table} APPLY (PURGE)', {})
        assert count == (f'SELECT count(*) AS n FROM {table} WHERE user_id = :user_id', {'user_id': 'usr_fixture'})
    left = {name: 0 for name in names}
    assert purge.decision_statement('usr_fixture', 'secondhand', left, 'dec_fixture') == purge.decision_statement('usr_fixture', 'secondhand', left, 'dec_fixture')


def test_success_records_zero_counts_and_system_owned_decision_then_revokes():
    _, purge = modules()
    sql = SQL()
    captures = []
    left = purge.run_purge(sql, 'usr_fixture', 'secondhand', ['observation', 'decision'], lambda: 0, lambda: captures.append(True))
    assert left == {'observation': 0, 'decision': 0}
    assert captures == [True]
    statements = [s for s, _ in sql.calls]
    deletes = [i for i, s in enumerate(statements) if s.startswith('DELETE FROM `secondhand`.`core`')]
    reorgs = [i for i, s in enumerate(statements) if s.startswith('REORG TABLE')]
    assert max(deletes) < min(reorgs)
    decision, args = next((s, a) for s, a in sql.calls if s.startswith('INSERT INTO `secondhand`.`core`.`decision`'))
    assert all(word in decision for word in ["'delete_user'", "'purge'", "'user'", "'ask'", "'done'", "'live:secondhand'", "'system'"])
    assert json.loads(args['why']) == {'tables': left, 'user_id': 'usr_fixture'}
    assert statements.index(decision) < next(i for i, s in enumerate(statements) if "user_id = '*'" in s and s.startswith('DELETE FROM `secondhand`.`governance`'))
    opened = next(a for s, a in sql.calls if s.startswith('INSERT INTO `secondhand`.`governance`.`break_glass`'))
    closed = sql.calls[-1][1]
    assert opened['reason'] == 'delete_user usr_fixture'
    assert opened['id'] == closed['id']
    assert all('current_user()' in s and "user_id = '*'" in s for s in statements if "user_id = '*'" in s and s.startswith('DELETE FROM `secondhand`.`governance`'))


def test_nonzero_counts_or_capture_failure_cannot_claim_done_and_still_revoke():
    _, purge = modules()
    for sql, capture in [(SQL(remaining=1), lambda: None), (SQL(), lambda: (_ for _ in ()).throw(OSError('capture deletion failed')))]:
        with pytest.raises((RuntimeError, OSError)):
            purge.run_purge(sql, 'usr_fixture', 'secondhand', ['observation'], lambda: 0, capture)
        assert not any('INSERT INTO `secondhand`.`core`.`decision`' in s for s, _ in sql.calls)
        assert any(s.startswith('DELETE FROM `secondhand`.`governance`.`principal_map`') for s, _ in sql.calls)


def test_custom_catalog_is_used_for_grants_and_every_core_statement():
    _, purge = modules()
    sql = SQL()
    purge.run_purge(sql, 'usr_fixture', 'demo-catalog', ['observation'], lambda: 0, lambda: None)
    assert all('`demo-catalog`.' in s for s, _ in sql.calls)


@pytest.fixture
def sdk_errors(monkeypatch):
    # The workspace supplies the SDK; these tests exercise its file boundary offline.
    monkeypatch.setitem(sys.modules, 'databricks.sdk.errors', SimpleNamespace(NotFound=FileNotFoundError))


def test_capture_tree_is_deleted_children_first_including_root(sdk_errors):
    _, purge = modules()
    root = '/Volumes/secondhand/raw/captures/usr_fixture'
    contents = {root: [SimpleNamespace(path=root + '/cap_x', is_directory=True)],
                root + '/cap_x': [SimpleNamespace(path=root + '/cap_x/photo.jpg', is_directory=False)]}
    removed = []
    files = SimpleNamespace(list_directory_contents=lambda path: contents[path], delete=lambda path: removed.append(path),
                            delete_directory=lambda path: removed.append(path))
    purge.delete_captures(files, 'usr_fixture', 'secondhand')
    assert removed == [root + '/cap_x/photo.jpg', root + '/cap_x', root]


def test_absent_capture_root_is_success_but_permission_or_partial_delete_is_not(sdk_errors):
    _, purge = modules()
    root = '/Volumes/secondhand/raw/captures/usr_fixture'

    def missing(path):
        raise FileNotFoundError(path)

    purge.delete_captures(SimpleNamespace(list_directory_contents=missing), 'usr_fixture', 'secondhand')

    def forbidden(path):
        raise PermissionError(path)

    with pytest.raises(PermissionError):
        purge.delete_captures(SimpleNamespace(list_directory_contents=forbidden), 'usr_fixture', 'secondhand')
    files = SimpleNamespace(list_directory_contents=lambda path: [SimpleNamespace(path=root + '/photo.jpg', is_directory=False)],
                            delete=missing)
    with pytest.raises(FileNotFoundError):
        purge.delete_captures(files, 'usr_fixture', 'secondhand')


def test_serverless_root_argument_reaches_spark_without_file(monkeypatch):
    class SparkReached(Exception):
        pass

    original = builtins.__import__

    def importing(name, *args, **kwargs):
        if name == 'pyspark.sql':
            raise SparkReached()
        return original(name, *args, **kwargs)

    monkeypatch.setattr(sys, 'argv', ['purge.py', 'usr_fixture', '--root', str(ROOT)])
    monkeypatch.setattr(builtins, '__import__', importing)
    module_paths = [str(ROOT / 'databricks'), str(ROOT / 'log')]
    monkeypatch.setattr(sys, 'path', [path for path in sys.path if path not in module_paths])
    with pytest.raises(SparkReached):
        exec(compile((ROOT / 'deploy/tasks/purge.py').read_text(), 'purge.py', 'exec'), {'__name__': '__main__'})
    assert all(path in sys.path for path in module_paths), '--root must populate imports before the Spark boundary'


def test_serverless_requires_root_before_importing_spark(monkeypatch):
    monkeypatch.setattr(sys, 'argv', ['purge.py', 'usr_fixture'])
    with pytest.raises(SystemExit) as error:
        exec(compile((ROOT / 'deploy/tasks/purge.py').read_text(), 'purge.py', 'exec'), {'__name__': '__main__'})
    assert error.value.code == 2


def test_entrypoint_discovers_every_owned_core_table(monkeypatch):
    _, purge = modules()
    seen = []
    monkeypatch.setattr(purge, 'run_purge', lambda sql, user, catalog, tables, rewrite_logs, captures: seen.extend(tables) or {})

    class Spark:
        def sql(self, statement, args=None):
            assert statement == 'SHOW TABLES IN `secondhand`.`core`'
            return SimpleNamespace(collect=lambda: [SimpleNamespace(tableName=t) for t in ['observation', 'no_owner', 'future_table']])

        def table(self, name):
            return SimpleNamespace(schema=[SimpleNamespace(name=c) for c in (['user_id'] if 'no_owner' not in name else ['id'])])

    monkeypatch.setitem(sys.modules, 'pyspark.sql', SimpleNamespace(SparkSession=SimpleNamespace(builder=SimpleNamespace(getOrCreate=lambda: Spark()))))
    monkeypatch.setitem(sys.modules, 'databricks.sdk', SimpleNamespace(WorkspaceClient=lambda: SimpleNamespace(files=None)))
    purge.main(['usr_fixture', '--root', str(ROOT)])
    assert seen == ['observation', 'future_table']


def test_tombstone_prevents_reload_before_any_core_delete_and_completion_is_last():
    _, purge = modules()
    sql = SQL()

    def rewrite():
        sql.calls.append(('rewrite_logs', {}))
        return 2

    def captures():
        sql.calls.append(('captures', {}))

    tables = ['observation', 'future_table', 'decision']
    purge.run_purge(sql, 'usr_fixture', 'secondhand', tables, rewrite, captures)
    calls = sql.calls
    index = lambda text: next(i for i, (s, _) in enumerate(calls) if text in s)
    tombstone = index('MERGE INTO `secondhand`.`governance`.`erasure`')
    first_delete = index('DELETE FROM `secondhand`.`core`')
    reorgs = [i for i, (s, _) in enumerate(calls) if s.startswith('REORG TABLE')]
    deletes = [i for i, (s, _) in enumerate(calls) if s.startswith('DELETE FROM `secondhand`.`core`')]
    mapping = index('DELETE FROM `secondhand`.`governance`.`principal_map` WHERE user_id = :user_id')
    complete = index('UPDATE `secondhand`.`governance`.`erasure`')
    decision = index('INSERT INTO `secondhand`.`core`.`decision`')
    revoke = index("AND user_id = '*'")
    assert tombstone < first_delete, 'reload can restore the user unless the tombstone precedes every delete'
    assert 'requested_at' in calls[tombstone][0]
    assert 'WHEN NOT MATCHED THEN INSERT' in calls[tombstone][0], 'retry must preserve the original tombstone'
    assert 'vacuumed_at = NULL' in calls[tombstone][0], 'retry must reopen physical erasure tracking'
    assert max(deletes) < min(reorgs) <= max(reorgs) < mapping
    assert mapping < index('rewrite_logs') < index('captures') < complete < decision < revoke
    statement, args = calls[complete]
    assert args['files_rewritten'] == 2
    assert json.loads(args['tables']) == {table: 0 for table in tables}
    assert 'INTERVAL 7 DAYS' in statement
    assert 'purged_at' in statement and 'vacuum_due_at' in statement


@pytest.mark.parametrize('failure', ['tombstone', 'delete', 'reorg', 'count', 'mapping', 'logs', 'captures', 'complete', 'decision'])
def test_every_failure_revokes_access_and_does_not_advance_later_steps(failure):
    _, purge = modules()
    markers = {
        'tombstone': 'MERGE INTO `secondhand`.`governance`.`erasure`',
        'delete': 'DELETE FROM `secondhand`.`core`', 'reorg': 'REORG TABLE',
        'count': 'SELECT count(*)',
        'mapping': 'DELETE FROM `secondhand`.`governance`.`principal_map` WHERE user_id = :user_id',
        'complete': 'UPDATE `secondhand`.`governance`.`erasure`',
        'decision': 'INSERT INTO `secondhand`.`core`.`decision`',
    }
    sql = SQL(fail=markers.get(failure))
    touched = []

    def step(name):
        touched.append(name)
        if name == failure:
            raise OSError(name)
        return 0

    with pytest.raises((RuntimeError, OSError)):
        purge.run_purge(sql, 'usr_fixture', 'secondhand', ['observation'],
                        lambda: step('logs'), lambda: step('captures'))
    assert "AND user_id = '*'" in sql.calls[-2][0], f'{failure}: wildcard access leaked'
    assert 'ended_at = current_timestamp()' in sql.calls[-1][0]
    if failure != 'decision':
        assert not any(s.startswith('INSERT INTO `secondhand`.`core`.`decision`') for s, _ in sql.calls)
    if failure in markers and failure not in ('complete', 'decision'):
        assert touched == [], f'{failure}: files touched after a failed database step'


def volume_files(contents):
    uploads = []
    files = SimpleNamespace(
        list_directory_contents=lambda path: [SimpleNamespace(path=f'{path}/{name}', is_directory=False) for name in contents],
        download=lambda path: SimpleNamespace(contents=BytesIO(contents[Path(path).name])),
        upload=lambda path, data, overwrite: uploads.append((path, data.read(), overwrite)),
    )
    return files, uploads


def test_log_rewrite_removes_both_owner_fields_and_preserves_other_lines_byte_for_byte(sdk_errors):
    _, purge = modules()
    other = b' {"user":"usr_other", "note":"usr_fixture"} \r\n'
    shared = b'{"event":"shared"}\n'
    malformed = b'{not-json}\n'
    contents = {'mixed.jsonl': b'{"user":"usr_fixture"}\n' + other + b'{"user_id":"usr_fixture"}\n' + shared + malformed,
                'other.jsonl': other, 'all.jsonl': b'{"user":"usr_fixture"}', 'ignore.txt': b'{"user":"usr_fixture"}'}
    files, uploads = volume_files(contents)
    assert purge.rewrite_logs(files, 'usr_fixture', 'secondhand') == 2
    assert uploads == [('/Volumes/secondhand/raw/landing/logs/mixed.jsonl', other + shared + malformed, True),
                       ('/Volumes/secondhand/raw/landing/logs/all.jsonl', b'', True)]


@pytest.mark.parametrize('operation', ['list_directory_contents', 'download', 'upload'])
def test_log_file_errors_fail_the_purge_instead_of_claiming_a_rewrite(operation, sdk_errors):
    _, purge = modules()
    files, _ = volume_files({'one.jsonl': b'{"user":"usr_fixture"}\n'})

    def fail(*args, **kwargs):
        raise PermissionError(operation)

    setattr(files, operation, fail)
    with pytest.raises(PermissionError, match=operation):
        purge.rewrite_logs(files, 'usr_fixture', 'secondhand')


def test_vacuum_covers_every_core_table_before_marking_only_due_completed_erasures():
    _, purge = modules()
    sql = SQL()
    purge.run_vacuum(sql, 'demo-catalog', ['observation', 'no_owner', 'decision'])
    assert sql.calls[0] == ('SELECT current_timestamp() AS vacuum_started_at', {})
    assert [s for s, _ in sql.calls[1:-1]] == [
        f'VACUUM `demo-catalog`.`core`.`{table}` RETAIN 168 HOURS' for table in ['observation', 'no_owner', 'decision']]
    statement, args = sql.calls[-1]
    assert statement.startswith('UPDATE `demo-catalog`.`governance`.`erasure` SET vacuumed_at = current_timestamp()')
    for condition in ['vacuum_due_at <= :vacuum_started_at', 'purged_at IS NOT NULL', 'vacuumed_at IS NULL']:
        assert condition in statement
    assert args == {'vacuum_started_at': '2026-11-15T04:00:00Z'}


def test_vacuum_failure_cannot_mark_erasures_vacuumed():
    _, purge = modules()
    sql = SQL(fail='VACUUM `secondhand`.`core`.`observation`')
    with pytest.raises(RuntimeError, match='VACUUM'):
        purge.run_vacuum(sql, 'secondhand', ['observation', 'decision'])
    assert len(sql.calls) == 2


@pytest.mark.parametrize('catalog', ['secondhand', 'demo-catalog'])
def test_vacuum_entrypoint_needs_no_user_and_includes_tables_without_user_id(monkeypatch, catalog):
    _, purge = modules()
    seen = []
    monkeypatch.setattr(purge, 'run_vacuum', lambda sql, target, tables: seen.append((target, tables)))

    class Spark:
        def sql(self, statement, args=None):
            assert statement == f'SHOW TABLES IN `{catalog}`.`core`'
            return SimpleNamespace(collect=lambda: [SimpleNamespace(tableName=t) for t in ['observation', 'no_owner']])

    monkeypatch.setitem(sys.modules, 'pyspark.sql', SimpleNamespace(SparkSession=SimpleNamespace(builder=SimpleNamespace(getOrCreate=lambda: Spark()))))
    purge.main(['--vacuum', '--catalog', catalog, '--root', str(ROOT)])
    assert seen == [(catalog, ['observation', 'no_owner'])]
