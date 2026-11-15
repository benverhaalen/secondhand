import copy
import hashlib
import io
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

from tasks import load_observations as loader
from test_guard import rights_rows

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / 'spec/fixtures/observations/landing.jsonl'
# The frozen SV7 example predates the provider and official-retail rights corrections.
LINES = FIXTURE.read_text().splitlines()
first = json.loads(LINES[0])
first.update(site='facebook', data='live:facebook', source_route='com.facebook.apify.search')
LINES[0] = json.dumps(first)
retail = json.loads(LINES[1])
retail.update(may_model=False, use_scope='none')
LINES[1] = json.dumps(retail)
TEST_RIGHTS = sorted(rights_rows()[1], key=lambda row: row['source'] != 'facebook:apify')
BASE = json.loads(LINES[0])


def parse(lines, **kwargs):
    return loader.parse(lines, source_rights=TEST_RIGHTS, **kwargs)


def parsed(row):
    return parse([json.dumps(row)])


def test_fixture_keeps_rights_prices_and_shared_owners_with_count_by_scope():
    before = datetime.now(timezone.utc)
    observations, evidence, rejects = parse(LINES)
    after = datetime.now(timezone.utc)
    assert len(observations) == len(evidence) == 2
    assert [r['line'] for r in rejects] == [3, 4, 5]
    for reject, reason in zip(rejects, ('dupe', 'user_id', 'use_scope')):
        assert reason in reject['reason']
    assert Counter(r['use_scope'] for r in observations) == {'hackathon_demo': 1, 'none': 1}
    for row in observations + evidence:
        assert row['user_id'] is None
        assert row['version'] == 1
        assert before <= row['created_at'] == row['updated_at'] <= after
        assert row['data'].startswith('live:')
    observation, source = observations[0], evidence[0]
    assert observation['evidence_id'] == source['id'] == 'evd_' + hashlib.sha256(
        (BASE['evidence']['fingerprint'] + BASE['evidence']['source_url']).encode()).hexdigest()[:16]
    for key in ('kind', 'site', 'product_id', 'subject_ref', 'source_route', 'retention_class',
                'rights_mode', 'channel', 'query', 'via', 'job_id', 'use_scope'):
        assert observation[key] == BASE[key]
    assert observation['seller_handle'] is None
    assert observation['observed_at'] == datetime(2026, 11, 15, 12, tzinfo=timezone.utc)
    assert observation['keep_until'] == datetime(2026, 11, 22, 12, tzinfo=timezone.utc)
    assert json.loads(observation['payload']) == BASE['payload']
    for key, value in BASE['payload'].items():
        assert observation[key] == value
    assert source['shape'] == 'comp' and source['snapshot_ref'] is None
    assert source['kind'] is None and source['ref'] is None
    assert source['ttl_days'] == 7 and source['use_scope'] == 'hackathon_demo'
    for key in ('source_url', 'fingerprint', 'extractor_version'):
        assert source[key] == BASE['evidence'][key]
    for key in loader.RIGHTS:
        assert source[key] is BASE[key]
    assert source['read_at'] == observation['observed_at']
    assert observations[1]['keep_until'] is None and evidence[1]['ttl_days'] is None


@pytest.mark.parametrize('line,reason', [
    ('not json', 'JSON'), ('[]', 'object'), ('null', 'object'), ('', 'JSON'),
    (b'\xff', 'UTF'),
    *[(json.dumps({**BASE, key: value}), reason) for key, value, reason in [
        ('v', 2, 'v'), ('v', True, 'v'), ('site', 'dupe', 'dupe'),
        ('may_store', False, 'may_store'), ('use_scope', 'unknown', 'use_scope'),
        ('data', 'example', 'data'), ('data', 'live:other', 'data'),
        ('id', 'obs_short', 'id'), ('id', 'obs_' + 'g' * 16, 'id'),
        ('observed_at', 'not a date', 'observed_at'), ('observed_at', '2026-02-30', 'observed_at'),
        ('kind', 'rank', 'kind'), ('channel', 'unknown', 'channel'),
        ('keep_until', 'tomorrow', 'keep_until'), ('landed_at', None, 'landed_at'),
        ('payload', [], 'payload'), ('evidence', {}, 'evidence'),
        ('site', None, 'site'), ('job_id', '', 'job_id'),
    ]],
    *[(json.dumps({k: v for k, v in BASE.items() if k != key}), key)
      for key in ('use_scope', 'v', 'observed_at', *('may_store', 'may_model', 'may_show', 'may_share'))],
    *[(json.dumps({**BASE, key: 1}), key) for key in ('may_store', 'may_model', 'may_show', 'may_share')],
])
def test_bad_lines_reject_once_with_a_cause(line, reason):
    observations, evidence, rejects = parse([line])
    assert observations == evidence == []
    assert len(rejects) == 1 and rejects[0]['line'] == 1
    assert reason in rejects[0]['reason']


@pytest.mark.parametrize('key', ['user_id', 'user', 'session'])
@pytest.mark.parametrize('location', ['root', 'payload', 'array', 'evidence'])
def test_caller_keys_are_refused_at_every_depth(key, location):
    row = copy.deepcopy(BASE)
    if location == 'root':
        row[key] = None
    elif location == 'array':
        row['payload']['nested'] = [{'deeper': {key: None}}]
    else:
        row[location][key] = None
    result = parsed(row)
    assert result.observations == result.evidence == []
    assert len(result.rejects) == 1 and key in result.rejects[0]['reason']


@pytest.mark.parametrize('ttl,days', [('0', 0), ('14', 14), ('1 day', 1), ('2 days', 2),
                                    ('30d', 30), ('P7D', 7), ('24h', None), ('1.5d', None),
                                    ('10m', None), ('forever', None), ('-1d', None),
                                    (None, None), ('99999999999d', None)])
def test_ttl_only_converts_whole_days(ttl, days):
    assert parsed({**BASE, 'ttl': ttl}).evidence[0]['ttl_days'] == days


@pytest.mark.parametrize('payload,reason', [({'price_cents': 1.5}, 'price_cents'),
                                          ({'price_cents': True}, 'price_cents'),
                                          ({'price_cents': 2**63}, 'price_cents'),
                                          ({'currency': 10}, 'currency'),
                                          ({'price_type': 'retail'}, 'price_type'),
                                          ({'value': float('nan')}, 'JSON')])
def test_bad_payload_values_are_counted_instead_of_failing_spark(payload, reason):
    result = parsed({**BASE, 'payload': payload})
    assert not result.observations and reason in result.rejects[0]['reason']


def test_absent_prices_remain_unknown_and_handles_are_never_lifted():
    row = parsed({**BASE, 'payload': {'seller_handle': 'fixture-handle'}}).observations[0]
    assert all(row[key] is None for key in ('price_cents', 'currency', 'price_type', 'seller_handle'))


def test_duplicate_json_keys_cannot_hide_caller_identity():
    line = LINES[0][:-1] + ',"payload":{"session":null},"payload":{}}'
    assert 'duplicate' in parse([line]).rejects[0]['reason']


def test_duplicate_ids_refuse_observation_but_shared_evidence_merges_once():
    row = {**BASE, 'id': 'obs_1111111111111111'}
    result = parse([LINES[0], LINES[0], json.dumps(row)])
    assert len(result.observations) == 2 and len(result.evidence) == 1
    assert len(result.rejects) == 1 and 'duplicate id' in result.rejects[0]['reason']


def test_one_bad_line_does_not_stop_the_following_public_read():
    result = parse(['invalid JSON', LINES[0], json.dumps({**BASE, 'may_store': False}), LINES[1]])
    assert len(result.observations) == len(result.evidence) == 2
    assert [row['line'] for row in result.rejects] == [1, 3]


@pytest.mark.parametrize('change', [{'use_scope': 'product'}, {'may_model': True},
                                  {'may_show': False}, {'may_share': True}, {'ttl': '1d'}])
def test_same_evidence_cannot_replace_per_row_rights(change):
    other = {**BASE, 'id': 'obs_1111111111111111', **change}
    policy = {**TEST_RIGHTS[0], 'may_model_scope': 'product', 'may_share': True}
    result = loader.parse([LINES[0], json.dumps(other)], source_rights=[policy])
    assert len(result.observations) == len(result.evidence) == 1
    assert result.rejects == [{'line': 2, 'reason': 'evidence rights conflict'}]
    assert result.evidence[0]['may_model'] is False


def test_migration_plan_adds_only_missing_columns_and_only_drops_required_owner():
    for table in ('observation', 'evidence'):
        additions = loader.NEW_COLUMNS[table]
        existing = ['user_id', next(iter(additions))]
        plan = loader.alter_plan('secondhand.core.' + table, existing, user_nullable=False)
        expected = [f'{name} {definition}' for name, definition in additions.items() if name not in existing]
        assert plan == ([f'ALTER TABLE secondhand.core.{table} ADD COLUMNS ({", ".join(expected)})'] if expected else []) + [
            f'ALTER TABLE secondhand.core.{table} ALTER COLUMN user_id DROP NOT NULL']
        assert loader.alter_plan('secondhand.core.' + table, list(additions), user_nullable=True) == []


class FakeSpark:
    def __init__(self):
        self.statements, self.views, self.reports, self.events = [], {}, {}, []
        self.columns = {name: ['user_id'] for name in ('observation', 'evidence')}
        self.nullable = {name: False for name in self.columns}
        self.source_rights = copy.deepcopy(TEST_RIGHTS)
        self.report_exists = False
        self.catalog = SimpleNamespace(tableExists=lambda table: self.report_exists)
        self.fail_table = None
        self.rows = {'observation': {}, 'evidence': {}}

    def table(self, table):
        name = table.rsplit('.', 1)[-1]
        fields = [SimpleNamespace(name=key, nullable=self.nullable[name] if key == 'user_id' else True)
                  for key in self.columns[name]]
        return SimpleNamespace(columns=self.columns[name], schema=SimpleNamespace(fields=fields))

    def sql(self, statement):
        self.statements.append(statement)
        self.events.append(('sql', statement))
        if 'FROM demo.governance.source_rights' in statement:
            return SimpleNamespace(collect=lambda: self.source_rights)
        if statement.startswith('SELECT file FROM '):
            return SimpleNamespace(collect=lambda: [{'file': file} for file in self.reports])
        if statement.startswith('SELECT * FROM demo.core.evidence WHERE id IN '):
            ids = re.findall(r"'(evd_[0-9a-f]{16})'", statement)
            return SimpleNamespace(collect=lambda: [SimpleNamespace(asDict=lambda row=row: row)
                                                    for key, row in self.rows['evidence'].items() if key in ids])
        if statement.startswith('ALTER TABLE '):
            table = statement.split()[2].rsplit('.', 1)[-1]
            if 'ADD COLUMNS' in statement:
                self.columns[table].extend(re.findall(r'(\w+) (?:STRING|TIMESTAMP)', statement.split('ADD COLUMNS (')[1]))
            else:
                self.nullable[table] = True
        if statement.startswith('CREATE TABLE'):
            self.report_exists = True
        if statement.startswith('MERGE INTO '):
            target = statement.split()[2]
            if target.endswith(self.fail_table or 'no-failure'):
                raise RuntimeError('injected merge failure')
            view = statement.split(' USING ')[1].split()[0]
            if target.endswith('observation_load_report'):
                for row in self.views[view][0]:
                    self.reports[row['file']] = row
            elif '.core.' in target:
                for row in self.views[view][0]:
                    self.rows[target.rsplit('.', 1)[-1]].setdefault(row['id'], row)
        return SimpleNamespace(collect=lambda: [])

    def createDataFrame(self, rows, schema):
        self.events.append(('frame', len(rows)))
        keys = {part.split()[0] for part in schema.split(', ')}
        assert all(set(row) == keys for row in rows), 'row keys must match explicit Spark schema'
        return SimpleNamespace(createOrReplaceTempView=lambda name: self.views.update({name: (rows, schema)}))


@pytest.fixture
def runtime(monkeypatch):
    import guard
    spark = FakeSpark()
    folder = '/Volumes/demo/raw/landing/observations'
    path = folder + '/2026-11-15/search_demo.jsonl'
    downloads = []
    entries = {
        folder: [SimpleNamespace(path=folder + '/2026-11-15', is_directory=True)],
        folder + '/2026-11-15': [SimpleNamespace(path=path, is_directory=False),
                                SimpleNamespace(path=path + '.tmp', is_directory=False)],
    }

    def download(file):
        downloads.append(file)
        return SimpleNamespace(contents=io.BytesIO(('\n'.join(LINES) + '\n').encode()))

    files = SimpleNamespace(list_directory_contents=lambda path: entries[path], download=download)
    sql = ModuleType('pyspark.sql')
    sql.SparkSession = SimpleNamespace(getActiveSession=lambda: spark)
    sdk = ModuleType('databricks.sdk')
    sdk.WorkspaceClient = lambda: SimpleNamespace(files=files)
    monkeypatch.setitem(sys.modules, 'pyspark', ModuleType('pyspark'))
    monkeypatch.setitem(sys.modules, 'pyspark.sql', sql)
    monkeypatch.setitem(sys.modules, 'databricks.sdk', sdk)
    monkeypatch.setattr(sys, 'argv', ['load_observations', '--root', str(ROOT), '--catalog', 'demo'])
    original_guard = guard.guard_batch

    def guarded(spark, log, job, table, rows, **kwargs):
        spark.events.append(('guard', table.rsplit('.', 1)[-1]))
        original_guard(spark, log, job, table, rows, **kwargs)

    monkeypatch.setattr(guard, 'guard_batch', guarded)
    return SimpleNamespace(spark=spark, path=path, downloads=downloads, files=files, entries=entries)


def test_main_reports_rejections_guards_both_tables_before_writes_and_skips_rerun(runtime, capsys):
    assert loader.main() == {'files': 1}
    spark = runtime.spark
    first_write = next(i for i, event in enumerate(spark.events)
                       if event[0] == 'frame' or event[0] == 'sql' and not event[1].startswith('SELECT '))
    assert ('guard', 'observation') in spark.events[:first_write]
    assert ('guard', 'evidence') in spark.events[:first_write]
    merges = [s for s in spark.statements if s.startswith('MERGE INTO demo.core.')]
    assert len(merges) == 2
    for merge in merges:
        assert 'ON t.id = s.id' in merge and 'WHEN NOT MATCHED THEN INSERT' in merge
        assert not re.search(r'\b(UPDATE|DELETE)\b', merge, re.I)
    report = spark.reports[runtime.path]
    assert (report['lines'], report['loaded'], report['rejected']) == (5, 2, 3)
    assert sum(json.loads(report['reasons']).values()) == 3
    assert all(spark.nullable.values())
    spark.statements.clear()
    assert loader.main() == {'files': 0}
    assert runtime.downloads == [runtime.path]
    assert len(spark.rows['observation']) == len(spark.rows['evidence']) == 2
    assert not any(s.startswith(('MERGE', 'ALTER', 'CREATE')) for s in spark.statements)
    logs = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert any(line['event'] == 'job.state' for line in logs)


def test_guard_failure_prevents_all_loader_writes(runtime, monkeypatch):
    import guard

    def refuse(spark, log, job, table, rows, **kwargs):
        if table.endswith('evidence'):
            raise guard.GuardRefused([{'rule': 'evidence_test', 'table_name': 'evidence', 'row_id': rows[0]['id']}])

    monkeypatch.setattr(guard, 'guard_batch', refuse)
    with pytest.raises(guard.GuardRefused, match='evidence_test'):
        loader.main()
    assert runtime.spark.views == {} and runtime.spark.reports == {}
    assert not any(s.startswith(('MERGE', 'ALTER', 'CREATE')) for s in runtime.spark.statements)


def test_partial_failure_never_marks_file_loaded_and_retry_is_insert_only(runtime):
    runtime.spark.fail_table = 'observation'
    with pytest.raises(RuntimeError, match='injected merge failure'):
        loader.main()
    assert not runtime.spark.reports
    runtime.spark.fail_table = None
    assert loader.main() == {'files': 1}
    assert len(runtime.downloads) == 2
    assert len(runtime.spark.rows['observation']) == len(runtime.spark.rows['evidence']) == 2


def test_all_rejected_file_is_counted_without_empty_core_merges(runtime):
    runtime.files.download = lambda file: SimpleNamespace(contents=io.BytesIO(b'invalid JSON\n'))
    assert loader.main() == {'files': 1}
    report = runtime.spark.reports[runtime.path]
    assert (report['lines'], report['loaded'], report['rejected']) == (1, 0, 1)
    assert not any(statement.startswith('MERGE INTO demo.core.') for statement in runtime.spark.statements)
    assert loader.main() == {'files': 0}


def test_empty_folder_has_no_writes(runtime):
    runtime.files.list_directory_contents = lambda path: []
    assert loader.main() == {'files': 0}
    assert runtime.spark.views == {}
    assert len(runtime.spark.statements) == 1
    assert 'FROM demo.governance.source_rights' in runtime.spark.statements[0]


def test_existing_evidence_conflict_is_rejected_and_counted_on_a_later_file(runtime):
    loader.main()
    runtime.spark.source_rights = [{**TEST_RIGHTS[0], 'may_model_scope': 'product'}]
    new_path = runtime.path.replace('search_demo.jsonl', 'search_later.jsonl')
    directory = runtime.path.rsplit('/', 1)[0]
    runtime.entries[directory].append(SimpleNamespace(path=new_path, is_directory=False))
    row = {**BASE, 'id': 'obs_1111111111111111', 'may_model': True, 'use_scope': 'product'}
    runtime.files.download = lambda file: SimpleNamespace(contents=io.BytesIO((json.dumps(row) + '\n').encode()))
    assert loader.main() == {'files': 1}
    report = runtime.spark.reports[new_path]
    assert (report['lines'], report['loaded'], report['rejected']) == (1, 0, 1)
    assert json.loads(report['reasons']) == {'evidence rights conflict': 1}
    assert row['id'] not in runtime.spark.rows['observation']
    assert len(runtime.spark.rows['evidence']) == 2


def test_duplicate_id_cannot_introduce_unchecked_evidence_after_a_rights_refusal(runtime):
    loader.main()
    new_path = runtime.path.replace('search_demo.jsonl', 'search_duplicates.jsonl')
    runtime.entries[runtime.path.rsplit('/', 1)[0]].append(SimpleNamespace(path=new_path, is_directory=False))
    shared_id = 'obs_1111111111111111'
    first = {**BASE, 'id': shared_id, 'may_model': True}
    second = {**json.loads(LINES[1]), 'id': shared_id, 'may_model': False}
    data = '\n'.join(json.dumps(row) for row in (first, second)).encode()
    runtime.files.download = lambda file: SimpleNamespace(contents=io.BytesIO(data))
    loader.main()
    report = runtime.spark.reports[new_path]
    assert (report['loaded'], report['rejected']) == (0, 2)
    assert shared_id not in runtime.spark.rows['observation']


def test_serverless_entrypoint_accepts_root_without_file(serverless_entrypoint):
    serverless_entrypoint('databricks/tasks/load_observations.py', ['--root', str(ROOT)])


def test_table_definitions_have_nullable_owners_and_commented_new_columns():
    sql = (ROOT / 'databricks/sql/01_tables.sql').read_text()
    for name in ('observation', 'evidence'):
        block = sql.split('CREATE TABLE IF NOT EXISTS secondhand.core.' + name + ' (')[1].split('\n)')[0]
        assert "user_id STRING COMMENT 'Owner; null is a shared public read, never who asked'" in block
        for key, definition in loader.NEW_COLUMNS[name].items():
            assert f'{key} {definition}' in block


@pytest.mark.parametrize('right', loader.RIGHTS)
def test_source_false_refuses_each_true_row_right_for_its_named_reason(right):
    policy = {**TEST_RIGHTS[0], right: False}
    row = {**BASE, right: True}
    result = loader.parse([json.dumps(row)], source_rights=[policy])
    assert result.observations == result.evidence == []
    assert result.rejects == [{'line': 1, 'reason': right + ' exceeds source rights'}]


@pytest.mark.parametrize('scope,limit', [('hackathon_demo', 'none'), ('product', 'hackathon_demo'), ('product', 'none')])
def test_wider_scope_is_refused_even_when_line_does_not_model(scope, limit):
    result = loader.parse([json.dumps({**BASE, 'use_scope': scope})],
                          source_rights=[{**TEST_RIGHTS[0], 'may_model_scope': limit}])
    assert result.observations == result.evidence == []
    assert result.rejects == [{'line': 1, 'reason': 'use_scope exceeds source rights'}]


def test_missing_source_rights_fail_closed():
    result = loader.parse([json.dumps(BASE)])
    assert result.observations == result.evidence == []
    assert result.rejects == [{'line': 1, 'reason': 'source has no rights row'}]


@pytest.mark.parametrize('site,via,models,scope', [
    ('nber_ebay_bo', None, True, 'hackathon_demo'),
    ('facebook:apify', None, True, 'hackathon_demo'),
    ('EBAY', None, True, 'none'),
    ('ebay_api', None, False, 'none'),
    ('ebay_comps_cc0', None, False, 'none'),
    ('ebay_api', None, True, 'hackathon_demo'),
    ('ebay_comps_cc0', None, True, 'hackathon_demo'),
    ('stockx_2019', None, False, 'none'),
    ('unknown', None, False, 'none'),
    ('facebook', 'unknown', False, 'none'),
])
def test_live_line_cannot_select_dataset_provider_or_unknown_source_rights(site, via, models, scope):
    source = site + (':' + via if via else '')
    policy = dict(source=source, may_store=True, may_model=True, may_show=True,
                  may_share=True, may_model_scope='product')
    row = {**BASE, 'site': site, 'data': 'live:' + site, 'via': via,
           'may_model': models, 'use_scope': scope}
    result = loader.parse([json.dumps(row)], source_rights=[policy])
    assert result.observations == result.evidence == []
    assert result.rejects == [{'line': 1, 'reason': 'source has no rights row'}]


def test_brand_fixture_with_permitted_rights_lands_from_the_sql_registry():
    _, policies = rights_rows()
    row = {**json.loads(FIXTURE.read_text().splitlines()[1]), 'may_model': False, 'use_scope': 'none'}
    result = loader.parse([json.dumps(row)], source_rights=policies)
    assert result.rejects == [], 'official retail needs a real brand rights row'
    assert result.observations[0]['channel'] == 'official_retail'
    assert result.evidence[0]['may_model'] is False


def test_original_brand_fixture_cannot_claim_model_rights_from_the_sql_registry():
    _, policies = rights_rows()
    claimed = {**json.loads(FIXTURE.read_text().splitlines()[1]), 'may_model': True, 'use_scope': 'product'}
    result = loader.parse([json.dumps(claimed)], source_rights=policies)
    assert result.observations == result.evidence == []
    assert result.rejects == [{'line': 1, 'reason': 'may_model exceeds source rights'}]


@pytest.mark.parametrize('site', ['ebay', 'mercari'])
def test_apify_other_sites_have_no_rights_row_even_when_direct_source_exists(site):
    row = {**BASE, 'site': site, 'data': 'live:' + site}
    result = loader.parse([json.dumps(row)], source_rights=[{**TEST_RIGHTS[0], 'source': site}])
    assert result.rejects == [{'line': 1, 'reason': 'source has no rights row'}]
    assert result.observations == result.evidence == []


@pytest.mark.parametrize('via', ['treg', None, 'another_route'])
def test_ebay_model_right_is_refused_by_every_route_even_with_overpermissive_source(via):
    row = {**BASE, 'site': 'ebay', 'data': 'live:ebay', 'via': via, 'may_model': True}
    policy = {**TEST_RIGHTS[0], 'source': 'ebay' + (':' + via if via else '')}
    result = loader.parse([json.dumps(row)], source_rights=[policy])
    reason = 'source has no rights row' if via == 'another_route' else 'ebay content never models'
    assert result.rejects == [{'line': 1, 'reason': reason}]
    assert result.observations == result.evidence == []


def test_live_source_rows_match_the_loader_and_facebook_model_rights_survive_untouched():
    _, policies = rights_rows()
    for site, via in [('ebay', 'treg'), ('ebay', None), ('mercari', None),
                      ('poshmark', None), ('depop', None), ('facebook', 'apify')]:
        row = {**BASE, 'site': site, 'data': 'live:' + site, 'via': via,
               'may_model': site == 'facebook', 'use_scope': 'hackathon_demo' if site == 'facebook' else 'none'}
        result = loader.parse([json.dumps(row)], source_rights=policies)
        assert not result.rejects, (site, via, result.rejects)
        assert len(result.observations) == len(result.evidence) == 1
        for key in loader.RIGHTS:
            assert result.evidence[0][key] is row[key]
        for key in ('site', 'via', 'use_scope', 'payload'):
            value = result.observations[0][key]
            assert (json.loads(value) if key == 'payload' else value) == row[key]


def test_main_reads_source_rights_once_per_run_and_counts_each_refusal_without_core_writes(runtime, capsys):
    runtime.spark.source_rights = [{**TEST_RIGHTS[0], 'may_show': False}]
    second_path = runtime.path.replace('search_demo.jsonl', 'search_second.jsonl')
    runtime.entries[runtime.path.rsplit('/', 1)[0]].append(SimpleNamespace(path=second_path, is_directory=False))
    row = {**BASE, 'may_show': True}
    runtime.files.download = lambda file: SimpleNamespace(contents=io.BytesIO((json.dumps(row) + '\n').encode()))
    loader.main()
    assert sum('FROM demo.governance.source_rights' in s for s in runtime.spark.statements) == 1
    assert set(runtime.spark.reports) == {runtime.path, second_path}
    for report in runtime.spark.reports.values():
        assert (report['loaded'], report['rejected']) == (0, 1)
        assert json.loads(report['reasons']) == {'may_show exceeds source rights': 1}
    assert runtime.spark.rows == {'observation': {}, 'evidence': {}}
    logs = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert any(line.get('reason') == 'may_show exceeds source rights' for line in logs)
