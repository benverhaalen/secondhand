"""Write the fitted param envelope to the server's Volume export paths."""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def run(spark, files, *, catalog, contestant, now, run_id, code_version, log):
    from valuation.export import build_rows

    log.job(run_id, 'export_params', 'running')
    try:
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', catalog):
            raise ValueError('catalog must be a SQL identifier')
        if not re.fullmatch(r'[A-Za-z0-9_-][A-Za-z0-9_.-]*', run_id):
            raise ValueError('run_id must be a single path component')
        now = now.isoformat() if isinstance(now, datetime) else now
        day = datetime.fromisoformat(now.replace('Z', '+00:00')).date().isoformat()
        comp_sql = f"""SELECT row_id, source, kind, site, may_model, price_type,
                             CAST(listed_at AS DATE) AS listed_at, CAST(at AS DATE) AS at
                      FROM {catalog}.market.comp_for_model
                      WHERE source = 'nber_ebay_bo'"""
        named = contestant.replace("'", "''")
        estimate_sql = f"""SELECT e.* FROM {catalog}.measures.backtest_estimate e
            WHERE e.contestant = '{named}' AND e.run_id = (
                SELECT e.run_id FROM {catalog}.measures.backtest_estimate e
                JOIN {catalog}.measures.backtest_run r ON r.run_id = e.run_id
                WHERE e.contestant = '{named}'
                ORDER BY r.ended_at DESC, e.run_id DESC LIMIT 1
            )"""
        comps = log.call('db', 'read_export_comps', {'catalog': catalog},
                         lambda: [r.asDict() for r in spark.sql(comp_sql).collect()],
                         describe=lambda rs: {'rows': len(rs)})
        counts = Counter()
        if not comps:
            log.note('no nber_ebay_bo rows in comp_for_model; writing empty params', level='info')
            estimates = []
        else:
            estimates = log.call('db', 'read_export_estimates', {'contestant': contestant},
                                 lambda: [r.asDict() for r in spark.sql(estimate_sql).collect()],
                                 describe=lambda rs: {'rows': len(rs)})
            if not estimates:
                log.note('no backtest estimates for contestant; no calibration rows',
                         level='info', contestant=contestant)
        out = log.timed('export_params.build', lambda: build_rows(comps, estimates, contestant, now,
                                                                  run_id, code_version, counts=counts))
        log.note('param export counts', level='info', **counts)
        payload = (json.dumps(out, allow_nan=False) + '\n').encode('utf-8')
        base = f'/Volumes/{catalog}/raw/export/params'
        for directory in (base, f'{base}/{day}'):
            log.call('tool', 'create_export_directory', {'path': directory},
                     lambda: files.create_directory(directory))
        for path, overwrite in [(f'{base}/{day}/{run_id}.json', False), (f'{base}/latest.json', True)]:
            log.call('tool', 'upload_params', {'path': path, 'overwrite': overwrite, 'bytes': len(payload)},
                     lambda: files.upload(path, io.BytesIO(payload), overwrite=overwrite))
        log.job(run_id, 'export_params', 'done', rows=len(out['params']))
        log.end()
        return out
    except Exception as error:
        log.error('export_params', error)
        log.job(run_id, 'export_params', 'failed')
        log.end(ok=False)
        raise


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--catalog', default='secondhand')
    parser.add_argument('--contestant', default='engine_all_on')
    parser.add_argument('--run-id')
    args = parser.parse_args(argv)
    root = Path(args.root)
    sys.path.insert(0, str(root / 'jobs'))
    sys.path.insert(0, str(root / 'log'))
    from secondhand_log import create_log, stdout_sink
    from pyspark.sql import SparkSession
    from databricks.sdk import WorkspaceClient

    version = os.environ.get('SECONDHAND_CODE_SHA', os.environ.get('SECONDHAND_BUILD', 'dev'))
    now = datetime.now(timezone.utc)
    run_id = args.run_id or f'export-{now:%Y%m%dT%H%M%S}-{uuid4().hex[:12]}'
    log = create_log(src='job.export_params', build=version, sink=stdout_sink,
                     config={'catalog': args.catalog, 'contestant': args.contestant, 'run_id': run_id})
    spark = log.call('db', 'spark_session', {},
                     lambda: SparkSession.getActiveSession() or SparkSession.builder.getOrCreate(),
                     describe=lambda _: {'ready': True})
    return run(spark, WorkspaceClient().files, catalog=args.catalog, contestant=args.contestant,
               now=now, run_id=run_id, code_version=version, log=log)


if __name__ == '__main__':
    main()
