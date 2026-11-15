"""Door, nightly net and source clearance contracts, without a workspace."""
import json
import re
import sqlite3
from pathlib import Path

import pytest

import guard
from secondhand_log import create_log, memory_sink

ROOT = Path(__file__).resolve().parents[1]


def logger():
    return create_log(src='job.guard_test', build='fixture', sink=memory_sink(), session='s_guard')


def number(**fields):
    return {'id': 'gn_fixture', 'state': 'shown', 'citation_id': 'cit_fixture',
            '_citation_exists': True, 'metric': 'valuation.product.q50', 'basis_level': 'product',
            'data': 'synthetic', **fields}


def test_rule_names_cannot_drift_between_door_net_and_status():
    sql = (ROOT / 'databricks/sql/09_guard.sql').read_text()
    names = re.findall(r"'([^']+)' AS rule", sql)
    assert len(names) == len(set(names)), 'nightly net repeats a rule'
    assert set(names) == set(guard.RULES), 'door and nightly net have different rules'
    status = sql.split('CREATE OR REPLACE VIEW secondhand.measures.guard_status', 1)[1]
    assert set(re.findall(r"'([^']+)'", re.search(r'array\((.*?)\) AS rules', status, re.S)[1])) == set(guard.RULES)
    for column in ('violations_now', 'refusals_last_7_days', 'last_checked_at'):
        assert column in status
    assert 'checked_at AS last_checked_at' in status
    assert 'secondhand.measures.guard_snapshot' in status
    assert 'guard_violations' not in status
    assert 'INTERVAL 7 DAYS' in status
    assert 'assert_true' not in sql, 'only the Python task may assert after revocation'


@pytest.mark.parametrize('level', [None, '', 'invented', 'Product', 'product '])
def test_unknown_or_missing_valuation_basis_is_refused(level):
    assert guard.check('secondhand.core.guarded_number', [number(basis_level=level)]) == [
        {'table_name': 'guarded_number', 'row_id': 'gn_fixture', 'rule': 'guarded_number_basis_level'}]


@pytest.mark.parametrize('level', ['variant', 'product', 'family', 'kind', 'prior'])
def test_canonical_basis_levels_pass_and_legacy_nonvaluation_rows_stay_nullable(level):
    assert guard.check('guarded_number', [number(basis_level=level)]) == []
    assert guard.check('guarded_number', [number(metric='score.fixture', basis_level=None)]) == []


def test_refusal_reports_every_bad_row_and_never_mutates_the_batch():
    rows = [number(), number(id='bad', state='hidden', citation_id=None, hide_reason=None,
                             basis_level='unknown', data='unlabelled')]
    before = json.dumps(rows, sort_keys=True)
    with pytest.raises(guard.GuardRefused) as refused:
        guard.refuse_or_pass('guarded_number', rows, logger())
    assert {r['rule'] for r in refused.value.violations} == {
        'guarded_number_hidden_reason', 'guarded_number_basis_level', 'guarded_number_data'}
    assert {r['row_id'] for r in refused.value.violations} == {'bad'}
    assert json.dumps(rows, sort_keys=True) == before
    guard.refuse_or_pass('guarded_number', [number()], logger())


@pytest.mark.parametrize('terminator', ['\n', '\r', '\r\n', '\u0085', '\u2028', '\u2029'])
def test_provenance_matches_spark_java_regex_line_terminators(terminator):
    for prefix in ('live:', 'dataset:'):
        broken = {'id': 'fixture', 'data': prefix + 'before' + terminator + 'after'}
        assert guard.check('evidence', [broken]) == [
            {'table_name': 'evidence', 'row_id': 'fixture', 'rule': 'evidence_data'}]
    for data in ('synthetic', 'example', 'captured', 'live:fixture', 'dataset:fixture'):
        # Java's $ can end immediately before a final line terminator.
        assert guard.check('evidence', [{'id': 'fixture', 'data': data + terminator}]) == []


def test_python_predicates_match_the_sql_net_including_nulls_and_citation_references():
    sql = (ROOT / 'databricks/sql/09_guard.sql').read_text()
    query = sql.split('\nAS\n', 1)[1].split(';', 1)[0]
    query = query.replace('secondhand.core.', '').replace('secondhand.governance.', '').replace(' RLIKE ', ' REGEXP ')
    db = sqlite3.connect(':memory:')
    db.execute('PRAGMA case_sensitive_like = ON')
    db.create_function('regexp', 2, lambda pattern, value: None if value is None else bool(re.search(pattern, value)))
    db.create_function('concat', -1, lambda *xs: ''.join('' if x is None else str(x) for x in xs))
    tables = sorted({table for table in re.findall(r'FROM secondhand.core.(\w+)', sql)})
    fields = ['id', 'state', 'citation_id', 'hide_reason', 'metric', 'basis_level', 'data', 'verdict', 'policy_mode', 'session', 'seq', 'principal', 'user_id', 'ended_at']
    all_rows = {}
    for table in tables:
        db.execute(f'CREATE TABLE {table} ({", ".join(fields)})')
        rows = []
        for i, data in enumerate(['synthetic', 'example', 'captured', 'dataset:fixture', 'live:fixture', '', 'dataset:', 'other', None]):
            rows.append(number(id=f'{table}_{i}', data=data, verdict='pass', policy_mode='ask', session=f's_{i}', seq=i))
        if table == 'guarded_number':
            for i, changes in enumerate([
                {'state': 'other'}, {'state': None}, {'citation_id': None},
                {'_citation_exists': False, 'citation_id': 'missing'},
                {'state': 'hidden', 'hide_reason': None}, {'state': 'not_found'},
                {'basis_level': None}, {'basis_level': 'unknown'}, {'basis_level': 'family'},
                {'metric': 'score.fixture', 'basis_level': None},
                {'metric': 'valuation.', 'basis_level': 'unknown'},
            ]):
                rows.append(number(id=f'case_{i}', **changes))
        if table in ('claim_check', 'decision'):
            key = 'verdict' if table == 'claim_check' else 'policy_mode'
            for i, value in enumerate(['unknown', None, 'pass', 'hold', 'abstain', 'contradicted', 'auto', 'ask', 'locked', 'never']):
                rows.append({'id': f'enum_{i}', key: value, 'data': 'example'})
        if table == 'citation':
            rows.append({'id': 'cit_fixture', 'data': 'example'})
        all_rows[table] = rows
        db.executemany(f'INSERT INTO {table} VALUES ({", ".join("?" for _ in fields)})',
                       [[row.get(k) for k in fields] for row in rows])
    db.execute('CREATE TABLE principal_map (principal, user_id)')
    db.execute('CREATE TABLE break_glass (principal, ended_at)')
    db.executemany('INSERT INTO principal_map VALUES (?, ?)', [('rogue', '*'), ('audited', '*'), ('closed', '*'), ('owner', 'usr_fixture')])
    db.executemany('INSERT INTO break_glass VALUES (?, ?)', [('audited', None), ('closed', '2026-11-15')])
    all_rows['principal_map'] = [
        {'principal': 'rogue', 'user_id': '*', '_break_glass_open': False},
        {'principal': 'audited', 'user_id': '*', '_break_glass_open': True},
        {'principal': 'closed', 'user_id': '*', '_break_glass_open': False},
        {'principal': 'owner', 'user_id': 'usr_fixture', '_break_glass_open': False},
    ]
    expected = sorted(db.execute(query).fetchall(), key=str)
    actual = sorted([(v['table_name'], v['row_id'], v['rule'], row.get('data'))
                     for table, rows in all_rows.items() for row in rows
                     for v in guard.check(table, [row])], key=str)
    assert actual == expected, 'Python door and SQL nightly net disagree on the same rows'
    db.close()


def rights_rows():
    sql = (ROOT / 'databricks/sql/11_sources.sql').read_text()
    values, aliases = re.search(r'USING \(\s*SELECT \* FROM VALUES\s*(.*?)\n\s*AS rights\((.*?)\)\s*\)', sql, re.S).groups()
    db = sqlite3.connect(':memory:')
    db.create_function('concat', -1, lambda *xs: ''.join(xs))
    db.create_function('chr', 1, chr)
    records = db.execute('VALUES ' + values).fetchall()
    db.close()
    columns = [c.strip() for c in aliases.split(',')]
    return sql, [dict(zip(columns, row)) for row in records]


def test_every_source_has_explicit_demo_and_product_clearance_with_the_original_terms():
    sql, records = rights_rows()
    rights = {r['source']: r for r in records}
    manifests = [json.loads(p.read_text()) for p in (ROOT / 'jobs/valuation/data/manifests').glob('*.json')]
    assert len(rights) == len(records) == 9
    assert set(rights) == {m['source'] for m in manifests} | {'nber_ebay_bo', 'ebay_api', 'dupe'}
    for manifest in manifests:
        row = rights[manifest['source']]
        assert bool(row['may_model']) == manifest['may_model']
        assert manifest['licence'] in row['clause'], 'keep the frozen licence, including its limits'
        assert row['may_model_scope'] == ('hackathon_demo' if row['may_model'] else 'none')
    assert 'only for the purposes of the Competition' in rights['mercari_kaggle']['clause']
    assert rights['mercari_kaggle']['decided_by'] == 'Ben, product/words.md 2026-11-15 09:09 UTC'
    assert 'served model' in rights['stockx_2019']['note']
    stockx = json.loads((ROOT / 'jobs/valuation/data/sources.json').read_text())['stockx_2019']['mirror']
    assert rights['stockx_2019']['clause_url'] == f"{stockx['repo']}/blob/{stockx['commit']}/{stockx['path']}"
    assert rights['nber_ebay_bo']['may_model_scope'] == 'hackathon_demo'
    assert 'Backus, Blake, Larsen and Tadelis (2020)' in rights['nber_ebay_bo']['clause']
    assert rights['ebay_api']['may_model'] == 0 and rights['ebay_api']['ttl_hours'] == 6
    assert 'to suggest or model prices for items listed on eBay Site' in rights['ebay_api']['clause']
    assert rights['dupe']['may_store'] == 0 and rights['dupe']['ttl_hours'] == 0
    assert rights['dupe']['note'] == 'not stored past the request'
    assert 'WHEN MATCHED THEN UPDATE SET' in sql and 'WHEN NOT MATCHED THEN INSERT' in sql
    assert len(sql.split(';')) == 5, 'SQL file tasks split even semicolons inside licence strings; preserve them with chr(59)'
    product = sql.split('CREATE OR REPLACE VIEW secondhand.market.comp_for_product', 1)[1].split(';', 1)[0]
    assert "r.may_model AND r.may_model_scope = 'product'" in product
    assert 'secondhand.governance.source_rights' in product
    clearance = sql.split('CREATE OR REPLACE VIEW secondhand.measures.model_clearance', 1)[1]
    assert 'LEFT JOIN' in clearance and 'count(c.row_id)' in clearance
    for column in ('rows', 'cleared_for_demo_backtest', 'cleared_for_shipped_model', 'clause', 'clause_url'):
        assert column in clearance


def test_alert_only_fires_above_zero_and_runs_hourly():
    sql = (ROOT / 'deploy/resources/alerts.yml').read_text()
    assert 'guard_violations_alert:' in sql
    assert 'query_text: SELECT violations_now FROM secondhand.measures.guard_status' in sql
    operator = re.search(r'comparison_operator: (\w+)', sql)[1]
    assert operator == 'GREATER_THAN'
    threshold = float(re.search(r'double_value: (\d+(?:\.\d+)?)', sql)[1])
    assert not 0 > threshold and 1 > threshold, 'an empty guard must not trigger an alert'
    assert 'quartz_cron_schedule: "0 0 * * * ?"' in sql
    for field in ('timezone_id: America/Chicago', 'pause_status: UNPAUSED', 'warehouse_id: ${var.warehouse_id}',
                  'name: violations_now', 'aggregation: SUM', 'empty_result_state: OK'):
        assert field in sql
    assert re.search(r'custom_summary: .*secondhand.measures.guard_violations', sql)


def test_sources_setup_precedes_guard():
    sql = (ROOT / 'deploy/resources/governance.yml').read_text()
    sources = sql.split('- task_key: sources', 1)[1].split('- task_key:', 1)[0]
    assert '../../databricks/sql/11_sources.sql' in sources
    assert 'task_key: constraints' in sources
    guard_task = sql.split('- task_key: guard', 1)[1]
    assert 'task_key: sources' in guard_task


def test_platform_findings_keep_the_exact_errors_and_record_the_workarounds():
    section = (ROOT / 'spec/databricks-build.md').read_text().split('## 11. Platform findings, 2026-11-15', 1)[1]
    for error in (
        '[ROW_LEVEL_SECURITY_CHECK_CONSTRAINT_UNSUPPORTED] Creating CHECK constraint on table `secondhand`.`core`.`guarded_number` with row level security policies is not supported.',
        '[DELTA_NEW_NOT_NULL_VIOLATION] 53 rows in secondhand.core.observation violate the new NOT NULL constraint on data',
        "[METRIC_VIEW_INVALID_VIEW_DEFINITION] … Missing required creator property 'expr'",
    ):
        assert error in section
    for fact in ('Design (b)', '76 s', 'governance.break_glass', 'Statements API', '__file__', '--root', 'semicolons'):
        assert fact in section
