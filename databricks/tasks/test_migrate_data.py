import pytest

from migrate_data import plan, run_plan


def test_fresh_table():
    statements = plan({}, ['evidence'])
    assert len(statements) == 3
    assert statements[0].startswith('ALTER TABLE secondhand.core.evidence ADD COLUMNS (data STRING COMMENT ')
    assert statements[1:] == [
        "UPDATE secondhand.core.evidence SET data = 'example' WHERE data IS NULL",
        'ALTER TABLE secondhand.core.evidence ALTER COLUMN data SET NOT NULL',
    ]


def test_not_null_column_needs_no_statements():
    assert plan({'evidence': 'NO', 'observation': 'NO'}, ['evidence', 'observation']) == []


def test_nullable_column_needs_only_backfill_and_constraint():
    assert plan({'evidence': 'YES'}, ['evidence']) == [
        "UPDATE secondhand.core.evidence SET data = 'example' WHERE data IS NULL",
        'ALTER TABLE secondhand.core.evidence ALTER COLUMN data SET NOT NULL',
    ]


def test_observation_property_is_restored_at_execution_not_hardcoded_in_plan():
    assert plan({'observation': 'YES'}, ['observation']) == [
        "UPDATE secondhand.core.observation SET data = 'example' WHERE data IS NULL",
        'ALTER TABLE secondhand.core.observation ALTER COLUMN data SET NOT NULL',
    ]


def test_plan_preserves_requested_table_order():
    assert plan({'citation': 'NO'}, ['job', 'citation', 'evidence']) == (
        plan({}, ['job']) + plan({}, ['evidence'])
    )


def test_basis_level_is_added_even_when_data_is_already_migrated_without_backfill_or_check():
    statements = plan({'guarded_number': 'NO'}, ['guarded_number'], basis_level_exists=False)
    assert len(statements) == 1
    assert statements[0].startswith('ALTER TABLE secondhand.core.guarded_number ADD COLUMNS (basis_level STRING COMMENT ')
    assert 'NOT NULL' not in statements[0] and 'CHECK' not in statements[0]
    assert plan({'guarded_number': 'NO'}, ['guarded_number'], basis_level_exists=True) == []


def test_basis_level_and_data_migrate_together_and_do_not_touch_other_tables():
    statements = plan({}, ['guarded_number'], basis_level_exists=False)
    assert len(statements) == 4
    assert 'basis_level STRING' in statements[-1]
    assert not any('UPDATE' in s and 'basis_level' in s for s in statements), 'legacy rows must stay nullable'
    assert len(plan({}, ['evidence'], basis_level_exists=False)) == 3


def test_fresh_guarded_number_schema_declares_nullable_basis_without_check():
    from pathlib import Path
    sql = (Path(__file__).resolve().parents[2] / 'databricks/sql/01_tables.sql').read_text()
    body = sql.split('CREATE TABLE IF NOT EXISTS secondhand.core.guarded_number (', 1)[1].split(') COMMENT', 1)[0]
    assert 'basis_level STRING COMMENT' in body
    assert 'basis_level STRING NOT NULL' not in body and 'CHECK' not in body


GRANT = "INSERT INTO `secondhand`.`governance`.`principal_map` (principal, user_id) VALUES (current_user(), '*')"
REVOKE = "DELETE FROM `secondhand`.`governance`.`principal_map` WHERE principal = current_user() AND user_id = '*'"


@pytest.mark.parametrize('failure', [None, 'backfill', 'constraint'])
def test_break_glass_wraps_plan_and_revokes_once(failure):
    calls = []

    def execute(statement, args):
        calls.append((statement, args))
        if statement == failure:
            raise RuntimeError('plan failed')

    if failure:
        with pytest.raises(RuntimeError, match='plan failed'):
            run_plan(['backfill', 'constraint'], execute)
    else:
        run_plan(['backfill', 'constraint'], execute)
    statements = [s for s, _ in calls]
    assert statements.count(REVOKE) == 1
    assert [s for s in statements if '`break_glass`' not in s] == (
        [GRANT, 'backfill'] + ([] if failure == 'backfill' else ['constraint']) + [REVOKE])
    assert statements[0].startswith('INSERT INTO `secondhand`.`governance`.`break_glass` ')
    assert calls[0][1]['reason'] == 'data column backfill (spec/product.md §3)'
    assert calls[0][1]['id'] == calls[-1][1]['id']
    assert statements[-2] == REVOKE
    assert statements[-1].startswith('UPDATE `secondhand`.`governance`.`break_glass` SET ended_at = current_timestamp()')


@pytest.mark.parametrize('fail_at', [0, 1])
def test_grant_or_audit_failure_still_revokes_without_running_the_plan(fail_at):
    calls = []

    def execute(statement, args):
        calls.append(statement)
        if len(calls) == fail_at + 1:
            raise RuntimeError('opening failed')

    with pytest.raises(RuntimeError, match='opening failed'):
        run_plan(['backfill'], execute)
    assert 'backfill' not in calls
    assert calls.count(REVOKE) == 1
    if fail_at == 0:
        assert GRANT not in calls


@pytest.mark.parametrize('plan_fails', [False, True])
def test_revoke_failure_raises_and_leaves_audit_open(plan_fails):
    calls = []

    def execute(statement, args):
        calls.append(statement)
        if statement == REVOKE:
            raise RuntimeError('revoke failed')
        if plan_fails and statement == 'backfill':
            raise RuntimeError('plan failed')

    with pytest.raises(RuntimeError, match='revoke failed'):
        run_plan(['backfill'], execute)
    assert calls[-1] == REVOKE
    assert calls.count(REVOKE) == 1
    assert not any(s.startswith('UPDATE `secondhand`.`governance`.`break_glass`') for s in calls)


def test_empty_plan_never_opens_access():
    calls = []
    run_plan([], lambda statement, args: calls.append(statement))
    assert calls == []


@pytest.mark.parametrize('prior', ['true', 'false', None])
@pytest.mark.parametrize('fails', [False, True])
def test_observation_restores_original_append_only_even_if_update_fails(prior, fails):
    calls = []
    update = "UPDATE secondhand.core.observation SET data = 'example' WHERE data IS NULL"

    def execute(statement, args):
        calls.append(statement)
        if statement.startswith('SHOW TBLPROPERTIES'):
            return [] if prior is None else [{'key': 'delta.appendOnly', 'value': prior}]
        if statement == update and fails:
            raise RuntimeError('backfill failed')
        return []

    if fails:
        with pytest.raises(RuntimeError, match='backfill failed'):
            run_plan([update], execute)
    else:
        run_plan([update], execute)
    restore = (f"ALTER TABLE secondhand.core.observation SET TBLPROPERTIES ('delta.appendOnly' = '{prior}')"
               if prior is not None else "ALTER TABLE secondhand.core.observation UNSET TBLPROPERTIES ('delta.appendOnly')")
    i = calls.index(update)
    assert calls[i-2:i] == ['SHOW TBLPROPERTIES secondhand.core.observation',
                           "ALTER TABLE secondhand.core.observation SET TBLPROPERTIES ('delta.appendOnly' = 'false')"]
    assert calls[i+1] == restore
    assert calls[i+2] == REVOKE


def test_guard_setup_plan_adds_reason_closed_once_and_keeps_the_ddl_in_09():
    from pathlib import Path
    from migrate_data import guard_setup_plan
    sql = (Path(__file__).resolve().parents[2] / 'databricks/sql/09_guard.sql').read_text()
    first = guard_setup_plan(sql, reason_closed_exists=False)
    again = guard_setup_plan(sql, reason_closed_exists=True)
    alter = [s for s in first if s.startswith('ALTER TABLE secondhand.governance.break_glass ADD COLUMNS')]
    assert len(alter) == 1
    assert 'reason_closed STRING' in alter[0]
    assert again == [s for s in first if s != alter[0]]
