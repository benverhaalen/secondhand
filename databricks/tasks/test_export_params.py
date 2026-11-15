import json
import re
import sys
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'jobs'))
sys.path.insert(0, str(ROOT / 'log'))

from secondhand_log import create_log
from tasks.export_params import run, main


class Spark:
    def __init__(self, comps=(), estimates=()):
        self.comps, self.estimates, self.queries = comps, estimates, []

    def sql(self, sql, args=None):
        self.queries.append(sql)
        self.args = args
        rows = self.comps if '.market.comp_for_model' in sql else self.estimates
        return SimpleNamespace(collect=lambda: [SimpleNamespace(asDict=lambda r=r: r) for r in rows])


class Files:
    def __init__(self):
        self.writes = []
        self.directories = set()

    def create_directory(self, path):
        if path.rsplit('/', 1)[0].endswith('/params'):
            assert path.rsplit('/', 1)[0] in self.directories
        self.directories.add(path)

    def upload(self, path, contents, *, overwrite=False):
        if path.rsplit('/', 1)[0] not in self.directories:
            raise FileNotFoundError('export directory must be created before upload')
        self.writes.append((path, contents.read(), overwrite))


def execute(comps=(), estimates=(), contestant='engine_all_on', files=None):
    spark, files, lines = Spark(comps, estimates), files or Files(), []
    log = create_log(src='job.export_params', build='test', sink=lines.append)
    out = run(spark, files, catalog='secondhand', contestant=contestant,
              now='2026-11-15T12:00:00+00:00', run_id='export-test', code_version='abc', log=log,
              split_at='2019-01-01')
    return out, spark, files, lines


def test_both_paths_receive_the_same_envelope_with_only_latest_overwritten():
    comps = [{'row_id': str(i), 'kind': 'electronics', 'site': 'ebay', 'source': 'nber_ebay_bo',
              'may_model': True, 'listed_at': date(2013, 1, 1), 'at': date(2013, 4, 11),
              'price_type': 'sold'} for i in range(40)]
    out, spark, files, lines = execute(comps)
    assert len(out['params']) == 1
    assert [(p, overwrite) for p, _, overwrite in files.writes] == [
        ('/Volumes/secondhand/raw/export/params/2026-11-15/export-test.json', False),
        ('/Volumes/secondhand/raw/export/params/latest.json', True)]
    assert all(json.loads(contents) == out for _, contents, _ in files.writes)
    assert files.directories == {'/Volumes/secondhand/raw/export/params', '/Volumes/secondhand/raw/export/params/2026-11-15'}
    assert any('job.state' in str(line) for line in lines)


def test_queries_use_the_guarded_view_and_latest_run_of_only_the_named_contestant():
    _, spark, _, _ = execute(comps=[{'may_model': False}], contestant="engine_all_on'quoted")
    comp_sql, estimate_sql = spark.queries
    assert 'FROM secondhand.market.comp_for_model' in comp_sql
    assert "source = 'nber_ebay_bo'" in comp_sql
    assert 'CAST(listed_at AS DATE)' in comp_sql and 'CAST(at AS DATE)' in comp_sql
    assert not any(re.search(r'\bmarket\.comp\b', q) for q in spark.queries)
    assert 'secondhand.measures.backtest_estimate' in estimate_sql
    assert estimate_sql.count('contestant = :contestant') == 2
    assert "engine_all_on" not in estimate_sql, 'contestant must not be interpolated into SQL'
    assert spark.args == {'contestant': "engine_all_on'quoted"}
    assert 'secondhand.measures.backtest_run' in estimate_sql
    assert 'ORDER BY r.ended_at DESC' in estimate_sql and 'LIMIT 1' in estimate_sql
    assert 'e.run_id = (' in estimate_sql


def test_empty_source_still_writes_empty_params_and_logs_why():
    out, _, files, lines = execute()
    assert out['params'] == [] and len(files.writes) == 2
    assert any('no nber_ebay_bo rows' in str(line) for line in lines)


def test_empty_source_does_not_require_a_backtest_table():
    class EmptySource(Spark):
        def sql(self, sql):
            if 'backtest_estimate' in sql:
                raise RuntimeError('backtests not loaded')
            return super().sql(sql)
    lines, files = [], Files()
    log = create_log(src='job.export_params', build='test', sink=lines.append)
    out = run(EmptySource(), files, catalog='secondhand', contestant='engine_all_on',
              now='2026-11-15T12:00:00Z', run_id='empty-source', code_version='dev', log=log,
              split_at='2019-01-01')
    assert out['params'] == [] and len(files.writes) == 2


def test_upload_failure_propagates_and_marks_job_failed():
    class BrokenFiles(Files):
        def upload(self, *args, **kwargs):
            raise OSError('volume unavailable')
    lines = []
    log = create_log(src='job.export_params', build='test', sink=lines.append)
    with pytest.raises(OSError, match='volume unavailable'):
        run(Spark(), BrokenFiles(), catalog='secondhand', contestant='engine_all_on',
            now='2026-11-15T12:00:00Z', run_id='broken-volume', code_version='dev', log=log,
            split_at='2019-01-01')
    events = [json.loads(line) for line in lines]
    assert any(e['event'] == 'job.state' and e['state'] == 'failed' for e in events)
    failed = next(e for e in events if e['event'] == 'job.state' and e['state'] == 'failed')
    assert failed.get('error', {}).get('type') == 'OSError', 'failed job needs its error'
    assert failed['error']['msg'] == 'volume unavailable'
    assert events[-1]['event'] == 'session.end' and events[-1]['ok'] is False


def test_invalid_catalog_and_run_id_are_rejected_before_external_calls():
    for field, value in [('catalog', 'secondhand; DROP TABLE x'), ('run_id', '../other')]:
        kwargs = dict(catalog='secondhand', contestant='engine_all_on', now='2026-11-15T00:00:00Z',
                      run_id='test', code_version='dev', split_at='2019-01-01',
                      log=create_log(src='test', build='test', sink=lambda _: None))
        kwargs[field] = value
        spark, files = Spark(), Files()
        with pytest.raises(ValueError, match=field):
            run(spark, files, **kwargs)
        assert spark.queries == [] and files.writes == []


def test_main_bootstraps_from_root_without_file_or_pyspark_at_import(monkeypatch):
    from types import ModuleType
    import tasks.export_params as task
    estimates = [{'item_id': f'e{i}', 'contestant': 'engine_all_on', 'kind': 'shoes', 'site': None,
                  'q10_cents': 100, 'q90_cents': 200, 'truth_cents': 150,
                  'data': 'dataset:stockx_2019', 'as_of': date(2018, 11, 30)} for i in range(30)]
    estimates.append({**estimates[0], 'item_id': 'holdout', 'as_of': date(2018, 12, 1)})
    spark, files = Spark([{'may_model': False}], estimates), Files()
    pyspark = ModuleType('pyspark')
    sql = ModuleType('pyspark.sql')
    sql.SparkSession = SimpleNamespace(getActiveSession=lambda: spark)
    sdk = ModuleType('databricks.sdk')
    sdk.WorkspaceClient = lambda: SimpleNamespace(files=files)
    monkeypatch.setitem(sys.modules, 'pyspark', pyspark)
    monkeypatch.setitem(sys.modules, 'pyspark.sql', sql)
    monkeypatch.setitem(sys.modules, 'databricks.sdk', sdk)
    monkeypatch.delattr(task, '__file__')
    out = main(['--root', str(ROOT), '--catalog', 'secondhand', '--run-id', 'main-test',
                '--split-at', '2018-12-01'])
    assert len(out['params']) == 1 and len(files.writes) == 2
    value = out['params'][0]['value_or_hyperparams']
    assert value['split_at'] == '2018-12-01', 'task must pass the caller date through to calibration'
    assert value['n'] == 30 and value['holdout_n'] == 1


def test_main_requires_split_at_before_loading_workspace_dependencies(capsys):
    with pytest.raises(SystemExit) as error:
        main(['--root', str(ROOT)])
    assert error.value.code != 0
    assert '--split-at' in capsys.readouterr().err
