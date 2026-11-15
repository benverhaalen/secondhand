"""Regressions for spec/engines/audit.md Identity and its arithmetic twins."""
import json
import math
from pathlib import Path
from datetime import datetime, timezone
import pytest
from identity.pair import compare_fields, beta_mean, score_signals, score_pair, text_similarity
from identity.groups import group_offers, variant_range
from identity.ladder import Hit, candidates, calibrate, conformal_set, odds, nonconformity, expected_calibration_error, fit_odds


def test_gtin_phone_and_listing_forms_match_and_bad_digits_are_counted():
    assert compare_fields({'gtin': '036000291452'}, {'gtin': '0036000291452'})['gtin'] is True
    result = score_pair({'gtin': '036000291453'}, {'gtin': '036000291453'})
    assert result['fields']['gtin'] is False
    assert result['invalid_gtin_count'] == 2


def test_canonical_beta_payload_and_nonfinite_rejection():
    assert beta_mean({'alpha': 9, 'beta': 1}) == .9
    for bad in (0, -1, math.inf, math.nan):
        with pytest.raises(ValueError, match='Beta'):
            beta_mean({'alpha': bad, 'beta': 1})


@pytest.mark.parametrize('field', ['price_cents', 'shipping_cents', 'tax_cents'])
@pytest.mark.parametrize('bad', [-1, 1.5, math.nan, math.inf, True, 2**53])
def test_delivered_money_rejects_bad_component_even_if_other_missing(field, bad):
    with pytest.raises(ValueError, match=field):
        group_offers([{'product_id': 'p', 'condition': 'good', field: bad}], now=datetime.now(timezone.utc))


def test_money_half_up_blend_and_proof():
    result = variant_range({'low': 1, 'high': 3}, [2], [1])
    assert result['low'] == 1 and result['high'] == 4
    assert result['basis_level'] == 'variant' and 0 < result['confidence'] < 1
    assert result['citation']['param_versions']
    groups = group_offers([{'id': 'a', 'product_id': 'p', 'condition': 'good', 'price_cents': 1, 'shipping_cents': 2, 'tax_cents': 3}], now=datetime.now(timezone.utc))
    assert groups[0]['offers'][0]['citation']['sources'] == ['a']
    assert groups[0]['offers'][0]['citation']['guard']['allowed']


@pytest.mark.parametrize('bad', [-1, 1.5, math.nan, math.inf])
def test_variant_prices_reject_bad_inputs_even_below_old_gate(bad):
    with pytest.raises(ValueError, match='variant_sold_prices'):
        variant_range({'low': 1, 'high': 3}, [bad], [1])


@pytest.mark.parametrize('hit', [Hit(0, 'p', .5), Hit(1, 'p', math.nan), Hit(2, 'p', -1), Hit(3, 'p', 2)])
def test_ladder_hit_boundary(hit):
    with pytest.raises(ValueError, match='rung|similarity'):
        candidates([hit])


@pytest.mark.parametrize('window,alpha', [([], 0), ([], 1), ([], math.nan), ([math.nan], .1), ([-1], .1), ([2], .1)])
def test_calibration_boundary(window, alpha):
    with pytest.raises(ValueError, match='alpha|window'):
        calibrate(window, alpha)


def test_equal_score_order_is_by_product_everywhere():
    c = {'z': (.5, {1}), 'a': (.5, {1})}
    assert conformal_set(c, .5) == ['a', 'z']
    assert list(odds(c, .1, .3)[0]) == ['a', 'z']


@pytest.mark.parametrize('t,b', [(0, .3), (-1, .3), (math.nan, .3), (.1, math.inf)])
def test_odds_boundary(t, b):
    with pytest.raises(ValueError, match='temperature|none_logit'):
        odds({'p': (.5, {1})}, t, b)


def test_calibration_empty_candidates_are_none_and_empty_report_is_defined():
    assert expected_calibration_error([({}, None)], .1, .3) == 0
    assert expected_calibration_error([], .1, .3) == 0


def test_resolved_values_are_required_and_versions_travel():
    from identity.params import DECLARED, resolve
    read = lambda name, scope: {'value': next(d['prior'] for d in DECLARED if d['name'] == name), 'version': 7}
    resolved = resolve(read, {'kind': 'shoes'})
    result = score_signals({'mpn': True}, 1, 1, resolved=resolved)
    assert set(result['citation']['param_versions'].values()) == {7}
    broken = {'values': dict(resolved['values']), 'versions': resolved['versions']}
    del broken['values']['identity_field_weight']
    with pytest.raises(KeyError, match='identity_field_weight'):
        score_signals({}, 0, 0, resolved=broken)


def test_learned_thresholds_do_not_reuse_prior_scale():
    weights = {'mpn': {'m': {'alpha': 9, 'beta': 1}, 'u': {'alpha': 1, 'beta': 9}}}
    r = score_signals({'mpn': True}, 1, 1, weights=weights)
    assert r['label'] != 'exact'
    assert r['basis_level'] == 'learned' and 0 <= r['confidence'] <= 1


def test_ascii_jaccard_twin():
    assert text_similarity('CAFÉ Straße', 'caf stra e') == 1


def test_gtin_shared_fixture():
    from identity.codes import gtin14
    fixture = Path(__file__).resolve().parents[2] / 'app/src/engines/trust/fixtures/gtin-parity.json'
    rows = json.loads(fixture.read_text())
    assert len(rows) >= 10
    for row in rows:
        assert gtin14(row['raw']) == row['expected'], row['name']


def test_all_fitted_thresholds_are_on_w_scale_and_clock_is_explicit():
    from identity.learn import nightly_fold, rollback
    from identity.test_learn import FakeStore, training, heldout
    from identity.learn import param_row
    a, b = FakeStore(), FakeStore()
    bad = {'weights': None, 'thresholds': {'identity_t_exact': 2}}
    for store in (a, b):
        store.rows.append(param_row('identity_weights', {'kind': 'apparel'}, 'model_ref', bad, bad, 1))
    at = '2026-11-15T00:00:00Z'
    row = nightly_fold(a, 'apparel', training(), heldout(), at=at)
    assert row == nightly_fold(b, 'apparel', training(), heldout(), at=at)
    thresholds = row['value_or_hyperparams']['thresholds']
    assert set(thresholds) == {'identity_t_exact', 'identity_t_model', 'identity_t_comparable'}
    assert all(t is None or abs(t) > 1 for t in thresholds.values())
    assert row['promoted_at'] == at
    assert rollback(a, 'apparel', row['version'], at=at)['promoted_at'] == at


def test_resolved_cluster_controls_and_ladder_controls():
    from identity.params import resolve
    from identity.cluster import cluster_comps
    from identity.test_cluster import comp
    from identity.ladder import action
    resolved = resolve()
    resolved['values']['identity_stock_sellers'] = 2
    assert len(cluster_comps([comp('a'), comp('b')], resolved=resolved)) == 2
    resolved['values']['identity_seller_text'] = 1
    assert len(cluster_comps([comp('a', title='one two three four five'), comp('b', seller_ref_hash='a', title='one two three four')], retail_phashes=[0], resolved=resolved)) == 2
    resolved['values']['identity_rung_3'] = .2
    assert candidates([Hit(3, 'p', 1)], resolved=resolved)['p'][0] == .2
    resolved['values']['identity_max_pick'] = 2
    assert action(['a', 'b', 'c'], resolved=resolved) == 'ask'


def test_resolved_beta_priors_guards_precision_and_money_blend():
    from identity.params import resolve
    from identity.learn import apply_label, calibrate_exact
    from identity.test_learn import FakeStore, label
    resolved = resolve()
    resolved['values']['identity_u_brand'] = {'alpha': 2., 'beta': 2.}
    resolved['values']['identity_beta_lo'] = .2
    resolved['values']['identity_beta_hi'] = .8
    store = FakeStore()
    apply_label(store, label(fields={'brand': True}), cap_per_person=3, resolved=resolved)
    assert store.rows[0]['value_or_hyperparams'] == {'alpha': 3., 'beta': 2.}
    assert beta_mean({'alpha': 99, 'beta': 1}, resolved=resolved) == .8
    resolved['values']['identity_exact_precision'] = 0
    weights = {'mpn': {'m': {'alpha': 9, 'beta': 1}, 'u': {'alpha': 1, 'beta': 9}}}
    assert calibrate_exact([{'fields': {'mpn': True}, 'match': True}], weights, resolved=resolved) is not None
    resolved['values']['identity_variant_blend'] = 1
    assert variant_range({'low': 100, 'high': 200}, [200], [100], resolved=resolved)['low'] == 150


def test_safe_money_overflow_and_half_up_maximum():
    from identity.validation import half_up, MAX_SAFE
    assert half_up(2.5, 'price_cents') == 3
    assert half_up(MAX_SAFE, 'price_cents') == MAX_SAFE
    with pytest.raises(ValueError, match='delivered_total_cents'):
        group_offers([{'product_id': 'p', 'condition': 'good', 'price_cents': MAX_SAFE, 'tax_cents': 1, 'shipping_cents': 0}], now=datetime.now(timezone.utc))


def test_lot_money_boundary():
    from identity.lots import lot_card
    with pytest.raises(ValueError, match='price_cents'):
        lot_card({'title': 'lot of 3 shoes', 'price_cents': -1})


def test_missing_timestamp_cannot_promote_or_rollback():
    from identity.learn import nightly_fold, rollback, param_row
    from identity.test_learn import FakeStore, training, heldout
    store = FakeStore()
    bad = {'weights': None, 'thresholds': {'identity_t_exact': 2}}
    store.rows.append(param_row('identity_weights', {'kind': 'apparel'}, 'model_ref', bad, bad, 1))
    with pytest.raises(ValueError, match='at timestamp'):
        nightly_fold(store, 'apparel', training(), heldout())
    assert len(store.rows) == 1 and store.rows[0]['status'] == 'champion'
    with pytest.raises(ValueError, match='at timestamp'):
        rollback(store, 'apparel', 1)


def test_calibration_validates_all_public_boundaries():
    with pytest.raises(ValueError, match='c_true'):
        nonconformity(math.nan)
    with pytest.raises(ValueError, match='q_hat'):
        conformal_set({}, math.nan)
    with pytest.raises(ValueError, match='similarity'):
        odds({'p': (math.nan, {1})}, .1, .3)
    with pytest.raises(ValueError, match='bins'):
        expected_calibration_error([], .1, .3, bins=0)
    with pytest.raises(ValueError, match='similarity'):
        fit_odds([({'p': (math.nan, {1})}, 'p')])


def test_citation_covers_every_label_input_and_freezes_its_snapshot():
    fields = {'mpn': True}
    exact = score_signals(fields, 1, 1)
    stock = score_signals(fields, 1, 1, stock_photo=True)
    assert exact['citation']['id'] != stock['citation']['id']
    purpose = score_signals({}, 0, 0, same_purpose=1)
    unrelated = score_signals({}, 0, 0, same_purpose=0)
    assert purpose['citation']['id'] != unrelated['citation']['id']
    fields['mpn'] = False
    assert exact['citation']['input_snapshot']['fields']['mpn'] is True


def test_learned_comparable_band_is_fitted_separately_and_requires_purpose():
    from identity.learn import calibrate_thresholds
    weights = {field: {'m': {'alpha': 9, 'beta': 1}, 'u': {'alpha': 1, 'beta': 9}} for field in ('mpn', 'brand')}
    rows = [{'fields': {'mpn': True, 'brand': True}, 'match': True},
            {'fields': {'mpn': False, 'brand': True}, 'match': False, 'same_purpose': 1},
            {'fields': {'mpn': False, 'brand': False}, 'match': False, 'same_purpose': 0}]
    t = calibrate_thresholds(rows, weights)
    assert t['identity_t_comparable'] < t['identity_t_model']
    fields = {'mpn': False, 'brand': True}
    assert score_signals(fields, 0, 0, same_purpose=1, weights=weights, thresholds=t)['label'] == 'comparable'
    assert score_signals(fields, 0, 0, same_purpose=0, weights=weights, thresholds=t)['label'] == 'unresolved'


def test_capture_answer_names_rung_and_confidence_at_any_count():
    from identity.ladder import answer
    result = answer([Hit(3, 'p', .9)])
    assert result['candidates'][0]['rung'] == 3
    assert result['candidates'][0]['label'] == 'likely_same_model'
    assert 0 < result['candidates'][0]['confidence'] < 1
    assert result['citation']['param_versions']
    assert answer([])['action'] == 'ask'
    assert answer([])['rung'] == 'prior'


def test_fractional_rung_and_invalid_calibration_truth_are_boundary_errors():
    with pytest.raises(ValueError, match='rung'):
        candidates([Hit(1.0, 'p', .5)])
    with pytest.raises(ValueError, match='truth'):
        expected_calibration_error([({'p': (.5, {1})}, 42)], .1, .3)


def test_prior_score_reads_all_three_resolved_weights():
    from identity.params import resolve
    resolved = resolve()
    resolved['values'].update(identity_field_weight=.1, identity_text_weight=.2, identity_image_weight=.7)
    result = score_signals({'mpn': True}, .5, .25, resolved=resolved)
    assert result['score'] == pytest.approx(.1 + .2 * .5 + .7 * .25)
