from proof import basisHash
from tasks.recompute import recompute


def test_serverless_recompute_resolves_explicit_root(serverless_entrypoint, tmp_path):
    module = serverless_entrypoint('databricks/tasks/recompute.py', ['--root', str(tmp_path)])
    assert module['ROOT'] == tmp_path
    assert str(tmp_path / 'databricks') in module['sys'].path
    assert str(tmp_path / 'log') in module['sys'].path


def test_recompute_detects_changed_prices_and_missing_basis_ids():
    comps = {'b': {'source': 'ebay', 'at': '2026-11-10', 'price_cents': 200},
             'a': {'source': 'depop', 'at': '2026-11-11', 'price_cents': 100}}
    h = basisHash([{'id': k, **v} for k, v in comps.items()])
    citation = {'id': 'cit_x', 'metric': 'sold_range', 'basis_ids': ['b', 'a'], 'basis_hash': h}
    row = recompute([citation], comps)[0]
    assert row == {'citation_id': 'cit_x', 'metric': 'sold_range', 'basis_count': 2,
                   'stored_hash': h, 'recomputed_hash': h, 'missing_ids': [], 'equal': True}
    assert not recompute([citation], {**comps, 'a': {**comps['a'], 'price_cents': 101}})[0]['equal']
    missing = recompute([citation], {'a': comps['a']})[0]
    assert missing['missing_ids'] == ['b']
    assert not missing['equal']
    assert recompute([], {}) == []


def test_missing_price_is_null_in_recomputed_hash():
    comp = {'source': 'ebay', 'at': '2026-11-10'}
    h = basisHash([{'id': 'a', **comp}])
    assert recompute([{'id': 'cit_a', 'metric': 'x', 'basis_ids': ['a'], 'basis_hash': h}], {'a': comp})[0]['equal']



def test_recompute_detects_changed_source_and_date_and_uses_citation_weights():
    comp = {'source': 'ebay', 'at': '2026-11-10', 'price_cents': 100}
    citation = {'id': 'cit_a', 'metric': 'x', 'basis_ids': ['a'], 'basis_weights': {'a': 0.25},
                'basis_hash': basisHash([{'id': 'a', **comp, 'weight': 0.25}])}
    assert recompute([citation], {'a': comp})[0]['equal']
    for change in [{'source': 'depop'}, {'at': '2026-11-11'}]:
        assert not recompute([citation], {'a': {**comp, **change}})[0]['equal']
    assert not recompute([{**citation, 'basis_weights': {'a': 1}}], {'a': comp})[0]['equal']


def test_spark_timestamp_is_serialized_as_utc_iso_for_hash():
    from datetime import datetime, timezone, timedelta
    comp = {'source': 'ebay', 'at': datetime(2026, 11, 10), 'price_cents': 100}
    citation = {'id': 'cit_a', 'metric': 'x', 'basis_ids': ['a'],
                'basis_hash': basisHash([{'id': 'a', **comp, 'at': '2026-11-10T00:00:00.000Z'}])}
    assert recompute([citation], {'a': comp})[0]['equal']
    comp['at'] = datetime(2026, 11, 10, 1, tzinfo=timezone(timedelta(hours=1)))
    assert recompute([citation], {'a': comp})[0]['equal']


def test_missing_hash_fields_are_not_silently_omitted():
    import pytest
    citation = {'id': 'cit_a', 'metric': 'x', 'basis_ids': ['a'], 'basis_hash': 'old'}
    for comp in [{'at': '2026-11-10'}, {'source': 'ebay'}]:
        with pytest.raises(KeyError):
            recompute([citation], {'a': comp})


def test_missing_saved_weights_cannot_reconstruct_a_weighted_citation():
    comp = {'source': 'ebay', 'at': '2026-11-10', 'price_cents': 100}
    citation = {'id': 'cit_a', 'metric': 'x', 'basis_ids': ['a'],
                'basis_hash': basisHash([{'id': 'a', **comp, 'weight': 0.25}])}
    assert not recompute([citation], {'a': comp})[0]['equal']


def test_incomplete_saved_weights_are_not_replaced_with_unit_weights():
    import pytest
    comp = {'source': 'ebay', 'at': '2026-11-10', 'price_cents': 100}
    citation = {'id': 'cit_a', 'metric': 'x', 'basis_ids': ['a'], 'basis_weights': {}, 'basis_hash': 'old'}
    with pytest.raises(KeyError, match='a'):
        recompute([citation], {'a': comp})


def test_timestamp_cannot_recover_original_date_only_hash_string():
    from datetime import datetime
    comp = {'source': 'ebay', 'at': datetime(2026, 11, 10), 'price_cents': 100}
    citation = {'id': 'cit_a', 'metric': 'x', 'basis_ids': ['a'],
                'basis_hash': basisHash([{'id': 'a', **comp, 'at': '2026-11-10'}])}
    assert not recompute([citation], {'a': comp})[0]['equal']
