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
    query = query.replace(" RLIKE r'", " RLIKE '")
    query = query.replace('secondhand.core.', '').replace('secondhand.governance.', '').replace(' RLIKE ', ' REGEXP ')
    db = sqlite3.connect(':memory:')
    db.execute('PRAGMA case_sensitive_like = ON')
    db.create_function('regexp', 2, lambda pattern, value: None if value is None else bool(re.search(pattern, value)))
    db.create_function('concat', -1, lambda *xs: ''.join('' if x is None else str(x) for x in xs))
    tables = sorted({table for table in re.findall(r'FROM secondhand.core.(\w+)', sql)})
    fields = ['id', 'state', 'citation_id', 'hide_reason', 'metric', 'basis_level', 'data', 'verdict', 'policy_mode', 'session', 'seq', 'principal', 'user_id', 'ended_at', 'rights_mode', 'site', 'via', 'source_route', 'evidence_id', 'may_model', 'source_url', 'body']
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
        rows.extend(rights_row(target, row) for target, row, _ in RIGHTS_BAD_ROWS if target == table)
        rows.extend(rights_row(target, row) for target, row in RIGHTS_CLEAN_ROWS if target == table)
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
    assert len(rights) == len(records) == 15
    assert set(rights) == {m['source'] for m in manifests} | {'nber_ebay_bo', 'ebay_api', 'dupe', 'ebay', 'ebay:treg', 'mercari', 'poshmark', 'depop', 'facebook:apify'}
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
    literals = re.findall(r"--[^\n]*|('(?:[^']|'')*')", sql)
    assert all(';' not in literal for literal in literals), 'SQL file tasks split even semicolons inside licence strings; preserve them with chr(59)'
    product = sql.split('CREATE OR REPLACE VIEW secondhand.market.comp_for_product', 1)[1].split(';', 1)[0]
    assert "c.may_model = true AND r.may_model AND r.may_model_scope = 'product'" in product
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


@pytest.mark.parametrize('row_right', [None, False, True])
@pytest.mark.parametrize('source_right', [None, False, True])
@pytest.mark.parametrize('scope', [None, 'none', 'hackathon_demo', 'product'])
def test_product_comps_require_row_and_source_product_rights(row_right, source_right, scope):
    sql, _ = rights_rows()
    product = sql.split('CREATE OR REPLACE VIEW secondhand.market.comp_for_product', 1)[1].split(';', 1)[0]
    query = product.split('\nAS\n', 1)[1].replace('secondhand.market.comp', 'comp').replace('secondhand.governance.source_rights', 'source_rights')
    db = sqlite3.connect(':memory:')
    db.execute('CREATE TABLE comp (source, may_model)')
    db.execute('CREATE TABLE source_rights (source, may_model, may_model_scope)')
    db.execute('INSERT INTO comp VALUES (?, ?)', ('fixture', row_right))
    db.execute('INSERT INTO source_rights VALUES (?, ?, ?)', ('fixture', source_right, scope))
    rows = db.execute(query).fetchall()
    db.close()
    assert bool(rows) == (row_right is True and source_right is True and scope == 'product')


RIGHTS_BAD_ROWS = [
    ('observation', {'id': 'obs_private', 'user_id': None, 'rights_mode': 'own_scope'}, 'observation_public_rights'),
    ('observation', {'id': 'obs_null_mode', 'rights_mode': None}, 'observation_public_rights'),
    ('observation', {'id': 'obs_dupe', 'site': 'dupe', 'evidence_id': 'evd_link_dupe'}, 'observation_dupe'),
    ('evidence', {'id': 'evd_dupe', 'data': 'live:dupe'}, 'evidence_dupe'),
    ('observation', {'id': 'obs_ebay', 'site': 'ebay', 'via': 'treg', 'evidence_id': 'evd_ebay', '_evidence_may_model': True}, 'observation_ebay_model'),
    ('evidence', {'id': 'evd_ebay', 'data': 'live:ebay', 'may_model': True}, 'evidence_ebay_model'),
    ('observation', {'id': 'obs_apify', 'site': 'mercari', 'via': 'apify', 'evidence_id': 'evd_apify'}, 'observation_apify_site'),
    ('evidence', {'id': 'evd_apify', '_observation_apify_site': True}, 'evidence_apify_site'),
    ('log_event', {'session': 's_rights', 'seq': 1, 'body': '{"message":"fixture words"}'}, 'log_event_message_text'),
]

RIGHTS_BAD_ROWS += [
    ('log_event', {'session': 's_escaped', 'seq': 1, 'body': r'{"mess\u0061ge":"fixture words"}'}, 'log_event_message_text'),
    ('log_event', {'session': 's_escaped', 'seq': 2, 'body': r'{"\u0074\u0065\u0078\u0074":"fixture words"}'}, 'log_event_message_text'),
    ('evidence', {'id': 'evd_upper_url', 'source_url': 'https://WWW.EBAY.COM/itm/fixture', 'may_model': True}, 'evidence_ebay_model'),
    ('evidence', {'id': 'evd_link_dupe', '_observation_dupe': True}, 'evidence_dupe'),
    ('evidence', {'id': 'evd_url', 'source_url': 'https://www.ebay.com/itm/fixture', 'may_model': True}, 'evidence_ebay_model'),
    ('observation', {'id': 'obs_route', 'source_route': 'com.ebay.search', 'evidence_id': 'evd_route', '_evidence_may_model': True}, 'observation_ebay_model'),
    ('evidence', {'id': 'evd_route', 'may_model': True, '_observation_ebay': True}, 'evidence_ebay_model'),
    ('observation', {'id': 'obs_apify_null', 'site': None, 'via': 'apify'}, 'observation_apify_site'),
    *[('log_event', {'session': 's_nested', 'seq': i, 'body': json.dumps({'result': [{key: 'fixture words'}]})},
       'log_event_message_text') for i, key in enumerate(('text', 'content', 'body', 'prompt', 'text_format', 'messageFormat'))],
]


RIGHTS_CLEAN_ROWS = [
    ('observation', {'id': 'obs_public', 'site': 'ebay', 'via': 'treg', '_evidence_may_model': False}),
    ('observation', {'id': 'obs_facebook', 'site': 'facebook', 'via': 'apify', '_evidence_may_model': True}),
    ('observation', {'id': 'obs_owned', 'user_id': 'usr_fixture', 'rights_mode': 'own_scope'}),
    ('evidence', {'id': 'evd_clean', 'data': 'live:facebook', 'may_model': True}),
    ('evidence', {'id': 'evd_ebay_clean', 'data': 'live:ebay', 'may_model': False}),
    ('log_event', {'session': 's_clean', 'seq': 1, 'body': '{"message_id":"msg_fixture","message_count":2,"text":{"masked":"key"}}'}),
]
RIGHTS_CLEAN_ROWS += [
    ('log_event', {'session': 's_encoded_clean', 'seq': 1, 'body': r'{"message\u0049d":"msg_fixture"}'}),
    ('log_event', {'session': 's_encoded_clean', 'seq': 2, 'body': r'{"message":{"m\u0061sked":"key"}}'}),
    ('log_event', {'session': 's_encoded_clean', 'seq': 3, 'body': r'{"mess\u0061ge\u005fid":"msg_fixture"}'}),
]


def rights_row(table, row):
    return {'data': 'synthetic', **({'rights_mode': 'public'} if table == 'observation' else {}), **row}


@pytest.mark.parametrize('table,row,rule', RIGHTS_BAD_ROWS, ids=[r[2] + '_' + str(i) for i, r in enumerate(RIGHTS_BAD_ROWS)])
def test_each_rights_violation_is_reported_under_its_own_name(table, row, rule):
    row = rights_row(table, row)
    assert guard.check(table, [row]) == [{'table_name': table, 'row_id':
        f"{row['session']}:{row['seq']}" if table == 'log_event' else row['id'], 'rule': rule}]


@pytest.mark.parametrize('table,row', RIGHTS_CLEAN_ROWS)

def test_clean_rights_rows_pass_every_guard(table, row):
    assert guard.check(table, [rights_row(table, row)]) == []


@pytest.mark.parametrize('key', ['text', 'message', 'body', 'content', 'prompt', 'message_text', 'buyerMessage', 'text_format', 'messageFormat'])
def test_message_text_is_caught_in_nested_log_envelope_fields(key):
    row = {'session': 's_text', 'seq': 1, 'body': json.dumps({'result': [{key: 'fixture words'}]})}
    assert guard.check('log_event', [row]) == [
        {'table_name': 'log_event', 'row_id': 's_text:1', 'rule': 'log_event_message_text'}]


def test_live_sources_have_only_nates_demo_model_clearance_and_strict_unknown_rights():
    sql, records = rights_rows()
    rights = {r['source']: r for r in records}
    assert not {'ebay:apify', 'mercari:apify'} & rights.keys()
    for source in ('ebay', 'ebay:treg', 'mercari', 'poshmark', 'depop'):
        row = rights[source]
        assert row['may_store'] and row['may_show']
        assert not row['may_model'] and not row['may_share']
        assert row['may_model_scope'] == 'none'
        if source in ('mercari', 'poshmark', 'depop'):
            assert row['decided_by'] == 'Agent proposal'
            assert 'missing' in row['note'].lower()
    row = rights['facebook:apify']
    assert row['may_model'] and row['may_model_scope'] == 'hackathon_demo'
    assert not row['may_share']
    assert 'Nate' in row['decided_by'] and 'Yes, Apify too' in row['clause']
    # Clearance starts with the registry, so sources with no stored comps still appear.
    query = sql.split('CREATE OR REPLACE VIEW secondhand.measures.model_clearance', 1)[1].split('\nAS\n', 1)[1].split(';', 1)[0]
    query = query.replace('secondhand.governance.source_rights', 'source_rights').replace('secondhand.market.comp', 'comp')
    db = sqlite3.connect(':memory:')
    db.execute('CREATE TABLE source_rights (source, may_model, may_model_scope, clause, clause_url)')
    db.execute('CREATE TABLE comp (row_id, source)')
    db.executemany('INSERT INTO source_rights VALUES (?, ?, ?, ?, ?)',
                   [[r[k] for k in ('source', 'may_model', 'may_model_scope', 'clause', 'clause_url')] for r in records])
    assert {r[0] for r in db.execute(query)} == set(rights)
    db.close()


@pytest.mark.parametrize('old_scope,new_scope', [('none', 'product'), ('hackathon_demo', 'product'),
                                               ('product', 'none'), ('product', 'hackathon_demo')])
def test_rerunning_source_merge_never_loosens_existing_rights(old_scope, new_scope):
    sql, _ = rights_rows()
    assignments = sql.split('WHEN MATCHED THEN UPDATE SET', 1)[1].split('  target.clause =', 1)[0].strip().rstrip(',')
    assignments = re.sub(r'(?m)^\s*target\.(\w+)\s*=', r'\1 =', assignments)
    columns = 'may_store, may_model, may_model_scope, may_show, may_share, ttl_hours'
    db = sqlite3.connect(':memory:')
    db.execute(f'CREATE TABLE source_rights ({columns})')
    db.execute(f'CREATE TABLE seed ({columns})')
    db.execute('INSERT INTO source_rights VALUES (false, false, ?, false, false, 1)', (old_scope,))
    db.execute('INSERT INTO seed VALUES (true, true, ?, true, true, 6)', (new_scope,))
    db.execute('UPDATE source_rights AS target SET ' + assignments + ' FROM seed AS s')
    row = db.execute('SELECT * FROM source_rights').fetchone()
    scopes = ('none', 'hackathon_demo', 'product')
    assert row == (0, 0, min((old_scope, new_scope), key=scopes.index), 0, 0, 1)
    db.close()


@pytest.mark.parametrize('pending', [False, True], ids=['stored_references', 'pending_references'])
@pytest.mark.parametrize('table,site,via,models,rule', [
    ('observation', 'ebay', None, True, 'observation_ebay_model'),
    ('observation', 'ebay', 'treg', True, 'observation_ebay_model'),
    ('observation', 'ebay', 'other', True, 'observation_ebay_model'),
    ('evidence', 'ebay', 'treg', True, 'evidence_ebay_model'),
    ('evidence', 'dupe', None, False, 'evidence_dupe'),
    ('evidence', 'mercari', 'apify', False, 'evidence_apify_site'),
    ('observation', 'ebay', 'treg', False, None),
    ('observation', 'facebook', 'apify', True, None),
    ('evidence', 'facebook', 'apify', True, None),
])
def test_write_door_resolves_rights_from_stored_or_pending_references(pending, table, site, via, models, rule):
    from types import SimpleNamespace

    observation = rights_row('observation', {'id': 'obs_link', 'evidence_id': 'evd_link', 'site': site, 'via': via})
    evidence = {'id': 'evd_link', 'data': 'synthetic', 'may_model': models}
    refusals, reads = [], []

    class Spark:
        def sql(self, query):
            reads.append(query)
            rows = [] if pending else [evidence if '.core.evidence ' in query else observation]
            return SimpleNamespace(collect=lambda: [SimpleNamespace(asDict=lambda row=r: row) for r in rows])

        def createDataFrame(self, rows, schema):
            refusals.extend(rows)
            return SimpleNamespace(write=SimpleNamespace(mode=lambda mode:
                SimpleNamespace(saveAsTable=lambda name: None)))

    row = observation if table == 'observation' else evidence
    before = dict(row)
    kwargs = {'evidence_rows': [evidence], 'observation_rows': [observation]} if pending else {}
    if rule:
        with pytest.raises(guard.GuardRefused) as error:
            guard.guard_batch(Spark(), logger(), 'rights_fixture', 'fixture.core.' + table, [row], **kwargs)
        assert error.value.violations == [{'table_name': table, 'row_id': row['id'], 'rule': rule}]
        assert [r['rule'] for r in refusals] == [rule]
        assert all(set(r) == {'refused_at', 'job', 'table_name', 'row_id', 'rule', 'data'} for r in refusals)
    else:
        guard.guard_batch(Spark(), logger(), 'rights_fixture', 'fixture.core.' + table, [row], **kwargs)
        assert not refusals
    assert row == before, 'reference snapshots must not change the row being written'
    assert all('fixture.core.' in query for query in reads)


@pytest.mark.parametrize('body', [
    {'message_id': 'msg_fixture', 'message_ids': ['msg_fixture'], 'text_count': 2, 'content_hash': 'hash_fixture'},
    {'text': None, 'message': {'masked': 'key'}},
    {'nested': [{'body': {'masked': 'key'}}, {'message_type': 'reply'}]},
    {'text': ''},
    {'messageId': 'msg_fixture', 'textCount': 2, 'contentHash': 'hash_fixture'},
])
def test_log_ids_counts_null_and_masked_text_are_allowed(body):
    assert guard.check('log_event', [{'session': 's_clean', 'seq': 1, 'body': json.dumps(body)}]) == []
