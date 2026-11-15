"""id-1: thresholds, missing evidence and stock imagery are independent gates."""
import math
import pytest
from identity.pair import score_signals, score_pair, read_param


def test_worked_example_is_likely_same_model():
    result = score_signals({"brand": True, "model": True, "colour": True}, .72, .88)
    assert result["score"] == pytest.approx(.836)
    assert result["label"] == "likely_same_model"


def test_threshold_param_missing_uses_each_prior():
    assert score_signals({"mpn": True}, .8, .9)["label"] == "exact"
    assert score_signals({"mpn": True}, .79, .7)["label"] == "likely_same_model"
    assert score_signals({}, 0, 0, same_purpose=.50)["label"] == "comparable"


def test_pair_below_param_threshold_is_never_exact():
    rows = [{"name": "identity_t_exact", "scope": {"kind": "apparel"},
             "status": "champion", "version": 1, "value_or_hyperparams": .99}]
    assert score_signals({"mpn": True}, .9, .9, params=rows,
                         scope={"kind": "apparel"})["label"] == "likely_same_model"


def test_identical_stock_photos_never_yield_exact():
    assert score_signals({"mpn": True}, 1, 1, stock_photo=True)["label"] != "exact"
    assert score_signals({}, 1, 1)["label"] != "exact"


def test_fellegi_sunter_agreement_disagreement_and_missing():
    weights = {"brand": {"m": {"a": 9, "b": 1}, "u": {"a": 1, "b": 9}},
               "model": {"m": {"a": 9, "b": 1}, "u": {"a": 1, "b": 9}}}
    r = score_signals({"brand": True, "model": False, "mpn": None}, None, None, weights=weights)
    assert r["score"] == pytest.approx(0)
    assert score_signals({"brand": True}, 0, 0, weights=weights)["score"] == pytest.approx(math.log2(9))


def test_other_variant_is_kept_out_of_exact_range():
    assert score_signals({"brand": True, "model": True, "variant": False}, 1, 1)["label"] == "same_family_other_variant"


def test_missing_fields_are_not_agreements():
    assert score_pair({"title": ""}, {"title": ""})["score"] == 0


def test_person_scope_never_reads_another_person():
    rows = [{"name": "x", "scope": {"kind": "bags", "person": "other"},
             "status": "champion", "version": 10, "value_or_hyperparams": .1}]
    assert read_param(rows, "x", {"kind": "bags", "person": "me"}, .85) == .85


@pytest.mark.parametrize("bad", [float("nan"), -1, 2])
def test_invalid_similarity_names_its_cause(bad):
    with pytest.raises(ValueError, match="similarity"):
        score_signals({}, bad, 0)
