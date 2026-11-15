"""Recheck citation basis hashes against the currently stored market comps."""
from __future__ import annotations

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

from proof import basisHash
from secondhand_log import create_log, stdout_sink

SCHEMA = 'citation_id STRING, metric STRING, basis_count INT, stored_hash STRING, recomputed_hash STRING, missing_ids ARRAY<STRING>, equal BOOLEAN, checked_at TIMESTAMP, code_sha STRING'


def recompute(citations: list[dict], comps_by_id: dict) -> list[dict]:
    checks = []
    for citation in citations:
        ids = citation['basis_ids']
        missing = [id for id in ids if id not in comps_by_id]
        weights = citation.get('basis_weights')
        rows = []
        for id in ids:
            if id not in comps_by_id:
                continue
            comp = comps_by_id[id]
            at = comp['at']
            if isinstance(at, datetime):
                at = (at.replace(tzinfo=timezone.utc) if at.tzinfo is None else at.astimezone(timezone.utc))
                at = at.isoformat(timespec='milliseconds').replace('+00:00', 'Z')
            row = {'id': id, 'source': comp['source'], 'at': at, 'weight': weights[id] if weights is not None else 1}
            if comp.get('price_cents') is not None:
                row['price_cents'] = comp['price_cents']
            rows.append(row)
        digest = basisHash(rows)
        checks.append({'citation_id': citation['id'], 'metric': citation['metric'], 'basis_count': len(ids),
                       'stored_hash': citation['basis_hash'], 'recomputed_hash': digest,
                       'missing_ids': missing, 'equal': not missing and digest == citation['basis_hash']})
    return checks


def main() -> dict:
    from pyspark.sql import SparkSession

    code_sha = os.environ.get('SECONDHAND_BUILD', 'dev')
    log = create_log(src='job.recompute', build=code_sha, sink=stdout_sink)
    log.job('recompute', 'recompute', 'running')
    try:
        spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
        def read_citations():
            table = spark.table('secondhand.core.citation')
            columns = ['id', 'metric', 'basis_ids', 'basis_hash']
            if 'basis_weights' in table.columns:
                columns.append('basis_weights')
            return [r.asDict() for r in table.select(*columns).collect()]

        citations = log.call('db', 'read_citations', {'table': 'secondhand.core.citation'},
                             read_citations,
                             describe=lambda rows: {'rows': len(rows)})
        comps = log.call('db', 'read_comps', {'table': 'secondhand.market.comp'},
                        lambda: [r.asDict() for r in spark.table('secondhand.market.comp')
                                 .select('comp_id', 'source', 'at', 'price_cents').collect()], describe=lambda rows: {'rows': len(rows)})
        checks = recompute(citations, {r['comp_id']: r for r in comps})
        checked_at = datetime.now(timezone.utc)
        rows = [{**r, 'checked_at': checked_at, 'code_sha': code_sha} for r in checks]
        log.call('db', 'write_recompute_check', {'table': 'secondhand.measures.recompute_check', 'rows': len(rows)},
                 lambda: spark.createDataFrame(rows, SCHEMA).write.mode('overwrite').saveAsTable('secondhand.measures.recompute_check'))
        result = {'rows': len(rows), 'unequal': sum(not r['equal'] for r in checks)}
        log.job('recompute', 'recompute', 'done', **result)
        log.end()
        return result
    except Exception as error:
        log.error('recompute', error)
        log.job('recompute', 'recompute', 'failed')
        log.end(ok=False)
        raise


if __name__ == '__main__':
    main()
