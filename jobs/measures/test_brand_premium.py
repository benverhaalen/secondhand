"""Exact ranks, rights, guards and cells are independent failure boundaries."""
import itertools
import math
import pytest
from jobs.measures.brand_premium import critical_value, estimate, kind_summary, measure_cells, u_counts


def rows(prices, cell='poshmark:used', may_model=True):
    return [{'price_cents': p, 'site': cell.rsplit(':', 1)[0], 'cell': cell, 'may_model': may_model}
            for p in prices]


def test_doubled_constant_prices_have_log_two_shift_and_containing_interval():
    got = estimate([2000] * 8, [1000] * 8)
    assert got['state'] == 'measured'
    assert got['theta'] == pytest.approx(math.log(2))
    assert got['lower'] <= got['theta'] <= got['upper']
    assert got['separation_S'] == pytest.approx(1)


def test_eight_by_eight_interval_uses_hand_counted_tails_and_one_based_ranks():
    # Enumerating C(16,8)=12870 labelings gives these cumulative tail counts.
    # 2*321/12870=.04988 <= .05; 2*418/12870 > .05. Thus critical U=13.
    counts = u_counts(8, 8)
    assert sum(counts) == 12870
    assert sum(counts[:13]) == 244
    assert sum(counts[:14]) == 321
    assert sum(counts[:15]) == 418
    assert critical_value(8, 8) == 13
    b, o = [101, 113, 127, 139, 151, 163, 181, 199], [17, 23, 31, 41, 47, 59, 67, 79]
    diffs = sorted(math.log(x) - math.log(y) for x in b for y in o)
    got = estimate(b, o)
    assert got['lower'] == diffs[13]
    assert got['upper'] == diffs[50]
    assert got['interval_method'] == 'exact_mann_whitney'


def test_counting_distribution_matches_enumerated_small_labelings():
    counts = [0] * 13
    for places in itertools.combinations(range(7), 3):
        counts[sum(places) - 3] += 1
    assert u_counts(3, 4) == tuple(counts)
    assert u_counts(4, 3) == tuple(counts)


def test_seven_rows_on_either_side_stays_not_known_with_counts():
    assert estimate([10] * 7, [5] * 8) == {'state': 'not_known', 'n_B': 7, 'n_O': 8}
    assert estimate([10] * 8, [5] * 7)['state'] == 'not_known'


def test_apify_display_rows_never_enter_measure_and_condition_cells_never_mix():
    groups = {'exact': rows([2000] * 8), 'same_product': rows([2000] * 8, 'apify:ebay:used', False),
              'similar_other_brand': rows([1000] * 8, 'poshmark:nwt') + rows([1000] * 8, 'apify:ebay:used', False)}
    got = measure_cells('m-shoes-1', groups)
    assert got['poshmark:used'] == {'state': 'not_known', 'n_B': 8, 'n_O': 0}
    assert got['poshmark:nwt'] == {'state': 'not_known', 'n_B': 0, 'n_O': 8}
    assert got['apify:ebay:used'] == {'state': 'not_known', 'n_B': 0, 'n_O': 0}


@pytest.mark.parametrize('item,state', [('m-electronics-1', 'brand_locked'), ('m-electronics-2', 'brand_locked'),
                                     ('m-electronics-4', 'brand_locked'), ('m-small_goods-3', 'excluded')])
def test_special_items_keep_their_state_even_without_rows(item, state):
    got = measure_cells(item, {'exact': [], 'same_product': [], 'similar_other_brand': []})
    assert got['all']['state'] == state
    if state == 'excluded':
        assert got['all']['reason'] == 'compatible-with sets can be counterfeits'


def test_large_pair_count_uses_normal_approximation_and_continuity_correction():
    got = estimate(list(range(100, 151)), list(range(60, 111)))
    assert got['interval_method'] == 'normal_mann_whitney_continuity_corrected'
    assert got['lower'] <= got['theta'] <= got['upper']
    assert 0 <= got['separation_S'] <= 1


def test_kind_mean_and_tau_are_precision_weighted():
    got = kind_summary([{'state': 'measured', 'theta': 1, 'lower': 0, 'upper': 3.92},
                        {'state': 'measured', 'theta': 3, 'lower': 2, 'upper': 3.96},
                        {'state': 'not_known', 'n_B': 1, 'n_O': 2}])
    assert got['theta'] == pytest.approx(2.6)
    assert got['tau_k'] == pytest.approx(.8)
    assert got['item_cells'] == 2


def test_zero_width_intervals_are_reported_instead_of_dividing_by_zero():
    got = kind_summary([estimate([2000] * 8, [1000] * 8)])
    assert got['state'] == 'not_known'
    assert got['zero_width_cells'] == 1


def test_nonpositive_prices_are_rejected_at_estimator_boundary():
    with pytest.raises(ValueError, match='positive'):
        estimate([0] * 8, [10] * 8)


def test_f2_unknown_condition_with_enough_rows_stays_not_known_and_out_of_kind_summary():
    groups = {'exact': rows(list(range(1000, 1008)), 'ebay:unknown'), 'same_product': [],
              'similar_other_brand': rows(list(range(500, 508)), 'ebay:unknown')}
    got = measure_cells('test', groups)
    assert got['ebay:unknown']['state'] == 'not_known', 'F2: unknown condition must never measure'
    assert got['ebay:unknown']['n_B'] == got['ebay:unknown']['n_O'] == 8
    assert kind_summary(list(got.values()))['item_cells'] == 0
