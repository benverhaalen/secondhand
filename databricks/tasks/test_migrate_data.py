from migrate_data import plan


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
