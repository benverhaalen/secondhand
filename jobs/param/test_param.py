import json
import pathlib
import sys

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from registry import FIELDS, MemoryStore, VersionConflict  # noqa: E402

ROW = json.loads((pathlib.Path(__file__).parents[2] / "app/src/engines/param/row.json").read_text())
AT = "2026-11-14T22:00:00-06:00"
SCOPE = {"site": "depop"}


def fit(**over):
    return {**ROW, **over}


def test_same_row_shape_as_typescript():
    assert set(ROW) == set(FIELDS)
    assert set(MemoryStore().propose(fit(), 0)) == set(FIELDS)


def test_no_promote_when_challenger_loses_held_out():
    s = MemoryStore()
    s.propose(fit(held_out_score=0.5), 0)
    assert s.promote("p_min_quick", SCOPE, 1, 0.01, AT) == (True, "first champion")
    s.propose(fit(value_or_hyperparams=0.9, held_out_score=0.505), 1)
    assert s.promote("p_min_quick", SCOPE, 2, 0.01, AT) == (False, "lost held-out")
    assert s.champion("p_min_quick", SCOPE)["version"] == 1


def test_fit_without_held_out_score_is_refused():
    with pytest.raises(ValueError, match="held-out"):
        MemoryStore().propose(fit(held_out_score=None), 0)


def test_version_conflict_one_of_two_racing_fits_wins():
    s = MemoryStore()
    s.propose(fit(), 0)
    with pytest.raises(VersionConflict):
        s.propose(fit(value_or_hyperparams=0.8), 0)
    assert len(s.history("p_min_quick", SCOPE)) == 1


def test_rollback_restores_previous_version():
    s = MemoryStore()
    s.propose(fit(held_out_score=0.5), 0)
    s.promote("p_min_quick", SCOPE, 1, 0, AT)
    s.propose(fit(value_or_hyperparams=0.9, held_out_score=0.8), 1)
    s.promote("p_min_quick", SCOPE, 2, 0, AT)
    assert s.rollback("p_min_quick", SCOPE, AT)["version"] == 1
    assert s.champion("p_min_quick", SCOPE)["value_or_hyperparams"] == 0.7


def test_unknown_scope_key_is_refused():
    with pytest.raises(ValueError, match="scope"):
        MemoryStore().propose(fit(scope={"city": "x"}), 0)
