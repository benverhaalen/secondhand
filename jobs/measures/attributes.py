"""Code-only evidence extraction for market-index §2 and adaptation AD9."""
from __future__ import annotations

import re
import unicodedata

KINDS = ('clothes', 'shoes', 'electronics', 'furniture', 'small_goods')
EVIDENCE_FIELDS = ('title', 'brand', 'category', 'size', 'condition', 'cell')

# Ordered specificity: suede before leather, birch before wood, pullover before jacket.
CLOTHES_TYPES = (
    ('jeans', r'jeans?'), ('jacket', r'jackets?|coats?'),
    ('pullover', r'pull[ -]?overs?'), ('leggings', r'leggings?|tights?|yoga pants?'),
    ('pants', r'pants?'), ('sweater', r'sweaters?'), ('shirt', r'shirts?'),
)
# Pullovers can be called jackets in the same title.
CLOTHES_TYPES = (CLOTHES_TYPES[2], *CLOTHES_TYPES[:2], *CLOTHES_TYPES[3:])
CLOTHES_MATERIALS = (
    ('cotton_duck', r'duck|canvas'), ('denim', r'denim'), ('corduroy', r'corduroy'),
    ('fleece', r'fleece'), ('cashmere', r'cashmere'), ('wool', r'wool'),
    ('leather', r'leather'), ('nylon', r'nylon'), ('polyester', r'polyester'),
    ('cotton', r'cotton'),
)
CLOTHES_CONSTRUCTION = (
    ('button_fly', r'button[ -]+fly'), ('blanket_lined', r'blanket[ -]+lin(?:ed|ing)'),
    ('sherpa_lined', r'sherpa[ -]+lin(?:ed|ing)'),
    ('quarter_zip', r'(?:quarter|1/4|¼)[ -]*zip'), ('full_zip', r'full[ -]*zip'),
    ('high_rise', r'high[ -]+rise'), ('straight_leg', r'straight[ -]+leg'),
    ('flannel_lined', r'flannel[ -]+lin(?:ed|ing)'), ('quilted', r'quilted'),
)
SHOES_TYPES = (
    ('clog', r'clogs?|mules?'), ('boot', r'boots?|booties'),
    ('sneaker', r'sneakers?|trainers?|running shoes?'),
)
SHOES_MATERIALS = (
    ('suede', r'suede'), ('leather', r'leather'), ('canvas', r'canvas'), ('mesh', r'mesh'),
)
SHOES_CONSTRUCTION = (
    ('low_top', r'low[ -]+top'), ('high_top', r'high[ -]+top'),
    ('eight_eye', r'(?:eight|8)[ -]+eye'),
)
FURNITURE_TYPES = (
    ('task_chair', r'(?:office|desk|task)(?:/desk)?[ -]+chairs?'),
    ('armchair', r'arm[ -]?chairs?'),
    ('shelf_unit', r'shel(?:f|ves)(?:[ -]+unit)?|bookshel(?:f|ves)|bookcases?|cube[ -]+storage'),
)
FURNITURE_MATERIALS = (
    ('birch', r'birch'), ('veneer', r'veneer'), ('mesh', r'mesh'), ('fabric', r'fabric'),
    ('leather', r'leather'), ('wood', r'wood(?:en)?'), ('metal', r'metal'),
    ('corduroy', r'corduroy'), ('boucle', r'boucl[eé]'),
)
FURNITURE_CONSTRUCTION = (
    ('adjustable_arms', r'(?:fully[ -]+)?adjustable(?:[ -]+pivot)?[ -]+arm(?:rests?|s)'),
    ('lumbar', r'lumbar'),
)
SMALL_GOODS_TYPES = (
    ('stand_mixer', r'stand[ -]+mixers?'), ('dutch_oven', r'dutch[ -]+ovens?|cocotte'),
    ('stick_vacuum', r'(?:stick(?:[ -]+(?:and|&)[ -]+handheld)?[ -]+)?vacuum(?:[ -]+cleaner)?s?'),
)
SMALL_GOODS_MATERIALS = (
    ('enamelled_cast_iron', r'(?:enamel(?:led|ed)?[ -]+cast[ -]+iron|cast[ -]+iron[^\n]{0,35}\benamel(?:led|ed)?)'),
    ('cast_iron', r'cast[ -]+iron'), ('stainless', r'stainless(?:[ -]+steel)?'),
)
SMALL_GOODS_CONSTRUCTION = (
    ('tilt_head', r'tilt[ -]+head'), ('bowl_lift', r'bowl[ -]+lift'), ('cordless', r'cordless'),
)
VACUUM_PARTS = (
    r'floor[ -]+nozzle[ -]+head',
    r'replacement[^\n]*\b(?:batter(?:y|ies)|wand|tube|filters?|brush|head|parts?)',
    r'(?:pre[ -]*)?filters?[^\n]*\bfor\b',
    r'(?:brush|cleaner)[ -]+head[^\n]*\b(?:attachment|for)\b',
)
VACUUM_PART_PATTERNS = tuple(re.compile(p, re.IGNORECASE) for p in VACUUM_PARTS)
ELECTRONICS_TYPES = (('headphones', r'headphones?|headsets?'),)
ELECTRONICS_CONSTRUCTION = (
    ('noise_cancelling', r'(?:active[ -]+)?noise[ -]+cancel(?:l)?ing|anc'),
    ('over_ear', r'over[ -]+(?:the[ -]+)?ear|over[ -]?head'),
    ('wireless', r'wireless|bluetooth'),
)
WORD_LISTS = {
    'clothes': (CLOTHES_TYPES, CLOTHES_MATERIALS, CLOTHES_CONSTRUCTION),
    'shoes': (SHOES_TYPES, SHOES_MATERIALS, SHOES_CONSTRUCTION),
    'furniture': (FURNITURE_TYPES, FURNITURE_MATERIALS, FURNITURE_CONSTRUCTION),
    'small_goods': (SMALL_GOODS_TYPES, SMALL_GOODS_MATERIALS, SMALL_GOODS_CONSTRUCTION),
    'electronics': (ELECTRONICS_TYPES, (), ELECTRONICS_CONSTRUCTION),
}
BRAND_ALIASES = (
    ('levis', r'levi[\s\'’]*s?'), ('dr_martens', r'(?:dr\.?|doc)[ -]+marten[\'’]?s'),
    ('carhartt', r'carhartt'), ('patagonia', r'patagonia'), ('lululemon', r'lululemon'),
    ('nike', r'nike'), ('new_balance', r'new[ -]+balance'), ('birkenstock', r'birkenstock'),
    ('apple', r'apple'), ('nintendo', r'nintendo'), ('sony', r'sony'), ('amazon', r'amazon'),
    ('herman_miller', r'herman[ -]+miller'), ('steelcase', r'steelcase'), ('ikea', r'ikea'),
    ('kitchenaid', r'kitchen[ -]*aid'), ('le_creuset', r'le[ -]*creuset'), ('lego', r'lego'),
    ('dyson', r'dyson'), ('wrangler', r'wrangler'), ('dickies', r'dickies'),
    ('the_north_face', r'(?:the[ -]+)?north[ -]+face'), ('eddie_bauer', r'eddie[ -]+bauer'),
    ('columbia', r'columbia'), ('cole_haan', r'cole[ -]+haan'), ('reebok', r'reebok'),
    ('adidas', r'adidas'), ('converse', r'converse'), ('vans', r'vans'), ('staub', r'staub'),
    ('figmint', r'figmint'), ('greenpan', r'greenpan'), ('aucma', r'aucma'),
    ('mainstays', r'mainstays'), ('bissell', r'bissell'), ('eureka', r'eureka'),
    ('tineco', r'tineco'), ('sharper_image', r'sharper[ -]+image'),
)


def _compile(pattern):
    return re.compile(r'(?<!\w)(?:' + pattern + r')(?!\w)', re.IGNORECASE)


PATTERNS = {kind: tuple(tuple((v, _compile(p)) for v, p in entries) for entries in lists)
            for kind, lists in WORD_LISTS.items()}
BRAND_PATTERNS = tuple((v, _compile(p)) for v, p in BRAND_ALIASES)
ACCESSORY_ALL = _compile(r'replacement|compatible|fits|for[ -]+parts|parts[ -]+only|part[ -]+only')
ACCESSORY_BY_KIND = {
    'small_goods': _compile(r'filter|battery|charger|adapter|attachment'),
    'electronics': _compile(r'ear[ -]+pads|earpads|cushions|case[ -]+only|cable|charger|adapter'),
    'shoes': _compile(r'insoles|laces|box[ -]+only'),
    'clothes': _compile(r'patch|button'),
}
PRODUCT_WORDS = {
    'small_goods': _compile(r'mixer|oven|vacuum'),
    'clothes': _compile('|'.join(p for _, p in CLOTHES_TYPES) +
                        r'|dress(?:es)?|skirts?|shorts?|hoodies?|vests?|sweatshirts?|trousers?|tops?|blouses?|suits?'),
}


def is_accessory(title: str, kind: str) -> bool:
    if ACCESSORY_ALL.search(title):
        return True
    pattern = ACCESSORY_BY_KIND.get(kind)
    if pattern is None or not pattern.search(title):
        return False
    return kind not in PRODUCT_WORDS or not PRODUCT_WORDS[kind].search(title)


def evidence_text(row: dict) -> str:
    """Spans index this field order, retaining original Unicode and punctuation."""
    return '\n'.join(str(row.get(field) or '') for field in EVIDENCE_FIELDS)


def search_text(text: str) -> str:
    text = unicodedata.normalize('NFKD', text).casefold()
    return ''.join(c for c in text if not unicodedata.combining(c) and c.isalnum())


def normalize_brand(text: str) -> str | None:
    for value, pattern in BRAND_PATTERNS:
        if pattern.search(text):
            return value
    words = re.sub(r'\bvintage\b', '', text, flags=re.IGNORECASE)
    words = re.sub(r"['’]", '', words).lower()
    return re.sub(r'[^\w]+', '_', words).strip('_') or None


def brand_present(text: str, brand: str) -> bool:
    canonical = normalize_brand(brand)
    for value, pattern in BRAND_PATTERNS:
        if value == canonical and pattern.search(text):
            return True
    return bool(canonical and search_text(brand) in search_text(text))


def _first(text, patterns):
    for value, pattern in patterns:
        match = pattern.search(text)
        if match:
            return value, list(match.span())
    return None, None


def _size(text, kind, *, field=False):
    if field and kind in ('clothes', 'shoes') and re.fullmatch(r'\d{1,2}(?:\.\d+)?', text.strip()):
        match = re.search(r'\d+(?:\.\d+)?', text)
        return ('us_' if kind == 'shoes' else '') + match[0], list(match.span())
    if kind == 'clothes':
        match = re.search(r'\b(?:W\s*)?(\d{2})\s*(?:in\s*)?(?:[x×]|L)\s*(\d{2})(?:\s*in)?\b', text, re.I)
        if match:
            return f'{int(match[1])}x{int(match[2])}', list(match.span())
        match = re.search(r'\bsize\s+(\d{1,2})\b', text, re.I)
        if match:
            return match[1], list(match.span())
    if kind == 'shoes':
        for pattern, prefix in ((r'\bEU\s*(\d{2}(?:\.\d+)?)\b', 'eu'),
                                (r'\b(?:US\s*(?:M\s*)?|size\s*|M\s+)(\d{1,2}(?:\.\d+)?)\b', 'us')):
            match = re.search(pattern, text, re.I)
            if match:
                return f'{prefix}_{match[1]}', list(match.span())
    if kind not in ('clothes', 'shoes'):
        return None, None
    for value, pattern in (
        ('one_size', r'OS|one[ -]+size'), ('XXL', r'XXL|2XL|extra[ -]+extra[ -]+large'),
        ('XL', r'XL|extra[ -]+large'), ('XS', r'XS|extra[ -]+small'),
        ('S', r'S|small'), ('M', r'M|medium'), ('L', r'L|large'),
    ):
        match = _compile(pattern).search(text)
        if match:
            return value, list(match.span())
    return None, None


def record(row: dict, kind: str) -> dict:
    text = evidence_text(row)
    types, materials, constructions = PATTERNS[kind]
    out = {'kind_type': None, 'material': None, 'construction': [], 'size_class': None,
           'condition_grade': None, 'brand_norm': None, 'capacity': None, 'spans': {}, 'decided_by': 'code'}
    for attr, patterns in (('kind_type', types), ('material', materials)):
        out[attr], span = _first(text, patterns)
        if span:
            out['spans'][attr] = span
    if out['kind_type'] == 'stick_vacuum' and any(p.search(row.get('title', '')) for p in VACUUM_PART_PATTERNS):
        out['kind_type'] = None
        out['spans'].pop('kind_type')
    for value, pattern in constructions:
        match = pattern.search(text)
        if match:
            out['construction'].append(value)
            out['spans'][f'construction.{value}'] = list(match.span())
    if kind == 'furniture':
        match = re.search(r'\b(\d)\s*[x×]\s*(\d)\b|\b(\d+)[ -]+cubes?\b', text, re.I)
        if match:
            count = int(match[3]) if match[3] else int(match[1]) * int(match[2])
            value = f'cube_count:{count}'
            out['construction'].append(value)
            out['spans'][f'construction.{value}'] = list(match.span())
    marks = [s for k, s in out['spans'].items() if k.startswith('construction.')]
    if marks:
        out['spans']['construction'] = [min(s[0] for s in marks), max(s[1] for s in marks)]
    offsets = {}
    start = 0
    for field in EVIDENCE_FIELDS:
        offsets[field] = start
        start += len(str(row.get(field) or '')) + 1
    for field in ('size', 'title'):
        out['size_class'], span = _size(str(row.get(field) or ''), kind, field=field == 'size')
        if span:
            out['spans']['size_class'] = [offsets[field] + n for n in span]
            out['spans']['size_class_field'] = field
            break
    if row.get('brand'):
        out['brand_norm'] = normalize_brand(row['brand'])
        out['spans']['brand_norm'] = [offsets['brand'], offsets['brand'] + len(row['brand'])]
        out['spans']['brand_norm_field'] = 'brand'
    else:
        out['brand_norm'], span = _first(row.get('title') or '', BRAND_PATTERNS)
        if span:
            out['spans']['brand_norm'] = span
            out['spans']['brand_norm_field'] = 'title'
    cell = row.get('cell', '')
    grade = cell.rsplit(':', 1)[1].lower() if ':' in cell else row.get('condition')
    if grade and grade.lower() not in ('unknown', 'listed', 'none', 'unspecified'):
        out['condition_grade'] = grade.lower()
        start = text.rfind(':') + 1 if ':' in cell else text.rfind(str(row.get('condition')))
        out['spans']['condition_grade'] = [start, start + len(grade)]
    if kind == 'small_goods':
        match = re.search(r'\b(\d+(?:\.\d+)?)[ -]*(?:qts?\.?|quarts?)\b', text, re.I)
        if match:
            out['capacity'] = f'{float(match[1]):g}_qt'
            out['spans']['capacity'] = list(match.span())
    return out
