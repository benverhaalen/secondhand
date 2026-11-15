"""Events to a person's facets (spec/engines/recommendation-and-style.md §2, §3 steps 1-3; expert note S1-S3).

One call is one person: `compute` refuses mixed people and reads no shared state, so another person's events cannot
move these facets (isolation). The only pooled input is `offsets`, passed in explicitly by the caller.
"""
from __future__ import annotations

import statistics
import math
from .params import resolve, resolved
from .evidence import publish
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta

# Compatibility projection of the declared §2 priors; calculations use resolved params.
START = {s: (resolve()['values']['style_'+s+'_taste'], resolve()['values']['style_'+s+'_size'])
         for s in ('want','you_said','save','follow','purchase','kept','sold','not_for_me')}
# spec `from` enum has no want / you_said; they map to saved (a requested name, not edited in spec)
FROM = {"want": "saved", "you_said": "saved", "save": "saved", "follow": "followed", "purchase": "bought",
        "kept": "kept", "sold": "sold"}
TASTE_NAMES = ("brand", "category", "colour", "era", "price_band")
LETTERS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"]


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
        return LETTERS[min(max(math.floor(value + 0.5), 0), len(LETTERS) - 1)]
    return f"{value:g}"


def _norm(size, brand, category, offsets):
    r = _rank(size)
    if r is None:
        return None
    return _label(r[0], r[1] - offsets.get((brand, category), 0)), r


def pool_offsets(people_modes: dict, min_people=None, *, params=None) -> dict:
    """{person: {(brand, category): size label}} -> {(brand, category): median steps from that person's own category mean}.
    A pair needs `min_people` people who own another brand in the same category, so one person's numbers are never "pooled"."""
    min_people = resolved(params)["values"]["style_offset_people"] if min_people is None else min_people
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
    return (now - at).total_seconds() / 86400  # Fixed unit conversion: seconds per day.


def event_weights(e: Event, table: dict, sourcing_days=None, as_of=None) -> tuple[float, float]:
    """(taste, size) for one event after the sourcing and sold rules."""
    if e.sold or e.source == "sold":
        return table["sold"]
    if e.source == "purchase" and e.listed_at is not None and (as_of is None or e.listed_at<=as_of) and e.listed_at - e.at <= timedelta(days=resolved(None)["values"]["style_sourcing_days"] if sourcing_days is None else sourcing_days):
        return 0.0, 0.0
    return table[e.source]


def compute(events, now: datetime, *, weights: dict | None = None, k: float | None = None, offsets: dict | None = None,
            children=frozenset(), params=None, shared_facets=()) -> Result:
    params = resolved(params)
    v = params['values']
    k = v['style_affinity_k'] if k is None else k
    table = {s: (v['style_'+s+'_taste'],v['style_'+s+'_size']) for s in START}
    table.update(weights or {})
    events = sorted((e for e in events if e.at <= now), key=lambda e:(e.at,e.id))
    if len({e.person for e in events}) > 1:
        raise ValueError("compute takes one person's events")
    offsets = offsets or {}
    taste = defaultdict(list)  # (recipient, name, value) -> [(event, contribution)]
    sizes = defaultdict(list)  # (recipient, category) -> [(event, weight, normalised label, rank)]
    penalties: dict = {}
    for e in events:
        if e.source == "not_for_me":
            d = 0.5 ** (_days(now, e.at) / v['style_half_life_days'])
            if e.attrs.get("cluster"):
                key = f"cluster:{e.attrs['cluster']}"
                penalties[key] = penalties.get(key, 0.0) - v['style_cluster_penalty'] * d
            if e.attrs.get("brand"):
                key = f"brand:{e.attrs['brand']}"
                penalties[key] = penalties.get(key, 0.0) - v['style_brand_penalty'] * d
            continue
        wt, ws = event_weights(e, table, v['style_sourcing_days'], now)
        age = _days(now, e.at)
        if wt > 0:
            for name in TASTE_NAMES:
                if e.attrs.get(name) is not None:
                    taste[(e.recipient, name, e.attrs[name])].append((e, wt * 0.5 ** (age / v['style_half_life_days'])))
        if ws > 0 and e.attrs.get("size") is not None and e.attrs.get("category") is not None:
            n = _norm(e.attrs["size"], e.attrs.get("brand"), e.attrs["category"], offsets)
            if n:
                half = v['style_child_half_life_days'] if e.recipient in children else v['style_half_life_days']
                sizes[(e.recipient, e.attrs["category"])].append((e, ws * 0.5 ** (age / half), n[0], n[1]))
    unassigned, skip = _unassigned(sizes, v['style_unassigned_steps'])
    facets = []
    for (rec, name, value), rows in taste.items():
        rows = [r for r in rows if r[1] > 0 and r[0].id not in skip]  # an unassigned purchase waits: not taste either
        if not rows:
            continue
        a = sum(c for _, c in rows)
        by_src = defaultdict(float)
        for e, c in rows:
            by_src[e.source] += c
        # Lexical source names break equal contribution ties.
        facets.append({"name": name, "value": value, "weight": a / (a + k), "a": a, "from": FROM[max(sorted(by_src), key=by_src.get)],
                       "count": len(rows), "recipient": rec, "pinned": False, "removed_at": None,
                       **publish({'weight':a/(a+k),'count':len(rows)}, [_basis(e,c) for e,c in rows], now, params, metric='facet')})
    for (rec, cat), rows in sizes.items():
        facets += _size_facets(rec, cat, [r for r in rows if r[0].id not in skip], now, params)
    own = {(f['recipient'],f['name'],str(f['value']),f.get('brand'),f.get('category')):f for f in facets}
    shared_by={(f.get('recipient'),f['name'],str(f['value']),f.get('brand'),f.get('category')):f for f in shared_facets
               if not f.get('removed_at')}
    for key in sorted(own.keys() | shared_by.keys(),key=repr):
        local, shared=own.get(key), shared_by.get(key)
        n=local['count'] if local else 0
        blend=n/(n+v['style_event_blend'])
        if local and local['name']!='size':
            dates=[datetime.fromisoformat(b['at']) for b in local['citation']['basis']]
            span=_days(max(dates),min(dates))+1  # Fixed inclusive span: same-day evidence occupies one day.
            blend*=span/(span+v['style_day_blend'])
        weight=blend*(local['weight'] if local else 0)+(1-blend)*(shared['weight'] if shared else 0)
        base=dict(local or shared)
        base.setdefault("recipient",key[0])
        base.setdefault("pinned",False)
        base.setdefault("removed_at",None)
        basis=(local['citation']['basis'] if local else [])
        if shared:
            basis=basis+[dict(id='shared:'+repr(key),facet=shared)]
        base.update(weight=weight, **publish({'weight':weight,'count':base['count']},basis,now,params,metric='facet_blend',basis_level='person' if n else 'prior'))
        own[key]=base
    facets=list(own.values())
    facets.sort(key=lambda f: (f["recipient"] or "", f["name"], str(f["value"]), f.get("brand") or "", f.get("category") or ""))
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


def _unassigned(sizes, steps):
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
            if ref and ref[0] == rank[0] and abs(ref[1] - rank[1]) > steps:
                out.append({"event": e.id, "category": cat, "size": e.attrs["size"]})
                skip.add(e.id)
    return out, skip


def _basis(e, contribution):
    return dict(id=e.id,source=e.source,at=e.at,attrs=e.attrs,contribution=contribution)


def _size_facets(rec, cat, rows, now, params):
    v=params['values']
    def make(m, brand, defining):
        src = defaultdict(float)
        for r in defining:
            src[r[0].source] += r[1]
        return {"name": "size", "value": m[0], "weight": m[1], "from": FROM[max(sorted(src), key=src.get)], "count": m[2],
                "recipient": rec, "pinned": False, "removed_at": None, "category": cat, "brand": brand,
                **publish({'weight':m[1],'count':m[2]},[_basis(r[0],r[1]) for r in defining],now,params,metric='size')}
    m = _mode(rows, lambda r: r[2])
    if m and m[1] >= v['style_size_share']:
        return [make(m, None, rows)]
    out = []
    for brand in sorted({r[0].attrs.get("brand") for r in rows} - {None}):  # brand sizes differ: keep each brand's own
        sub = [r for r in rows if r[0].attrs.get("brand") == brand]
        raw = _mode(sub, lambda r: str(r[0].attrs["size"]).strip().upper())
        if raw and raw[1] >= v['style_size_share']:
            out.append(make(raw, brand, sub))
    return out


def profiles(events, now: datetime, **kw) -> dict:
    """{person: Result}, each computed from that person's events alone."""
    by = defaultdict(list)
    for e in events:
        by[e.person].append(e)
    return {p: compute(es, now, **kw) for p, es in sorted(by.items())}
