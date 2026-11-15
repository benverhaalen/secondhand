"""Grouping uses only explicit evidence; exported artifacts never carry listings."""
import json
from jobs.measures.attributes import record
from jobs.measures.index_slice import MarketIndex, build_slice, examples, render_markdown, validate_rows
import pytest

ITEM = {'id': 'test-jeans', 'kind': 'clothes', 'query': "Levi's denim straight leg jeans 32x32",
        'identity': {'brand': "Levi's", 'model': '', 'variant': ''}}
SPEC = {'test-jeans': {'query': 'denim jeans', 'exclude_brand_terms': ['levi'], 'require_any_of': [['jean']]}}


def row(title, side='other', relation=None, site='poshmark', grade='used', may_model=True):
    return {'item_id': 'test-jeans', 'kind': 'clothes', 'side': side, 'relation': relation,
            'title': title, 'site': site, 'cell': f'{site}:{grade}', 'price_cents': 4200,
            'may_model': may_model, 'url': 'https://example.test/listing', 'read_at': '2026-11-15T12:00:00Z'}


def index(rows, item=ITEM, spec=SPEC):
    return MarketIndex(rows, [item], spec)


def test_missing_material_is_left_out_and_names_the_missing_attribute():
    got = index([row('Wrangler straight leg jeans 32x32')])
    assert got.lookup(ITEM)['similar_other_brand'] == []
    assert got.left_out['test-jeans']['missing']['material'] == 1


def test_corduroy_disagrees_but_stated_denim_and_shared_construction_agree():
    good = row('Wrangler denim straight leg jeans 32x32')
    got = index([row('Wrangler corduroy straight leg pants 32x32'), good])
    assert got.lookup(ITEM)['similar_other_brand'] == [good]
    assert got.left_out['test-jeans']['disagrees']['material'] == 1


def test_a_row_without_the_items_construction_mark_is_left_out():
    got = index([row('Wrangler denim jeans 32x32')])
    assert got.lookup(ITEM)['similar_other_brand'] == []
    assert got.left_out['test-jeans']['missing']['construction'] == 1


def test_f2_unknown_condition_is_not_a_required_matching_attribute():
    got = index([row('Wrangler denim straight leg jeans', grade='unknown')])
    assert len(got.lookup(ITEM)['similar_other_brand']) == 1
    assert 'condition_grade' not in got.missing_by_row[0], 'F2: condition belongs to cells, not matching'


def test_other_side_brand_leakage_is_never_similar_even_with_aliases():
    got = index([row("Vintage Levi’s denim straight leg jeans"), row('LEVIS denim straight leg jeans')])
    assert got.lookup(ITEM)['similar_other_brand'] == []
    assert got.left_out['test-jeans']['brand_excluded'] == 2


def test_exact_and_same_product_require_brand_and_stated_relation():
    r = [row("Levi's 501", 'brand', 'exact'), row('Levis 505', 'brand', 'same_family_other_variant'),
         row('Wrangler 501', 'brand', 'exact'), row("Levi's jeans", 'brand', 'comparable')]
    groups = index(r).lookup(ITEM)
    assert groups['exact'] == r[:1]
    assert groups['same_product'] == r[1:2]


def test_apify_is_counted_for_display_but_has_zero_measure_counts():
    r = [row("Levi's denim straight leg jeans", 'brand', 'exact', 'apify:ebay', may_model=False)]
    got = build_slice(r, [ITEM], SPEC)
    assert got['items']['test-jeans']['groups']['exact']['count'] == 1
    assert got['items']['test-jeans']['a11']['apify:ebay:used']['n_B'] == 0


def test_item_missing_material_abstains_instead_of_using_the_search_query():
    item = {**ITEM, 'query': "Levi's straight leg jeans 32x32"}
    got = index([row('Wrangler denim straight leg jeans')], item)
    assert got.lookup(item)['similar_other_brand'] == []
    assert 'material' in got.item_missing['test-jeans']


def test_shared_attribute_keys_do_not_mix_item_candidate_pools():
    second = {**ITEM, 'id': 'test-second'}
    rows = [row('Wrangler denim straight leg jeans')]
    got = MarketIndex(rows, [ITEM, second], {**SPEC, 'test-second': SPEC['test-jeans']})
    assert len(got.lookup(ITEM)['similar_other_brand']) == 1
    assert got.lookup(second)['similar_other_brand'] == []


def test_require_any_of_filters_each_clause_without_replacing_attributes():
    spec = {'test-jeans': {**SPEC['test-jeans'], 'require_any_of': [['jean'], ['white']]}}
    got = index([row('Wrangler denim straight leg jeans')], spec=spec)
    assert got.lookup(ITEM)['similar_other_brand'] == []
    assert got.left_out['test-jeans']['query_mismatch'] == 1


def test_outputs_have_counts_records_timings_but_never_titles_or_urls():
    r = [row("Levi's 501 brand unique title", 'brand', 'exact'), row('Wrangler denim straight leg jeans unique title')]
    got = build_slice(r, [ITEM], SPEC)
    text = json.dumps(got) + render_markdown(got)
    assert 'http' not in text
    for x in r:
        assert x['title'] not in text
    assert len(got['records']) == len(r)
    assert got['measures']['coverage']['clothes']['poshmark']['rows'] == 2
    assert got['measures']['record_ms']['all']['repetitions'] == 5
    assert got['measures']['lookup_us']['lookups'] == 1000
    assert got['measures']['lookup_us']['returned_rows'] == 2000
    assert 'examples' not in got


def test_private_examples_are_capped_at_five_and_stay_out_of_the_report():
    r = [row(f"Levi's unique listing {n}", 'brand', 'exact') for n in range(8)]
    got = examples(r, [ITEM], SPEC)
    assert len(got['test-jeans']['exact']) == 5
    assert set(got['test-jeans']['exact'][0]) == {'title', 'site', 'price_cents', 'url'}


def test_f2_headphones_without_a_grade_are_grouped_in_unknown_and_cannot_measure():
    item = {'id': 'm-electronics-3', 'kind': 'electronics', 'query': 'Sony headphones',
            'identity': {'brand': 'Sony', 'model': '', 'variant': ''}}
    spec = {item['id']: {'query': 'headphones', 'exclude_brand_terms': ['sony'], 'require_any_of': [['headphone']]}}
    r = [{**row('Bose noise cancelling headphones', grade='unknown'), 'item_id': item['id'], 'kind': 'electronics'}]
    got = MarketIndex(r, [item], spec)
    assert len(got.lookup(item)['similar_other_brand']) == 1
    assert got.missing_by_row == [[]]
    assert got.rows[0]['cell'] == 'poshmark:unknown'


def test_lookup_timings_measure_one_thousand_queries_per_item():
    second = {**ITEM, 'id': 'test-second'}
    got = build_slice([], [ITEM, second], {**SPEC, second['id']: SPEC[ITEM['id']]})
    timing = got['measures']['lookup_us']
    assert timing['lookups'] == 2000
    assert timing['per_item'][ITEM['id']]['rows'] == 1000
    assert got['items'][second['id']]['a11']['all'] == {'state': 'not_known', 'n_B': 0, 'n_O': 0}


@pytest.mark.parametrize('change,cause', [({'price_cents': 0}, 'price_cents'), ({'may_model': 'false'}, 'may_model'),
                                         ({'cell': 'ebay:used'}, 'cell'), ({'kind': 'unknown'}, 'kind')])
def test_input_validation_names_bad_fields(change, cause):
    with pytest.raises(ValueError, match=cause):
        validate_rows([{**row('sample'), **change}], [ITEM])


def test_cli_writes_separate_examples_and_contract_valid_file_call_kinds(tmp_path, capsys):
    from jobs.measures.index_slice import ROOT, main
    r = {**row('A unique public test listing', 'brand', 'exact'), 'item_id': 'm-clothes-1'}
    paths = {name: tmp_path / (name + '.json') for name in ('rows', 'spec', 'out', 'table', 'examples')}
    paths['rows'].write_text(json.dumps(r) + '\n')
    paths['spec'].write_text('{}')
    argv = [arg for name, path in paths.items() for arg in ('--' + name, str(path))]
    assert main(argv) == 0
    lines = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    contract = json.loads((ROOT / 'spec/events.json').read_text())
    starts = [line for line in lines if line['event'] == 'call.start']
    assert len(starts) == 6
    allowed = contract['events']['call.start']['enum']['kind']
    assert all(line['kind'] in allowed for line in starts)
    assert json.loads(paths['out'].read_text())['counts']['rows'] == 1
    assert 'http' not in paths['out'].read_text() + paths['table'].read_text()
    assert lines[-1]['event'] == 'session.end' and lines[-1]['ok']


def test_f1_consensus_fills_only_manifest_gaps_from_admitted_branded_rows():
    item = {**ITEM, 'query': "Levi's straight leg jeans", 'identity': {**ITEM['identity'], 'model': '501'}}
    branded = [row("Levis 501 denim straight leg jeans", 'brand', 'exact') for _ in range(3)]
    branded += [row('Wrangler corduroy jeans', 'brand', 'exact'), row('Levis corduroy jeans', 'brand', 'unresolved')]
    other = row('Wrangler denim straight leg jeans')
    got = index(branded + [other], item)
    assert got.item_records[item['id']]['material'] == 'denim', 'F1: three branded rows must complete material'
    assert got.item_records[item['id']]['consensus']['material'] == {'rows': 3, 'stated_rows': 3}
    assert 'construction' not in got.item_records[item['id']]['consensus'], 'F1: manifest evidence must win'
    assert got.lookup(item)['similar_other_brand'] == [other]
    assert got.item_records == index(list(reversed(branded)) + [other], item).item_records


@pytest.mark.parametrize('materials,expected,support', [(['denim', 'denim'], None, 0),
    (['denim', 'cotton', 'wool'], None, 0), (['denim', 'denim', 'cotton', 'wool'], 'denim', 2),
    (['wool', 'wool', 'denim', 'denim'], 'denim', 2)])
def test_f1_consensus_requires_three_stated_rows_and_half_support_with_stable_ties(materials, expected, support):
    item = {**ITEM, 'query': "Levi's straight leg jeans"}
    r = [row(f'Levis {m} straight leg jeans', 'brand', 'exact') for m in materials]
    r += [row('Levis jeans', 'brand', 'exact') for _ in range(10)]
    got = index(r, item).item_records[item['id']]
    assert got['material'] == expected, 'F1: consensus denominator must be rows stating this attribute'
    if expected:
        assert got['consensus']['material'] == {'rows': support, 'stated_rows': len(materials)}
    assert got == index(list(reversed(r)), item).item_records[item['id']]


def test_f1_construction_consensus_counts_each_stated_mark_without_overwriting_manifest():
    item = {**ITEM, 'query': "Levi's denim jeans"}
    r = [row('Levis denim straight leg button fly jeans', 'brand', 'exact'),
         row('Levis denim straight leg jeans', 'brand', 'exact'),
         row('Levis denim button fly jeans', 'brand', 'exact')]
    target = index(r, item).item_records[item['id']]
    assert target['construction'] == ['button_fly', 'straight_leg'], 'F1: each majority construction mark survives'
    assert target['consensus']['construction']['support'] == {'button_fly': 2, 'straight_leg': 2}


def test_f3_accessories_are_excluded_from_every_group_and_from_item_consensus():
    r = [row('Levis replacement denim straight leg jeans', 'brand', 'exact'),
         row('Levis replacement denim straight leg jeans', 'brand', 'likely_same_model'),
         row('Wrangler replacement denim straight leg jeans')]
    got = index(r, {**ITEM, 'query': "Levi's jeans"})
    assert all(not group for group in got.lookup(ITEM).values()), 'F3: accessories cannot reach any group'
    assert got.left_out[ITEM['id']]['accessory'] == 3
    assert got.item_records[ITEM['id']]['material'] is None


@pytest.mark.parametrize('brand,title,expected', [
    (None, 'Nike Air Force 1 07 sneakers US 10', 'exact_by_code'),
    ('Nike', 'Air Force 1 07 sneakers US 9', 'same_product_by_code'),
    ('Nike', 'Air Force 1 07 CW2288-111 sneakers', 'exact_by_code'),
    ('Nike', 'Air Force 1 07 CW2288-1110 sneakers', 'same_product_by_code'),
    ('Nike', 'Air Force 1 07ish sneakers US 10', 'unresolved'),
    ('Adidas', 'Nike Air Force 1 07 sneakers US 10', 'unresolved'),
    ('Nike', 'Air Force 1 sneakers US 10', 'unresolved'),
])
def test_f4_null_relation_uses_brand_all_model_tokens_and_variant_size_or_style_code(brand, title, expected):
    from jobs.measures.index_slice import relation_by_code
    item = {'id': 'shoes', 'kind': 'shoes', 'query': 'Nike shoes',
            'identity': {'brand': 'Nike', 'model': "The Air Force 1 '07 (CW2288-111)", 'variant': 'US 10 white'}}
    assert relation_by_code({'title': title, 'brand': brand}, item) == expected, 'F4: identity code rule misclassified row'


def test_f4_inferred_relations_join_groups_and_brand_field_stops_other_side_leaks():
    item = {**ITEM, 'identity': {'brand': "Levi's", 'model': '501 Original Fit', 'variant': 'W32 L32'}}
    r = [row('Levis 501 fit jeans W32 L32', 'brand'), row('Levis 501 fit jeans W30 L30', 'brand'),
         {**row('Wrangler denim straight leg jeans'), 'brand': 'Levis'}]
    got = index(r, item)
    assert got.lookup(item)['exact'] == r[:1], 'F4: exact_by_code must join exact'
    assert got.lookup(item)['same_product'] == r[1:2], 'F4: same_product_by_code must join same_product'
    assert got.lookup(item)['similar_other_brand'] == []


@pytest.mark.parametrize('model,title,expected', [
    ('Kindle Paperwhite (11th generation, 2021)', 'Amazon Kindle Paperwhite', 'unresolved'),
    ('Kindle Paperwhite (11th generation, 2021)', 'Amazon Kindle Paperwhite 11th generation 2021', 'same_product_by_code'),
    ('990v5 (M990GL5)', 'New Balance 990v5 M990GL5', 'exact_by_code'),
    ('Artisan 5-Quart Tilt-Head (KSM150PS)', 'KitchenAid Artisan 5 Quart Tilt Head KSM150PS', 'exact_by_code'),
    ('Switch OLED Model (HEG-001)', 'Nintendo Switch OLED HEG-001', 'exact_by_code'),
    ('POÄNG armchair', 'IKEA POANG armchair', 'same_product_by_code'),
])
def test_f4_only_style_code_parentheses_are_optional_and_alias_accents_normalize(model, title, expected):
    from jobs.measures.index_slice import relation_by_code
    brand = title.split(' ')[0] if not title.startswith('New Balance') else 'New Balance'
    item = {'kind': 'electronics', 'identity': {'brand': brand, 'model': model, 'variant': ''}}
    assert relation_by_code({'title': title}, item) == expected, 'F4: significant parenthetical words cannot be dropped'


@pytest.mark.parametrize('title,size,expected', [('Nike Air Force 1 07 sneakers US 10', '9', 'same_product_by_code'),
    ('Nike Air Force 1 07 sneakers', '10', 'exact_by_code')])
def test_f4_exact_size_uses_f5_field_precedence(title, size, expected):
    from jobs.measures.index_slice import relation_by_code
    item = {'kind': 'shoes', 'identity': {'brand': 'Nike', 'model': 'Air Force 1 07', 'variant': 'US 10'}}
    assert relation_by_code({'title': title, 'size': size}, item) == expected, 'F4/F5: exact size must use structured evidence first'


def test_f4_a_short_model_token_is_not_itself_variant_style_evidence():
    from jobs.measures.index_slice import relation_by_code
    item = {'kind': 'small_goods', 'identity': {'brand': 'Dyson', 'model': 'V8 Absolute',
                                               'variant': 'with charger and standard heads'}}
    assert relation_by_code({'title': 'Dyson V8 Absolute vacuum'}, item) == 'same_product_by_code', \
        'F4: a model token alone cannot promote a row to exact'


def test_f6_repeated_rows_flags_combine_inputs_and_retain_each_hash(tmp_path, capsys):
    from jobs.measures.index_slice import main
    paths = {name: tmp_path / (name + '.json') for name in ('rows', 'second', 'spec', 'out', 'table', 'examples')}
    for name, site in (('rows', 'poshmark'), ('second', 'ebay')):
        value = {**row('Unique fixture listing', site=site), 'item_id': 'm-clothes-1'}
        if site == 'ebay':
            value.pop('kind')
        paths[name].write_text(json.dumps(value) + '\n')
    paths['spec'].write_text('{}')
    argv = [arg for name in ('rows', 'second', 'spec', 'out', 'table', 'examples')
            for arg in ('--rows' if name == 'second' else '--' + name, str(paths[name]))]
    assert main(argv) == 0
    got = json.loads(paths['out'].read_text())
    assert got['counts']['by_site'] == {'ebay': 1, 'poshmark': 1}, 'F6: repeated --rows must append, not replace'
    assert len(got['input_sha256s']) == 4, 'F6: every rows file must keep its own provenance hash'
    assert [r['source_input'] for r in got['records']] == ['rows', 'rows_2']
    capsys.readouterr()


def test_f6_every_table_has_site_counts_even_for_sites_with_no_admitted_groups():
    got = build_slice([row('No required attributes', site='ebay')], [ITEM], SPEC)
    text = render_markdown(got)
    for table in [p for p in text.split('\n\n') if p.startswith('|')]:
        assert 'Site' in table.splitlines()[0], 'F6: each table must identify its site'
        assert 'ebay' in table, 'F6: observed sites with zero matches must remain visible'
