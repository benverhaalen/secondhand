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


def test_observation_append_only_order():
    backfill = [
        "ALTER TABLE secondhand.core.observation SET TBLPROPERTIES ('delta.appendOnly' = 'false')",
        "UPDATE secondhand.core.observation SET data = 'example' WHERE data IS NULL",
        "ALTER TABLE secondhand.core.observation SET TBLPROPERTIES ('delta.appendOnly' = 'true')",
        'ALTER TABLE secondhand.core.observation ALTER COLUMN data SET NOT NULL',
    ]
    assert plan({'observation': 'YES'}, ['observation']) == backfill
    fresh = plan({}, ['observation'])
    assert fresh[0].startswith('ALTER TABLE secondhand.core.observation ADD COLUMNS ')
    assert fresh[1:] == backfill


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


GRANT = 'INSERT INTO ' + "secondhand.governance.principal_map (principal, user_id) VALUES (current_user(), '*')"
REVOKE = "DELETE FROM secondhand.governance.principal_map WHERE principal = current_user() AND user_id = '*'"


@pytest.mark.parametrize('failure', [None, 'backfill', 'constraint'])
def test_break_glass_wraps_plan_and_revokes_once(failure):
    calls = []

    def execute(statement):
        calls.append(statement)
        if statement == failure:
            raise RuntimeError('plan failed')

    if failure:
        with pytest.raises(RuntimeError, match='plan failed'):
            run_plan(['backfill', 'constraint'], execute)
    else:
        run_plan(['backfill', 'constraint'], execute)

    assert calls[0] == GRANT
    assert calls.count(REVOKE) == 1
    # Audit writes also bracket the window; access and plan statements end in revoke.
    assert [s for s in calls if 'secondhand.governance.break_glass' not in s] == (
        [GRANT, 'backfill'] + ([] if failure == 'backfill' else ['constraint']) + [REVOKE]
    )
    audit_start = calls[1]
    assert audit_start.startswith('INSERT INTO secondhand.governance.break_glass ')
    assert "current_user(), 'data column backfill (spec/product.md §3)', current_timestamp(), NULL)" in audit_start
    audit_id = audit_start.split("VALUES ('", 1)[1].split("'", 1)[0]
    assert calls[-2] == REVOKE
    assert calls[-1] == (
        'UPDATE secondhand.governance.break_glass SET ended_at = current_timestamp() '
        f"WHERE id = '{audit_id}' AND principal = current_user()"
    )


@pytest.mark.parametrize('fail_at', [0, 1])
def test_grant_or_audit_failure_still_revokes(fail_at):
    calls = []

    def execute(statement):
        calls.append(statement)
        if len(calls) == fail_at + 1:
            raise RuntimeError('opening failed')

    with pytest.raises(RuntimeError, match='opening failed'):
        run_plan(['backfill'], execute)
    assert 'backfill' not in calls
    assert calls.count(REVOKE) == 1


@pytest.mark.parametrize('plan_fails', [False, True])
def test_revoke_failure_raises_and_leaves_audit_open(plan_fails):
    calls = []

    def execute(statement):
        calls.append(statement)
        if statement == REVOKE:
            raise RuntimeError('revoke failed')
        if plan_fails and statement == 'backfill':
            raise RuntimeError('plan failed')

    with pytest.raises(RuntimeError, match='revoke failed'):
        run_plan(['backfill'], execute)
    assert calls[-1] == REVOKE
    assert calls.count(REVOKE) == 1
    assert not any(s.startswith('UPDATE secondhand.governance.break_glass') for s in calls)
