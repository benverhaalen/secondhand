"""Run committed TypeScript fixtures on the workspace Python and store every comparison."""
from __future__ import annotations

import json
import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Serverless executes the entrypoint without __file__; imported modules still have it.
ROOT = Path(__file__).resolve().parents[2] if '__file__' in globals() else None
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT, required=ROOT is None)
    ROOT = parser.parse_args().root.resolve()
sys.path.insert(0, str(ROOT / 'databricks'))
sys.path.insert(0, str(ROOT / 'log'))

from parity.parity import compare, proof_case, table_rows
from secondhand_log import create_log, stdout_sink

SCHEMA = 'engine STRING, case STRING, ts_value STRING, py_value STRING, equal BOOLEAN, code_sha STRING, checked_at TIMESTAMP'


def run(root: Path = ROOT) -> list[dict]:
    folder = root / 'databricks' / 'parity'
    fixtures = json.loads((folder / 'fixtures/proof.json').read_text(encoding='utf-8'))
    ts = json.loads((folder / 'proof.ts-out.json').read_text(encoding='utf-8'))
    return compare(fixtures, ts, proof_case)


def main() -> dict:
    from pyspark.sql import SparkSession

    code_sha = os.environ.get('SECONDHAND_BUILD', 'dev')
    log = create_log(src='job.parity', build=code_sha, sink=stdout_sink)
    log.job('parity', 'parity', 'running')
    try:
        results = log.call('tool', 'compare_committed_fixtures', {'root': str(ROOT)}, run,
                           describe=lambda rows: {'cases': len(rows), 'unequal': sum(not r['equal'] for r in rows)})
        spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
        rows = table_rows(results, code_sha, datetime.now(timezone.utc))
        log.call('db', 'write_parity_check', {'table': 'secondhand.measures.parity_check', 'rows': len(rows)},
                 lambda: spark.createDataFrame(rows, SCHEMA).write.mode('overwrite').saveAsTable('secondhand.measures.parity_check'))
        unequal = sum(not r['equal'] for r in results)
        if unequal:
            raise ValueError(f'{unequal} parity cases differ; see secondhand.measures.parity_check')
        log.job('parity', 'parity', 'done', cases=len(rows))
        log.end()
        return {'cases': len(rows), 'unequal': unequal}
    except Exception as error:
        log.error('parity', error)
        log.job('parity', 'parity', 'failed')
        log.end(ok=False)
        raise


if __name__ == '__main__':
    main()
