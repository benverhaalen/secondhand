"""Demand's Python guarded-number boundary, matching engines/proof/proof.ts shapes.

Calculators retain their numerical rows for backtesting; only `guarded` is displayable.
No source rows means no publishable number.
"""
from datetime import datetime, timezone
from hashlib import sha256
import json
from demand.params import resolved
from demand.validation import finite, number, money


def _time(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def publication(value, *, metric, basis, as_of, params=None, filters=None):
    params = resolved(params)
    if value is None or not basis:
        return {'guarded': {'state': 'hidden', 'hide_reason': 'source_gap', 'basis_count': 0}, 'citation': None}
    rows = sorted(basis, key=lambda r: r['id'])
    ids = [r['id'] for r in rows]
    if len(set(ids)) != len(ids):
        raise ValueError('basis: duplicate ids')
    now = _time(as_of)
    weights = []
    for row in rows:
        if not row['id'] or not row['source']:
            raise ValueError('basis: missing id or source')
        if _time(row['at']) > now:
            raise ValueError('basis: future observation')
        weights.append(number(row.get('weight', 1), 'basis.weight'))
        if 'price_cents' in row:
            money(row['price_cents'])
    if isinstance(value, dict):
        number(value['lo'], 'lo')
        number(value['hi'], 'hi')
        if value['lo'] > value['hi']:
            raise ValueError('guarded interval: unordered endpoints')
    else:
        finite(value, 'value')
    largest = max(weights)
    weights = [w / largest for w in weights] if largest else weights
    sw = sum(weights)
    n_eff = sw * sw / sum(w * w for w in weights) if sw else 0
    number(n_eff, 'n_eff')
    newest = max(_time(row['at']) for row in rows)
    age = (now - newest).total_seconds() / 86400  # Seconds per day, fixed unit conversion.
    basis_hash = sha256(json.dumps(rows, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()
    cite = {'metric': metric, 'filters': filters or {}, 'table_versions': [],
            'definition_version': 'spec/engines/demand-and-trend.md', 'code_version': 'demand-2',
            'param_versions': params['versions'], 'model_version': 'demand-fc-1',
            'computed_at': as_of, 'basis_ids': ids, 'basis_hash': basis_hash, 'result': value}
    cite['id'] = 'cit_' + sha256(json.dumps(cite, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    v = params['values']
    reason = ('too_few' if n_eff < v['demand_proof_min_n_eff'] else
              'stale' if age > v['demand_proof_max_age_days'] else
              'too_wide' if isinstance(value, dict) and value['hi'] - value['lo'] > (value['lo'] + value['hi']) / 2 else None)
    guarded = {'state': 'hidden' if reason else 'shown', 'basis_count': len(rows),
               'as_of': newest.isoformat(), 'citation_id': cite['id']}
    if reason:
        guarded['hide_reason'] = reason
    else:
        guarded['value'] = value
    return {'guarded': guarded, 'citation': cite}
