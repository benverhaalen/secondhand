"""Exa tests for secondhand's watch/search/pricing features.

Usage:  RAW_DIR=~/secondhand-exa-raw python3 run.py coverage|freshness|sold|extract <urls.json>
Reads EXA_API_KEY from the environment and never writes it. Raw responses go to
RAW_DIR, outside the repo. Other steps import exa() and the patterns from here.
"""
import json, os, re, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

RAW = os.path.expanduser(os.environ.get("RAW_DIR", "~/secondhand-exa-raw"))

QUERIES = [
    ("band-tee", "vintage 90s Nirvana band t-shirt"),
    ("carhartt-detroit", "Carhartt Detroit jacket"),
    ("levis-501-bigE", "Levi's 501 big E vintage jeans"),
    ("switch-oled", "Nintendo Switch OLED console"),
    ("ps5", "PS5 console"),
    ("charizard", "Pokemon Charizard card"),
    ("aj1-size10", "Air Jordan 1 size 10"),
    ("synchilla", "Patagonia Synchilla fleece"),
    ("poang", "IKEA Poang chair"),
    ("kitchenaid", "KitchenAid stand mixer"),
    ("coach-bag", "Coach bag"),
    ("vinyl-dsotm", "Pink Floyd Dark Side of the Moon 1973 Harvest SMAS-11163 vinyl"),
]
DOMAINS = {
    "ebay.com": r"ebay\.com/itm/",
    "poshmark.com": r"poshmark\.com/listing/",
    "depop.com": r"depop\.com/products/",
    "mercari.com": r"mercari\.com/(us/)?item/",
    "grailed.com": r"grailed\.com/listings/",
    "facebook.com": r"facebook\.com/marketplace/item/",
    "offerup.com": r"offerup\.com/item/detail",
}
MODES = {
    "auto-live": {"type": "auto", "contents": {"text": {"maxCharacters": 4000}, "maxAgeHours": 0}},
    "auto-cached": {"type": "auto", "contents": {"text": {"maxCharacters": 4000}}},
    "keyword-cached": {"type": "keyword", "contents": {"text": {"maxCharacters": 4000}}},
}
PRICE = re.compile(r"(?:US\s?)?\$\s?\d[\d,]*(?:\.\d{2})?")
# Heuristic: phrases marketplaces print on sold, ended or removed listings. "Sold by <seller>" is
# not a match, so a bare SOLD only counts on a line of its own.
GONE = re.compile(
    r"this listing (?:was ended|has ended|sold)|this item (?:is|has) sold|bidding (?:has )?ended|"
    r"no longer available|item is sold|listing has been sold|\bsold out\b|this listing is (?:no longer|unavailable)|"
    r"page (?:not found|isn.t available)|out of stock|^\s*sold\s*$", re.I | re.M)


def exa(path, body, method="POST", tries=6):
    for attempt in range(tries):
        t = time.time()
        req = urllib.request.Request("https://api.exa.ai" + path, method=method,
                                     data=None if body is None else json.dumps(body).encode(),
                                     headers={"content-type": "application/json", "x-api-key": os.environ["EXA_API_KEY"]})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.status, json.load(r), int((time.time() - t) * 1000)
        except urllib.error.HTTPError as e:
            code, data = e.code, e.read().decode(errors="replace")
            try: data = json.loads(data)
            except ValueError: data = {"error": data[:500]}
            if code == 429 or code >= 500:
                time.sleep(5 * (attempt + 1)); continue
            return code, data, int((time.time() - t) * 1000)
        except Exception as e:  # network
            if attempt == tries - 1: return 0, {"error": repr(e)}, int((time.time() - t) * 1000)
            time.sleep(5 * (attempt + 1))
    return code, data, 0


def score(domain, data):
    pat = re.compile(DOMAINS[domain])
    rows = data.get("results") or []
    out = {"n": len(rows), "listing": 0, "price": 0, "listingWithPrice": 0, "gone": 0, "dates": []}
    for x in rows:
        listing, text = bool(pat.search(x["url"])), x.get("text") or ""
        out["listing"] += listing
        out["price"] += bool(PRICE.search(text))
        out["listingWithPrice"] += listing and bool(PRICE.search(text))
        out["gone"] += listing and bool(GONE.search(text))
        if x.get("publishedDate"): out["dates"].append(x["publishedDate"])
    out["statuses"] = [s.get("status") for s in data.get("statuses") or []]
    return out


def coverage():
    os.makedirs(os.path.join(RAW, "coverage"), exist_ok=True)
    jobs = [(qid, q, d, m) for qid, q in QUERIES for d in DOMAINS for m in MODES]

    def done(job):
        f = os.path.join(RAW, "coverage", f"{job[0]}__{job[2]}__{job[3]}.json")
        if not os.path.exists(f): return None
        d = json.load(open(f))
        return d if d["status"] == 200 else None

    def run(job):
        qid, q, d, m = job
        prev = done(job)
        if prev:  # resume: keep successful calls from an earlier run
            return {"qid": qid, "domain": d, "mode": m, "status": 200, "ms": prev["ms"], "error": None, **score(d, prev["response"])}
        body = {"query": q, "numResults": 25, "includeDomains": [d], **MODES[m]}
        code, data, ms = exa("/search", body)
        with open(os.path.join(RAW, "coverage", f"{qid}__{d}__{m}.json"), "w") as f:
            json.dump({"request": body, "status": code, "ms": ms, "response": data}, f, indent=1)
        row = {"qid": qid, "domain": d, "mode": m, "status": code, "ms": ms, "error": data.get("error"), **score(d, data)}
        print(qid, d, m, code, f"n={row['n']} listing={row['listing']} {ms}ms", file=sys.stderr, flush=True)
        return row

    with ThreadPoolExecutor(int(os.environ.get("CONC", 8))) as ex:
        rows = list(ex.map(run, jobs))
    with open(os.path.join(RAW, "coverage-summary.json"), "w") as f:
        json.dump(rows, f, indent=1)


FRESH = {"switch-oled": "Nintendo Switch OLED console", "carhartt-detroit": "Carhartt Detroit jacket",
         "synchilla": "Patagonia Synchilla fleece", "coach-bag": "Coach bag"}


def save(name, obj):
    os.makedirs(os.path.dirname(os.path.join(RAW, name)), exist_ok=True)
    with open(os.path.join(RAW, name), "w") as f: json.dump(obj, f, indent=1)


def freshness():
    """Needs RAW/freshness/ebay_newest.json and posh_newest.json, captured from each site's newest-first
    search in a browser (eBay and Poshmark refuse plain HTTP clients)."""
    ebay = json.load(open(os.path.join(RAW, "freshness/ebay_newest.json")))
    posh = json.load(open(os.path.join(RAW, "freshness/posh_newest.json")))
    jobs = []
    for qid, q in FRESH.items():
        for d in ("ebay.com", "poshmark.com"):
            for m in ("auto-live", "auto-cached"):
                jobs.append(("broad", qid, d, m, {"query": q, "numResults": 100, "includeDomains": [d], **MODES[m]}))
        for item_id, title in ebay["probe"][qid]:  # exact-title probe of a listing made in the last few hours
            jobs.append(("probe", qid, item_id, "auto-cached", {"query": title, "numResults": 10, "includeDomains": ["ebay.com"], **MODES["auto-cached"]}))
            jobs.append(("contents", qid, item_id, "live", {"urls": [f"https://www.ebay.com/itm/{item_id}"], "text": {"maxCharacters": 3000}, "maxAgeHours": 0}))
            jobs.append(("contents", qid, item_id, "cached", {"urls": [f"https://www.ebay.com/itm/{item_id}"], "text": {"maxCharacters": 3000}}))

    def run(j):
        kind, qid, key, m, body = j
        code, data, ms = exa("/contents" if kind == "contents" else "/search", body)
        save(f"freshness/{kind}__{qid}__{key}__{m}.json", {"request": body, "status": code, "ms": ms, "response": data})
        urls = [r["url"] for r in data.get("results") or []]
        row = {"kind": kind, "qid": qid, "key": key, "mode": m, "status": code, "ms": ms, "n": len(urls),
               "statuses": data.get("statuses"), "dates": [r.get("publishedDate") for r in data.get("results") or []]}
        if kind == "broad":
            ids = set(re.findall(r"ebay\.com/itm/(?:[^/]+/)?(\d{9,})", " ".join(urls)) if key == "ebay.com"
                      else re.findall(r"poshmark\.com/listing/[^\s]*?([0-9a-f]{24})", " ".join(urls)))
            newest = (ebay if key == "ebay.com" else posh)["ids"][qid]
            row.update(returnedIds=sorted(ids), overlap=[i for i in newest if i in ids])
        else:
            row.update(found=any(key in u for u in urls), text=bool((data.get("results") or [{}])[0].get("text")) if data.get("results") else False)
        print(kind, qid, key, m, code, row["n"], ms, file=sys.stderr, flush=True)
        return row

    with ThreadPoolExecutor(int(os.environ.get("CONC", 4))) as ex:
        save("freshness-summary.json", list(ex.map(run, jobs)))


SOLD = [
    ("ebay-sold-words", {"query": "Carhartt Detroit jacket J97 sold price", "includeDomains": ["ebay.com"]}),
    ("ebay-sold-words-2", {"query": "Nintendo Switch OLED sold listings", "includeDomains": ["ebay.com"]}),
    ("ebay-sold-path", {"query": "Patagonia Synchilla Snap-T", "includeDomains": ["ebay.com/sch"]}),
    ("130point", {"query": "Pokemon Charizard card sold price", "includeDomains": ["130point.com"]}),
    ("130point-2", {"query": "Air Jordan 1 sold prices", "includeDomains": ["130point.com"]}),
    ("open-web-sold", {"query": "Carhartt Detroit jacket J97 recent sold prices"}),
]
SOLD_URLS = [
    "https://www.ebay.com/sch/i.html?_nkw=carhartt+detroit+jacket+j97&LH_Sold=1&LH_Complete=1",
    "https://www.ebay.com/sch/i.html?_nkw=nintendo+switch+oled&LH_Sold=1&LH_Complete=1",
    "https://130point.com/sales/?q=charizard",
    "https://www.ebay.com/sch/i.html?_nkw=nintendo+switch+oled&_sop=10",
]


def sold():
    rows = []
    for name, body in SOLD:
        for m in ("auto-live", "auto-cached"):
            b = {"numResults": 25, **body, **MODES[m]}
            code, data, ms = exa("/search", b)
            save(f"sold/search__{name}__{m}.json", {"request": b, "status": code, "ms": ms, "response": data})
            res = data.get("results") or []
            rows.append({"name": name, "mode": m, "status": code, "ms": ms, "n": len(res), "error": data.get("error"),
                         "soldPages": sum(bool(re.search(r"LH_Sold|LH_Complete|/sold|130point", r["url"])) for r in res),
                         "withPrice": sum(bool(PRICE.search(r.get("text") or "")) for r in res),
                         "soldWordsAndPrice": sum(bool(re.search(r"\bsold\b", r.get("text") or "", re.I) and PRICE.search(r.get("text") or "")) for r in res),
                         "urls": [r["url"] for r in res][:25]})
    for u in SOLD_URLS:
        for m, extra in (("live", {"maxAgeHours": 0}), ("cached", {})):
            b = {"urls": [u], "text": {"maxCharacters": 20000}, **extra}
            code, data, ms = exa("/contents", b)
            save(f"sold/contents__{len(rows)}__{m}.json", {"request": b, "status": code, "ms": ms, "response": data})
            t = ((data.get("results") or [{}])[0].get("text") or "")
            rows.append({"name": u, "mode": m, "status": code, "ms": ms, "statuses": data.get("statuses"), "chars": len(t),
                         "prices": len(PRICE.findall(t)), "soldDates": len(re.findall(r"Sold\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}", t))})
    save("sold-summary.json", rows)


SCHEMA = {"type": "object", "properties": {
    "title": {"type": "string"}, "price": {"type": "number"}, "currency": {"type": "string"},
    "size": {"type": "string"}, "condition": {"type": "string"}, "sold": {"type": "boolean"}},
    "required": ["title", "price", "currency", "sold"]}


def extract(urls):
    rows = []
    for u in urls:
        b = {"urls": [u], "maxAgeHours": 0, "text": {"maxCharacters": 3000},
             "summary": {"query": "Extract this marketplace listing's details. sold is true if the item is sold, ended or unavailable.", "schema": SCHEMA}}
        code, data, ms = exa("/contents", b)
        save(f"extract/{len(rows)}.json", {"request": b, "status": code, "ms": ms, "response": data})
        r = (data.get("results") or [{}])[0]
        try: summ = json.loads(r.get("summary") or "null")
        except ValueError: summ = {"unparsed": r.get("summary")}
        rows.append({"url": u, "status": code, "ms": ms, "statuses": data.get("statuses"), "summary": summ})
        print(u, code, ms, summ, file=sys.stderr, flush=True)
    save("extract-summary.json", rows)


def analyze():
    """Recompute every coverage number from the raw files and print markdown tables."""
    import statistics, datetime, glob
    now = datetime.datetime(2026, 11, 14, tzinfo=datetime.timezone.utc)
    print("| domain | mode | calls ok | results | listing pages | listings with price | listings sold/ended | dated | median age (d) | p50 / p90 latency (s) |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for d in DOMAINS:
        for m in MODES:
            ok = n = lst = pr = gone = dated = 0; ages, ms = [], []
            for qid, _ in QUERIES:
                f = os.path.join(RAW, "coverage", f"{qid}__{d}__{m}.json")
                if not os.path.exists(f): continue
                r = json.load(open(f))
                if r["status"] != 200: continue
                ok += 1; ms.append(r["ms"] / 1000)
                sc = score(d, r["response"])
                n += sc["n"]; lst += sc["listing"]; pr += sc["listingWithPrice"]; gone += sc["gone"]; dated += len(sc["dates"])
                for x in sc["dates"]:
                    ages.append((now - datetime.datetime.fromisoformat(x.replace("Z", "+00:00"))).days)
            pct = lambda a, b: f"{a} ({round(100 * a / b)}%)" if b else "0"
            ms.sort()
            lat = f"{statistics.median(ms):.1f} / {ms[int(0.9 * (len(ms) - 1))]:.1f}" if ms else "-"
            print(f"| {d} | {m} | {ok}/12 | {n} | {pct(lst, n)} | {pct(pr, lst)} | {pct(gone, lst)} | {pct(dated, n)} | {statistics.median(ages) if ages else '-'} | {lat} |")


if __name__ == "__main__":
    cmd = (sys.argv[1:] or ["coverage"])[0]
    if cmd == "coverage": coverage()
    elif cmd == "freshness": freshness()
    elif cmd == "sold": sold()
    elif cmd == "extract": extract(json.load(open(sys.argv[2])))
    elif cmd == "analyze": analyze()
