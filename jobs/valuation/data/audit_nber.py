"""Read-only raw NBER audit; emit aggregates, never listing or person IDs.

    python jobs/valuation/data/audit_nber.py /path/to/anon_bo_lists.csv.gz
"""
import csv
import gzip
import json
import sys
from collections import Counter
from datetime import datetime


def audit(path):
    categories, late, late_ends, late_starts = Counter(), Counter(), Counter(), Counter()
    total, without_product_id = 0, 0
    with gzip.open(path, "rt", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        category, start, end, price, product = (header.index(c) for c in
            ("meta_categ_id", "auct_start_dt", "auct_end_dt", "item_price", "anon_product_id"))
        for r in reader:
            total += 1
            without_product_id += not r[product]
            categories[r[category]] += 1
            v = r[end]
            # Raw dates are ddmonyyyy; compare year/month before parsing 98M dates.
            if int(v[-4:]) > 2013 or (v[-4:] == "2013" and v[-7:-4].lower() in
                                                   ("jul", "aug", "sep", "oct", "nov", "dec")):
                status = "sold" if r[price] else "unsold"
                late[status] += 1
                late_ends[status, v] += 1
                late_starts[r[start]] += 1
    late_range, by_year = {}, {}
    for (status, end), n in late_ends.items():
        day = datetime.strptime(end, "%d%b%Y").date().isoformat()
        lo, hi = late_range.get(status, [day, day])
        late_range[status] = [min(lo, day), max(hi, day)]
        by_year.setdefault(day[:4], Counter())[status] += n
    starts = [datetime.strptime(v, "%d%b%Y").date().isoformat() for v in late_starts]
    return {"rows": total, "by_meta_categ_id": dict(sorted(categories.items(), key=lambda x: int(x[0]))),
            "without_product_id": without_product_id,
            "after_2013_06_30": dict(late), "late_end_range": late_range,
            "late_by_end_year": dict(sorted(by_year.items())),
            "late_start_range": [min(starts), max(starts)] if starts else None}


if __name__ == "__main__":
    print(json.dumps(audit(sys.argv[1]), indent=2))
