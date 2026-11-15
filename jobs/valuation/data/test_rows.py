import csv
import gzip
import io
import json
import zipfile

import pytest

from valuation.data import rows
from valuation.data.freeze import freeze


@pytest.fixture(autouse=True)
def fixed_code_commit(monkeypatch):
    """Artifact tests use fixed provenance without invoking git in the worker checkout."""
    monkeypatch.setattr("valuation.data.freeze._commit", lambda: "f8b2d3f")


def _write(tmp_path, name, text):
    p = tmp_path / name
    p.write_text(text)
    return p


def test_mercari_maps_condition_and_drops_free_rows(tmp_path):
    p = _write(tmp_path, "train.tsv",
               "train_id\tname\titem_condition_id\tcategory_name\tbrand_name\tprice\tshipping\titem_description\n"
               "0\tLevi 501\t3\tMen/Jeans/Slim\tLevi's\t24.0\t1\tworn twice\n"
               "1\tFree thing\t1\tOther/Other/Other\t\t0.0\t0\tNo description yet\n"
               "2\tJordan 1\t2\tMen/Shoes/Athletic\tNike\t80.5\t0\t\n")
    dropped = {}
    out = list(rows.mercari_kaggle(p, dropped))
    assert dropped == {"price_zero": 1}
    jeans, shoes = out
    assert set(jeans) == set(rows.COLUMNS)
    assert (jeans["price_cents"], jeans["condition"], jeans["kind"], jeans["buyer_shipping_cents"]) == (2400, "good", "apparel", 0)
    assert (shoes["price_cents"], shoes["condition"], shoes["kind"], shoes["buyer_shipping_cents"]) == (8050, "like_new", "shoes", "")
    assert jeans["price_type"] == "sold" and jeans["at"] == "" and jeans["may_model"] is True
    assert shoes["description"] == ""   # "No description yet" is Mercari's placeholder, not text


def _xlsx(tmp_path, header, data):
    """A minimal two-sheet workbook shaped like the StockX contest file: rules sheet first, rows second."""
    strings = header + [c for r in data for c in r if isinstance(c, str)]
    idx = {s: i for i, s in enumerate(dict.fromkeys(strings))}

    def cell(v):
        return f'<c t="s"><v>{idx[v]}</v></c>' if isinstance(v, str) else f"<c><v>{v}</v></c>"

    body = "".join(f"<row>{''.join(cell(v) for v in r)}</row>" for r in [header] + data)
    p = tmp_path / "stockx.xlsx"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr("xl/sharedStrings.xml", "<sst>" + "".join(f"<si><t>{s}</t></si>" for s in idx) + "</sst>")
        z.writestr("xl/worksheets/sheet1.xml", "<worksheet><sheetData/></worksheet>")
        z.writestr("xl/worksheets/sheet2.xml", f"<worksheet><sheetData>{body}</sheetData></worksheet>")
    return p


def test_stockx_reads_dates_and_keys_product_by_size(tmp_path):
    header = ["Order Date", "Brand", "Sneaker Name", "Sale Price", "Retail Price", "Release Date", "Shoe Size", "Buyer Region"]
    p = _xlsx(tmp_path, header, [[42979, " Yeezy", "Adidas-Yeezy-Boost-350-V2-Beluga", 1097, 220, 42637, 11, "California"]])
    (r,) = rows.stockx_2019(p, {})
    assert r["at"] == "2017-09-01" and r["released_at"] == "2016-09-24"
    assert r["product_id"] == "Adidas-Yeezy-Boost-350-V2-Beluga|11" and r["family_id"] == "Adidas-Yeezy-Boost-350-V2-Beluga"
    assert (r["price_cents"], r["retail_cents"], r["brand"], r["kind"]) == (109700, 22000, "Yeezy", "shoes")


def test_nber_unsold_listing_is_censored_not_dropped(tmp_path):
    cols = ["anon_item_id", "anon_product_id", "anon_slr_id", "auct_start_dt", "auct_end_dt", "start_price_usd",
            "item_price", "photo_count", "fdbk_score_start", "item_cndtn_id", "meta_categ_id", "view_item_count",
            "wtchr_count", "bo_ck_yn"]
    raw = io.StringIO()
    w = csv.writer(raw)
    w.writerow(cols)
    w.writerow([7, 99, 5, "01jun2012", "09jun2012", "120.0", "95.5", 6, 40, 3000, 293, 30, 2, 1])
    w.writerow([8, 99, 5, "02jun2012", "30JUN2012", "130.0", "", 4, 40, 1000, 293, 12, 0, ""])
    p = tmp_path / "anon_bo_lists.csv.gz"
    p.write_bytes(gzip.compress(raw.getvalue().encode()))
    sold, unsold = rows.nber_ebay_bo(p, {})
    assert (sold["price_type"], sold["price_cents"], sold["best_offer"], sold["at"]) == ("sold", 9550, "accepted", "2012-06-09")
    assert (unsold["price_type"], unsold["price_cents"], unsold["at"], unsold["listed_at"]) == ("ended_unsold", 13000, "2012-06-30", "2012-06-02")
    assert sold["product_id"] == "99" and sold["condition"] == "used" and sold["kind"] == "electronics"


def test_freeze_is_byte_identical_on_rerun_and_records_hashes(tmp_path):
    p = _write(tmp_path, "train.tsv",
               "train_id\tname\titem_condition_id\tcategory_name\tbrand_name\tprice\tshipping\titem_description\n"
               "0\tLevi 501\t3\tMen/Jeans/Slim\tLevi's\t24.0\t1\tworn twice\n")
    a = freeze("mercari_kaggle", [p], tmp_path / "a")
    b = freeze("mercari_kaggle", [p], tmp_path / "b")
    assert (tmp_path / "a" / "rows.csv.gz").read_bytes() == (tmp_path / "b" / "rows.csv.gz").read_bytes()
    m = json.loads((tmp_path / "a" / "manifest.json").read_text())
    assert m["rows"] == 1 and m["output"]["sha256"] == b["output"]["sha256"]
    assert m["inputs"][0]["sha256"] == a["inputs"][0]["sha256"] and m["may_model"] is True


def test_freeze_refuses_an_input_whose_hash_changed(tmp_path):
    p = _write(tmp_path, "train.tsv", "train_id\tname\titem_condition_id\tcategory_name\tbrand_name\tprice\tshipping\titem_description\n")
    with pytest.raises(ValueError, match="sha256"):
        freeze("mercari_kaggle", [p], tmp_path / "o", expect={"train.tsv": "0" * 64})


NBER_HEADER = ('anon_item_id,anon_title_code,anon_product_id,anon_leaf_categ_id,anon_slr_id,anon_buyer_id,'
               'auct_start_dt,fdbk_score_start,fdbk_pstv_start,auct_end_dt,start_price_usd,photo_count,to_lst_cnt,'
               'bo_lst_cnt,count1,ref_price1,count2,ref_price2,count3,ref_price3,item_cndtn_id,view_item_count,'
               'wtchr_count,meta_categ_id,item_price,bo_ck_yn,ship_time_slowest,ship_time_fastest,ship_time_chosen,'
               'decline_price,accept_price,bin_rev,lstg_gen_type_id,store,ref_price4,count4,slr_us,buyer_us')
NBER_REAL = ('14203427,3600167,547957,7728,900000001,900000002,22oct2012,750,100,23oct2012,24.99,2,73,22,0,24.99,0,24.99,,,3000,1,1,281,24.99,0,4,4,4,,,0,,0,,,1,1\n'
             '59381948,19380965,547957,7728,900000003,900000002,23oct2012,666,99.7,23oct2012,14.99,2,174,92,0,14.99,0,14.99,,,3000,4,0,281,14.99,0,6,6,6,,,0,,0,,,1,1\n')


def test_nber_real_dates_and_codebook_fields(tmp_path):
    p = _write(tmp_path, 'nber.csv', NBER_HEADER + '\n' + NBER_REAL)
    a, b = rows.nber_ebay_bo(p, {})
    assert (a['listed_at'], a['at'], b['listed_at']) == ('2012-10-22', '2012-10-23', '2012-10-23')
    assert (a['price_cents'], b['price_cents'], a['best_offer']) == (2499, 1499, 'none')
    assert (a['seller_feedback'], a['category'], a['condition']) == (750, '281', 'used')


@pytest.mark.parametrize('field', ['auct_start_dt', 'auct_end_dt'])
def test_nber_bad_dates_are_dropped_and_counted(tmp_path, field):
    raw = list(csv.DictReader(io.StringIO(NBER_HEADER + '\n' + NBER_REAL)))
    raw[0][field] = '31feb2012'
    p = tmp_path / 'nber.csv'
    with p.open('w') as f:
        w = csv.DictWriter(f, fieldnames=NBER_HEADER.split(','))
        w.writeheader()
        w.writerows(raw)
    dropped = {}
    assert len(list(rows.nber_ebay_bo(p, dropped))) == 1
    assert dropped == {'invalid_date': 1}


def test_nber_output_never_contains_person_ids(tmp_path):
    p = _write(tmp_path, 'nber.csv', NBER_HEADER + '\n' + NBER_REAL)
    freeze('nber_ebay_bo', [p], tmp_path / 'out')
    with gzip.open(tmp_path / 'out/rows.csv.gz', 'rt') as f:
        content = f.read()
    assert 'anon_slr_id' not in content and 'anon_buyer_id' not in content
    assert all(person_id not in content for person_id in ('900000001', '900000002', '900000003'))


def test_freeze_hash_is_the_output_file_hash(tmp_path):
    from valuation.data.freeze import sha256
    p = _write(tmp_path, 'nber.csv', NBER_HEADER + '\n' + NBER_REAL)
    manifest = freeze('nber_ebay_bo', [p], tmp_path / 'out')
    assert manifest['output']['sha256'] == sha256(tmp_path / 'out/rows.csv.gz')


def test_nber_product_sample_keeps_whole_products_and_is_stable(tmp_path):
    cols = ["anon_item_id", "anon_product_id", "auct_start_dt", "auct_end_dt", "start_price_usd", "item_price",
            "photo_count", "fdbk_score_start", "item_cndtn_id", "meta_categ_id", "view_item_count", "wtchr_count", "bo_ck_yn"]
    raw = io.StringIO()
    w = csv.writer(raw)
    w.writerow(cols)
    for i in range(2000):   # 200 products, 10 listings each
        w.writerow([i, i % 200, "01jun2012", "09jun2012", "10", "9", 1, 1, 3000, 293, 1, 0, 0])
    p = tmp_path / "anon_bo_lists.csv.gz"
    p.write_bytes(gzip.compress(raw.getvalue().encode()))
    a = freeze("nber_ebay_bo", [p], tmp_path / "a", share=0.25)
    b = freeze("nber_ebay_bo", [p], tmp_path / "b", share=0.25)
    assert a["output"]["sha256"] == b["output"]["sha256"] and a["sample"]["share"] == 0.25
    with gzip.open(tmp_path / "a" / "rows.csv.gz", "rt") as f:
        kept = list(csv.DictReader(f))
    per_product = {}
    for r in kept:
        per_product[r["product_id"]] = per_product.get(r["product_id"], 0) + 1
    assert set(per_product.values()) == {10}            # a sampled product keeps every listing
    assert 30 <= len(per_product) <= 70                  # about a quarter of 200
    assert a["dropped"]["not_in_sample"] == 2000 - len(kept)


def test_nber_future_unsold_end_is_not_a_sale_date(tmp_path):
    raw = list(csv.DictReader(io.StringIO(NBER_HEADER + '\n' + NBER_REAL)))
    raw[0].update(auct_end_dt='22sep2016', item_price='', bo_ck_yn='')
    p = tmp_path / 'nber.csv'
    with p.open('w') as f:
        w = csv.DictWriter(f, fieldnames=NBER_HEADER.split(','))
        w.writeheader()
        w.writerows(raw)
    dropped = {}
    kept = list(rows.nber_ebay_bo(p, dropped))
    assert len(kept) == 1, 'seller-chosen future unsold end dates must not enter time histories'
    assert dropped == {'unsold_end_after_observation': 1}


def test_nber_observation_boundary_keeps_june_unsold_and_later_sales(tmp_path):
    raw = list(csv.DictReader(io.StringIO(NBER_HEADER + '\n' + NBER_REAL)))
    raw[0].update(auct_end_dt='30jun2013', item_price='', bo_ck_yn='')
    raw[1]['auct_end_dt'] = '01jul2013'
    p = tmp_path / 'nber.csv'
    with p.open('w') as f:
        w = csv.DictWriter(f, fieldnames=NBER_HEADER.split(','))
        w.writeheader()
        w.writerows(raw)
    dropped = {}
    kept = list(rows.nber_ebay_bo(p, dropped))
    assert [r['at'] for r in kept] == ['2013-06-30', '2013-07-01']
    assert dropped == {}


@pytest.mark.parametrize('category, expected', [('11450.0', 'apparel'), ('293.0', 'electronics'),
                                              ('64482.0', 'cards_collectibles'), ('220.0', 'toys_lego')])
def test_nber_numeric_category_codes_do_not_fall_into_other(tmp_path, category, expected):
    raw = list(csv.DictReader(io.StringIO(NBER_HEADER + '\n' + NBER_REAL)))
    raw[0]['meta_categ_id'] = category
    assert next(rows.nber_rows(raw, {}))['kind'] == expected


def test_nber_codebook_pin_and_fields():
    from pathlib import Path
    from valuation.data.freeze import sha256
    root = Path(__file__).resolve().parents[3]
    book = root / 'research/price/ben/sources/sold-followup-2026-11-15/Codebook.xlsx'
    source = json.loads(Path(rows.__file__).with_name('sources.json').read_text())['nber_ebay_bo']
    assert sha256(book) == source['codebook']['repository_sha256']
    codebook = {r[0]: r[2] for r in rows._xlsx_rows(book, 1) if len(r) >= 3}
    assert 'Listing start date' in codebook['auct_start_dt']
    assert 'date of sale' in codebook['auct_end_dt']
    assert 'missing if the item never sold' in codebook['item_price']
    assert 'Buy-It-Now price' in codebook['start_price_usd']
    assert 'previous feedbacks' in codebook['fdbk_score_start']
    assert 'not anonymized' in codebook['meta_categ_id']
    assert set(('anon_item_id', 'anon_product_id', 'photo_count', 'item_cndtn_id',
                'bo_ck_yn', 'view_item_count', 'wtchr_count')) <= codebook.keys()


def test_nber_sample_keeps_thin_and_unsold_only_products(tmp_path):
    from valuation.data.freeze import in_sample
    raw = list(csv.DictReader(io.StringIO(NBER_HEADER + '\n' + NBER_REAL)))
    raw[0].update(anon_product_id='thin', anon_item_id='1')
    raw[1].update(anon_product_id='unsold-only', anon_item_id='2', item_price='', bo_ck_yn='')
    p = tmp_path / 'nber.csv'
    with p.open('w') as f:
        w = csv.DictWriter(f, fieldnames=NBER_HEADER.split(','))
        w.writeheader()
        w.writerows(raw)
    share = 0.99
    assert all(in_sample(r['anon_product_id'], share) for r in raw)
    manifest = freeze('nber_ebay_bo', [p], tmp_path / 'out', share=share)
    assert manifest['rows'] == 2
    assert manifest['by_price_type'] == {'ended_unsold': 1, 'sold': 1}
    assert manifest['dropped'] == {}


@pytest.mark.parametrize('category, kind', [
    ('1', 'cards_collectibles'), ('99', 'other'), ('220', 'toys_lego'), ('237', 'toys_lego'),
    ('260', 'cards_collectibles'), ('267', 'other'), ('281', 'other'), ('293', 'electronics'),
    ('316', 'other'), ('550', 'other'), ('619', 'other'), ('625', 'electronics'), ('870', 'other'),
    ('888', 'other'), ('1249', 'electronics'), ('1281', 'other'), ('1305', 'other'), ('2984', 'other'),
    ('3252', 'other'), ('6000', 'other'), ('10542', 'other'), ('11116', 'cards_collectibles'),
    ('11232', 'other'), ('11233', 'other'), ('11450', 'apparel'), ('11700', 'other'),
    ('12576', 'other'), ('14339', 'other'), ('15032', 'electronics'), ('20081', 'other'),
    ('26395', 'other'), ('45100', 'cards_collectibles'), ('58058', 'electronics'),
    ('64482', 'cards_collectibles'), ('172008', 'other'),
])
def test_nber_each_observed_meta_category_uses_a_plan_kind(category, kind):
    raw = list(csv.DictReader(io.StringIO(NBER_HEADER + '\n' + NBER_REAL)))
    raw[0]['meta_categ_id'] = category
    assert next(rows.nber_rows(raw, {}))['kind'] == kind


def test_nber_audit_counts_raw_categories_and_separates_late_sales(tmp_path):
    from valuation.data.audit_nber import audit
    raw = list(csv.DictReader(io.StringIO(NBER_HEADER + '\n' + NBER_REAL)))
    raw[0].update(auct_end_dt='22sep2016', item_price='', anon_product_id='')
    raw[1].update(auct_end_dt='01jul2013')
    body = io.StringIO()
    w = csv.DictWriter(body, fieldnames=NBER_HEADER.split(','))
    w.writeheader()
    w.writerows(raw)
    p = tmp_path / 'raw.csv.gz'
    p.write_bytes(gzip.compress(body.getvalue().encode()))
    result = audit(p)
    assert result['rows'] == 2
    assert result['by_meta_categ_id'] == {'281': 2}
    assert result['after_2013_06_30'] == {'sold': 1, 'unsold': 1}
    assert result['late_end_range'] == {'sold': ['2013-07-01', '2013-07-01'],
                                        'unsold': ['2016-09-22', '2016-09-22']}
    assert result['without_product_id'] == 1
    assert all(person_id not in json.dumps(result) for person_id in ('900000001', '900000002', '900000003'))


def test_nber_missing_price_is_counted_separately_from_invalid_date(tmp_path):
    raw = list(csv.DictReader(io.StringIO(NBER_HEADER + '\n' + NBER_REAL)))
    raw[0].update(item_price='', start_price_usd='')
    raw[1]['auct_end_dt'] = 'not-a-date'
    dropped = {}
    assert list(rows.nber_rows(raw, dropped)) == []
    assert dropped == {'no_price': 1, 'invalid_date': 1}


def test_freeze_refuses_unrecognized_input_names_when_pinned(tmp_path):
    p = _write(tmp_path, 'renamed.csv', NBER_HEADER + '\n' + NBER_REAL)
    with pytest.raises(ValueError, match='not pinned'):
        freeze('nber_ebay_bo', [p], tmp_path / 'out', expect={'anon_bo_lists.csv.gz': '0' * 64})
    assert not (tmp_path / 'out').exists()
