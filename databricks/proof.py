"""Python twin of app/src/engines/proof/proof.ts (spec/product.md §6)."""
from __future__ import annotations

import copy
import hashlib
import json
import math
import re
from datetime import datetime, timedelta, timezone


def utf16_sort_key(value: str) -> bytes:
    """JavaScript's default sort compares UTF-16 code units, including surrogate pairs."""
    return value.encode('utf-16-be', errors='surrogatepass')


class CitationIdentityMustBeFiniteJSON(ValueError):
    pass


class DuplicateBasisId(ValueError):
    pass


class WeightMustBeFiniteAndNonnegative(ValueError):
    pass


class PriceCentsMustBeNonnegativeSafeIntegerCents(ValueError):
    pass


class NowMustBeAValidDate(ValueError):
    pass


class BasisMustContainRows(ValueError):
    pass


class BasisDateMustBeValidAndNotAfterNow(ValueError):
    pass


class MinNEffMustBeFiniteAndPositive(ValueError):
    pass


class MaxAgeDaysMustBeFiniteAndPositive(ValueError):
    pass


class ValueMustBeFinite(ValueError):
    pass


class RangeMustHaveFiniteOrderedBounds(ValueError):
    pass


def _finite(value) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def _number_string(value: int | float) -> str:
    # Python repr supplies shortest round-trip binary64 digits; JS places the
    # decimal point at different exponent boundaries and omits exponent zeroes.
    value = float(value)
    if value == 0:
        return '0'
    sign = '-' if value < 0 else ''
    mantissa, _, exponent = repr(abs(value)).partition('e')
    whole, _, fraction = mantissa.partition('.')
    digits = (whole + fraction).lstrip('0')
    point = len(whole) + int(exponent or '0')
    if whole == '0':
        point -= len(whole + fraction) - len(digits)
    digits = digits.rstrip('0')
    if 0 < point <= 21:
        result = digits[:point] + ('.' + digits[point:] if point < len(digits) else '0' * (point - len(digits)))
    elif -6 < point <= 0:
        result = '0.' + '0' * -point + digits
    else:
        power = point - 1
        result = digits[0] + ('.' + digits[1:] if len(digits) > 1 else '') + 'e' + ('+' if power >= 0 else '-') + str(abs(power))
    return sign + result


def _string(value: str) -> str:
    # JSON.stringify escapes lone surrogates, but emits valid pairs as Unicode.
    value = value.encode('utf-16-le', errors='surrogatepass').decode('utf-16-le', errors='surrogatepass')
    encoded = json.dumps(value, ensure_ascii=False)
    return ''.join(f'\\u{ord(c):04x}' if 0xd800 <= ord(c) <= 0xdfff else c for c in encoded)


def canonical(value) -> str:
    if value is None or isinstance(value, bool):
        return json.dumps(value)
    if isinstance(value, str):
        return _string(value)
    if _finite(value):
        return _number_string(value)
    if isinstance(value, list):
        return '[' + ','.join(canonical(v) for v in value) + ']'
    if type(value) is dict and all(isinstance(k, str) for k in value):
        return '{' + ','.join(_string(k) + ':' + canonical(value[k]) for k in sorted(value, key=utf16_sort_key)) + '}'
    raise CitationIdentityMustBeFiniteJSON('citation identity must be finite JSON')


def _hash(value) -> str:
    return hashlib.sha256(canonical(value).encode('utf-8')).hexdigest()


def _weight(row: dict):
    return 1 if row.get('weight') is None else row['weight']


def _validate_rows(rows: list[dict]) -> None:
    ids = set()
    for row in rows:
        id = row['id']
        if id in ids:
            raise DuplicateBasisId(f'duplicate basis id {id}')
        ids.add(id)
        weight = _weight(row)
        if not _finite(weight) or weight < 0:
            raise WeightMustBeFiniteAndNonnegative('weight must be finite and nonnegative')
        if 'price_cents' in row:
            price = row['price_cents']
            if not _finite(price) or price < 0 or price > 2**53 - 1 or int(price) != price:
                raise PriceCentsMustBeNonnegativeSafeIntegerCents('price_cents must be nonnegative safe integer cents')


def basisHash(rows: list[dict]) -> str:
    _validate_rows(rows)
    frozen = [{**{k: r[k] for k in ('id', 'source', 'at') if k in r},
               'weight': _weight(r), 'price_cents': r.get('price_cents')} for r in rows]
    frozen.sort(key=lambda r: utf16_sort_key(r['id']))
    return _hash(frozen)


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
    _validate_rows(rows)
    try:
        current = _date(now)
    except (ValueError, TypeError, OverflowError):
        raise NowMustBeAValidDate('now must be a valid date') from None
    if not rows:
        raise BasisMustContainRows('basis must contain rows')
    try:
        dates = [_date(row.get('at')) for row in rows]
    except (ValueError, TypeError, OverflowError):
        raise BasisDateMustBeValidAndNotAfterNow('basis date must be valid and not after now') from None
    if any(date > current for date in dates):
        raise BasisDateMustBeValidAndNotAfterNow('basis date must be valid and not after now')
    oldest, newest = min(dates), max(dates)
    weights = sorted(_weight(row) for row in rows)
    scale = weights[-1]
    weights = [weight / scale if scale else 0 for weight in weights]
    # A float start preserves JS reduce's left-to-right binary64 arithmetic.
    sw, sw2 = 0.0, 0.0
    for weight in weights:
        sw += weight
        sw2 += weight * weight
    return {'ids': [r['id'] for r in rows],
            'sources': sorted({r['source'] for r in rows}, key=utf16_sort_key),
            'count': len(rows), 'n_eff': sw * sw / sw2 if sw2 else 0,
            'oldest': _iso(oldest), 'newest': _iso(newest),
            'age_days': math.floor((current - newest).total_seconds() / 86400), 'passed': list(passed)}


def citationId(cite: dict, basis_hash: str) -> str:
    identity = {key: cite[key] for key in ('metric', 'filters', 'table_versions', 'definition_version',
                                         'code_version', 'param_versions', 'model_version') if key in cite}
    return 'cit_' + _hash({**identity, 'basis_hash': basis_hash})


_citation_id = citationId


def answer(value, rows: list[dict], cite: dict, now: str, passed: list[str] | None = None) -> dict:
    refused = {'ok': False, 'refused': 'no_basis'}
    try:
        current = _date(now)
    except (ValueError, TypeError, OverflowError):
        return refused
    if not rows:
        return refused
    for row in rows:
        if not row.get('id') or not row.get('source'):
            return refused
        try:
            if _date(row.get('at')) > current:
                return refused
        except (ValueError, TypeError, OverflowError):
            return refused
    basis = basisOf(rows, now, passed if passed is not None else [])
    basis_hash = basisHash(rows)
    citation = {**copy.deepcopy(cite), 'id': citationId(cite, basis_hash),
                'basis_ids': sorted(basis['ids'], key=utf16_sort_key),
                'basis_hash': basis_hash, 'computed_at': now}
    return {'ok': True, 'value': value, 'basis': basis, 'citation': citation}


def guard(a: dict, rules: dict) -> dict:
    for name, error in [('min_n_eff', MinNEffMustBeFiniteAndPositive), ('max_age_days', MaxAgeDaysMustBeFiniteAndPositive)]:
        if not _finite(rules.get(name)) or rules[name] <= 0:
            raise error(f'{name} must be finite and positive')
    if not a['ok']:
        return {'state': 'hidden', 'hide_reason': 'source_gap', 'basis_count': 0}
    value = a['value']
    if type(value) in (int, float):
        if not _finite(value):
            raise ValueMustBeFinite('value must be finite')
    elif not _finite(value.get('lo')) or not _finite(value.get('hi')) or value['lo'] > value['hi']:
        raise RangeMustHaveFiniteOrderedBounds('range must have finite ordered bounds')
    g = {'value': value, 'basis_count': a['basis']['count'], 'as_of': a['basis']['newest'],
         'citation_id': a['citation']['id'], 'state': 'shown'}
    age_days = (_date(a['citation']['computed_at']) - _date(a['basis']['newest'])).total_seconds() / 86400
    reason = None
    if a['basis']['n_eff'] < rules['min_n_eff']:
        reason = 'too_few'
    elif age_days > rules['max_age_days']:
        reason = 'stale'
    elif isinstance(value, dict) and value['hi'] > 3 * float(value['lo']):
        reason = 'too_wide'
    return {**g, 'state': 'hidden', 'hide_reason': reason} if reason else g
