from proof import basisHash
from tasks.recompute import recompute


def test_serverless_recompute_resolves_explicit_root(serverless_entrypoint, tmp_path):
    module = serverless_entrypoint('databricks/tasks/recompute.py', ['--root', str(tmp_path)])
    assert module['ROOT'] == tmp_path
    assert str(tmp_path / 'databricks') in module['sys'].path
    assert str(tmp_path / 'log') in module['sys'].path


def test_recompute_detects_changed_prices_and_missing_basis_ids():
    comps = {'b': {'price_cents': 200}, 'a': {'price_cents': 100}}
    h = basisHash([{'id': k, **v} for k, v in comps.items()])
    citation = {'id': 'cit_x', 'metric': 'sold_range', 'basis_ids': ['b', 'a'], 'basis_hash': h}
    row = recompute([citation], comps)[0]
    assert row == {'citation_id': 'cit_x', 'metric': 'sold_range', 'basis_count': 2,
                   'stored_hash': h, 'recomputed_hash': h, 'missing_ids': [], 'equal': True}
    assert not recompute([citation], {**comps, 'a': {'price_cents': 101}})[0]['equal']
    missing = recompute([citation], {'a': comps['a']})[0]
    assert missing['missing_ids'] == ['b']
    assert not missing['equal']
    assert recompute([], {}) == []


def test_missing_price_is_empty_in_recomputed_hash():
    h = basisHash([{'id': 'a'}])
    assert recompute([{'id': 'cit_a', 'metric': 'x', 'basis_ids': ['a'], 'basis_hash': h}], {'a': {}})[0]['equal']
