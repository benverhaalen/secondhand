import csv
import gzip
import io
import json
import zipfile

import pytest

from valuation.data import rows
from valuation.data.freeze import freeze


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
    w.writerow([8, 99, 5, "02jun2012", "30jun2012", "130.0", "", 4, 40, 1000, 293, 12, 0, ""])
    p = tmp_path / "anon_bo_lists.csv.gz"
    p.write_bytes(gzip.compress(raw.getvalue().encode()))
    sold, unsold = rows.nber_ebay_bo(p, {})
    assert (sold["price_type"], sold["price_cents"], sold["best_offer"], sold["at"]) == ("sold", 9550, "accepted", "2012-06-09")
    assert (unsold["price_type"], unsold["price_cents"], unsold["at"]) == ("ended_unsold", 13000, "2012-06-30")
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
NBER_REAL = ('14203427,3600167,547957,7728,4526559,6939083,22oct2012,750,100,23oct2012,24.99,2,73,22,0,24.99,0,24.99,,,3000,1,1,281,24.99,0,4,4,4,,,0,,0,,,1,1\n'
             '59381948,19380965,547957,7728,4714470,6939083,23oct2012,666,99.7,23oct2012,14.99,2,174,92,0,14.99,0,14.99,,,3000,4,0,281,14.99,0,6,6,6,,,0,,0,,,1,1\n')


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
        header = next(csv.reader(f))
    assert 'anon_slr_id' not in header and 'anon_buyer_id' not in header


def test_freeze_hash_is_the_output_file_hash(tmp_path):
    from valuation.data.freeze import sha256
    p = _write(tmp_path, 'nber.csv', NBER_HEADER + '\n' + NBER_REAL)
    manifest = freeze('nber_ebay_bo', [p], tmp_path / 'out')
    assert manifest['output']['sha256'] == sha256(tmp_path / 'out/rows.csv.gz')
