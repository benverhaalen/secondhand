"""Fixed-file development reading of market-index §§2,3,6; no network or models."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
from statistics import median
import sys
import time
import unicodedata

from .attributes import KINDS, is_accessory, normalize_brand, record, search_text
from .brand_premium import BRAND_LOCKED, EXCLUDED, kind_summary, measure_cells

ROOT = Path(__file__).resolve().parents[2]
GROUPS = ('exact', 'same_product', 'similar_other_brand')
LABEL = 'development reading: asking prices on public search rows read 2026-11-15, one day, not sales'
REQUIRED = {
    'clothes': ('kind_type', 'material', 'construction'),
    'shoes': ('kind_type', 'material'),
    'furniture': ('kind_type', 'material'),
    'small_goods': ('kind_type', 'material_or_power'),
    'electronics': (),
}
MODEL_STOP_WORDS = frozenset(('the', 'and', 'with', 'original', 'model'))
STYLE_CODE = re.compile(r'\b(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9]+(?:-[A-Z0-9]+)*\b')


def _tokens(text):
    text = ''.join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c))
    return re.findall(r'[a-z0-9]+', text.lower())


def relation_by_code(row: dict, item: dict) -> str:
    identity = item['identity']
    rec = record(row, item['kind'])
    if rec['brand_norm'] != normalize_brand(identity['brand']):
        return 'unresolved'
    model = identity['model']
    codes = [match[1] for match in re.finditer(r'\(([^)]*)\)', model) if STYLE_CODE.fullmatch(match[1])]
    if identity.get('style_code'):
        codes.append(identity['style_code'])
    # Parenthesized style codes identify the variant; they are not mandatory model words.
    model_words = re.sub(r'\(([^)]*)\)',
                         lambda m: '' if STYLE_CODE.fullmatch(m[1]) else m[0], model)
    required = set(_tokens(model_words)) - MODEL_STOP_WORDS
    title_tokens = _tokens(row['title'])
    if not required or not required.issubset(title_tokens):
        return 'unresolved'
    size = record({'title': identity['variant']}, item['kind'])['size_class']
    title_words = ' ' + ' '.join(title_tokens) + ' '
    has_code = any(' ' + ' '.join(_tokens(code)) + ' ' in title_words for code in codes)
    return 'exact_by_code' if (size and size == rec['size_class']) or has_code else 'same_product_by_code'


def relation_group(relation):
    if relation in ('exact', 'exact_by_code'):
        return 'exact'
    if relation in ('likely_same_model', 'same_family_other_variant', 'same_product_by_code'):
        return 'same_product'
    return None


def item_record(item: dict, branded_records=()) -> dict:
    identity = item['identity']
    target = record({'title': '\n'.join([item['query'], *identity.values()])}, item['kind'])
    target['consensus'] = {}
    for attr in ('kind_type', 'material', 'construction', 'size_class', 'condition_grade', 'brand_norm', 'capacity'):
        if target[attr]:
            continue
        stated = [r[attr] for r in branded_records if r[attr]]
        if len(stated) < 3:
            continue
        counts = Counter(v for values in stated for v in set(values)) if attr == 'construction' else Counter(stated)
        supported = sorted((v for v, n in counts.items() if 2 * n >= len(stated)), key=lambda v: (-counts[v], v))
        if not supported:
            continue
        if attr == 'construction':
            target[attr] = sorted(supported)
            target['consensus'][attr] = {'stated_rows': len(stated), 'support': {v: counts[v] for v in sorted(supported)}}
        else:
            value = supported[0]
            target[attr] = value
            target['consensus'][attr] = {'rows': counts[value], 'stated_rows': len(stated)}
    return target


def required_attributes(kind, target):
    fields = list(REQUIRED[kind])
    if kind == 'small_goods' and target['capacity'] is not None:
        fields.append('capacity')
    return fields


def attribute_value(rec, attr):
    if attr == 'material_or_power':
        return 'cordless' if 'cordless' in rec['construction'] else rec['material']
    return rec[attr]


def missing_attributes(rec, fields):
    return [attr for attr in fields if not attribute_value(rec, attr)]


def record_key(kind, rec):
    return (kind, rec['kind_type'], rec['material'], tuple(rec['construction']),
            rec['size_class'], rec['condition_grade'], rec['capacity'])


def validate_rows(rows: list[dict], items: list[dict]) -> None:
    kinds = {i['id']: i['kind'] for i in items}
    for number, row in enumerate(rows, 1):
        prefix = f'row {number}: '
        if row.get('item_id') not in kinds:
            raise ValueError(prefix + 'unknown item_id')
        if row.get('kind') not in KINDS or row['kind'] != kinds[row['item_id']]:
            raise ValueError(prefix + 'kind does not agree with manifest')
        if row.get('side') not in ('brand', 'other'):
            raise ValueError(prefix + 'side must be brand or other')
        if not isinstance(row.get('title'), str):
            raise ValueError(prefix + 'title must be text')
        price = row.get('price_cents')
        if isinstance(price, bool) or not isinstance(price, int) or price <= 0:
            raise ValueError(prefix + 'price_cents must be a positive integer')
        if not isinstance(row.get('may_model'), bool):
            raise ValueError(prefix + 'may_model must be a boolean')
        if not isinstance(row.get('site'), str) or not row['site']:
            raise ValueError(prefix + 'site must be stated')
        cell = row.get('cell')
        if not isinstance(cell, str) or not cell.startswith(row['site'] + ':') or not cell[len(row['site']) + 1:]:
            raise ValueError(prefix + 'cell must be site plus condition')
        if row['site'].startswith('apify:') and row['may_model']:
            raise ValueError(prefix + 'may_model must be false for apify rows')
        if row.get('relation') not in (None, 'exact', 'likely_same_model', 'same_family_other_variant', 'comparable', 'unresolved'):
            raise ValueError(prefix + 'relation is unknown')
        if not isinstance(row.get('read_at'), str):
            raise ValueError(prefix + 'read_at must be stated')
        read_at = datetime.fromisoformat(row['read_at'].replace('Z', '+00:00'))
        if read_at.date().isoformat() != '2026-11-15':
            raise ValueError(prefix + 'read_at is not the fixed reading day')


class MarketIndex:
    """Materialized group lists keyed by an attribute record and candidate-pool item id."""

    def __init__(self, rows: list[dict], items: list[dict], match_spec: dict):
        validate_rows(rows, items)
        self.records = [record(row, row['kind']) for row in rows]
        self.rows = rows = [row if rec['condition_grade'] else {**row, 'cell': row['site'] + ':unknown'}
                            for row, rec in zip(rows, self.records)]
        by_id = {i['id']: i for i in items}
        self.relations = [row['relation'] if row['relation'] is not None else
                          relation_by_code(row, by_id[row['item_id']]) if row['side'] == 'brand' else 'unresolved'
                          for row in rows]
        self.accessories = [is_accessory(row['title'], row['kind']) for row in rows]
        pools = defaultdict(list)
        for number, row in enumerate(rows):
            pools[row['item_id']].append(number)
        self.item_records = {}
        for item in items:
            branded = [self.records[n] for n in pools[item['id']] if rows[n]['side'] == 'brand'
                       and not self.accessories[n] and relation_group(self.relations[n])
                       and self.records[n]['brand_norm'] == normalize_brand(item['identity']['brand'])]
            self.item_records[item['id']] = item_record(item, branded)
        self.item_keys = {i['id']: record_key(i['kind'], self.item_records[i['id']]) for i in items}
        self.by_record = defaultdict(dict)
        self.left_out = {}
        self.left_out_by_site = {}
        self.item_missing = {}
        self.missing_by_row = []
        for row, rec in zip(rows, self.records):
            target = self.item_records[row['item_id']]
            self.missing_by_row.append(missing_attributes(rec, required_attributes(row['kind'], target)))
        for item in items:
            item_id = item['id']
            target = self.item_records[item_id]
            fields = required_attributes(item['kind'], target)
            self.item_missing[item_id] = missing_attributes(target, fields)
            groups = {group: [] for group in GROUPS}
            def empty_omitted():
                return {'other_rows': 0, 'rows': 0, 'missing': Counter(), 'disagrees': Counter(),
                       'brand_excluded': 0, 'query_mismatch': 0, 'item_record_missing': 0,
                        'no_match_spec': 0, 'special_state': 0, 'brand_rows_not_grouped': 0, 'accessory': 0}
            by_site = defaultdict(empty_omitted)
            rule = match_spec.get(item_id)
            brand = item['identity']['brand']
            for number in pools[item_id]:
                row, rec = rows[number], self.records[number]
                omitted = by_site[row['site']]
                if self.accessories[number]:
                    omitted['accessory'] += 1
                    if row['side'] == 'other':
                        omitted['other_rows'] += 1
                        omitted['rows'] += 1
                    continue
                text = '\n'.join((row['title'], row.get('brand') or '', rec['brand_norm'] or ''))
                has_brand = rec['brand_norm'] == normalize_brand(brand)
                if row['side'] == 'brand':
                    group = relation_group(self.relations[number])
                    if has_brand and group:
                        groups[group].append(row)
                    else:
                        omitted['brand_rows_not_grouped'] += 1
                    continue
                omitted['other_rows'] += 1
                omitted['rows'] += 1
                missing = self.missing_by_row[number]
                omitted['missing'].update(missing)
                disagrees = []
                for attr in fields:
                    a, b = attribute_value(target, attr), attribute_value(rec, attr)
                    if a and b:
                        agrees = bool(set(a) & set(b)) if attr == 'construction' else a == b
                        if not agrees:
                            disagrees.append(attr)
                omitted['disagrees'].update(disagrees)
                if item_id in BRAND_LOCKED or item_id in EXCLUDED:
                    omitted['special_state'] += 1
                    continue
                if rule is None:
                    omitted['no_match_spec'] += 1
                    continue
                if has_brand or any(search_text(term) in search_text(text) for term in rule['exclude_brand_terms']):
                    omitted['brand_excluded'] += 1
                    continue
                if not all(any(search_text(term) in search_text(row['title']) for term in clause)
                           for clause in rule['require_any_of']):
                    omitted['query_mismatch'] += 1
                    continue
                if self.item_missing[item_id]:
                    omitted['item_record_missing'] += 1
                    continue
                if missing:
                    continue
                if disagrees:
                    continue
                omitted['rows'] -= 1
                groups['similar_other_brand'].append(row)
            self.by_record[self.item_keys[item_id]][item_id] = groups
            omitted = empty_omitted()
            for site_counts in by_site.values():
                for key, value in site_counts.items():
                    if isinstance(value, Counter):
                        omitted[key].update(value)
                    else:
                        omitted[key] += value
            self.left_out[item_id] = omitted
            self.left_out_by_site[item_id] = dict(by_site)

    def lookup(self, item: dict) -> dict:
        item_id = item['id']
        return self.by_record[self.item_keys[item_id]][item_id]


def _percentile(values, q):
    ordered = sorted(values)
    offset = (len(ordered) - 1) * q
    lo, hi = math.floor(offset), math.ceil(offset)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (offset - lo)


def _timing_summary(values):
    return {'p50': median(values), 'p95': _percentile(values, .95), 'rows': len(values)}


def record_timings(rows):
    runs = []
    for _ in range(5):
        per_kind = defaultdict(list)
        all_times = []
        for row in rows:
            start = time.perf_counter()
            rec = record(row, row['kind'])
            elapsed = (time.perf_counter() - start) * 1000
            assert rec['decided_by'] == 'code'
            per_kind[row['kind']].append(elapsed)
            all_times.append(elapsed)
        if all_times:
            runs.append({'all': all_times, **per_kind})
    if not runs:
        return {}
    chosen = sorted(runs, key=lambda run: median(run['all']))[2]
    return {kind: {**_timing_summary(values), 'repetitions': 5,
                   'run_p50s': [median(run[kind]) for run in runs],
                   'run_p50_range': [min(median(run[kind]) for run in runs), max(median(run[kind]) for run in runs)]}
            for kind, values in chosen.items()}


def lookup_timings(index, items):
    times, returned = [], 0
    per_item = defaultdict(list)
    for item in items:
        for _ in range(1000):
            start = time.perf_counter()
            groups = index.lookup(item)
            elapsed = (time.perf_counter() - start) * 1_000_000
            returned += sum(len(group) for group in groups.values())
            times.append(elapsed)
            per_item[item['id']].append(elapsed)
    return {**_timing_summary(times), 'lookups': len(times), 'lookups_per_item': 1000, 'returned_rows': returned,
            'per_item': {key: _timing_summary(value) for key, value in per_item.items()}}


def _group_summary(rows):
    def summary(values):
        return {'count': len(values), 'may_model_count': sum(r['may_model'] for r in values),
                'median_ask_dollars': median(r['price_cents'] for r in values) / 100 if values else None}
    return {**summary(rows), 'by_site': {site: summary([r for r in rows if r['site'] == site])
                                       for site in sorted({r['site'] for r in rows})},
            'by_cell': {cell: summary([r for r in rows if r['cell'] == cell])
                       for cell in sorted({r['cell'] for r in rows})}}


def build_slice(rows, items, match_spec):
    index = MarketIndex(rows, items, match_spec)
    rows = index.rows
    if not items:
        raise ValueError('manifest must contain market_items')
    coverage = defaultdict(lambda: defaultdict(lambda: {'rows': 0, 'decided': 0, 'missing': Counter()}))
    for row, missing in zip(rows, index.missing_by_row):
        for site in (row['site'], 'all'):
            value = coverage[row['kind']][site]
            value['rows'] += 1
            value['decided'] += not missing
            value['missing'].update(missing)
    for sites in coverage.values():
        for value in sites.values():
            value['share'] = value['decided'] / value['rows']
    output = {'label': LABEL, 'counts': {'rows': len(rows), 'items': len(items),
                                      'may_model': sum(r['may_model'] for r in rows),
                                      'display_only': sum(not r['may_model'] for r in rows),
                                      'by_site': dict(Counter(r['site'] for r in rows)),
                                      'by_cell': dict(Counter(r['cell'] for r in rows)),
                                      'by_kind': dict(Counter(r['kind'] for r in rows))},
              'items': {}, 'records': [], 'a11_by_kind': {}, 'a11_by_kind_by_site': {},
              'measures': {'coverage': dict(coverage), 'record_ms': record_timings(rows),
                           'lookup_us': lookup_timings(index, items)},
              'limitations': [
                  'Unknown condition and listed status supply no condition grade.',
                  'Item records keep manifest evidence and fill gaps from at least three admitted branded rows stating an attribute, with at least half supporting the value.',
                  'A scalar consensus tie at exactly half chooses the lexicographically first value; construction retains every mark supported by at least half.',
                  'Condition is not a matching attribute; ungraded rows are displayed in the site unknown cell and never measured.',
                  'Electronics has no required product-attribute set in A11; non-locked headphones use the supplied query clauses.',
                  'Search rows are observations, not deduplicated listings or a representative sample.',
                  'Exact intervals use the untied counting distribution; repeated prices make coverage conservative.',
                  'Kind summaries omit zero-width intervals because inverse-variance weights are undefined.',
                  'Timing is a local microbenchmark: parsing only and warm materialized lookups; excludes file IO and live reads.',
                  'No live-search timings were supplied, so an index-versus-live comparison cannot be measured.',
                  'Model agreement, registry fitting, forgetting and leave-one-brand-out pooling are outside this fixed-day slice.',
              ]}
    for number, (row, rec) in enumerate(zip(rows, index.records), 1):
        output['records'].append({'row_number': number, 'item_id': row['item_id'], 'site': row['site'],
                                  'cell': row['cell'], 'may_model': row['may_model'], 'attributes': rec,
                                  'relation': index.relations[number - 1], 'accessory': index.accessories[number - 1],
                                  'source_input': row.get('source_input', 'rows'),
                                  'source_line': row.get('source_line', number),
                                  'missing_required': index.missing_by_row[number - 1]})
    for item in items:
        item_id = item['id']
        groups = index.lookup(item)
        item_rows = [r for r in rows if r['item_id'] == item_id]
        observed_cells = [r['cell'] for r in item_rows]
        output['items'][item_id] = {'kind': item['kind'], 'record': index.item_records[item_id],
                                   'required_attributes': required_attributes(item['kind'], index.item_records[item_id]),
                                   'item_missing_required': index.item_missing[item_id],
                                   'counts': {'rows': len(observed_cells), 'grouped': sum(len(g) for g in groups.values()),
                                              'by_site': dict(Counter(r['site'] for r in item_rows)),
                                              'by_cell': dict(Counter(observed_cells))},
                                   'groups': {name: _group_summary(group) for name, group in groups.items()},
                                   'left_out': index.left_out[item_id],
                                   'left_out_by_site': index.left_out_by_site[item_id],
                                   'a11': measure_cells(item_id, groups, observed_cells)}
    for kind in sorted({i['kind'] for i in items}):
        cells = [c for item in output['items'].values() if item['kind'] == kind for c in item['a11'].values()]
        output['a11_by_kind'][kind] = kind_summary(cells)
        sites = sorted({r['site'] for r in rows if r['kind'] == kind})
        output['a11_by_kind_by_site'][kind] = {
            site: kind_summary([c for item in output['items'].values() if item['kind'] == kind
                                for cell, c in item['a11'].items() if cell.rsplit(':', 1)[0] == site])
            for site in sites}
    output['measures']['left_out'] = dict(sum((Counter(v['missing']) for v in index.left_out.values()), Counter()))
    return output


def examples(rows, items, match_spec):
    index = MarketIndex(rows, items, match_spec)
    return {item['id']: {group: [{k: r[k] for k in ('title', 'site', 'price_cents', 'url')}
                                for r in members[:5]] for group, members in index.lookup(item).items()}
            for item in items}


def _a11_text(value):
    counts = f"B={value.get('n_B', 0)}, O={value.get('n_O', 0)}"
    if value['state'] != 'measured':
        return f"{value['state']} ({counts})"
    return f"{value['ratio']:.3f} [{value['ratio_lower']:.3f}, {value['ratio_upper']:.3f}] ({counts})"


def render_markdown(output):
    lines = [output['label'], '', 'Measured code coverage and parsing time (milliseconds per row).', '',
             '| Kind | Site | Decided / rows | Coverage | p50 ms | p95 ms |',
             '|---|---|---:|---:|---:|---:|']
    for kind, sites in sorted(output['measures']['coverage'].items()):
        timing = output['measures']['record_ms'][kind]
        for site, coverage in sorted(sites.items()):
            lines.append(f"| {kind} | {site} | {coverage['decided']} / {coverage['rows']} | {coverage['share']:.1%} | {timing['p50']:.4f} | {timing['p95']:.4f} |")
    lines += ['', 'Group counts and median asks in dollars; display-only rows are included.', '',
              '| Item | Site | Rows | Exact n / median $ | Same product n / median $ | Similar other brand n / median $ |',
              '|---|---|---:|---:|---:|---:|']
    for item_id, item in output['items'].items():
        sites = sorted(item['counts']['by_site'])
        for site in sites or ['none']:
            cells = []
            for group in GROUPS:
                value = item['groups'][group]['by_site'].get(site, {'count': 0, 'median_ask_dollars': None})
                ask = '-' if value['median_ask_dollars'] is None else f"{value['median_ask_dollars']:.2f}"
                cells.append(f"{value['count']} / {ask}")
            lines.append(f"| {item_id} | {site} | {item['counts']['by_site'].get(site, 0)} | " + ' | '.join(cells) + ' |')
    lines += ['', 'A11: model against its attribute set, ratio of asks with 95% interval.', '',
              '| Item | Site | Cell | Rows | A11 ratio [95% interval] or state | Separation S |', '|---|---|---|---:|---|---:|']
    for item_id, item in output['items'].items():
        for cell, value in item['a11'].items():
            separation = f"{value['separation_S']:.3f}" if 'separation_S' in value else '-'
            site = cell.rsplit(':', 1)[0]
            lines.append(f"| {item_id} | {site} | {cell} | {item['counts']['by_cell'].get(cell, 0)} | {_a11_text(value)} | {separation} |")
    lines += ['', '| Kind | Site | Rows | A11 ratio [95% interval] or state | Item-cells | tau_k (log ask) |', '|---|---|---:|---|---:|---:|']
    for kind, sites in output['a11_by_kind_by_site'].items():
        for site, value in sorted({**sites, 'all': output['a11_by_kind'][kind]}.items()):
            tau = f"{value['tau_k']:.3f}" if 'tau_k' in value else '-'
            count = output['measures']['coverage'].get(kind, {}).get(site, {}).get('rows', 0)
            lines.append(f"| {kind} | {site} | {count} | {_a11_text(value)} | {value['item_cells']} | {tau} |")
    lines += ['', '| Item | Site | Rows | Missing in item record | Other rows left out | Accessories (all sides) | Missing in other rows (overlapping counts) |',
              '|---|---|---:|---|---:|---:|---|']
    for item_id, item in output['items'].items():
        missing = ', '.join(item['item_missing_required']) or '-'
        for site, omitted in sorted(item['left_out_by_site'].items()):
            counts = ', '.join(f'{k}={v}' for k, v in sorted(omitted['missing'].items())) or '-'
            lines.append(f"| {item_id} | {site} | {item['counts']['by_site'][site]} | {missing} | {omitted['rows']} | {omitted['accessory']} | {counts} |")
    timing = output['measures']['lookup_us']
    lines += ['', f"Measured warm index lookup: p50 {timing['p50']:.3f} µs, p95 {timing['p95']:.3f} µs; {timing['lookups']} lookups, {timing['returned_rows']} returned row references.",
              '', 'Parsing repeats five complete passes; percentiles use the run with median overall p50. Site rows share the kind timing. Timings include no logging in the timed region.', '']
    lines += [f'- {text}' for text in output['limitations']]
    if output.get('input_sha256s'):
        lines += ['', 'Input SHA-256:', ''] + [f'- {key}: `{value}`' for key, value in output['input_sha256s'].items()]
    return '\n'.join(lines) + '\n'


def _write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rows', type=Path, action='append', required=True)
    for flag in ('spec', 'out', 'table', 'examples'):
        parser.add_argument('--' + flag, type=Path, required=True)
    args = parser.parse_args(argv)
    sys.path.insert(0, str(ROOT / 'log'))
    from secondhand_log import create_log, stdout_sink
    # stdout is capturable outside this checkout without writing any unowned file.
    log = create_log('job.measures.index_slice', os.environ.get('SECONDHAND_BUILD', 'dev'), stdout_sink,
                     seed=7, config={'read_day': '2026-11-15', 'repetitions': 5, 'lookups': 1000})
    log.job('index_slice', 'market_index', 'running')
    try:
        raw = {}
        inputs = [('rows' if n == 1 else f'rows_{n}', path) for n, path in enumerate(args.rows, 1)]
        for name, path in (*inputs, ('match_spec', args.spec), ('manifest', ROOT / 'spec/items/manifest.json')):
            raw[name] = log.call('tool', 'filesystem.read.' + name, {'input': name}, path.read_bytes,
                                 lambda value: {'result': {'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest()}})
        rows = [{**json.loads(line), 'source_input': name, 'source_line': number}
                for name, _ in inputs for number, line in enumerate(raw[name].splitlines(), 1) if line.strip()]
        match_spec = json.loads(raw['match_spec'])
        items = json.loads(raw['manifest'])['market_items']
        kinds = {item['id']: item['kind'] for item in items}
        rows = [{**row, 'kind': row.get('kind', kinds.get(row.get('item_id')))} for row in rows]
        log.stage('index_slice', 'input', state='arrived', rows=len(rows), items=len(items))
        output = log.timed('index_slice.build', lambda: build_slice(rows, items, match_spec))
        output['input_sha256s'] = {k: hashlib.sha256(v).hexdigest() for k, v in raw.items()}
        log.stage('index_slice', 'groups', state='arrived', counts=output['counts'],
                  per_item={k: v['counts'] for k, v in output['items'].items()})
        output['benchmark_environment'] = {'python': sys.version.split()[0], 'platform': sys.platform,
                                           'logical_cpus': os.cpu_count(), 'load_average': list(os.getloadavg()) if hasattr(os, 'getloadavg') else None}
        artifacts = ((args.out, json.dumps(output, indent=2, sort_keys=True, allow_nan=False) + '\n', 'json'),
                     (args.table, render_markdown(output), 'table'),
                     (args.examples, json.dumps(examples(rows, items, match_spec), indent=2) + '\n', 'examples'))
        for path, text, name in artifacts:
            if name != 'examples' and ('http' in text or any(r['title'] and r['title'] in text for r in rows)):
                raise ValueError('repo output contains a row title or URL')
            log.call('tool', 'filesystem.write.' + name, {'output': name, 'bytes': len(text.encode())},
                     lambda path=path, text=text: _write(path, text), lambda _: {'result': {'written': True}})
        log.job('index_slice', 'market_index', 'done', counts=output['counts'])
        log.end(ok=True)
        return 0
    except Exception as error:
        log.error('index_slice', error)
        log.job('index_slice', 'market_index', 'failed')
        log.end(ok=False)
        raise


if __name__ == '__main__':
    sys.exit(main())
