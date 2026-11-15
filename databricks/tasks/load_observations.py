"""Load public search reads with per-row rights and a reason for each refused line."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple

RIGHTS = ('may_store', 'may_model', 'may_show', 'may_share')
SCOPES = ('none', 'hackathon_demo', 'product')
LIVE_SITES = ('ebay', 'mercari', 'poshmark', 'depop', 'facebook', 'brand')
PROVIDERS = ('apify', 'treg')
SCOPE_COMMENT = 'hackathon_demo or product: what this row may be used for; shown-only rows are hackathon_demo with may_model false on their evidence'
NEW_COLUMNS = {
    'observation': {
        'use_scope': f"STRING COMMENT '{SCOPE_COMMENT}'",
        'keep_until': "TIMESTAMP COMMENT 'When this public read must stop being kept; null means no stated deadline.'",
        'channel': "STRING COMMENT 'official_retail or secondhand.'",
        'query': "STRING COMMENT 'Public search terms, never who asked.'",
        'via': "STRING COMMENT 'The provider used for this read, or null for a direct read.'",
        'job_id': "STRING COMMENT 'The finished search that landed this read.'",
    },
    'evidence': {'use_scope': "STRING COMMENT 'hackathon_demo or product: what this evidence may be used for.'"},
}
SCHEMAS = {
    'observation': 'data STRING, id STRING, user_id STRING, created_at TIMESTAMP, updated_at TIMESTAMP, version INT, kind STRING, site STRING, product_id STRING, subject_ref STRING, observed_at TIMESTAMP, price_cents BIGINT, currency STRING, price_type STRING, seller_handle STRING, payload STRING, evidence_id STRING, source_route STRING, retention_class STRING, rights_mode STRING, use_scope STRING, keep_until TIMESTAMP, channel STRING, query STRING, via STRING, job_id STRING',
    'evidence': 'data STRING, id STRING, user_id STRING, created_at TIMESTAMP, updated_at TIMESTAMP, version INT, shape STRING, kind STRING, ref STRING, source_url STRING, read_at TIMESTAMP, snapshot_ref STRING, fingerprint STRING, extractor_version STRING, may_store BOOLEAN, may_model BOOLEAN, may_show BOOLEAN, may_share BOOLEAN, ttl_days INT, use_scope STRING',
    'load_report': 'file STRING, lines BIGINT, loaded BIGINT, rejected BIGINT, reasons STRING',
}


class Parsed(NamedTuple):
    observations: list[dict]
    evidence: list[dict]
    rejects: list[dict]


def _object(value, fields, name):
    if not isinstance(value, dict):
        raise ValueError(f'{name} must be an object')
    missing = fields - value.keys()
    if missing:
        raise ValueError(f'{name} missing {sorted(missing)[0]}')


def _string(value, field, nullable=False):
    if nullable and value is None:
        return
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'{field} must be a nonempty string' + (' or null' if nullable else ''))


def _time(value, field, nullable=False):
    _string(value, field, nullable)
    if value is None:
        return None
    try:
        date = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as error:
        raise ValueError(f'{field} must be an ISO timestamp') from error
    return date.replace(tzinfo=timezone.utc) if date.tzinfo is None else date.astimezone(timezone.utc)


def _public_only(value):
    if isinstance(value, dict):
        for key, nested in value.items():
            if key in ('user_id', 'user', 'session'):
                raise ValueError(f'public read contains forbidden key {key}')
            _public_only(nested)
    elif isinstance(value, list):
        for nested in value:
            _public_only(nested)


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate JSON key')
        result[key] = value
    return result


def _invalid_constant(value):
    raise ValueError('JSON contains a nonfinite number')


def _validate(row):
    _object(row, set(), 'observation')
    _public_only(row)
    if type(row.get('v')) is not int or row['v'] != 1:
        raise ValueError('v must be 1')
    if row.get('site') == 'dupe':
        raise ValueError('site dupe is never stored')
    if row.get('use_scope') not in SCOPES:
        raise ValueError('use_scope must be none, hackathon_demo or product')
    for field in RIGHTS:
        if type(row.get(field)) is not bool:
            raise ValueError(f'{field} must be a boolean')
    if not row['may_store']:
        raise ValueError('may_store false is never stored')
    fields = {'id', 'data', 'kind', 'site', 'product_id', 'query', 'subject_ref', 'observed_at',
              'payload', 'source_route', 'retention_class', 'rights_mode', 'channel', 'via', 'actor',
              'ttl', 'keep_until', 'evidence', 'job_id', 'landed_at'}
    _object(row, fields, 'observation')
    for field in ('id', 'site', 'subject_ref', 'source_route', 'retention_class', 'rights_mode', 'job_id'):
        _string(row[field], field)
    for field in ('product_id', 'query', 'via', 'actor', 'ttl'):
        _string(row[field], field, nullable=True)
    if row['data'] != 'live:' + row['site']:
        raise ValueError('data must be live:<site> matching site')
    if not re.fullmatch(r'obs_[0-9a-fA-F]{16}', row['id']):
        raise ValueError('id must be obs_ followed by 16 hex digits')
    if row['kind'] not in ('listing', 'price'):
        raise ValueError('kind must be listing or price')
    if row['channel'] not in ('official_retail', 'secondhand'):
        raise ValueError('channel must be official_retail or secondhand')
    observed = _time(row['observed_at'], 'observed_at')
    keep_until = _time(row['keep_until'], 'keep_until', nullable=True)
    _time(row['landed_at'], 'landed_at')
    _object(row['payload'], set(), 'payload')
    price = row['payload'].get('price_cents')
    if price is not None and (type(price) is not int or not -(2**63) <= price < 2**63):
        raise ValueError('payload.price_cents must be a 64-bit integer')
    _string(row['payload'].get('currency'), 'payload.currency', nullable=True)
    price_type = row['payload'].get('price_type')
    if price_type is not None and price_type not in ('sold', 'asking'):
        raise ValueError('payload.price_type must be sold or asking')
    _object(row['evidence'], {'source_url', 'read_at', 'fingerprint', 'extractor_version'}, 'evidence')
    for field in ('source_url', 'fingerprint', 'extractor_version'):
        _string(row['evidence'][field], 'evidence.' + field)
    read_at = _time(row['evidence']['read_at'], 'evidence.read_at')
    return observed, keep_until, read_at


def _ttl_days(ttl):
    match = re.fullmatch(r'(?:P(\d+)D|(\d+)(?:d| days?)?)', ttl or '')
    if not match:
        return None
    days = int(match[1] or match[2])
    return days if days < 2**31 else None


def _source_rights(row, policies):
    # site is the product.md id. A provider never borrows the direct page's rights.
    if row['site'] not in LIVE_SITES or row['via'] is not None and row['via'] not in PROVIDERS:
        raise ValueError('source has no rights row')
    source = row['site'] + (':' + row['via'] if row['via'] else '')
    policy = policies.get(source)
    if policy is None or row['via'] == 'apify' and row['site'] != 'facebook':
        raise ValueError('source has no rights row')
    if row['may_model'] and (row['site'] == 'ebay' or re.search(r'^ebay|_ebay|ebay_', source, re.I)):
        raise ValueError('ebay content never models')
    for right in RIGHTS:
        if row[right] and not policy[right]:
            raise ValueError(right + ' exceeds source rights')
    if SCOPES.index(row['use_scope']) > SCOPES.index(policy['may_model_scope']):
        raise ValueError('use_scope exceeds source rights')


def parse(lines, *, source_rights=(), existing_evidence=()) -> Parsed:
    observations, evidence, rejects = [], [], []
    seen, sources = set(), {}
    known = {row['id']: row for row in existing_evidence}
    policies = {row['source']: row for row in source_rights}
    loaded_at = datetime.now(timezone.utc)
    for number, line in enumerate(lines, 1):
        try:
            row = json.loads(line, object_pairs_hook=_unique_object, parse_constant=_invalid_constant)
            observed, keep_until, read_at = _validate(row)
            if row['id'] in seen:
                raise ValueError('duplicate id')
            # Reserve valid ids even if their evidence conflicts: a reparse must
            # never promote a duplicate whose evidence was absent from the lookup.
            seen.add(row['id'])
            _source_rights(row, policies)
            source = row['evidence']
            evidence_id = 'evd_' + hashlib.sha256((source['fingerprint'] + source['source_url']).encode()).hexdigest()[:16]
            common = {'data': row['data'], 'user_id': None, 'created_at': loaded_at,
                      'updated_at': loaded_at, 'version': 1, 'use_scope': row['use_scope']}
            evidence_row = {**common, 'id': evidence_id, 'shape': 'comp', 'kind': None, 'ref': None,
                            'source_url': source['source_url'], 'read_at': read_at, 'snapshot_ref': None,
                            'fingerprint': source['fingerprint'], 'extractor_version': source['extractor_version'],
                            **{key: row[key] for key in RIGHTS}, 'ttl_days': _ttl_days(row['ttl'])}
            prior = sources.get(evidence_id, known.get(evidence_id))
            if prior is not None and any(prior.get(key) != evidence_row[key]
                                         for key in ('data', 'use_scope', 'ttl_days', *RIGHTS)):
                raise ValueError('evidence rights conflict')
            payload = json.dumps(row['payload'], allow_nan=False)
        except (ValueError, TypeError, UnicodeDecodeError) as error:
            reason = 'invalid UTF-8 JSON' if isinstance(error, UnicodeDecodeError) else str(error)
            if isinstance(error, json.JSONDecodeError):
                reason = 'invalid JSON'
            rejects.append({'line': number, 'reason': reason})
            continue
        observations.append({**common, **{key: row[key] for key in (
            'id', 'kind', 'site', 'product_id', 'subject_ref', 'source_route', 'retention_class',
            'rights_mode', 'channel', 'query', 'via', 'job_id')},
            'observed_at': observed, 'keep_until': keep_until,
            **{key: row['payload'].get(key) for key in ('price_cents', 'currency', 'price_type')},
            'seller_handle': None, 'payload': payload, 'evidence_id': evidence_id})
        if evidence_id not in sources:
            sources[evidence_id] = evidence_row
            evidence.append(evidence_row)
    return Parsed(observations, evidence, rejects)


def alter_plan(table, columns, *, user_nullable):
    missing = [f'{key} {definition}' for key, definition in NEW_COLUMNS[table.rsplit('.', 1)[-1]].items()
               if key not in columns]
    statements = [f'ALTER TABLE {table} ADD COLUMNS ({", ".join(missing)})'] if missing else []
    if not user_nullable:
        statements.append(f'ALTER TABLE {table} ALTER COLUMN user_id DROP NOT NULL')
    return statements


def main():
    root = Path(__file__).resolve().parents[2] if '__file__' in globals() else None
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=root, required=root is None)
    parser.add_argument('--catalog', default='secondhand')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', args.catalog):
        raise ValueError('catalog must be a SQL identifier')
    sys.path[:0] = [str(args.root.resolve() / 'log'), str(args.root.resolve() / 'databricks')]
    from secondhand_log import create_log, stdout_sink
    from pyspark.sql import SparkSession
    from databricks.sdk import WorkspaceClient
    from guard import guard_batch

    log = create_log(src='job.load_observations', build=os.environ.get('SECONDHAND_BUILD', 'dev'), sink=stdout_sink)
    log.job('load_observations', 'load_observations', 'running')
    try:
        spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
        files = WorkspaceClient().files
        directory = f'/Volumes/{args.catalog}/raw/landing/observations'
        report_table = f'{args.catalog}.measures.observation_load_report'

        def execute(statement):
            return log.call('db', 'observation_sql', {'sql': statement},
                            lambda: spark.sql(statement).collect(), describe=lambda rows: {'rows': len(rows)})

        def list_directory(path):
            return log.call('tool', 'list_observation_files', {'path': path},
                            lambda: list(files.list_directory_contents(path)), describe=lambda rows: {'entries': len(rows)})

        report_exists = log.call('db', 'observation_report_exists', {'table': report_table},
                                 lambda: spark.catalog.tableExists(report_table))
        loaded = {row['file'] for row in execute(f'SELECT file FROM {report_table}')} if report_exists else set()
        source_rights = execute(f'SELECT source, may_store, may_model, may_show, may_share, may_model_scope '
                                f'FROM {args.catalog}.governance.source_rights')
        paths = sorted(entry.path for day in list_directory(directory)
                       if day.is_directory and re.fullmatch(r'\d{4}-\d{2}-\d{2}', day.path.rsplit('/', 1)[-1])
                       for entry in list_directory(day.path)
                       if not entry.is_directory and entry.path.endswith('.jsonl') and entry.path not in loaded)
        migrated = False
        for path in paths:
            def read():
                with files.download(path).contents as stream:
                    return stream.read().splitlines()

            lines = log.call('tool', 'read_observation_file', {'file': path}, read,
                             describe=lambda rows: {'lines': len(rows)})
            parsed = parse(lines, source_rights=source_rights)
            if parsed.evidence:
                ids = ', '.join("'" + row['id'] + "'" for row in parsed.evidence)
                existing = execute(f'SELECT * FROM {args.catalog}.core.evidence WHERE id IN ({ids})')
                if existing:
                    parsed = parse(lines, source_rights=source_rights, existing_evidence=[row.asDict() for row in existing])
            for reject in parsed.rejects:
                log.event('note', {'msg': 'observation line rejected', 'file': path, **reject}, 'warn')
            batches = (('observation', parsed.observations), ('evidence', parsed.evidence))
            for name, rows in batches:
                guard_batch(spark, log, 'load_observations', f'{args.catalog}.core.{name}', rows,
                            evidence_rows=parsed.evidence, observation_rows=parsed.observations)
            if not migrated:
                for name, _ in batches:
                    table = f'{args.catalog}.core.{name}'
                    schema = log.call('db', 'observation_columns', {'table': table},
                                      lambda: spark.table(table).schema,
                                      describe=lambda schema: {'columns': len(schema.fields)})
                    user_nullable = next(field.nullable for field in schema.fields if field.name == 'user_id')
                    for statement in alter_plan(table, [field.name for field in schema.fields], user_nullable=user_nullable):
                        execute(statement)
                execute(f'CREATE TABLE IF NOT EXISTS {report_table} ({SCHEMAS["load_report"]}) '
                        "COMMENT 'Finished public observation files, accepted rows and refusal counts; keyed by file.'")
                migrated = True
            # Evidence lands first so every inserted observation has its source on retry.
            for name, rows in reversed(batches):
                if not rows:
                    continue
                table = f'{args.catalog}.core.{name}'
                temp = 'observations_load_' + name

                def merge():
                    spark.createDataFrame(rows, SCHEMAS[name]).createOrReplaceTempView(temp)
                    spark.sql(f'MERGE INTO {table} t USING {temp} s ON t.id = s.id '
                              'WHEN NOT MATCHED THEN INSERT *').collect()

                log.call('db', 'merge_public_' + name, {'table': table, 'rows': len(rows)}, merge)
            report = {'file': path, 'lines': len(lines), 'loaded': len(parsed.observations),
                      'rejected': len(parsed.rejects),
                      'reasons': json.dumps(dict(Counter(row['reason'] for row in parsed.rejects)), sort_keys=True)}

            def report_load():
                spark.createDataFrame([report], SCHEMAS['load_report']).createOrReplaceTempView('observations_report_input')
                spark.sql(f'MERGE INTO {report_table} t USING observations_report_input s ON t.file = s.file '
                          'WHEN NOT MATCHED THEN INSERT *').collect()

            log.call('db', 'report_public_observations', report, report_load)
        result = {'files': len(paths)}
        log.job('load_observations', 'load_observations', 'done', **result)
        log.end()
        return result
    except Exception as error:
        log.error('load_observations', error)
        log.job('load_observations', 'load_observations', 'failed')
        log.end(ok=False)
        raise


if __name__ == '__main__':
    main()
