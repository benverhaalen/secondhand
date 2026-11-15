"""tr-5 proof: nightly fit, Platt small / isotonic large, held-out only, switch and rollback (spec/engines/trust.md §4, §7)."""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from param.registry import MemoryStore  # noqa: E402
from trust.fit import SWITCH_N, brier, fit, isotonic, platt, split, watch, NAME  # noqa: E402


def stream(n: int, seed: int = 1, flip: bool = False) -> list[tuple[float, int]]:
    rnd = random.Random(seed)
    out = []
    for _ in range(n):
        z = rnd.uniform(-4, 4)
        p = 1 / (1 + 2.718281828 ** (-z))
        y = 1 if rnd.random() < p else 0
        out.append((z, (1 - y) if flip else y))
    return out


def test_small_group_uses_platt_large_uses_isotonic():
    s = MemoryStore()
    assert fit(s, stream(SWITCH_N - 1), "2026-11-14T00:00:00Z").kind == "platt"
    assert fit(MemoryStore(), stream(SWITCH_N), "2026-11-14T00:00:00Z").kind == "isotonic"


def test_isotonic_is_monotone():
    ys = isotonic(stream(1200, 3))["ys"]
    assert all(a <= b for a, b in zip(ys, ys[1:]))


def test_first_fit_is_champion_with_its_gate_fields_and_score_is_heldout_only():
    s = MemoryStore()
    rows = stream(400)
    r = fit(s, rows, "2026-11-14T00:00:00Z")
    champ = s.champion(NAME, {})
    v = champ["value_or_hyperparams"]
    assert r.promoted and v["n"] == 400 and v["positives"] == sum(y for _, y in rows) and 0 <= v["ece"] <= 1
    train, held = split(rows)
    assert champ["held_out_score"] == -brier(platt(train), held)  # not the train score
    assert set(map(tuple, train)).isdisjoint(set(map(tuple, held)))


def test_a_challenger_that_does_not_beat_the_champion_is_not_promoted():
    s = MemoryStore()
    fit(s, stream(400, 1), "2026-11-14T00:00:00Z")
    r = fit(s, stream(400, 2, flip=True), "2026-11-15T00:00:00Z")  # labels inverted: a worse held-out score
    assert not r.promoted and s.champion(NAME, {})["version"] == 1
    assert [x["status"] for x in s.history(NAME, {})] == ["champion", "challenger"]


def test_rollback_when_the_champion_degrades_on_live_threads():
    s = MemoryStore()
    fit(s, stream(400, 1), "2026-11-14T00:00:00Z")
    fit(s, stream(400, 5), "2026-11-15T00:00:00Z", noise=-1.0)  # force v2 in
    assert s.champion(NAME, {})["version"] == 2
    assert watch(s, stream(300, 9, flip=True), "2026-11-16T00:00:00Z")
    assert s.champion(NAME, {})["version"] == 1
    assert not watch(s, stream(300, 9), "2026-11-17T00:00:00Z")  # healthy live data: no rollback


def test_a_persons_fit_is_written_under_that_person_and_never_reaches_another():
    s = MemoryStore()
    fit(s, stream(400), "2026-11-14T00:00:00Z", person="ana", site="facebook_local")
    assert s.champion(NAME, {"site": "facebook_local", "person": "ana"}) is not None
    assert s.champion(NAME, {"site": "facebook_local", "person": "bo"}) is None
    assert s.champion(NAME, {"site": "facebook_local"}) is None
