"""Shared-fixture comparisons; strings and integer cents stay exact."""
from __future__ import annotations

import json

from proof import answer, basisHash, guard


def proof_case(case: dict) -> dict:
    a = answer(case['value'], case['rows'], case['cite'], case['now'], case.get('passed', []))
    return {'hash': basisHash(case['rows']), 'answer': a, 'guard': guard(a, case['rules'])}


def _equal(ts, py) -> bool:
    if isinstance(ts, bool) or isinstance(py, bool):
        return type(ts) is type(py) and ts == py
    if isinstance(ts, (int, float)) and isinstance(py, (int, float)):
        return round(ts, 6) == round(py, 6) if isinstance(ts, float) or isinstance(py, float) else ts == py
    if type(ts) is not type(py):
        return False
    if isinstance(ts, dict):
        return ts.keys() == py.keys() and all(_equal(ts[k], py[k]) for k in ts)
    if isinstance(ts, list):
        return len(ts) == len(py) and all(_equal(a, b) for a, b in zip(ts, py))
    return ts == py


def compare(fixtures: list[dict], ts_out: list[dict], py_fn) -> list[dict]:
    expected = {row['case']: row['value'] for row in ts_out}
    names = [case['case'] for case in fixtures]
    if len(expected) != len(ts_out) or len(set(names)) != len(names) or set(expected) != set(names):
        raise ValueError('fixtures and TypeScript outputs must have the same unique case names')
    rows = []
    for case in fixtures:
        ts, py = expected[case['case']], py_fn(case)
        rows.append({'engine': case.get('engine', 'proof'), 'case': case['case'],
                     'ts_value': ts, 'py_value': py, 'equal': _equal(ts, py)})
    return rows


def table_rows(results: list[dict], code_sha: str, checked_at) -> list[dict]:
    return [{**row, 'ts_value': json.dumps(row['ts_value'], ensure_ascii=False, sort_keys=True),
             'py_value': json.dumps(row['py_value'], ensure_ascii=False, sort_keys=True),
             'code_sha': code_sha, 'checked_at': checked_at} for row in results]
