"""Two CSV passes select repeat-sale NBER products and freeze their sold and censored listings."""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

from secondhand_log import create_log, file_sink, stdout_sink, tee_sink
from valuation.data import rows
from valuation.data.freeze import HERE, _commit, freeze
from valuation.experiment import FIELDS

RULE = ('Count rows with item_price set per non-empty anon_product_id. Keep products with at least 30 sold rows '
        'whose meta_categ_id is in rows.py _EBAY_KIND. Per kind keep at most 80 products, ordered by smallest '
        'sha256 of the UTF-8 product id (product id breaks ties). Retain all sold and ended-unsold listings of '
        'kept products, in input order; drop invalid dates and rows without a price. Products spanning kinds must '
        'rank in the smallest 80 in every kind; products with any unmapped meta category are excluded.')


def build(path: Path, out_dir: Path, expect: dict | None = None, log=None) -> dict:
    path = Path(path)
    if expect is None:
        expect = {f['file']: f['sha256'] for f in json.loads((HERE / 'sources.json').read_text())['nber_ebay_bo']['files']}
    if path.name not in expect:
        raise ValueError(f'{path.name}: no pinned sha256')
    metadata = {'subset_rule': RULE}

    def reader(path, dropped):
        counts = Counter()
        kinds = defaultdict(set)
        total = 0
        with rows._open(path) as f:
            for r in csv.DictReader(f):
                total += 1
                product = r['anon_product_id']
                if not product:
                    continue
                kind = rows._EBAY_KIND.get(r['meta_categ_id'])
                kinds[product].add(kind)
                if r['item_price']:
                    counts[product] += 1
        candidates = defaultdict(list)
        for product, count in counts.items():
            if count >= 30 and None not in kinds[product]:
                for kind in kinds[product]:
                    candidates[kind].append(product)
        ranked = {}
        for kind, ids in sorted(candidates.items()):
            chosen = sorted(ids, key=lambda p: (hashlib.sha256(p.encode('utf-8')).digest(), p))[:80]
            ranked[kind] = set(chosen)
        kept = {p for ids in ranked.values() for p in ids if all(p in ranked[k] for k in kinds[p])}
        metadata.update(input_rows=total)
        products = defaultdict(set)
        if log:
            log.stage('subset-nber_ebay_bo', 'select', state='arrived', n=total, products=len(kept))

        def selected():
            with rows._open(path) as f:
                for r in csv.DictReader(f):
                    product = r['anon_product_id']
                    if not product:
                        rows._drop(dropped, 'no_product_id')
                    elif None in kinds[product]:
                        rows._drop(dropped, 'unmapped_kind')
                    elif counts[product] < 30:
                        rows._drop(dropped, 'too_few_sales')
                    elif product not in kept:
                        rows._drop(dropped, 'product_cap')
                    else:
                        yield r
        for r in rows.nber_rows(selected(), dropped):
            products[r['kind']].add(r['product_id'])
            yield r
        metadata['products_per_kind'] = {k: len(ids) for k, ids in sorted(products.items())}

    return freeze('nber_ebay_bo', [path], out_dir, expect, log, reader=reader, metadata=metadata, columns=FIELDS)


def main(argv: list[str]) -> None:
    raw, out_dir = map(Path, argv)
    out_dir.mkdir(parents=True, exist_ok=True)
    log = create_log('job.subset', _commit(), tee_sink(stdout_sink, file_sink(str(out_dir / 'build.jsonl'))))
    log.job('subset-nber_ebay_bo', 'subset', 'running', input_file=raw.name)
    try:
        manifest = build(raw, out_dir, log=log)
    except Exception as e:
        log.error('subset', e)
        log.job('subset-nber_ebay_bo', 'subset', 'failed')
        raise
    else:
        log.note('frozen', rows=manifest['rows'], by_kind=manifest['by_kind'])
        log.job('subset-nber_ebay_bo', 'subset', 'done')
    finally:
        log.end()


if __name__ == '__main__':
    main(sys.argv[1:])
