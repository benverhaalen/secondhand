"""Events to a person's facets (spec/engines/recommendation-and-style.md §2, §3 steps 1-3; expert note S1-S3).

One call is one person: `compute` refuses mixed people and reads no shared state, so another person's events cannot
move these facets (isolation). The only pooled input is `offsets`, passed in explicitly by the caller.
"""
from __future__ import annotations

import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta

# (taste, size) start weights per source, spec §2. A sold item is 0/0 here: the expert note counts it for neither
# taste nor current size (the spec gives 0.2 and 0.4).
START = {
    "want": (1.0, 1.0), "you_said": (1.0, 1.0), "save": (0.8, 0.6), "follow": (0.6, 0.0),
    "purchase": (0.5, 0.8), "kept": (0.4, 0.8), "sold": (0.0, 0.0), "not_for_me": (0.0, 0.0),
}
# spec `from` enum has no want / you_said; they map to saved (a requested name, not edited in spec)
FROM = {"want": "saved", "you_said": "saved", "save": "saved", "follow": "followed", "purchase": "bought",
        "kept": "kept", "sold": "sold"}
TASTE_NAMES = ("brand", "category", "colour", "era", "price_band")
SOURCING_DAYS = 30
CHILD_HALF_LIFE_DAYS = 91.0  # guess: about 3 months; tune on real child histories
LETTERS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"]
SIZE_SHARE, MIN_EVENTS, MIN_DAYS = 0.7, 3, 2


@dataclass(frozen=True)
class Event:
    id: str
    person: str
    source: str
    at: datetime
    attrs: dict = field(default_factory=dict)
    recipient: str | None = None
    listed_at: datetime | None = None  # when the purchased item was relisted, if it was
    sold: bool = False                 # the item behind this event has since been sold

    def __post_init__(self):
        if self.source not in START:
            raise ValueError(f"unknown event source {self.source!r}")


@dataclass
class Result:
    facets: list
    unassigned: list
    penalties: dict

    def as_dict(self) -> dict:
        return {"facets": self.facets, "unassigned": self.unassigned, "penalties": self.penalties}


def _rank(size):
    s = str(size).strip().upper()
    if s in LETTERS:
        return ("L", float(LETTERS.index(s)))
    try:
        return ("N", float(s))
    except ValueError:
        return None


def _label(kind, value):
    if kind == "L":
        return LETTERS[min(max(int(round(value)), 0), len(LETTERS) - 1)]
    return f"{value:g}"


def _norm(size, brand, category, offsets):
    r = _rank(size)
    if r is None:
        return None
    return _label(r[0], r[1] - offsets.get((brand, category), 0)), r


def pool_offsets(people_modes: dict, min_people: int = 5) -> dict:
    """{person: {(brand, category): size label}} -> {(brand, category): median steps from that person's own category mean}.
    A pair needs `min_people` people who own another brand in the same category, so one person's numbers are never "pooled"."""
    seen = defaultdict(list)
    for modes in people_modes.values():
        by_cat = defaultdict(list)
        for (brand, cat), size in modes.items():
            r = _rank(size)
            if r:
                by_cat[cat].append((brand, r))
        for cat, rows in by_cat.items():
            if len(rows) < 2 or len({r[0] for _, r in rows}) != 1:
                continue
            mean = statistics.fmean(r[1] for _, r in rows)
            for brand, r in rows:
                seen[(brand, cat)].append(r[1] - mean)
    return {k: statistics.median(v) for k, v in seen.items() if len(v) >= min_people}


def _days(now, at):
    return max(0.0, (now - at).total_seconds() / 86400)


def event_weights(e: Event, table: dict) -> tuple[float, float]:
    """(taste, size) for one event after the sourcing and sold rules."""
    if e.sold or e.source == "sold":
        return 0.0, 0.0
    if e.source == "purchase" and e.listed_at is not None and e.listed_at - e.at <= timedelta(days=SOURCING_DAYS):
        return 0.0, 0.0
    return table[e.source]


def compute(events, now: datetime, *, weights: dict | None = None, k: float = 2.0, offsets: dict | None = None,
            children=frozenset()) -> Result:
    table = {**START, **(weights or {})}
    events = list(events)
    if len({e.person for e in events}) > 1:
        raise ValueError("compute takes one person's events")
    offsets = offsets or {}
    taste = defaultdict(list)  # (recipient, name, value) -> [(event, contribution)]
    sizes = defaultdict(list)  # (recipient, category) -> [(event, weight, normalised label, rank)]
    penalties: dict = {}
    for e in events:
        if e.source == "not_for_me":
            d = 0.5 ** (_days(now, e.at) / 365)
            if e.attrs.get("cluster"):
                key = f"cluster:{e.attrs['cluster']}"
                penalties[key] = penalties.get(key, 0.0) - 1.0 * d
            if e.attrs.get("brand"):
                key = f"brand:{e.attrs['brand']}"
                penalties[key] = penalties.get(key, 0.0) - 0.3 * d
            continue
        wt, ws = event_weights(e, table)
        age = _days(now, e.at)
        if wt > 0:
            for name in TASTE_NAMES:
                if e.attrs.get(name) is not None:
                    taste[(e.recipient, name, e.attrs[name])].append((e, wt * 0.5 ** (age / 365)))
        if ws > 0 and e.attrs.get("size") is not None and e.attrs.get("category") is not None:
            n = _norm(e.attrs["size"], e.attrs.get("brand"), e.attrs["category"], offsets)
            if n:
                half = CHILD_HALF_LIFE_DAYS if e.recipient in children else 365.0
                sizes[(e.recipient, e.attrs["category"])].append((e, ws * 0.5 ** (age / half), n[0], n[1]))
    unassigned, skip = _unassigned(sizes)
    facets = []
    for (rec, name, value), rows in taste.items():
        rows = [r for r in rows if r[1] > 0 and r[0].id not in skip]  # an unassigned purchase waits: not taste either
        if len(rows) < MIN_EVENTS or max(r[0].at for r in rows) - min(r[0].at for r in rows) < timedelta(days=MIN_DAYS):
            continue
        a = sum(c for _, c in rows)
        by_src = defaultdict(float)
        for e, c in rows:
            by_src[e.source] += c
        facets.append({"name": name, "value": value, "weight": a / (a + k), "a": a, "from": FROM[max(by_src, key=by_src.get)],
                       "count": len(rows), "recipient": rec, "pinned": False, "removed_at": None})
    for (rec, cat), rows in sizes.items():
        facets += _size_facets(rec, cat, [r for r in rows if r[0].id not in skip])
    facets.sort(key=lambda f: (f["recipient"] or "", f["name"], str(f["value"]), f.get("brand") or ""))
    return Result(facets, unassigned, penalties)


def _mode(rows, key):
    tally, count = defaultdict(float), defaultdict(int)
    for r in rows:
        tally[key(r)] += r[1]
        count[key(r)] += 1
    if not tally:
        return None
    top = max(sorted(tally), key=tally.get)
    return top, tally[top] / sum(tally.values()), count[top]


def _unassigned(sizes):
    """A purchase with no recipient more than one step from the category mode, with no second event on that size, waits."""
    out, skip = [], set()
    for (rec, cat), rows in sizes.items():
        if rec is not None:
            continue
        for e, _, label, rank in rows:
            if e.source != "purchase":
                continue
            others = [o for o in rows if o[0].id != e.id]
            if any(o[2] == label for o in others):
                continue
            m = _mode(others, lambda o: o[2])
            ref = next((o[3] for o in others if o[2] == m[0]), None) if m else None
            if ref and ref[0] == rank[0] and abs(ref[1] - rank[1]) > 1:
                out.append({"event": e.id, "category": cat, "size": e.attrs["size"]})
                skip.add(e.id)
    return out, skip


def _size_facets(rec, cat, rows):
    def make(m, brand):
        src = defaultdict(float)
        for r in rows:
            src[r[0].source] += r[1]
        return {"name": "size", "value": m[0], "weight": m[1], "from": FROM[max(src, key=src.get)], "count": m[2],
                "recipient": rec, "pinned": False, "removed_at": None, "category": cat, "brand": brand}
    m = _mode(rows, lambda r: r[2])
    if m and m[1] >= SIZE_SHARE and m[2] >= MIN_EVENTS:
        return [make(m, None)]
    out = []
    for brand in sorted({r[0].attrs.get("brand") for r in rows} - {None}):  # brand sizes differ: keep each brand's own
        sub = [r for r in rows if r[0].attrs.get("brand") == brand]
        raw = _mode(sub, lambda r: str(r[0].attrs["size"]).strip().upper())
        if raw and raw[1] >= SIZE_SHARE and raw[2] >= MIN_EVENTS:
            out.append(make(raw, brand))
    return out


def profiles(events, now: datetime, **kw) -> dict:
    """{person: Result}, each computed from that person's events alone."""
    by = defaultdict(list)
    for e in events:
        by[e.person].append(e)
    return {p: compute(es, now, **kw) for p, es in sorted(by.items())}
