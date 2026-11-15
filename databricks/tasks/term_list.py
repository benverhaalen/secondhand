"""Count Mercari competition title words and brands; DB20, never a current-price input.

Check: cd databricks && ../.venv/bin/python -m pytest tasks/test_term_list.py -q -p no:cacheprovider
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

COLUMNS = ('kind', 'term', 'brand', 'n_rows', 'n_brands')


def select_sql(catalog):
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', catalog):
        raise ValueError('catalog must be a SQL identifier')
    return f"""WITH source_rows AS (
  SELECT kind, nullif(lower(trim(brand)), '') AS brand, {catalog}.market.title_terms(title) AS title_terms
  FROM {catalog}.market.comp WHERE source = 'mercari_kaggle'
), counts AS (
  SELECT kind, term, cast(NULL AS STRING) AS brand, count(*) AS n_rows, count(DISTINCT brand) AS n_brands
  FROM source_rows
  LATERAL VIEW explode(array_distinct(title_terms)) terms AS term
  GROUP BY kind, term
  UNION ALL
  SELECT kind, cast(NULL AS STRING) AS term, brand, count(*) AS n_rows, cast(1 AS BIGINT) AS n_brands
  FROM source_rows WHERE brand IS NOT NULL
  GROUP BY kind, brand
)
SELECT kind, term, brand, n_rows, n_brands FROM counts
WHERE n_rows >= {catalog}.market.market_min_n()
ORDER BY kind, term, brand"""


def write_sql(catalog):
    return f"INSERT OVERWRITE {catalog}.measures.term_list ({', '.join(COLUMNS)})\n{select_sql(catalog)}"


def main(argv=None):
    root = Path(__file__).resolve().parents[2] if '__file__' in globals() else None
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=root, required=root is None)
    parser.add_argument('--catalog', default='secondhand')
    args = parser.parse_args(argv)
    statement = write_sql(args.catalog)
    sys.path.insert(0, str(args.root.resolve() / 'log'))
    from secondhand_log import create_log, stdout_sink
    from pyspark.sql import SparkSession

    log = create_log(src='job.term_list', build=os.environ.get('SECONDHAND_BUILD', 'dev'), sink=stdout_sink)
    log.job('term_list', 'term_list', 'running', source='mercari_kaggle', catalog=args.catalog)
    try:
        spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()

        def execute(sql):
            return log.call('db', 'term_list_sql', {'sql': sql}, lambda: spark.sql(sql).collect(),
                            describe=lambda rows: {'rows': len(rows)})

        source = execute(f"SELECT count(*) AS n_rows FROM {args.catalog}.market.comp WHERE source = 'mercari_kaggle'")[0]
        log.event('note', {'msg': 'Term list source count', 'source': 'mercari_kaggle', 'n_rows': source['n_rows']})
        execute(statement)
        counts = execute(f"SELECT count(*) AS rows, count(term) AS terms, count(brand) AS brands "
                         f"FROM {args.catalog}.measures.term_list")[0].asDict()
        log.job('term_list', 'term_list', 'done', **counts)
        log.end()
        return counts
    except Exception as error:
        log.error('term_list', error)
        log.job('term_list', 'term_list', 'failed')
        log.end(ok=False)
        raise


if __name__ == '__main__':
    main()
