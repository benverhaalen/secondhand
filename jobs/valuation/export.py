"""Export fitted params without requiring a warehouse read on a served request."""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import math
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

if __package__ in (None, ''):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from param.registry import FIELDS, complete_row, scope_key
from valuation.sale_curve import _timestamp, fit_group


def _param(name, scope, value, ids, now, citation):
    row = complete_row({'name': name, 'scope': scope, 'family': 'model_ref',
                        'value_or_hyperparams': value, 'version': 1,
                        'fitted_on_ids_hash': hashlib.sha256('\n'.join(sorted(ids)).encode()).hexdigest(),
                        'n_eff': len(ids), 'status': 'champion', 'frozen': False,
                        'promoted_at': now, 'origin': 'fit'})
    return {**{field: row[field] for field in FIELDS}, 'citation': citation}  # eng-en3-export-shape: run id + table


def _groups(rows):
    groups = defaultdict(list)
    for row in rows:
        scope = {'kind': row.get('kind'), 'site': row.get('site') or None}
        groups[scope_key(scope)].append(row)
    for key, members in sorted(groups.items()):
        canonical = json.loads(key)
        yield {'kind': canonical.get('kind'), 'site': canonical.get('site')}, members


def _positive(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0


def split_date(value):
    try:
        parsed = date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValueError('--split-at must be YYYY-MM-DD') from None
    if parsed.isoformat() != value:
        raise ValueError('--split-at must be YYYY-MM-DD')
    return value


def _calibration(rows, holdout, split_at):
    datasets = {row['data'] for row in rows + holdout}
    scores = sorted(max(math.log(r['q10_cents']) - math.log(r['truth_cents']),
                        math.log(r['truth_cents']) - math.log(r['q90_cents']), 0) for r in rows)
    n = len(scores)
    rank = min(n, math.ceil((n + 1) * .8))
    q_g = scores[rank - 1]
    holdout_n = len(holdout)
    raw_hits = sum(r['q10_cents'] <= r['truth_cents'] <= r['q90_cents'] for r in holdout)
    widened_hits = sum(r['q10_cents'] * math.exp(-q_g) <= r['truth_cents'] <= r['q90_cents'] * math.exp(q_g)
                       for r in holdout)
    return {'Q_g': q_g, 'n': n,
            'hits': sum(r['q10_cents'] <= r['truth_cents'] <= r['q90_cents'] for r in rows),
            'split_at': split_at, 'holdout_n': holdout_n,
            'holdout_raw_coverage': round(raw_hits / holdout_n, 4) if holdout_n else None,
            'holdout_coverage': round(widened_hits / holdout_n, 4) if holdout_n else None,
            'nominal': .8, 'fitted_on': next(iter(datasets)), 'use_scope': 'hackathon_demo'}


def build_rows(comps, estimates, contestant, now, run_id, code_version, *, split_at=None, counts=None, log=None):
    if estimates or split_at is not None:
        split_at = split_date(split_at)
    counts = counts if counts is not None else Counter()
    now = now.isoformat() if isinstance(now, datetime) else now
    allowed = []
    for row in comps:
        if not (row.get('may_model') is True or row.get('may_model') == 'True'):
            counts['forbidden_comps'] = counts.get('forbidden_comps', 0) + 1
        elif row.get('price_type') not in ('sold', 'ended_unsold') or not row.get('listed_at') or not row.get('at'):
            counts['ineligible_comps'] = counts.get('ineligible_comps', 0) + 1
        else:
            allowed.append(row)
    params = []
    for scope, members in _groups(allowed):
        value = fit_group(members)
        if value is not None:
            params.append(_param('valuation_sale_curve', scope, value, [r['row_id'] for r in members], now,
                                 f'{run_id}:market.comp_for_model'))
        else:
            counts['omitted_sale_groups'] = counts.get('omitted_sale_groups', 0) + 1
    valid = []
    for row in estimates:
        if row.get('contestant') != contestant:
            continue
        if not all(_positive(row.get(field)) for field in ('q10_cents', 'q90_cents', 'truth_cents')):
            counts['invalid_estimates'] = counts.get('invalid_estimates', 0) + 1
            continue
        try:
            as_of = datetime.fromtimestamp(_timestamp(row.get('as_of')), timezone.utc).date()
        except (AttributeError, TypeError, ValueError, OverflowError, OSError):
            counts['invalid_estimates'] = counts.get('invalid_estimates', 0) + 1
            continue
        valid.append({**row, 'as_of': as_of})
    for scope, members in _groups(valid):
        datasets = {r['data'] for r in members}
        if len(datasets) != 1 or not next(iter(datasets)).startswith('dataset:'):
            counts['omitted_calibration_groups'] = counts.get('omitted_calibration_groups', 0) + 1
            if log is not None:
                log.note('omitted calibration group', level='info', scope=scope,
                         reason='calibration scope must contain one dataset provenance')
            continue
        cutoff = date.fromisoformat(split_at)
        fit = [r for r in members if r['as_of'] < cutoff]
        holdout = [r for r in members if r['as_of'] >= cutoff]
        if len(fit) >= 30:
            params.append(_param('valuation_calibration', scope, _calibration(fit, holdout, split_at),
                                 [r['item_id'] for r in fit], now, f'{run_id}:measures.backtest_estimate'))
        else:
            counts['omitted_calibration_groups'] = counts.get('omitted_calibration_groups', 0) + 1
    return {'version': 1, 'exported_at': now, 'run_id': run_id, 'code_version': code_version, 'params': params}


def read_comps(path):
    with gzip.open(path, 'rt', encoding='utf-8', newline='') as stream:
        return list(csv.DictReader(stream))


def _read_estimates(path):
    with Path(path).open(encoding='utf-8') as stream:
        return [json.loads(line) for line in stream if line.strip()]


def code_version(root):
    result = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=root, capture_output=True, text=True, check=False)
    return result.stdout.strip() if result.returncode == 0 else 'dev'


def main(argv=None, *, log_path=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--comps', required=True)
    parser.add_argument('--estimates')
    parser.add_argument('--split-at', type=split_date)
    parser.add_argument('--contestant', default='engine_all_on')
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args(argv)
    if args.estimates and not args.split_at:
        parser.error('--split-at is required with --estimates')
    root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(root / 'log'))
    from secondhand_log import create_log, file_sink
    now = datetime.now(timezone.utc).isoformat()
    path = Path(log_path) if log_path else Path('/tmp') / f'valuation-export-{datetime.now(timezone.utc):%Y%m%dT%H%M%S%f}.jsonl'
    log = create_log(src='job.valuation.export', build='dev', sink=file_sink(str(path)),
                     config={'contestant': args.contestant, 'run_id': args.run_id, 'split_at': args.split_at})
    log.job(args.run_id, 'export_params', 'running')
    try:
        version = log.call('tool', 'code_version', {}, lambda: code_version(root))
        comps = log.call('tool', 'read_comps', {'file': args.comps}, lambda: read_comps(args.comps),
                         describe=lambda rs: {'rows': len(rs)})
        estimates = log.call('tool', 'read_estimates', {'file': args.estimates}, lambda: _read_estimates(args.estimates),
                             describe=lambda rs: {'rows': len(rs)}) if args.estimates else []
        counts = Counter()
        out = log.timed('valuation.export', lambda: build_rows(comps, estimates, args.contestant, now,
                                                               args.run_id, version, split_at=args.split_at, counts=counts, log=log))
        log.note('param export counts', **counts)
        log.call('tool', 'write_params', {'file': args.out, 'rows': len(out['params'])},
                 lambda: Path(args.out).write_text(json.dumps(out, allow_nan=False) + '\n', encoding='utf-8'))
        log.job(args.run_id, 'export_params', 'done', rows=len(out['params']))
        log.end()
        return out
    except Exception as error:
        log.error('valuation.export', error)
        log.job(args.run_id, 'export_params', 'failed', error=error)
        log.end(ok=False)
        raise


if __name__ == '__main__':
    main()
