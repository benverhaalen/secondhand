import csv
import gzip
import hashlib
import io
import json

import pytest

from valuation.data import rows, subset
from valuation.data.freeze import sha256
from valuation.data.test_rows import NBER_HEADER, NBER_REAL
from valuation.experiment import FIELDS


def source(tmp_path):
    base = next(csv.DictReader(io.StringIO(NBER_HEADER + '\n' + NBER_REAL)))
    p = tmp_path / 'anon_bo_lists.csv.gz'
    with gzip.open(p, 'wt', newline='') as f:
        w = csv.DictWriter(f, fieldnames=NBER_HEADER.split(','))
        w.writeheader()
        for product, category, sold_count in [(str(i), '293', 30 + i % 3) for i in range(82)] + [('thin', '293', 29), ('unknown', '999999', 31), ('', '293', 31), ('jewel', '281', 30)]:
            for i in range(sold_count + 1):
                w.writerow({**base, 'anon_item_id': f'{product}-{i}', 'anon_product_id': product,
                            'meta_categ_id': category, 'item_price': '24.99' if i < sold_count else ''})
        w.writerow({**base, 'anon_product_id': 'jewel', 'auct_end_dt': 'bad'})
    return p


def test_subset_counts_sales_caps_by_hash_and_retains_unsold(tmp_path, monkeypatch):
    p = source(tmp_path)
    opens = []
    original = rows._open
    def tracked(path):
        opens.append(path)
        return original(path)
    monkeypatch.setattr(rows, '_open', tracked)
    m = subset.build(p, tmp_path / 'out', expect={p.name: sha256(p)})
    assert opens == [p, p], 'subset must stream the raw CSV exactly twice'
    with gzip.open(tmp_path / 'out/rows.csv.gz', 'rt') as f:
        reader = csv.DictReader(f)
        assert reader.fieldnames == list(FIELDS)
        out = list(reader)
    expected = set(sorted(map(str, range(82)), key=lambda p: hashlib.sha256(p.encode()).digest())[:80])
    assert {r['product_id'] for r in out} == expected | {'jewel'}
    assert sum(r['price_type'] == 'ended_unsold' for r in out) == 81
    assert m['products_per_kind'] == {'electronics': 80, 'jewellery_watches': 1}
    assert m['by_kind'] == {k: sum(r['kind'] == k for r in out) for k in m['by_kind']}
    assert m['by_price_type'] == {k: sum(r['price_type'] == k for r in out) for k in m['by_price_type']}
    assert m['at_range'] == ['2012-10-23', '2012-10-23']
    assert m['input_rows'] == m['rows'] + sum(m['dropped'].values())
    assert m['dropped']['invalid_date'] == 1
    assert m['dropped']['no_product_id'] == 32
    assert m['dropped']['unmapped_kind'] == 32
    assert m['dropped']['too_few_sales'] == 30
    assert m['subset_rule'] == subset.RULE
    assert m['inputs'][0]['sha256'] == sha256(p)
    assert m['output']['sha256'] == sha256(tmp_path / 'out/rows.csv.gz')


def test_subset_is_byte_identical_and_refuses_changed_input(tmp_path):
    p = source(tmp_path)
    subset.build(p, tmp_path / 'out', expect={p.name: sha256(p)})
    before = [(tmp_path / 'out' / n).read_bytes() for n in ('rows.csv.gz', 'manifest.json')]
    subset.build(p, tmp_path / 'out', expect={p.name: sha256(p)})
    assert before == [(tmp_path / 'out' / n).read_bytes() for n in ('rows.csv.gz', 'manifest.json')]
    with pytest.raises(ValueError, match='sha256'):
        subset.build(p, tmp_path / 'bad', expect={p.name: '0' * 64})
    assert not (tmp_path / 'bad/rows.csv.gz').exists()


def test_product_in_multiple_kinds_keeps_all_its_listings(tmp_path):
    base = next(csv.DictReader(io.StringIO(NBER_HEADER + '\n' + NBER_REAL)))
    p = tmp_path / 'raw.csv.gz'
    with gzip.open(p, 'wt', newline='') as f:
        w = csv.DictWriter(f, fieldnames=NBER_HEADER.split(','))
        w.writeheader()
        for i in range(30):
            w.writerow({**base, 'meta_categ_id': '293' if i % 2 else '281'})
    m = subset.build(p, tmp_path / 'out', expect={p.name: sha256(p)})
    assert m['rows'] == 30
    assert m['products_per_kind'] == {'electronics': 1, 'jewellery_watches': 1}


def test_products_count_only_products_written_after_date_drops(tmp_path):
    base = next(csv.DictReader(io.StringIO(NBER_HEADER + '\n' + NBER_REAL)))
    p = tmp_path / 'raw.csv.gz'
    with gzip.open(p, 'wt', newline='') as f:
        w = csv.DictWriter(f, fieldnames=NBER_HEADER.split(','))
        w.writeheader()
        for _ in range(30):
            w.writerow({**base, 'auct_start_dt': ''})
    m = subset.build(p, tmp_path / 'out', expect={p.name: sha256(p)})
    assert m['rows'] == 0 and m['dropped'] == {'invalid_date': 30}
    assert m['products_per_kind'] == {}


def test_subset_cli_writes_contract_log_and_manifest(tmp_path, monkeypatch):
    p = source(tmp_path)
    (tmp_path / 'sources.json').write_text(json.dumps({'nber_ebay_bo': {'files': [
        {'file': p.name, 'sha256': sha256(p)}]}}))
    monkeypatch.setattr(subset, 'HERE', tmp_path)
    subset.main([str(p), str(tmp_path / 'cli')])
    manifest = json.loads((tmp_path / 'cli/manifest.json').read_text())
    events = [json.loads(line) for line in (tmp_path / 'cli/build.jsonl').read_text().splitlines()]
    assert manifest['output']['sha256'] == sha256(tmp_path / 'cli/rows.csv.gz')
    assert events[0]['event'] == 'session.start'
    assert events[-1]['event'] == 'session.end'
    assert any(e['event'] == 'job.stage' for e in events)


def test_cross_kind_product_must_qualify_in_each_kind(tmp_path):
    p = source(tmp_path)
    with gzip.open(p, 'rt') as f:
        records = list(csv.DictReader(f))
    excluded = max(map(str, range(82)), key=lambda p: hashlib.sha256(p.encode()).digest())
    records.append({**records[0], 'anon_product_id': excluded, 'meta_categ_id': '281', 'item_price': ''})
    with gzip.open(p, 'wt', newline='') as f:
        w = csv.DictWriter(f, fieldnames=NBER_HEADER.split(','))
        w.writeheader()
        w.writerows(records)
    m = subset.build(p, tmp_path / 'out', expect={p.name: sha256(p)})
    with gzip.open(tmp_path / 'out/rows.csv.gz', 'rt') as f:
        out = list(csv.DictReader(f))
    assert excluded not in {r['product_id'] for r in out}
    assert m['products_per_kind'] == {'electronics': 80, 'jewellery_watches': 1}


def test_product_with_unmapped_category_is_counted_and_excluded(tmp_path):
    base = next(csv.DictReader(io.StringIO(NBER_HEADER + '\n' + NBER_REAL)))
    p = tmp_path / 'raw.csv.gz'
    with gzip.open(p, 'wt', newline='') as f:
        w = csv.DictWriter(f, fieldnames=NBER_HEADER.split(','))
        w.writeheader()
        for _ in range(30):
            w.writerow(base)
        w.writerow({**base, 'meta_categ_id': '999999', 'item_price': ''})
    m = subset.build(p, tmp_path / 'out', expect={p.name: sha256(p)})
    assert m['rows'] == 0 and m['dropped'] == {'unmapped_kind': 31}
