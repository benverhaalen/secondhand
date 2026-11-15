"""Offline checks of the purge statement plan and temporary cross-user access."""
import builtins
import json
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
        return [{'n': self.remaining}] if statement.startswith('SELECT count(*)') else []


def test_delete_failure_revokes_grant_and_closes_break_glass_without_done_decision():
    _, purge = modules()
    sql = SQL(fail='DELETE FROM `secondhand`.`core`.`observation`')
    with pytest.raises(RuntimeError, match='observation'):
        purge.run_purge(sql, 'usr_fixture', 'secondhand', ['observation', 'evidence'], lambda: None)
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
        purge.run_purge(sql, user, 'secondhand', ['observation'], lambda: pytest.fail('captures touched'))
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
    left = purge.run_purge(sql, 'usr_fixture', 'secondhand', ['observation', 'decision'], lambda: captures.append(True))
    assert left == {'observation': 0, 'decision': 0}
    assert captures == [True]
    statements = [s for s, _ in sql.calls]
    deletes = [i for i, s in enumerate(statements) if s.startswith('DELETE FROM `secondhand`.`core`')]
    reorgs = [i for i, s in enumerate(statements) if s.startswith('REORG TABLE')]
    assert max(deletes) < min(reorgs)
    decision, args = next((s, a) for s, a in sql.calls if s.startswith('INSERT INTO `secondhand`.`core`.`decision`'))
    assert all(word in decision for word in ["'delete_user'", "'purge'", "'user'", "'ask'", "'done'", "'live:secondhand'", "'system'"])
    assert json.loads(args['why']) == {'tables': left, 'user_id': 'usr_fixture'}
    assert statements.index(decision) < next(i for i, s in enumerate(statements) if s.startswith('DELETE FROM `secondhand`.`governance`'))
    opened = next(a for s, a in sql.calls if s.startswith('INSERT INTO `secondhand`.`governance`.`break_glass`'))
    closed = sql.calls[-1][1]
    assert opened['reason'] == 'delete_user usr_fixture'
    assert opened['id'] == closed['id']
    assert all('current_user()' in s and "user_id = '*'" in s for s in statements if s.startswith('DELETE FROM `secondhand`.`governance`'))


def test_nonzero_counts_or_capture_failure_cannot_claim_done_and_still_revoke():
    _, purge = modules()
    for sql, capture in [(SQL(remaining=1), lambda: None), (SQL(), lambda: (_ for _ in ()).throw(OSError('capture deletion failed')))]:
        with pytest.raises((RuntimeError, OSError)):
            purge.run_purge(sql, 'usr_fixture', 'secondhand', ['observation'], capture)
        assert not any('INSERT INTO `secondhand`.`core`.`decision`' in s for s, _ in sql.calls)
        assert any(s.startswith('DELETE FROM `secondhand`.`governance`.`principal_map`') for s, _ in sql.calls)


def test_custom_catalog_is_used_for_grants_and_every_core_statement():
    _, purge = modules()
    sql = SQL()
    purge.run_purge(sql, 'usr_fixture', 'demo-catalog', ['observation'], lambda: None)
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
    monkeypatch.setattr(purge, 'run_purge', lambda sql, user, catalog, tables, captures: seen.extend(tables) or {})

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
