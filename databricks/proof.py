"""Python twin of app/src/engines/proof/proof.ts (spec/product.md §6)."""
from __future__ import annotations

import hashlib
import math
import re
from datetime import datetime, timedelta, timezone


def utf16_sort_key(value: str) -> bytes:
    """JavaScript's default sort compares UTF-16 code units, including surrogate pairs."""
    return value.encode('utf-16-be', errors='surrogatepass')


def _number_string(value) -> str:
    if value is None:
        return ''
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def basisHash(rows: list[dict]) -> str:
    lines = [f"{r['id']}:{_number_string(r.get('price_cents'))}" for r in rows]
    return hashlib.sha256('\n'.join(sorted(lines, key=utf16_sort_key)).encode('utf-8')).hexdigest()


def _date(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError('date must be an ISO string')
    parts = re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})(.*)', value)
    if not parts:
        raise ValueError('date must be an ISO string')
    year, month, day = map(int, parts.group(1, 2, 3))
    suffix = parts.group(4)
    if not 1 <= day <= 31:
        raise ValueError('day must be between 1 and 31')
    # Date.parse normalizes short months and permits exactly 24:00 at day end.
    end_of_day = bool(re.fullmatch(r'T24:00(?::00(?:\.0+)?)?(?:Z|[+-]\d{2}:?\d{2})?', suffix))
    if end_of_day:
        suffix = suffix.replace('T24:', 'T00:', 1)
    date = datetime.fromisoformat(f'{year:04d}-{month:02d}-01{suffix}'.replace('Z', '+00:00'))
    date += timedelta(days=day - 1 + int(end_of_day))
    # The jobs run in UTC; date-only inputs also mean midnight UTC in Date.parse.
    date = date.replace(tzinfo=timezone.utc) if date.tzinfo is None else date.astimezone(timezone.utc)
    return date.replace(microsecond=date.microsecond // 1000 * 1000)


def _iso(date: datetime) -> str:
    return date.isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def basisOf(rows: list[dict], now: str, passed: list[str]) -> dict:
    dates = []
    for row in rows:
        try:
            dates.append(_date(row['at']))
        except (KeyError, ValueError, TypeError):
            continue  # basisOf, like TS, drops unreadable dates; answer refuses them.
    oldest, newest = min(dates), max(dates)
    weights = [1 if r.get('weight') is None else r['weight'] for r in rows]
    sw, sw2 = sum(weights), sum(w * w for w in weights)
    return {'ids': [r['id'] for r in rows],
            'sources': sorted({r['source'] for r in rows}, key=utf16_sort_key),
            'count': len(rows), 'n_eff': sw * sw / sw2 if sw2 else 0,
            'oldest': _iso(oldest), 'newest': _iso(newest),
            'age_days': math.floor((_date(now) - newest).total_seconds() / 86400), 'passed': passed}


def answer(value, rows: list[dict], cite: dict, now: str, passed: list[str] | None = None) -> dict:
    refused = {'ok': False, 'refused': 'no_basis'}
    if not rows:
        return refused
    for row in rows:
        if not row.get('id') or not row.get('source'):
            return refused
        try:
            _date(row.get('at'))
        except (ValueError, TypeError):
            return refused
    basis = basisOf(rows, now, passed if passed is not None else [])
    basis_hash = basisHash(rows)
    citation = {**cite, 'id': 'cit_' + basis_hash[:16], 'basis_ids': basis['ids'],
                'basis_hash': basis_hash, 'computed_at': now}
    return {'ok': True, 'value': value, 'basis': basis, 'citation': citation}


def guard(a: dict, rules: dict) -> dict:
    if not a['ok']:
        return {'state': 'hidden', 'hide_reason': 'source_gap', 'basis_count': 0}
    g = {'value': a['value'], 'basis_count': a['basis']['count'], 'as_of': a['basis']['newest'],
         'citation_id': a['citation']['id'], 'state': 'shown'}
    value = a['value']
    reason = None
    if a['basis']['n_eff'] < rules['min_n_eff']:
        reason = 'too_few'
    elif a['basis']['age_days'] > rules['max_age_days']:
        reason = 'stale'
    elif isinstance(value, dict) and value['hi'] - value['lo'] > (value['lo'] + value['hi']) / 2:
        reason = 'too_wide'
    return {**g, 'state': 'hidden', 'hide_reason': reason} if reason else g
