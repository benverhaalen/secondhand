"""Frozen valuation job. Local contract: python -m pytest databricks/tasks/test_backtest.py -q.

Rests on spec/databricks-build.md §§3,4,7 and jobs/valuation/experiment.py.
Spark, MLflow and the proof twin are imported only at the job boundary.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2] if '__file__' in globals() else None
if __name__ == '__main__':
    root_parser = argparse.ArgumentParser(add_help=False)
    root_parser.add_argument('--root', type=Path, default=ROOT, required=ROOT is None)
    ROOT = root_parser.parse_known_args()[0].root.resolve()
sys.path[:0] = [str(ROOT / 'jobs'), str(ROOT / 'log'), str(ROOT / 'databricks'), str(ROOT / 'databricks/tasks')]

from valuation import experiment, market  # noqa: E402
from secondhand_log import create_log, file_sink  # noqa: E402
from guard import guard_batch  # noqa: E402

HEADLINE_FIELDS = ('n', 'priced', 'hit_rate', 'within_20', 'median_ape', 'coverage', 'bias', 'lift_vs_primary')


def provenance(source):
    if source == 'synthetic' or source.startswith(('dataset:', 'live:')):
        return source
    return 'dataset:' + source


def _timestamp_string(value, source):
    if isinstance(value, datetime):
        value = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
        # StockX CSV stores days, not midnight timestamps. load() preserves those strings.
        if source == 'stockx_2019' and value.time().isoformat() == '00:00:00':
            return value.date().isoformat()
        return value.isoformat().replace('+00:00', 'Z')
    return value.isoformat() if isinstance(value, date) else value


def to_runner_rows(spark_rows):
    rows = []
    for raw in spark_rows:
        raw = raw.asDict() if hasattr(raw, 'asDict') else raw
        raw = {**raw, 'row_id': raw.get('row_id') or raw.get('comp_id'),
               'at': raw.get('at') or raw.get('sold_at') or raw.get('observed_at'),
               'url': raw.get('url') or raw.get('url_ref')}
        row = {k: raw.get(k) if raw.get(k) not in ('', None) else None for k in experiment.FIELDS}
        for key in experiment.INTS:
            row[key] = int(float(row[key])) if row[key] is not None else None
        for key, default in experiment.FLAGS.items():
            row[key] = experiment._flag(raw.get(key), default)
        for key in ('at', 'listed_at'):
            row[key] = _timestamp_string(row[key], row['source'])
        rows.append(row)
    return rows


def _cents(value):
    return None if value is None else int(round(value))


def estimates_table(estimates, rows_by_id, run_id):
    out = []
    for est in estimates:
        truth = rows_by_id[est['item_id']]
        price = int(truth['price_cents'])
        q10, q50, q90 = (est[k] for k in ('q10', 'q50', 'q90'))
        priced = bool(est['shown']) and q50 is not None
        err = abs(q50 - price) / price if priced else None
        out.append({**{k: est[k] for k in ('contestant', 'item_id', 'as_of', 'freeze_basis', 'shown', 'comp_ids')},
                    'run_id': run_id, 'q10_cents': _cents(q10), 'q50_cents': _cents(q50), 'q90_cents': _cents(q90),
                    'truth_cents': price, 'kind': truth.get('kind'), 'site': truth.get('site'),
                    'abs_pct_err': err, 'within_20': err <= .2 if priced else None,
                    'in_range': q10 <= price <= q90 if priced else None, 'data': provenance(truth['source'])})
    return out


def run_table(report, meta):
    heads = []
    for name, result in report['contestants'].items():
        metrics = result['overall']
        lift = result.get('lift_vs_primary')
        heads.append({'run_id': meta['run_id'], 'contestant': name,
                      **{k: metrics.get(k) for k in HEADLINE_FIELDS},
                      'median_ape': metrics.get('median_pct_off'),
                      'lift_vs_primary': lift['diff'] if lift else None,
                      'data': provenance(meta['source'])})
    stored = {**report, 'uncited_contestants': meta.get('uncited_contestants', {}),
              'table_versions': meta.get('table_versions', []),
              'notes': ['median_ape maps to score.overall.median_pct_off; lift_vs_primary maps to lift.diff.',
                        'Unavailable score fields remain null (including primary lift and thin-cell metrics).',
                        'Product/last/random baselines show every nonempty basis; ambiguous hides use too_few. Model count/width hides follow its current product-history guard.',
                        'Citation ids identify the metric, filters, versions and full basis; repeated identities retain the first computed_at.']}
    row = {k: meta.get(k) for k in ('run_id', 'source', 'test_from', 'test_to', 'rows_hash', 'code_sha',
                                   'started_at', 'ended_at', 'mlflow_run_id')}
    row.update(n_tests=max((r['n'] for r in heads), default=0), report=json.dumps(stored, sort_keys=True),
               sentence=report.get('sentence'), data=provenance(meta['source']))
    return row, heads


def new_citations(citations, existing_ids):
    seen = set(existing_ids)
    out = []
    for row in citations:
        if row['id'] not in seen:
            out.append(row)
            seen.add(row['id'])
    return out


def _basis_timestamp(value):
    dt = value if isinstance(value, datetime) else datetime.fromisoformat(value.replace('Z', '+00:00'))
    dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
    return dt.isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def guarded_rows(estimates, rows_by_id, hash_fn, citation_id_fn, run_id, now, *, meta=None):
    meta = meta or {}
    guards, citations = [], []
    by_product = {}
    for row in rows_by_id.values():
        if row.get('may_model', True) and row['price_type'] == 'sold' and (row.get('price_cents') or 0) > 0:
            by_product.setdefault(row['product_id'], []).append(row)
    for est in estimates:
        ids = est.get('comp_ids') or []
        item = rows_by_id[est['item_id']]
        basis = [{'id': i, 'source': rows_by_id[i]['source'], 'at': _basis_timestamp(rows_by_id[i]['at']),
                  'weight': 1, 'price_cents': int(rows_by_id[i]['price_cents'])} for i in ids]
        digest = hash_fn(basis)
        metric = 'valuation.' + est['contestant'] + '.q50'
        shared = {'user_id': 'usr_backtest', 'created_at': now, 'updated_at': now, 'version': 1, 'data': provenance(item['source'])}
        cite = {'metric': metric, 'filters': {'source': item['source'], 'product_id': item['product_id']},
                'table_versions': meta.get('table_versions', []), 'definition_version': 'experiment.v1',
                'code_version': meta.get('code_sha', 'unknown'), 'param_versions': {}, 'model_version': None}
        citation = {**shared, **cite, 'id': citation_id_fn(cite, digest), 'computed_at': est['as_of'],
                    'basis_ids': sorted(ids, key=lambda i: i.encode('utf-16-be')), 'basis_hash': digest}
        for field in ('filters', 'table_versions', 'param_versions'):
            citation[field] = json.dumps(cite[field], sort_keys=True)
        # The indexed market contestant now carries its recent product basis.
        # Its minimum applies to all prior product sales, not just ANCHOR_K ids.
        shown = bool(est['shown']) and bool(ids)
        reason = None
        if not shown:
            reason = 'too_few'
            if est['contestant'] == 'model':
                ages = [(experiment.ts(est['as_of']) - experiment.ts(r['at'])) / 86400
                        for r in by_product.get(item['product_id'], [])
                        if not item.get('cluster_id') or r.get('cluster_id') != item['cluster_id']]
                n12 = sum(0 < age <= 365 for age in ages)
                n90 = sum(0 < age <= 90 for age in ages)
                if n12 >= market.MIN_12M and n90 >= market.MIN_90D:
                    reason = 'too_wide'
            if not ids:
                reason = 'source_gap'
        identity = hashlib.sha256(f"{run_id}:{est['contestant']}:{est['item_id']}".encode()).hexdigest()[:24]
        guards.append({**shared, 'id': 'gn_' + identity, 'item_id': est['item_id'], 'metric': metric,
                       'value_cents': _cents(est['q50']), 'lo_cents': _cents(est['q10']), 'hi_cents': _cents(est['q90']),
                       'currency': 'USD', 'basis_count': len(ids), 'n_eff': float(len(ids)), 'as_of': est['as_of'],
                       'basis_level': (est.get('basis_level') or 'product') if ids else 'prior',
                       'state': 'shown' if shown else 'hidden', 'hide_reason': reason,
                       'citation_id': citation['id'] if shown else None})
        if ids:
            citations.append(citation)
    return guards, new_citations(citations, set())


def table_frame(spark, table, rows):
    """Use the declared Delta schema, including nullable columns in an all-null batch."""
    schema = spark.table(table).schema
    converted = []
    for row in rows:
        record = {f.name: row.get(f.name) for f in schema}
        for field in schema:
            value = record[field.name]
            if value is not None and field.dataType.typeName() == 'timestamp' and isinstance(value, str):
                parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
                record[field.name] = parsed.astimezone(timezone.utc).replace(tzinfo=None) if parsed.tzinfo else parsed
            elif value is not None and field.dataType.typeName() in ('double', 'float'):
                record[field.name] = float(value)
        converted.append(record)
    return spark.createDataFrame(converted, schema=schema)


def append_rows(spark, log, table, rows):
    if rows:
        guard_batch(spark, log, 'valuation_backtest', table, rows)
        log.call('db', 'append', {'table': table, 'rows': len(rows)},
                 lambda: table_frame(spark, table, rows).write.mode('append').saveAsTable(table))


def write_batches(spark, log, batches):
    pending_citations = set()
    for table, rows in batches:
        guard_batch(spark, log, 'valuation_backtest', table, rows, citation_ids=pending_citations)
        if table == 'secondhand.core.citation':
            pending_citations.update(r['id'] for r in rows)
    for table, rows in batches:
        append_rows(spark, log, table, rows)


def job_log(name, config):
    path = Path(os.environ.get('SECONDHAND_LOG_DIR', '/tmp/secondhand')) / f'{name}-{uuid4().hex}.jsonl'
    return create_log(src='job.' + name, build=os.environ.get('SECONDHAND_BUILD', 'dev'),
                      sink=file_sink(str(path)), config=config)


def rows_hash(rows):
    return hashlib.sha256(json.dumps(sorted(rows, key=lambda r: r['row_id']), sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def require_snapshot_version(before, after):
    if before != after:
        raise ValueError(f'comp changed during read (v{before} to v{after}); rerun before writing citations')


def log_training_input(mlflow, log, version):
    dataset = log.call('mlflow', 'load_delta', {'table': 'secondhand.market.comp_for_model', 'version': int(version)},
                       lambda: mlflow.data.load_delta(table_name='secondhand.market.comp_for_model', version=int(version)))
    log.call('mlflow', 'log_input', {'context': 'training', 'version': int(version)},
             lambda: mlflow.log_input(dataset, context='training'))


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', type=Path, default=ROOT)
    ap.add_argument('--source', default='stockx_2019')
    ap.add_argument('--test-from', default='2018-11-01')
    ap.add_argument('--test-to')
    args = ap.parse_args(argv)
    from pyspark.sql import SparkSession, functions as F
    import mlflow
    from proof import basisHash as basis_hash, citationId as citation_id

    log = job_log('valuation_backtest', vars(args))
    run_id = 'bt_' + uuid4().hex
    started = datetime.now(timezone.utc).isoformat()
    log.job(run_id, 'backtest', 'running')
    try:
        spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
        version = log.call('db', 'comp_version', {}, lambda: spark.sql('DESCRIBE HISTORY secondhand.market.comp LIMIT 1').first()['version'])
        raw = log.call('db', 'read_comps', {'source': args.source},
                       lambda: spark.table('secondhand.market.comp_for_model').where(F.col('source') == args.source).collect(),
                       describe=lambda rs: {'rows': len(rs)})
        after_version = log.call('db', 'comp_version_after_read', {}, lambda: spark.sql('DESCRIBE HISTORY secondhand.market.comp LIMIT 1').first()['version'])
        require_snapshot_version(version, after_version)
        rows = to_runner_rows(raw)
        meta = {**vars(args), 'run_id': run_id, 'rows_hash': rows_hash(rows), 'started_at': started,
                'code_sha': os.environ.get('SECONDHAND_CODE_SHA', os.environ.get('SECONDHAND_BUILD', 'unknown')),
                'table_versions': [{'table': 'secondhand.market.comp', 'version': int(version)}]}
        contestants = [experiment.ProductMedian(), experiment.LastSale(), experiment.Model()]
        log.call('mlflow', 'tracking', {}, lambda: mlflow.set_tracking_uri('databricks'))
        log.call('mlflow', 'experiment', {}, lambda: mlflow.set_experiment('/Shared/secondhand/valuation-backtest'))
        with mlflow.start_run(run_name=run_id) as run:
            log_training_input(mlflow, log, version)
            log.call('mlflow', 'params', {}, lambda: mlflow.log_params({
                'source': args.source, 'test_from': args.test_from, 'test_to': args.test_to or '',
                'contestants': json.dumps([c.name for c in contestants]), 'MIN_PEERS': experiment.MIN_PEERS,
                'MIN_CELL': experiment.MIN_CELL, 'SEEDS': json.dumps(experiment.SEEDS),
                'rows_hash': meta['rows_hash'], 'market_comp_version': version}))
            log.call('mlflow', 'tags', {}, lambda: mlflow.set_tag('code_sha', meta['code_sha']))
            estimates = log.timed('backtest.run', lambda: experiment.run(rows, contestants, test_from=args.test_from, test_to=args.test_to, log=log))
            report = log.timed('backtest.score', lambda: experiment.score(estimates, rows))
            meta['uncited_contestants'] = {c.name: sum(e['contestant'] == c.name and not e.get('comp_ids') for e in estimates)
                                          for c in contestants if any(e['contestant'] == c.name and not e.get('comp_ids') for e in estimates)}
            meta.update(ended_at=datetime.now(timezone.utc).isoformat(), mlflow_run_id=run.info.run_id)
            run_row, headlines = run_table(report, meta)
            by_id = {r['row_id']: r for r in rows}
            guards, citations = guarded_rows(estimates, by_id, basis_hash, citation_id, run_id, meta['ended_at'], meta=meta)
            if citations:
                ids = [r['id'] for r in citations]
                existing = log.call('db', 'existing_citations', {'candidates': len(ids)},
                                    lambda: {r['id'] for r in spark.table('secondhand.core.citation').where(F.col('id').isin(ids)).select('id').collect()},
                                    describe=lambda found: {'rows': len(found)})
                citations = new_citations(citations, existing)
            write_batches(spark, log, [
                ('secondhand.core.citation', citations),
                ('secondhand.core.guarded_number', guards),
                ('secondhand.measures.backtest_estimate', estimates_table(estimates, by_id, run_id)),
                ('secondhand.measures.backtest_headline', headlines),
                ('secondhand.measures.backtest_run', [run_row]),
            ])
            metrics = {f'{key}.{row["contestant"]}': float(row[key]) for row in headlines for key in HEADLINE_FIELDS if row[key] is not None}
            log.call('mlflow', 'metrics', {}, lambda: mlflow.log_metrics(metrics))
            log.call('mlflow', 'report', {}, lambda: mlflow.log_dict(json.loads(run_row['report']), 'report.json'))
        log.job(run_id, 'backtest', 'done', n_tests=run_row['n_tests'])
        return run_row
    except Exception as error:
        log.error('backtest', error)
        log.job(run_id, 'backtest', 'failed')
        raise


if __name__ == '__main__':
    main()
