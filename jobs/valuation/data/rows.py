"""Sold-item rows from public datasets, normalised to the backtest's one row shape.

COLUMNS is the runner's FIELDS (jobs/valuation/experiment.py) plus four trailing extras some sources carry. A field
the source lacks is "". Money is integer cents. Each reader yields rows in file order and counts every dropped row by
reason in `dropped`, so a manifest can say what was left out and why. Where each file comes from: sources.json. Its
licence, bias, and why may_model is what it is: research/price/ben/sold-datasets.md.
"""
from __future__ import annotations

import csv
import gzip
import re
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree

from valuation.experiment import FIELDS

EXTRAS = ("description", "retail_cents", "released_at", "region")   # read by the text-only and release tests, not the runner
COLUMNS = FIELDS + EXTRAS

csv.field_size_limit(1 << 24)   # Mercari and Grailed descriptions run long


def _row(**f) -> dict:
    return {c: f.get(c, "") for c in COLUMNS}


def _cents(v: str | float) -> int:
    return int(round(float(v) * 100))


def _open(path: Path):
    return gzip.open(path, "rt", newline="", encoding="utf-8") if str(path).endswith(".gz") else open(path, newline="", encoding="utf-8")


def _drop(dropped: dict, reason: str) -> None:
    dropped[reason] = dropped.get(reason, 0) + 1


# Mercari's category tree, first two levels, into spec/engines kind families. Unlisted pairs fall back to the top level.
_MERCARI_KIND = {
    "Women/Shoes": "shoes", "Men/Shoes": "shoes", "Sports & Outdoors/Footwear": "shoes",
    "Women/Women's Handbags": "bags", "Handmade/Bags and Purses": "bags", "Vintage & Collectibles/Bags and Purses": "bags",
    "Women/Jewelry": "jewellery_watches", "Handmade/Jewelry": "jewellery_watches", "Vintage & Collectibles/Jewelry": "jewellery_watches",
    "Kids/Toys": "toys_lego", "Vintage & Collectibles/Toy": "toys_lego", "Handmade/Toys": "toys_lego",
    "Vintage & Collectibles/Trading Cards": "cards_collectibles", "Vintage & Collectibles/Collectibles": "cards_collectibles",
    "Electronics/Media": "media", "Other/Books": "media", "Vintage & Collectibles/Book": "media",
    "Vintage & Collectibles/Clothing": "apparel", "Handmade/Clothing": "apparel", "Sports & Outdoors/Apparel": "apparel",
    "Vintage & Collectibles/Electronics": "electronics", "Home/Home Appliances": "appliances_tools",
    "Kids/Gear": "baby_gear", "Kids/Strollers": "baby_gear", "Kids/Car Seats & Accessories": "baby_gear", "Kids/Nursery": "baby_gear",
}
_MERCARI_TOP = {"Women": "apparel", "Men": "apparel", "Kids": "apparel", "Electronics": "electronics",
                "Home": "lighting_home", "Sports & Outdoors": "bikes_sports"}
# Mercari US's five grades, in id order (asserted: the Kaggle data gives ids only; the app shows these five names).
_MERCARI_CONDITION = {"1": "new", "2": "like_new", "3": "good", "4": "fair", "5": "poor"}


def _mercari_kind(category: str) -> str:
    parts = category.split("/")
    return _MERCARI_KIND.get("/".join(parts[:2])) or _MERCARI_TOP.get(parts[0], "other")


def mercari_kaggle(path: Path, dropped: dict):
    """train.tsv of the Mercari Price Suggestion Challenge (Kaggle, 2017-18). No dates, no product ids."""
    with _open(path) as f:
        for r in csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
            if float(r["price"]) <= 0:
                _drop(dropped, "price_zero")
                continue
            desc = r["item_description"] or ""
            yield _row(
                row_id=f"mercari_kaggle-{r['train_id']}", source="mercari_kaggle", licence=LICENCE["mercari_kaggle"],
                site="mercari", kind=_mercari_kind(r["category_name"] or ""), brand=r["brand_name"] or "",
                category=r["category_name"] or "", condition=_MERCARI_CONDITION[r["item_condition_id"]], title=r["name"],
                price_type="sold", price_cents=_cents(r["price"]),
                buyer_shipping_cents=0 if r["shipping"] == "1" else "",   # 1 = the seller paid shipping
                may_model=MAY_MODEL["mercari_kaggle"], description="" if desc == "No description yet" else desc,
            )


_EXCEL_EPOCH = date(1899, 12, 30)


def _excel_day(v: str) -> str:
    return (_EXCEL_EPOCH + timedelta(days=int(float(v)))).isoformat()


def _xlsx_rows(path: Path, sheet: int):
    """Rows of one sheet as lists of strings, stdlib only. Enough for a plain data sheet: no merged cells, no styles."""
    ns = re.compile(r"\{[^}]*\}")
    with zipfile.ZipFile(path) as z:
        shared = [ "".join(t.text or "" for t in si.iter() if ns.sub("", t.tag) == "t")
                   for si in ElementTree.fromstring(z.read("xl/sharedStrings.xml")) ]
        root = ElementTree.fromstring(z.read(f"xl/worksheets/sheet{sheet}.xml"))
    for row in root.iter():
        if ns.sub("", row.tag) != "row":
            continue
        out = []
        for c in row:
            v = next((x.text for x in c if ns.sub("", x.tag) == "v"), "") or ""
            out.append(shared[int(v)] if c.get("t") == "s" else v)
        yield out


def stockx_2019(path: Path, dropped: dict):
    """StockX Data Contest 2019: a fixed random share of each colorway's US sales per day, 2017-09-01 to 2019-02-13."""
    it = _xlsx_rows(path, sheet=2)
    head = next(it)
    for i, v in enumerate(it):
        r = dict(zip(head, v))
        name, size = r["Sneaker Name"].strip(), str(float(r["Shoe Size"])).removesuffix(".0")
        yield _row(
            row_id=f"stockx_2019-{i}", source="stockx_2019", licence=LICENCE["stockx_2019"], site="stockx",
            url=f"https://stockx.com/{name.lower()}", kind="shoes", product_id=f"{name}|{size}", family_id=name,
            brand=r["Brand"].strip(), category="sneakers", condition="new", size=size, title=name, price_type="sold",
            price_cents=_cents(r["Sale Price"]), at=_excel_day(r["Order Date"]), may_model=MAY_MODEL["stockx_2019"],
            retail_cents=_cents(r["Retail Price"]), released_at=_excel_day(r["Release Date"]), region=r["Buyer Region"],
        )


_GRAILED_CONDITION = {"New": "new", "Gently used": "gently_used", "Used": "used", "Worn": "worn"}


def grailed_2021(path: Path, dropped: dict):
    """A third party's scrape of 103,537 Grailed sold listings (file dated 2021-01-27). No sale dates."""
    with _open(path) as f:
        for r in csv.DictReader(f):
            m = re.search(r"/listings/(\d+)", r["link"] or "")
            if not m or not r["sold_price"]:
                _drop(dropped, "no_listing_id_or_price")
                continue
            yield _row(
                row_id=f"grailed_2021-{m.group(1)}", source="grailed_2021", licence=LICENCE["grailed_2021"], site="grailed",
                url=r["link"], kind=_grailed_kind(r["category"] or ""), brand=r["designer"], category=r["category"],
                condition=_GRAILED_CONDITION.get(r["condition"], ""), size=r["size"], title=r["sub_title"],
                photo_count=int(r["image_count"]) if r["image_count"] else "",
                seller_feedback=int(float(r["feedback_count"])) if r["feedback_count"] else "", price_type="sold",
                price_cents=_cents(r["sold_price"]), may_model=MAY_MODEL["grailed_2021"], description=r["description"] or "",
            )


_GRAILED_SHOES = re.compile(r"sneaker|boot|shoe|sandal|slip on|loafer|formal shoes|leather shoes", re.I)
_GRAILED_BAGS = re.compile(r"bag|luggage|wallet", re.I)
_GRAILED_JEWEL = re.compile(r"jewel|watch|ring|necklace|bracelet", re.I)


def _grailed_kind(category: str) -> str:
    if _GRAILED_SHOES.search(category):
        return "shoes"
    if _GRAILED_BAGS.search(category):
        return "bags"
    if _GRAILED_JEWEL.search(category):
        return "jewellery_watches"
    return "apparel"


# eBay meta categories (2012-13 tree) into kind families; verified against Codebook.xlsx, bo_lists.
_EBAY_KIND = {
    "1": "cards_collectibles", "220": "toys_lego", "237": "toys_lego", "260": "cards_collectibles", "267": "media",
    "281": "jewellery_watches", "293": "electronics", "550": "lighting_home", "619": "other", "625": "electronics",
    "870": "lighting_home", "888": "bikes_sports", "1249": "electronics", "11116": "cards_collectibles",
    "11232": "media", "11233": "media", "11450": "apparel", "11700": "lighting_home", "12576": "appliances_tools",
    "2984": "baby_gear", "15032": "electronics", "58058": "electronics", "64482": "cards_collectibles",
    "20081": "lighting_home", "26395": "other", "45100": "other", "99": "other", "1281": "other", "14339": "other",
}
_EBAY_CONDITION = {"1000": "new", "1500": "new_other", "1750": "new_with_defects", "2000": "manufacturer_refurbished",
                   "2500": "seller_refurbished", "2750": "like_new", "3000": "used", "4000": "very_good",
                   "5000": "good", "6000": "acceptable", "7000": "for_parts"}


def _int(v: str):
    return int(float(v)) if v not in ("", None) else ""


def nber_ebay_bo(path: Path, dropped: dict):
    """NBER bo_lists: sold at item_price, or censored at the recorded Buy-It-Now price."""
    with _open(path) as f:
        yield from nber_rows(csv.DictReader(f), dropped)


def nber_rows(raw, dropped: dict):
    """Map listing records without retaining seller or buyer identities (Codebook.xlsx, bo_lists)."""
    for r in raw:
        sold = r["item_price"] not in ("", None)
        if not sold and not r["start_price_usd"]:
            _drop(dropped, "no_price")
            continue
        try:
            listed = datetime.strptime(r["auct_start_dt"], "%d%b%Y").date().isoformat()
            end = datetime.strptime(r["auct_end_dt"], "%d%b%Y").date().isoformat()
        except ValueError:
            _drop(dropped, "invalid_date")
            continue
        yield _row(
            row_id=f"nber_ebay_bo-{r['anon_item_id']}", source="nber_ebay_bo", licence=LICENCE["nber_ebay_bo"],
            site="ebay", kind=_EBAY_KIND.get(r["meta_categ_id"], "other"), product_id=r["anon_product_id"] or "",
            category=r["meta_categ_id"], condition=_EBAY_CONDITION.get(str(_int(r["item_cndtn_id"])), ""),
            photo_count=_int(r["photo_count"]), seller_feedback=_int(r["fdbk_score_start"]),
            price_type="sold" if sold else "ended_unsold",
            price_cents=_cents(r["item_price"] if sold else r["start_price_usd"]),
            listed_at=listed, at=end,
            best_offer=("accepted" if r["bo_ck_yn"] in ("1", "1.0") else "none") if sold else "",
            views=_int(r["view_item_count"]), watchers=_int(r["wtchr_count"]), may_model=MAY_MODEL["nber_ebay_bo"],
        )


def ebay_comps_cc0(paths: list[Path], dropped: dict):
    """silentdirectivellc-hub/ebay-sold-comps, eBay files: 570 sold rows, September 2026, 15 keyword files."""
    for path in paths:
        with _open(path) as f:
            for r in csv.DictReader(f):
                yield _row(
                    row_id=f"ebay_comps_cc0-{r['item_id']}", source="ebay_comps_cc0", licence=LICENCE["ebay_comps_cc0"],
                    site="ebay", url=f"https://www.ebay.com/itm/{r['item_id']}", kind=_keyword_kind(r["keyword"]),
                    family_id=r["keyword"], condition=r["condition"].lower().replace(" ", "_").replace("-", "_"),
                    title=r["title"], price_type="sold", price_cents=_cents(r["sold_price_usd"]), at=r["ended_at"][:10],
                    may_model=MAY_MODEL["ebay_comps_cc0"],
                )


def goodwill_cc0(paths: list[Path], dropped: dict):
    """The same repo's ShopGoodwill closed auctions: hammer prices with bid counts, June to September 2026."""
    for path in paths:
        with _open(path) as f:
            for i, r in enumerate(csv.DictReader(f)):
                if r["bids"] in ("", "0"):
                    _drop(dropped, "no_bids")
                    continue
                yield _row(
                    row_id=f"goodwill_cc0-{r['item_id'] or path.stem + '-' + str(i)}", source="goodwill_cc0",
                    licence=LICENCE["goodwill_cc0"], site="shopgoodwill", kind=_keyword_kind(r["keyword"] or path.stem),
                    family_id=r["keyword"] or path.stem.removeprefix("goodwill-").rsplit("-", 2)[0],
                    category=r["category"], title=r["title"], price_type="sold", price_cents=_cents(r["sold_price_usd"]),
                    at=r["ended_at"][:10], may_model=MAY_MODEL["goodwill_cc0"],
                )


_KEYWORD_KIND = (("lego", "toys_lego"), ("hot wheels", "toys_lego"), ("hotwheels", "toys_lego"), ("video game", "media"),
                 ("vinyl", "media"), ("camera", "electronics"), ("jewelry", "jewellery_watches"),
                 ("watch", "jewellery_watches"), ("sterling", "jewellery_watches"), ("sewing", "appliances_tools"),
                 ("fishing", "bikes_sports"), ("fly reel", "bikes_sports"), ("tackle", "bikes_sports"),
                 ("lure", "bikes_sports"), ("reel", "bikes_sports"), ("rod", "bikes_sports"))


def _keyword_kind(keyword: str) -> str:
    k = keyword.lower()
    return next((kind for word, kind in _KEYWORD_KIND if word in k), "lighting_home" if k else "other")


def mercari_apify_ccby(path: Path, dropped: dict):
    """malekoweis/resale-market-data, Mercari US file: 462 Switch-search results, October 2026, sold and on sale."""
    with _open(path) as f:
        for r in csv.DictReader(f):
            yield _row(
                row_id=f"mercari_apify_ccby-{r['itemId']}", source="mercari_apify_ccby",
                licence=LICENCE["mercari_apify_ccby"], site="mercari", url=r["url"], kind="electronics",
                family_id=r["source"], brand=r["brand"], category=r["categoryPath"],
                condition=r["condition"].lower().replace(" ", "_"), size=r["size"], title=r["title"],
                price_type="sold" if r["status"] == "sold" else "asking", price_cents=_cents(r["price"]),
                listed_at=r["listedAt"][:10], may_model=MAY_MODEL["mercari_apify_ccby"],
            )


LICENCE = {
    "mercari_kaggle": "Kaggle competition data (Mercari Price Suggestion Challenge); rules unread, non-commercial research use asserted",
    "stockx_2019": "StockX Data Contest 2019, released by StockX for public analysis; no licence stated",
    "grailed_2021": "third-party scrape, no licence; Grailed's terms bar scraping and ML extraction",
    "nber_ebay_bo": "cleared for public release by eBay.com, research purposes (NBER); cite Backus et al. 2020 QJE",
    "ebay_comps_cc0": "CC0 1.0 (silentdirectivellc-hub/ebay-sold-comps); collected from eBay by a scraping actor",
    "goodwill_cc0": "CC0 1.0 (silentdirectivellc-hub/ebay-sold-comps); ShopGoodwill buyer API, its terms unread",
    "mercari_apify_ccby": "CC BY 4.0, attribution malekoweis/resale-market-data; collected from Mercari by a scraping actor",
}
# True only where the marketplace itself released the rows (research/price/ben/sold-datasets.md, "may_model").
MAY_MODEL = {"mercari_kaggle": True, "stockx_2019": True, "nber_ebay_bo": True, "grailed_2021": False,
             "ebay_comps_cc0": False, "goodwill_cc0": False, "mercari_apify_ccby": False}

READERS = {"mercari_kaggle": mercari_kaggle, "stockx_2019": stockx_2019, "grailed_2021": grailed_2021,
           "nber_ebay_bo": nber_ebay_bo, "ebay_comps_cc0": ebay_comps_cc0, "goodwill_cc0": goodwill_cc0,
           "mercari_apify_ccby": mercari_apify_ccby}
MULTI_FILE = {"ebay_comps_cc0", "goodwill_cc0"}
