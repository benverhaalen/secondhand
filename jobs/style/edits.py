"""What a person can do to their profile: edit, remove, get a facet back, reset (spec §3 step 4, expert note S4).

`PersonState` holds every per-person thing the engine caches (facets, edits, passed-over counts, the For you shelf,
the alert bar), so a reset clears all of it in one place and nothing per person lives anywhere else.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from .facets import compute
from .params import resolved
from .evidence import publish

VERB = {"saved": "saved", "bought": "bought", "kept": "kept", "followed": "followed", "sold": "sold"}


@dataclass
class PersonState:
    person: str
    facets: list = field(default_factory=list)
    edits: dict = field(default_factory=dict)      # (recipient, name, value) -> pinned weight
    removed: dict = field(default_factory=dict)    # (recipient, name, value) -> removed_at
    passed: dict = field(default_factory=dict)     # listing id -> on-screen impressions without a tap (learn.py)
    seen: set = field(default_factory=set)         # impression ids already counted
    shelf: list | None = None                      # cached For you shelf
    stale: bool = True
    alert_bar: float | None = None
    alerts_sent: list = field(default_factory=list)  # (listing id, product id, at); kept across a reset so the cap holds
    floor: datetime | None = None                  # events at or before this are ignored (a reset)


def _key(recipient, name, value):
    return (recipient, name, value)


def mark_stale(state: PersonState) -> None:
    state.stale = True


def edit(state: PersonState, name, value, weight=None, recipient=None, replaces=None, now=None, log=None, params=None):
    """The person's own value for a trait. It is pinned: learning and folds never change its weight."""
    if replaces is not None:
        remove(state, name, replaces, now or datetime.min, recipient=recipient)
    k = _key(recipient, name, value)
    if weight is None:  # pin what the profile shows now
        weight = next((f['weight'] for f in state.facets if _key(f['recipient'], f['name'], f['value']) == k), resolved(params)['values']['style_edit_weight'])
    state.edits[k] = weight
    state.removed.pop(k, None)
    mark_stale(state)
    if log:
        log.change("style_profile", state.person, "edited", name=name, recipient=recipient)


def remove(state: PersonState, name, value, now: datetime, recipient=None, log=None):
    k = _key(recipient, name, value)
    state.removed[k] = now
    state.edits.pop(k, None)
    mark_stale(state)
    if log:
        log.change("style_profile", state.person, "removed", name=name, recipient=recipient)


def fold(state: PersonState, events, now: datetime, log=None, **kw) -> list:
    """Recompute the facets from events (nightly, or after an action) and apply edits and removals."""
    params=resolved(kw.get('params'))
    events = [e for e in events if state.floor is None or e.at > state.floor]
    facets = {_key(f["recipient"], f["name"], f["value"]) + (f.get("brand"),f.get("category")): f for f in compute(events, now, **kw).facets}
    for k, at in state.removed.items():
        facets = {fk: f for fk, f in facets.items() if fk[:3] != k}
        fresh = [f for f in compute([e for e in events if e.at > at], now, **kw).facets if _key(f["recipient"], f["name"], f["value"]) == k]
        for f in fresh:  # Reappearance uses only new evidence and its continuous blend.
            if not any(e.at > at and e.recipient==k[0] and e.attrs.get(k[1])==k[2] for e in events if e.at<=now):
                continue
            f["back_because"] = f"back because you {VERB.get(f['from'], f['from'])} {f['count']} since {at.day} {at:%b}"
            facets[k + (f.get("brand"),f.get("category"))] = f
    for k, w in state.edits.items():
        cur = next((f for fk, f in facets.items() if fk[:3] == k), None)
        facets = {fk: f for fk, f in facets.items() if fk[:3] != k}
        facets[k + (None,None)] = {**(cur or {"count": 0, "recipient": k[0], "name": k[1], "value": k[2], "removed_at": None}),
                               "weight": w, "from": "edited", "pinned": True}
    for f in facets.values():
        if f.get('pinned'):
            f.update(publish({'weight':f['weight'],'count':f.get('count',0)},
                             [dict(id='edit:'+repr((f['recipient'],f['name'],f['value'])),weight=f['weight'])],
                             now,params,metric='facet_edit'))
    state.facets = sorted(facets.values(), key=lambda f: (f["recipient"] or "", f["name"], str(f["value"]), f.get("brand") or "", f.get("category") or ""))
    mark_stale(state)
    if log:
        log.change("style_profile", state.person, "folded", facets=len(state.facets))
    return state.facets


def reset(state: PersonState, now: datetime, log=None) -> None:
    """Clears facets, edits, removals, passed-over counts, the cached shelf and the alert bar; the next open is the cold-start shelf."""
    state.facets, state.edits, state.removed, state.passed, state.seen = [], {}, {}, {}, set()
    state.shelf, state.alert_bar, state.floor = None, None, now
    mark_stale(state)
    if log:
        log.change("style_profile", state.person, "reset")
