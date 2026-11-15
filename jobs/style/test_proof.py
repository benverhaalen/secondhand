"""rs-6: seeded histories exercise real profile/rank paths, never claim real data."""
from style.proof.run import synthetic_set, evaluate, referral_invariance, removal_and_edit, shelf_speed


def test_held_out_saves_and_explicit_missing_real_set():
    listings,histories,now=synthetic_set(seed=13)
    result=evaluate(listings,histories,now,seed=13)
    assert len(listings)==600 and len(histories)==20
    assert result['ndcg_gain_interval'][0]>0
    assert result['size_accuracy']>=.853
    assert result['real_proof']=='not usable yet'
    assert result['mode']=='synthetic'
    assert '600 real live listings' in result['missing']


def test_referrals_byte_identical_reset_and_edits_survive():
    rows,histories,now=synthetic_set(seed=13)
    assert referral_invariance(rows,histories,now,seed=13)
    assert removal_and_edit(histories[0],now)


def test_for_you_speed():
    rows,histories,now=synthetic_set(seed=13)
    assert shelf_speed(rows,histories,now)['p95_ms']<200
