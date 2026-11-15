import math
import pytest
from valuation import ablate
from valuation.comps import LEGACY, DEFAULTS


def row(i, at, price=10000, **extra):
    return {'row_id': str(i), 'at': at, 'price_cents': price, 'price_type': 'sold', 'source': 'fixture',
            'product_id': 'p', 'family_id': 'f', 'kind': 'shoes', 'category': 'shoes', 'condition': 'good', 'size': 'M',
            'site': 'ebay', 'may_model': True, **extra}


def test_every_switch_is_isolated_and_all_on():
    settings = ablate.configurations()
    for letter, switch in zip('ABCDEF', ablate.SWITCHES):
        assert [s for s in ablate.SWITCHES if settings[letter][s]] == [switch]
    assert all(settings['all'][s] for s in ablate.SWITCHES)
    assert not any(settings['engine_comps'][s] for s in ablate.SWITCHES)


def test_conformal_is_scale_free_and_never_changes_middle():
    estimates = [{'q10': 100, 'q50': 100, 'q90': 100, 'shown': True} for _ in range(20)]
    q = ablate.fit_conformal([(120, e) for e in estimates])
    assert math.isclose(q, math.log(1.2))
    widened = ablate.widen(estimates[0], q)
    assert widened['q50'] == 100 and widened['q90'] == 120 and widened['q10'] == 83


def test_same_items_paired_bootstrap_and_small_family_label():
    rows = [row(i, '2020-01-01', family_id='tiny' if i == 0 else 'large') for i in range(12)]
    ests = []
    for c, value in [('last_sale', 10000), ('product_90d_median', 10000), ('all', 13000)]:
        for r in rows:
            ests.append({'contestant': c, 'item_id': r['row_id'], 'q10': value, 'q50': value, 'q90': value, 'shown': True})
    summary = ablate.table(ests, rows)
    ours = next(r for r in summary if r['contestant'] == 'all' and r['family'] == 'overall' and r['data'] == 'dataset:fixture')
    assert ours['ppe20'] == 0 and ours['vs_last_sale']['diff'] == -1
    assert ours['vs_product_90d_median']['n_items'] == 12
    assert next(r for r in summary if r['family'] == 'tiny')['too_few']


def test_future_and_own_cluster_cannot_enter_prediction_or_fits():
    rows = [row(i, f'2019-10-{i+1:02}', 10000+i*100) for i in range(20)]
    rows += [row('future', '2021-01-01', 999999), row('self', '2019-10-25', 999999, cluster_id='target')]
    history = ablate.experiment.History(ablate.experiment.index_of(rows), ablate.experiment.ts('2020-01-01'), 'target')
    engine = ablate.AblationEngine('all', DEFAULTS)
    target = row('target', '2020-01-02', cluster_id='target')
    result = engine.predict(target, '2020-01-01', history)
    assert 'future' not in result['comp_ids'] and 'self' not in result['comp_ids']
    assert result['q50'] < 20000


def test_half_life_selection_uses_only_pretest_errors():
    observations = [('f', 30, .1), ('f', 90, .2), ('g', 30, .3), ('g', 90, .1)]
    assert ablate.select_half_lives(observations) == {'f': 30, 'g': 90}


def test_report_refuses_different_item_sets_and_fractional_money():
    with pytest.raises(ValueError, match='same items'):
        ablate.table([{'contestant': 'a', 'item_id': '1'}, {'contestant': 'b', 'item_id': '2'}], [])
    with pytest.raises(ValueError, match='price_cents'):
        ablate.validate_rows([row(0, '2020-01-01', 1.5)])


def test_family_and_product_are_distinct_and_composite_variant_ids_are_normalized():
    rows = [row('a', '2019-01-01', product_id='p|M'), row('b', '2019-01-01', product_id='p|L', size='L'), row('c', '2019-01-01', product_id='different')]
    history = ablate.experiment.History(ablate.experiment.index_of(rows), ablate.experiment.ts('2020-01-01'))
    past = ablate.Past(history.index)
    levels = {r['comp_id']: r['level'] for r in past.candidates(row('target', '2020-01-01', product_id='p|M'), history)}
    assert levels == {'a': 'variant', 'b': 'product', 'c': 'family'}


def test_hard_backoff_optimization_is_equal_to_full_candidate_calculation():
    rows = [row(i, f'2019-12-{i+1:02}') for i in range(10)] + [row('other', '2019-12-01', 20000, product_id='other')]
    history = ablate.experiment.History(ablate.experiment.index_of(rows), ablate.experiment.ts('2020-01-01'))
    target = row('target', '2020-01-02')
    past = ablate.Past(history.index)
    from valuation import comps
    for params in (LEGACY, {**LEGACY, 'anchor_enabled': 1}):
        expected = comps.comparables({'condition': 'good', 'size': 'M'}, past.candidates(target, history), '2020-01-01', params)
        result = ablate.AblationEngine('test', params).predict(target, '2020-01-01', history)
        assert {k: result[k] for k in ('q10', 'q50', 'q90')} == expected['range']


def test_kind_fallback_survives_expired_family_and_retail_prior_is_evaluated():
    rows = [row('stale', '2010-01-01'), row('kind', '2019-12-01', 12000, product_id='other', family_id='other')]
    history = ablate.experiment.History(ablate.experiment.index_of(rows), ablate.experiment.ts('2020-01-01'))
    e = ablate.AblationEngine('all', DEFAULTS).predict(row('target', '2020-01-02'), '2020-01-01', history)
    assert e['shown'] and e['basis_level'] == 'kind' and e['q50'] == 12000
    empty = ablate.experiment.History(ablate.experiment.index_of([]), ablate.experiment.ts('2020-01-01'))
    e = ablate.AblationEngine('all', DEFAULTS).predict(row('target', '2020-01-02', retail_cents=10000, depreciation=.6), '2020-01-01', empty)
    assert e['shown'] and e['basis_level'] == 'prior' and e['q50'] == 6000


def test_supplied_depreciation_survives_file_loading_and_cache_keys(tmp_path):
    import json
    source = tmp_path / 'rows.jsonl'
    source.write_text(json.dumps(row('r', '2020-01-02', retail_cents=10000, depreciation=.6)) + '\n')
    assert ablate.load_rows(source)[0]['depreciation'] == .6
    history = ablate.experiment.History(ablate.experiment.index_of([]), ablate.experiment.ts('2020-01-01'))
    engine = ablate.AblationEngine('all', DEFAULTS, ablate.Past(history.index))
    for depreciation, expected in ((.6, 6000), (.8, 8000)):
        e = engine.predict(row('r', '2020-01-02', retail_cents=10000, depreciation=depreciation), '2020-01-01', history)
        assert e['q50'] == expected


def test_paired_middle_errors_use_only_the_items_both_priced():
    rows = [row('a', '2020-01-01'), row('b', '2020-01-01')]
    estimates = []
    for name in ('all', 'last_sale', 'product_90d_median'):
        for r in rows:
            estimates.append({'contestant': name, 'item_id': r['row_id'], 'shown': not (name == 'all' and r['row_id'] == 'b'),
                              'q10': 11000, 'q50': 11000, 'q90': 11000})
    result = next(r for r in ablate.table(estimates, rows) if r['data'] == 'overall' and r['contestant'] == 'all')
    assert result['paired_mdape_vs_last_sale'] == {'ours': .1, 'baseline': .1, 'n': 1}


def test_reader_rejects_fractional_cents_before_float_precision_can_erase_them(tmp_path):
    source = tmp_path / 'bad.csv'
    source.write_text('row_id,at,price_cents\nr,2020-01-01,9007199254740991.1\n')
    with pytest.raises(ValueError, match='price_cents'):
        ablate.load_rows(source)
