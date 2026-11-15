"""Failures name the attribute evidence that would otherwise be invented or lost."""
from jobs.measures.attributes import evidence_text, normalize_brand, record
import pytest


def test_jacket_attributes_have_spans_and_repeat_deterministically():
    row = {'title': 'Carhartt Detroit Jacket J97 duck canvas blanket lined brown L', 'cell': 'poshmark:used'}
    got = record(row, 'clothes')
    assert got == record(row, 'clothes'), 'same input must give identical evidence'
    assert got['kind_type'] == 'jacket'
    assert got['material'] == 'cotton_duck'
    assert 'blanket_lined' in got['construction']
    assert got['size_class'] == 'L'
    assert got['brand_norm'] == 'carhartt'
    assert got['condition_grade'] == 'used'
    for attr in ('kind_type', 'material', 'construction', 'size_class', 'brand_norm', 'condition_grade'):
        a, b = got['spans'][attr]
        assert evidence_text(row)[a:b], f'{attr} needs a nonempty evidence span'
    assert got['decided_by'] == 'code'


def test_vintage_levis_alias_and_waist_length_are_not_model_number():
    got = record({'title': 'Vintage Levis 501 W32 L32'}, 'clothes')
    assert got['brand_norm'] == 'levis'
    assert got['size_class'] == '32x32'
    assert got['material'] is None, 'jeans or model names never supply an unstated material'


@pytest.mark.parametrize('title,kind,field,value', [
    ('jeans 32x32', 'clothes', 'size_class', '32x32'),
    ('US 10', 'shoes', 'size_class', 'us_10'),
    ('size 6', 'clothes', 'size_class', '6'),
    ('Size 10', 'shoes', 'size_class', 'us_10'),
    ('M 10', 'shoes', 'size_class', 'us_10'),
    ('EU 42', 'shoes', 'size_class', 'eu_42'),
    ('OS', 'clothes', 'size_class', 'one_size'),
    ('Extra Large fleece pullover', 'clothes', 'size_class', 'XL'),
    ('5.5-quart enamelled cast iron dutch oven', 'small_goods', 'capacity', '5.5_qt'),
    ('8 cube bookcase', 'furniture', 'kind_type', 'shelf_unit'),
    ('2x4 shelf', 'furniture', 'construction', ['cube_count:8']),
    ('cordless vacuum cleaner', 'small_goods', 'kind_type', 'stick_vacuum'),
    ('Noise Canceling Over-the-Ear Bluetooth Headphones', 'electronics', 'construction',
     ['noise_cancelling', 'over_ear', 'wireless']),
])
def test_kind_parsers_preserve_stated_values(title, kind, field, value):
    assert record({'title': title}, kind)[field] == value


@pytest.mark.parametrize('brand', ["Levi's", 'Levis', 'Vintage LEVI’S'])
def test_levi_aliases_share_one_brand(brand):
    assert normalize_brand(brand) == 'levis'


@pytest.mark.parametrize('brand', ['Dr. Martens', 'Doc Martens', "Dr Marten's"])
def test_martens_aliases_share_one_brand(brand):
    assert normalize_brand(brand) == 'dr_martens'


@pytest.mark.parametrize('grade', ['nwt', 'nwot', 'uln', 'ug', 'used', 'new'])
def test_condition_grades_are_never_collapsed(grade):
    assert record({'cell': f'poshmark:{grade}'}, 'shoes')['condition_grade'] == grade


@pytest.mark.parametrize('cell', ['poshmark:unknown', 'apify:ebay:listed', 'poshmark'])
def test_unknown_or_listing_status_cannot_supply_condition(cell):
    assert record({'cell': cell}, 'furniture')['condition_grade'] is None


def test_matching_phrases_do_not_infer_brand_or_material_from_models():
    got = record({'title': 'Carhartt jacket J97'}, 'clothes')
    assert got['material'] is None
    assert got['construction'] == []
    assert record({'title': 'Wrangler corduroy pants'}, 'clothes')['material'] == 'corduroy'


@pytest.mark.parametrize('title', [
    'Bissell Cordless Stick Vacuum Floor Nozzle Head Tested',
    'Replacement Battery for Cordless Stick Vacuum Cleaner',
    'Cordless Vacuum Replacement Wand Tube',
    'Pre Filters for Cordless Vacuum Cleaner',
])
def test_vacuum_parts_abstain_from_the_complete_vacuum_type(title):
    got = record({'title': title}, 'small_goods')
    assert got['kind_type'] is None
    assert 'kind_type' not in got['spans']


def test_a_complete_vacuum_with_accessories_keeps_its_type():
    assert record({'title': 'Cordless Stick Vacuum with Charger and Standard Heads'}, 'small_goods')['kind_type'] == 'stick_vacuum'


def test_f5_brand_field_wins_over_a_different_brand_in_the_title_and_has_field_span():
    row = {'title': 'Nike style sneakers', 'brand': 'New Balance'}
    got = record(row, 'shoes')
    assert got['brand_norm'] == 'new_balance', 'F5: structured brand must precede title aliases'
    assert got['spans']['brand_norm_field'] == 'brand'
    a, b = got['spans']['brand_norm']
    assert evidence_text(row)[a:b] == row['brand']


@pytest.mark.parametrize('kind,size,expected', [('shoes', '10', 'us_10'), ('shoes', 'EU 42', 'eu_42'),
                                              ('clothes', '32x32', '32x32'), ('clothes', 'M', 'M'),
                                              ('clothes', '6', '6')])
def test_f5_size_field_precedes_title_and_keeps_a_field_span(kind, size, expected):
    row = {'title': 'Nike shoes US 9' if kind == 'shoes' else 'jacket XL', 'size': size}
    got = record(row, kind)
    assert got['size_class'] == expected, 'F5: explicit size field must precede title size'
    assert got['spans']['size_class_field'] == 'size'
    a, b = got['spans']['size_class']
    assert evidence_text(row)[a:b] == size


@pytest.mark.parametrize('size,expected', [('32 in x 32 in', '32x32'), ('W32 L32', '32x32')])
def test_f5_ebay_waist_and_inseam_field_spelling_keeps_both_dimensions(size, expected):
    got = record({'title': 'Levis jeans', 'size': size}, 'clothes')
    assert got['size_class'] == expected, 'F5: eBay waist/inseam units must parse as size'


def test_f5_unparseable_size_falls_back_to_the_title():
    got = record({'title': 'Nike sneakers US 10', 'size': 'not specified'}, 'shoes')
    assert got['size_class'] == 'us_10'
    assert got['spans']['size_class_field'] == 'title'


@pytest.mark.parametrize('kind,positive,negative', [
    *[(kind, term, 'irreplaceable compatibleish outfits spareparts')
      for kind in ('clothes', 'shoes', 'electronics', 'furniture', 'small_goods')
      for term in ('replacement', 'compatible', 'fits', 'for parts', 'parts only', 'part only')],
    *[('small_goods', f'Dyson V8 {word}', f'Dyson V8 vacuum with {word}')
      for word in ('filter', 'battery', 'charger', 'adapter', 'attachment')],
    ('small_goods', 'Dyson V8 replacement filter', 'KitchenAid Artisan mixer with three attachments'),
    *[('electronics', f'Sony {word}', 'Sony headphones with ear padding and cableless charging')
      for word in ('ear pads', 'earpads', 'cushions', 'case only', 'cable', 'charger', 'adapter')],
    *[('shoes', f'Nike {word}', 'Nike sneakers with shoelaces and boxed packaging')
      for word in ('insoles', 'laces', 'box only')],
    *[('clothes', f'Carhartt {word}', f'Carhartt jacket with {word}') for word in ('patch', 'button')],
    ('clothes', 'button', 'button down dress'),
])
def test_f3_each_accessory_list_excludes_parts_but_respects_whole_words_and_kind_words(kind, positive, negative):
    from jobs.measures.attributes import is_accessory
    assert is_accessory(positive, kind), f'F3: accessory not excluded: {kind}: {positive}'
    assert not is_accessory(negative, kind), f'F3: whole product wrongly excluded: {kind}: {negative}'
