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
    w.writerow([7, 99, 5, "2012-06-01", "2012-06-09", "120.0", "95.5", 6, 40, 3000, 293, 30, 2, 1])
    w.writerow([8, 99, 5, "2012-06-02", "2012-06-30", "130.0", "", 4, 40, 1000, 293, 12, 0, ""])
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
