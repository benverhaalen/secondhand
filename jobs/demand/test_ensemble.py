"""dt-5: the research ensemble on the gateway, with its track record (demand-and-trend §3 step 7)."""
import math

from demand.direction import Proxy, demand_index
from demand.ensemble import Record, ask, brier

Q = {"id": "q1", "text": "Will used p50 of this model be under $200 by June?", "resolves_on": "2027-06-01"}


def gateway(ps):
    calls = iter(ps)
    return lambda question, evidence: next(calls)


def test_aggregate_is_geometric_mean_of_odds_and_shows_the_range():
    out = ask(Q, evidence=["comp-1"], call=gateway([0.6, 0.7, 0.8, 0.7, 0.65]), record=Record())
    logit = lambda p: math.log(p / (1 - p))
    expect = 1 / (1 + math.exp(-sum(map(logit, [0.6, 0.7, 0.8, 0.7, 0.65])) / 5))
    assert abs(out["p"] - expect) < 1e-12
    assert out["range"] == (0.6, 0.8) and out["calls"] == 5
    assert out["record"] == {"brier": None, "resolved": 0}


def test_gateway_down_is_arithmetic_only():
    def down(question, evidence):
        raise ConnectionError("gateway 503")
    out = ask(Q, evidence=[], call=down, record=Record())
    assert out["p"] is None and out["state"] == "arithmetic_only"


def test_bad_record_drops_weight():
    good, bad = Record(), Record()
    for _ in range(30):
        good.resolve(0.9, 1)
        bad.resolve(0.9, 0)
    assert good.weight() > 0.9 and bad.weight() < 0.1
    assert abs(brier([0.9], [1]) - 0.01) < 1e-12


def test_ensemble_never_enters_D():
    proxies = {"sold": Proxy(recent=20, base=10), "watchers": Proxy(recent=30, base=30)}
    w = {"sold": 1.0, "watchers": 0.6}
    before = demand_index(proxies, w)
    ask(Q, evidence=[], call=gateway([0.99] * 5), record=Record())
    assert demand_index(proxies, w) == before
    import demand.direction as d
    assert "ensemble" not in open(d.__file__, encoding="utf-8").read()
