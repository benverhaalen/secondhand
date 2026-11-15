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
DATA_PATTERN = re.compile(r'^(synthetic|example|captured|dataset:[^\n\r\u0085\u2028\u2029]+|live:[^\n\r\u0085\u2028\u2029]+)(?:\r\n|[\n\r\u0085\u2028\u2029])?\Z')


def _json_key_word(word):
    # JSON can encode ASCII field names with Unicode escapes, too.
    return ''.join('(?:' + c + r'|\\u' + format(ord(c), '04x') + r'|\\u'
                   + format(ord(c.upper()), '04x') + ')' for c in word)


_JSON_KEY_CHAR = r'(?:[^"\\]|\\(?:["\\/bfnrt]|u[0-9a-f]{4}))'
_JSON_LOWER_OR_DIGIT = r'(?:(?-i:[a-z0-9])|\\u00(?:3[0-9]|6[1-9a-f]|7[0-9a]))'
_JSON_UPPER = r'(?:(?-i:[A-Z])|\\u00(?:4[1-9a-f]|5[0-9a]))'
_SAFE_SUFFIX = '|'.join(map(_json_key_word, ('ids', 'id', 'count', 'type', 'len', 'length', 'at', 'ms', 'in', 'out', 'hash')))
_MESSAGE_FIELDS = '|'.join(map(_json_key_word, ('text', 'message', 'body', 'content', 'prompt')))
# core.log_event.body contains the remaining envelope. Match its keys at any depth,
# retaining the logger's safe suffixes and {"masked":"key"} placeholders.
MESSAGE_TEXT_PATTERN = re.compile(
    r'(?i)"(?!(?:' + _JSON_KEY_CHAR + r'*(?:[^a-z0-9"\\]|\\u00(?:5f|2d)|'
    + _JSON_LOWER_OR_DIGIT + r'(?=' + _JSON_UPPER + r')))?'
    r'(?:' + _SAFE_SUFFIX + r')")' + _JSON_KEY_CHAR + r'*(?:' + _MESSAGE_FIELDS + r')' + _JSON_KEY_CHAR + r'*"\s*:\s*'
    r'(?!null\b|\{\s*"' + _json_key_word('masked') + r'"\s*:\s*"' + _json_key_word('key')
    + r'"\s*\})(?:"(?:[^"\\]|\\.)+"|\[|\{)')

REFUSAL_SCHEMA = 'refused_at TIMESTAMP, job STRING, table_name STRING, row_id STRING, rule STRING, data STRING'


def _outside(value, allowed):
    return value is not None and value not in allowed


def _site(row, site):
    return (row.get('site') == site or row.get('data') == 'live:' + site
            or re.search(r'(^|[.])' + site + r'([.]|$)', row.get('source_route') or '') is not None)


def _ebay_evidence(row):
    return (_site(row, 'ebay') or row.get('_observation_ebay') is True
            or re.search(r'(?i)^https?://([^/]+\.)?ebay\.[^/]+(/|$)', row.get('source_url') or '') is not None)


RULES = {
    'guarded_number_state': ('guarded_number', lambda r: _outside(r.get('state'), ('shown', 'hidden', 'not_found'))),
    'guarded_number_shown_citation': ('guarded_number', lambda r: r.get('state') == 'shown' and r.get('citation_id') is None),
    'guarded_number_hidden_reason': ('guarded_number', lambda r: r.get('state') == 'hidden' and r.get('hide_reason') is None),
    'guarded_number_citation_fk': ('guarded_number', lambda r: r.get('state') == 'shown' and r.get('citation_id') is not None and r.get('_citation_exists') is not True),
    'guarded_number_basis_level': ('guarded_number', lambda r: (r.get('metric') or '').startswith('valuation.') and r.get('basis_level') not in BASIS_LEVELS),
    'claim_check_verdict': ('claim_check', lambda r: _outside(r.get('verdict'), ('pass', 'hold', 'abstain', 'contradicted'))),
    'principal_map_unlogged_wildcard': ('principal_map', lambda r: r.get('user_id') == '*' and r.get('_break_glass_open') is not True),
    'decision_policy_mode': ('decision', lambda r: _outside(r.get('policy_mode'), ('auto', 'ask', 'locked', 'never'))),
    'observation_public_rights': ('observation', lambda r: r.get('user_id') is None and r.get('rights_mode') != 'public'),
    'observation_dupe': ('observation', lambda r: _site(r, 'dupe')),
    'evidence_dupe': ('evidence', lambda r: _site(r, 'dupe') or r.get('_observation_dupe') is True),
    'observation_ebay_model': ('observation', lambda r: r.get('_evidence_may_model') is True and (_site(r, 'ebay') or r.get('_evidence_ebay') is True)),
    'evidence_ebay_model': ('evidence', lambda r: r.get('may_model') is True and _ebay_evidence(r)),
    'observation_apify_site': ('observation', lambda r: r.get('via') == 'apify' and r.get('site') != 'facebook'),
    'evidence_apify_site': ('evidence', lambda r: r.get('_observation_apify_site') is True),
    'log_event_message_text': ('log_event', lambda r: MESSAGE_TEXT_PATTERN.search(r.get('body') or '') is not None),
    **{table + '_data': (table, lambda r: r.get('data') is not None and DATA_PATTERN.search(r['data']) is None)
       for table in DATA_TABLES},
}


def _row_id(table, row):
    if table == 'principal_map':
        return row.get('principal')
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


def guard_batch(spark, log, job, table, rows, *, citation_ids=(), evidence_rows=(), observation_rows=()):
    """Resolve references, check the whole batch, persist refusals, then raise."""
    short = table.rsplit('.', 1)[-1]
    checked = rows
    if short in ('observation', 'evidence') and rows:
        catalog = table.split('.')[0] if '.' in table else 'secondhand'
        def references(name, field, ids):
            if not ids:
                return []
            literals = ', '.join("'" + value.replace("'", "''") + "'" for value in sorted(ids))
            query = f'SELECT * FROM {catalog}.core.{name} WHERE {field} IN ({literals})'
            return log.call('db', 'guard_' + name, {'candidates': len(ids)},
                            lambda: [r.asDict() for r in spark.sql(query).collect()], describe=lambda rs: {'rows': len(rs)})

        if short == 'observation':
            known = {r['id']: r for r in evidence_rows}
            needed = {r['evidence_id'] for r in rows if r.get('evidence_id')} - known.keys()
            known.update((r['id'], r) for r in references('evidence', 'id', needed))
            checked = [{**r, '_evidence_may_model': known.get(r.get('evidence_id'), {}).get('may_model') is True,
                        '_evidence_ebay': _ebay_evidence(known.get(r.get('evidence_id'), {}))} for r in rows]
        else:
            related = list(observation_rows) + references('observation', 'evidence_id', {r['id'] for r in rows})
            by_evidence = {}
            for observation in related:
                by_evidence.setdefault(observation.get('evidence_id'), []).append(observation)
            checked = [{**r,
                        '_observation_ebay': any(_site(o, 'ebay') for o in by_evidence.get(r['id'], [])),
                        '_observation_dupe': any(_site(o, 'dupe') for o in by_evidence.get(r['id'], [])),
                        '_observation_apify_site': any(o.get('via') == 'apify' and o.get('site') != 'facebook'
                                                       for o in by_evidence.get(r['id'], []))} for r in rows]
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
