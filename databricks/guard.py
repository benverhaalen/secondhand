"""Rules shared by the write door and the nightly SQL net (09_guard.sql).

check() is pure. A shown number's transient _citation_exists field is the writer's
reference snapshot; guard_batch resolves it from Delta or validated pending citations.
SQL NOT IN and NOT RLIKE leave NULL to the tables' existing NOT NULL constraints.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

BASIS_LEVELS = ('variant', 'product', 'family', 'kind', 'prior')
DATA_TABLES = ('observation', 'evidence', 'citation', 'guarded_number', 'claim_check',
               'event', 'job', 'decision', 'storefront_snapshot', 'log_event')
# Spark RLIKE uses Java's dot and $: exclude all Java line terminators inside
# the source name, but accept one final terminator (including CRLF).
DATA_PATTERN = re.compile(r'^(synthetic|example|dataset:[^\n\r\u0085\u2028\u2029]+|live:[^\n\r\u0085\u2028\u2029]+)(?:\r\n|[\n\r\u0085\u2028\u2029])?\Z')
REFUSAL_SCHEMA = 'refused_at TIMESTAMP, job STRING, table_name STRING, row_id STRING, rule STRING, data STRING'


def _outside(value, allowed):
    return value is not None and value not in allowed


RULES = {
    'guarded_number_state': ('guarded_number', lambda r: _outside(r.get('state'), ('shown', 'hidden', 'not_found'))),
    'guarded_number_shown_citation': ('guarded_number', lambda r: r.get('state') == 'shown' and r.get('citation_id') is None),
    'guarded_number_hidden_reason': ('guarded_number', lambda r: r.get('state') == 'hidden' and r.get('hide_reason') is None),
    'guarded_number_citation_fk': ('guarded_number', lambda r: r.get('state') == 'shown' and r.get('citation_id') is not None and r.get('_citation_exists') is not True),
    'guarded_number_basis_level': ('guarded_number', lambda r: (r.get('metric') or '').startswith('valuation.') and r.get('basis_level') not in BASIS_LEVELS),
    'claim_check_verdict': ('claim_check', lambda r: _outside(r.get('verdict'), ('pass', 'hold', 'abstain', 'contradicted'))),
    'decision_policy_mode': ('decision', lambda r: _outside(r.get('policy_mode'), ('auto', 'ask', 'locked', 'never'))),
    **{table + '_data': (table, lambda r: r.get('data') is not None and DATA_PATTERN.search(r['data']) is None)
       for table in DATA_TABLES},
}


def _row_id(table, row):
    if table == 'log_event':
        return None if row.get('session') is None or row.get('seq') is None else f"{row['session']}:{row['seq']}"
    return row.get('id')


def check(table, rows):
    table = table.rsplit('.', 1)[-1]
    return [{'table_name': table, 'row_id': _row_id(table, row), 'rule': name}
            for row in rows for name, (target, fails) in RULES.items() if target == table and fails(row)]


class GuardRefused(ValueError):
    def __init__(self, violations):
        self.violations = violations
        super().__init__(f'guard refused {len(violations)} violations: ' + ', '.join(sorted({v['rule'] for v in violations})))


def refuse_or_pass(table, rows, log):
    violations = check(table, rows)
    log.event('note', {'msg': 'guard refused batch' if violations else 'guard passed batch',
                       'table': table, 'rows': len(rows), 'violations': len(violations),
                       'rules': sorted({v['rule'] for v in violations})}, 'error' if violations else 'info')
    if violations:
        raise GuardRefused(violations)


def guard_batch(spark, log, job, table, rows, *, citation_ids=()):
    """Resolve references, check the whole batch, persist refusals, then raise."""
    short = table.rsplit('.', 1)[-1]
    checked = rows
    if short == 'guarded_number':
        known = set(citation_ids)
        needed = {r['citation_id'] for r in rows if r.get('state') == 'shown' and r.get('citation_id') is not None} - known
        if needed:
            literals = ', '.join("'" + value.replace("'", "''") + "'" for value in sorted(needed))
            query = f'SELECT id FROM secondhand.core.citation WHERE id IN ({literals})'
            found = log.call('db', 'guard_citations', {'candidates': len(needed)},
                             lambda: spark.sql(query).collect(), describe=lambda rs: {'rows': len(rs)})
            known.update(r['id'] for r in found)
        checked = [{**row, '_citation_exists': row.get('citation_id') in known} for row in rows]
    try:
        refuse_or_pass(table, checked, log)
    except GuardRefused as error:
        by_id = {_row_id(short, row): row for row in rows}
        now = datetime.now(timezone.utc)
        refusals = [{'refused_at': now, 'job': job, **v, 'data': by_id[v['row_id']].get('data')}
                    for v in error.violations]
        log.call('db', 'guard_refusals', {'job': job, 'table': table, 'rows': len(refusals)},
                 lambda: spark.createDataFrame(refusals, REFUSAL_SCHEMA).write.mode('append').saveAsTable('secondhand.measures.guard_refusals'))
        raise
