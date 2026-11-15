import pytest

from negotiation.sim import FloorViolation, compare, draw_buyers, run

ASK, FLOOR, ALWAYS = 8000, 6000, 7200
# Ratios of the ask at which real offers closed; a stand-in sample until the frozen offer threads land.
ACCEPTED = [0.78, 0.8, 0.82, 0.85, 0.85, 0.88, 0.9, 0.9, 0.92, 0.95]


def keep(c):  # the negotiation worked example's eBay keep, in cents
    return 0.864 * c - 940


def ending(c):
    d = c // 100
    while d % 10 not in (5, 8):
        d -= 1
    return d * 100


def champion(s):
    o = s["offer_cents"]
    if o >= s["always_accept_cents"]:
        return {"kind": "accept_offer"}
    if o < s["floor_cents"]:
        return {"kind": "price_below_floor", "amount_cents": max(s["floor_cents"], ending((o + s["ask_cents"]) // 2)), "ask": True}
    return {"kind": "counter_offer", "amount_cents": max(s["floor_cents"], ending((o + s["ask_cents"]) // 2))}


def high_counter(s):
    a = champion(s)
    if a["kind"] == "counter_offer":
        a["amount_cents"] = max(a["amount_cents"], ending(s["ask_cents"] - 300))
    return a


def args():
    return dict(ask_cents=ASK, floor_cents=FLOOR, always_accept_cents=ALWAYS, keep=keep, v_wait_cents=4400)


def test_a_policy_that_counters_under_the_floor_fails_the_run():
    def planted(s):
        return {"kind": "counter_offer", "amount_cents": FLOOR - 500}
    with pytest.raises(FloorViolation):
        run(planted, draw_buyers(10, ASK, ACCEPTED), **args())


def test_a_policy_that_auto_accepts_a_lowball_fails_the_run():
    with pytest.raises(FloorViolation):
        run(lambda s: {"kind": "accept_offer"}, draw_buyers(10, ASK, ACCEPTED, types=("lowballer",)), **args())


def test_lowballers_never_close_under_the_floor():
    r = run(champion, draw_buyers(200, ASK, ACCEPTED, types=("lowballer",)), **args())
    sold = [t.final_cents for t in r["threads"] if t.final_cents is not None]
    assert all(c >= FLOOR for c in sold)
    assert any(t.outcome == "asked" for t in r["threads"])


def test_a_ghost_times_out_and_keeps_the_plan_value():
    r = run(champion, draw_buyers(20, ASK, ACCEPTED, types=("ghost",)), **args())
    assert {t.outcome for t in r["threads"]} <= {"expired", "accepted", "asked"}
    assert any(t.outcome == "expired" for t in r["threads"])


def test_every_type_plays_and_every_sale_lies_in_floor_to_ask():
    r = run(champion, draw_buyers(200, ASK, ACCEPTED), **args())
    assert {t.buyer.kind for t in r["threads"]} == {"fair", "lowballer", "haggler", "committed", "ghost"}
    assert all(FLOOR <= t.final_cents <= ASK for t in r["threads"] if t.final_cents is not None)


def test_compare_is_paired_and_deterministic():
    buyers = draw_buyers(200, ASK, ACCEPTED, seed=3)
    a = run(champion, buyers, **args())["keep_per_thread"]
    b = run(high_counter, draw_buyers(200, ASK, ACCEPTED, seed=3), **args())["keep_per_thread"]
    one, two = compare(a, b), compare(a, b)
    assert one == two and one["n"] == 200
    assert compare(a, a)["mean_gain"] == 0
