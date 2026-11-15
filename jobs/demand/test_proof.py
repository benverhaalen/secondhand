"""dt-6: demand fixed set and backtest (demand-and-trend §9)."""
import pytest

from demand.proof.backtest import WEEKS, fixed_set, history, run


@pytest.fixture(scope="module")
def result():
    return run(fixed_set())


def test_fixed_set_is_frozen():
    a, b = fixed_set(), fixed_set()
    assert a == b and len(a) == 60 and len({p["kind"] for p in a}) == 6


def test_backtest_beats_carrying_forward_by_ten_percent(result):
    assert result["n"] == 60 * 26
    assert result["gain"] >= 0.10, result


def test_coverage_in_band(result):
    assert 0.75 <= result["coverage"] <= 0.85, result  # §9 test 2


def test_future_never_leaks_into_history():
    p = fixed_set()[0]
    h = history(p, 50)
    assert len(h) == 50 and [w.sold for w in h] == p["sold"][:50]
    with pytest.raises(ValueError):
        history(p, WEEKS)
