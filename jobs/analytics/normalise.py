"""Platform analytics, step 1: turn each site's own stats read into `listing_stat` rows.

Operating design (written before the code, per the build skill)

Reads. One raw read is {site, listing_id, item_id, posted_at, read_at, route, payload}. It comes from
an API (eBay, Depop) or a harness read of the seller page (Poshmark, Mercari, Facebook). Nothing else
is read here: orders and prices come from other engines.

Steps, fewest moves. For each listing, sort its reads by time. For each read: pull the site's
fields into Ben's five stages (exposure, attention, interest, intent, outcome), keeping the site's own
word and its real definition beside the number. Flow stages on cumulative sites become daily
deltas against the previous read of the same listing id. Gauge stages (likes, bag) stay as read.
Then set the site's day and its UTC window, and the closed list of data-quality flags.

Parallel. Listings and sites are independent, so a caller can run them as separate batches; a
single listing's reads are strictly ordered because each delta needs the one before it.

Decisions. No model runs here: every rule is a table lookup or a subtraction, so it is cheap and
replayable. A language model only reads the site's help text once, when a site table entry is
written or changed (and then an adapter version bump freezes the site's rows, see learn.py).

Likely to break. (1) Mercari "views" are impressions, so they map to exposure and the row says so.
(2) A blank before the daily update is `not_yet_processed`, never zero. (3) A cumulative counter that
falls is a reset: that day is dropped and the baseline restarts. (4) eBay's day is Pacific
(GMT-07:00), so its UTC window starts at 07:00. (5) A relist gets a new listing id and a new
baseline, but is the same item. (6) A field the site did not send is `not_reported`. (7) A listing
posted before we linked it has no baseline: its first read is `left_truncated`.
shortcut: eBay is fixed at -07:00 all year, as eBay's own report states; revisit if eBay moves to PDT/PST.
"""
from datetime import datetime, timedelta, timezone

STAGES = ("exposure", "attention", "interest", "intent", "outcome")
FLAGS = (
    "not_reported", "not_yet_processed", "counter_reset", "boosted", "definition_undocumented",
    "not_in_view_possible", "late", "adapter_frozen", "harness_read", "self_reported",
    "left_truncated", "timezone",
)
_MISSING = object()

# stage -> (payload path, the site's own term, what it really is)
SITES = {
    "ebay": dict(tz=-7, cumulative=False, gauge=("interest",), flags=("timezone", "not_in_view_possible"), map={
        "exposure": (("metrics", "impressions_total"), "impressions", "search impressions, may not have been in view"),
        "attention": (("metrics", "views"), "views", "listing page views"),
        "interest": (("metrics", "watchers"), "watchers", "people watching now"),
        "intent": (("metrics", "offers"), "offers", "offers received"),
        "outcome": (("metrics", "transactions"), "transactions", "sales")}),
    "mercari": dict(tz=0, cumulative=True, gauge=("interest",), flags=(), map={
        "exposure": (("views",), "views", "impressions"),
        "attention": (("clicks",), "clicks", "opens of the listing"),
        "interest": (("likes",), "likes", "people who liked it"),
        "intent": (("offers",), "offers", "offers received")}),
    "poshmark": dict(tz=0, cumulative=True, gauge=("interest",), flags=("definition_undocumented",), map={
        "exposure": (("impressions",), "impressions", "not defined by Poshmark"),
        "attention": (("clicks",), "clicks", "not defined by Poshmark"),
        "interest": (("likes",), "likes", "people who liked it"),
        "intent": (("offers",), "offers", "offers received")}),
    "depop": dict(tz=0, cumulative=True, gauge=("interest", "intent"), flags=(), map={
        "exposure": (None, "impressions", "organic plus boosted impressions"),
        "attention": (None, "clicks", "organic plus boosted clicks"),
        "interest": (("likes_count",), "likes_count", "people who liked it"),
        "intent": (("bag_count",), "bag_count", "people with it in a bag")}),
    "facebook": dict(tz=0, cumulative=True, gauge=("interest",), flags=("self_reported",), map={
        "exposure": (("views",), "views", "views as Facebook counts them"),
        "attention": (("clicks",), "clicks", "clicks as Facebook counts them"),
        "interest": (("saves",), "saves", "saves"),
        "intent": (("messages",), "messages", "messages to the seller"),
        "outcome": (("sold_by_tap",), "sold", "sold, as the person told us")}),
}


def _get(payload, path):
    for k in path:
        if not isinstance(payload, dict) or k not in payload:
            return _MISSING
        payload = payload[k]
    return payload


def _raw(site, stage, payload):
    path = SITES[site]["map"][stage][0]
    if path is None:  # Depop: organic plus boosted; either blank means blank
        key = "impressions" if stage == "exposure" else "clicks"
        parts = [_get(payload, (g, key)) for g in ("organic", "boosted")]
        if _MISSING in parts:
            return _MISSING
        return None if None in parts else sum(parts)
    v = _get(payload, path)
    return int(v) if isinstance(v, bool) else v


def _ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _z(d):
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _window(site, day):
    start = datetime.fromisoformat(day).replace(tzinfo=timezone.utc) - timedelta(hours=SITES[site]["tz"])
    return _z(start), _z(start + timedelta(days=1))


def normalise(reads):
    """Rows {listing_id, item_id, site, day, window_utc, stages, terms, flags, boosted, read_at, route}."""
    rows, prev = [], {}
    for r in sorted(reads, key=lambda r: (r["listing_id"], r["read_at"])):
        site = r["site"]
        if site not in SITES:
            raise ValueError(f"unknown site {site!r}")
        spec, p = SITES[site], r["payload"]
        flags = set(spec["flags"]) | ({"harness_read"} if r["route"] == "harness" else set())
        day = p["day"] if site == "ebay" else _ts(r["read_at"]).date().isoformat()
        base = prev.get(r["listing_id"])
        truncated = base is None and spec["cumulative"] and _ts(r["posted_at"]).date().isoformat() < day
        if truncated:
            flags.add("left_truncated")
        stages, terms, state = {}, {}, dict(base or {})
        for st in STAGES:
            if st not in spec["map"]:
                stages[st] = None
                continue
            terms[st] = {"site_term": spec["map"][st][1], "definition": spec["map"][st][2]}
            v = _raw(site, st, p)
            if v is _MISSING:
                flags.add("not_reported")
                v = None
            elif v is None:
                flags.add("not_yet_processed")
            if v is None or st in spec["gauge"] or not spec["cumulative"]:
                stages[st] = v
                continue
            old = state.get(st)
            if truncated:
                stages[st] = None
            elif old is None:
                stages[st] = v
            elif v < old:
                flags.add("counter_reset")
                stages[st] = None
            else:
                stages[st] = v - old
            state[st] = v
        boosted = False
        boost = _get(p, ("boosted", "impressions")) if site == "depop" else _MISSING
        if boost is not _MISSING and boost is not None:
            boosted = boost > state.get("_boost", 0)
            state["_boost"] = boost
        if boosted:
            flags.add("boosted")
        prev[r["listing_id"]] = state
        rows.append(dict(listing_id=r["listing_id"], item_id=r["item_id"], site=site, day=day,
                         window_utc=_window(site, day), stages=stages, terms=terms,
                         flags=sorted(flags), boosted=boosted, read_at=r["read_at"], route=r["route"]))
    return rows


def distinct_items(rows, same_item=None):
    """Cross-listed and relisted copies of one item count once. same_item maps item_id -> canonical id."""
    same_item = same_item or {}
    return len({same_item.get(r["item_id"], r["item_id"]) for r in rows})
