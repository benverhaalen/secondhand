"""The run ledger: a locked window is scored once, and every look at it is on the record."""
import pytest

from valuation import ledger


def _line(lines, **kw):
    base = dict(run="r", at="2026-11-15T00:00:00Z", rows="rows.csv", rows_sha256="a" * 64, commit="c", test_from="2018-11-01",
                test_to=None, sample=None, locked=False, deviation=None, settings={"model": {"k": 5}}, result={"x": 1})
    return ledger.entry(lines, **{**base, **kw})


def _check(lines, **kw):
    base = dict(rows_sha256="a" * 64, test_from="2018-11-01", test_to=None, locked=False, deviation=None)
    return ledger.check(lines, **{**base, **kw})


def test_a_locked_window_is_refused_after_any_earlier_look_and_every_later_look_is_refused():
    tuning = [_line([], run="t1", test_from="2018-06-01", test_to="2018-11-01")]
    assert _check(tuning, locked=True) == []                                      # tuning stopped at the lock date
    peeked = tuning + [_line(tuning, run="t2", test_from="2018-10-01", test_to="2018-12-01")]
    with pytest.raises(ledger.LockedWindowError, match="t2"):
        _check(peeked, locked=True)
    done = tuning + [_line(tuning, run="L", locked=True)]
    with pytest.raises(ledger.LockedWindowError, match="L"):
        _check(done, test_from="2018-12-01")                                       # a tuning run inside the locked window
    with pytest.raises(ledger.LockedWindowError):
        _check(done, locked=True)                                                  # scoring the locked month twice
    assert _check(done, rows_sha256="b" * 64, locked=True) == []                   # other rows are another test
    assert _check(done, test_from="2018-01-01", test_to="2018-06-01") == []        # before the lock is fine
    assert [x["run"] for x in _check(done, locked=True, deviation="scorer bug fixed")] == ["L"]


def test_the_ledger_counts_distinct_settings_tried_on_the_same_rows():
    lines = [_line([], settings={"model": {"k": 5}})]
    lines.append(_line(lines, settings={"model": {"k": 3}}))
    lines.append(_line(lines, settings={"model": {"k": 5}}))
    assert [x["settings_tried_on_these_rows"] for x in lines] == [1, 2, 2]
    assert _line(lines, rows_sha256="b" * 64)["settings_tried_on_these_rows"] == 1
