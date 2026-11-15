"""Identity twin contract fixtures, ready for TypeScript consumers to import."""
import json
from pathlib import Path
import pytest
from identity.pair import score_pair, text_similarity
from identity.cluster import cluster_comps


def fixture():
    return json.loads(Path(__file__).with_name('twin-parity.json').read_text())


def test_match_score_and_label_contract():
    for row in fixture()['match']:
        result = score_pair(row['left'], row['right'], text_sim=row['text_sim'], image_sim=row['image_sim'])
        assert result['score'] == pytest.approx(row['score']), row['name']
        assert result['label'] == row['label'], row['name']


def test_token_jaccard_contract():
    for row in fixture()['jaccard']:
        assert text_similarity(row['left'], row['right']) == row['expected'], row


def test_phash_hamming_contract():
    from identity.cluster import hamming
    for row in fixture()['hamming']:
        assert hamming(row['left'], row['right']) == row['expected'], row


def test_stock_and_union_contract():
    for row in fixture()['clusters']:
        result = cluster_comps(row['comps'], retail_phashes=row.get('retail_phashes', []))
        assert [r['comp_ids'] for r in result] == row['expected'], row['name']
