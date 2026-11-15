import hashlib

import pytest

from valuation.sale_curve import kaplan_meier, probabilities, quantiles, split, calibration_error, fit_group


def listing(i, day=100, sold=True):
    from datetime import date, timedelta
    return {'row_id': str(i), 'listed_at': date(2020, 1, 1),
            'at': date(2020, 1, 1) + timedelta(days=day),
            'price_type': 'sold' if sold else 'ended_unsold'}


def test_hand_computed_censoring_changes_the_risk_set():
    curve = kaplan_meier([(2, True), (3, False), (4, True), (10, False)])
    assert probabilities(curve, [1, 2, 3, 4, 10]) == pytest.approx([0, .25, .25, .625, .625])
    assert quantiles(curve) == [2, 4, None]


def test_probability_is_null_past_last_at_risk_including_all_sold():
    assert probabilities(kaplan_meier([(7, True)]), [7, 30, 90]) == [1, None, None]
    assert probabilities(kaplan_meier([]), [7, 30, 90]) == [None, None, None]


def test_tied_events_precede_censors():
    curve = kaplan_meier([(7, False), (7, True), (30, True), (30, False)])
    assert probabilities(curve, [7, 30]) == pytest.approx([.25, .625])


def test_quantile_at_exact_fraction_is_not_delayed_by_float_rounding():
    curve = kaplan_meier([(day, True) for day in range(1, 45)])
    assert quantiles(curve) == [11, 22, 33]


def test_fewer_than_30_sold_is_omitted_even_with_many_censors():
    assert fit_group([listing(i, sold=i < 29) for i in range(100)]) is None
    assert fit_group([listing(i) for i in range(30)])['n_events'] == 30


def test_hash_split_is_stable_and_calibration_compares_independent_halves():
    rows = [listing(i) for i in range(100)]
    fit, held_out = split(rows)
    assert {r['row_id'] for r in fit}.isdisjoint(r['row_id'] for r in held_out)
    assert len(fit) + len(held_out) == len(rows)
    assert all(int(hashlib.sha256(r['row_id'].encode()).hexdigest(), 16) % 2 == 0 for r in fit)
    altered = [listing(r['row_id'], day=5, sold=True) for r in fit]
    altered += [listing(r['row_id'], day=100, sold=False) for r in held_out]
    # A late censor in fit preserves support at the queried days.
    altered[0] = listing(altered[0]['row_id'], day=100, sold=False)
    assert calibration_error(altered) == pytest.approx((len(fit) - 1) / len(fit))
    assert fit_group(rows) == fit_group(list(reversed(rows)))


def test_negative_duration_names_the_invalid_listing():
    with pytest.raises(ValueError, match='negative.*bad'):
        fit_group([listing('bad', day=-1)])


def test_group_without_a_supported_calibration_day_is_omitted():
    assert fit_group([listing(i, day=1) for i in range(60)]) is None
