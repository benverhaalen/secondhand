"""Guarded analytics metrics with deterministic input and parameter lineage."""
import hashlib
import json
import math
from pathlib import Path
from datetime import datetime, timezone


def _date(row):
    raw = row.get('at') or row.get('read_at') or row.get('ended_at') or row.get('sold_at')
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return None  # Invalid evidence is explicitly hidden by the guard.
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()


def guarded(metric, value, basis, *, versions, filters=None, unit=None, missing=False):
    basis = sorted(basis, key=lambda r: json.dumps(r, sort_keys=True))
    frozen = json.dumps(basis, sort_keys=True, separators=(',', ':'), allow_nan=False)
    digest = hashlib.sha256(frozen.encode()).hexdigest()
    dates = sorted(date for row in basis if (date := _date(row)))
    citation = dict(metric=metric, filters=filters or {}, basis_ids=sorted({str(r['id']) for r in basis if r.get('id')}),
                    basis_hash=digest, param_versions=dict(versions), definition_version='platform-analytics:3',
                    code_version=hashlib.sha256(b''.join(p.read_bytes() for p in sorted(Path(__file__).parent.glob('*.py')) if not p.name.startswith('test_'))).hexdigest(),
                    table_versions=[], model_version=None, computed_at=dates[-1] if dates else None)
    citation['id'] = 'cit_' + hashlib.sha256(json.dumps(citation, sort_keys=True).encode()).hexdigest()
    numbers = value if isinstance(value, (list, tuple)) else [value]
    valid = bool(basis) and len(dates) == len(basis) and all(r.get('id') for r in basis) and len({r['id'] for r in basis}) == len(basis) and not missing and value is not None and all(
        isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in numbers)
    return dict(value=value if valid else None, state='shown' if valid else 'hidden',
                hide_reason=None if valid else 'source_gap', basis_count=len(basis),
                as_of=citation['computed_at'], citation_id=citation['id'], citation=citation, unit=unit)
