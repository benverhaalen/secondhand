"""tr-6: deterministic labels, production poison guard and production burst bench."""
import pytest
from trust.sim import label_stream, calibration_trial, production_bench, poison_trial


def test_seeded_label_stream_is_synthetic_reproducible():
    a=label_stream(seed=12,n=2000,weights={'off_platform':2.,'new_account':.7})
    assert a==label_stream(seed=12,n=2000,weights={'off_platform':2.,'new_account':.7})
    assert len(a)==2000 and all(r['mode']=='synthetic' for r in a)
    assert all(set(r['trust_label'])=={'subject_id','kind','value','weight','source','observed_at','resolved_at'} for r in a)


def test_calibration_uses_existing_fit_and_rejects_bad_challenger():
    result=calibration_trial(seed=12,n=2000)
    assert result['held_out_brier']<result['uncalibrated_brier']
    assert not result['bad_promoted']
    assert 'nightly signal-weight regression' in result['missing']


def test_poison_stream_positive_and_negative_capped(log_lines):
    log,_=log_lines
    result=poison_trial(n=500,log=log)
    assert result['positive_mass']<=result['cap_mass']+1e-9
    assert result['negative_mass']<=result['cap_mass']+1e-9
    assert result['labels']==500


def test_burst_budget_held_on_real_trust_code():
    result=production_bench(n=1000,burst=50)
    assert result['count']==1000 and result['code_p95_ms']<50 and result['full_p95_ms']<2000
    assert result['hard_blocked']==250 and result['model_down_asked']==250
    assert result['network_calls']==0 and result['model']=='fixture'


def test_real_people_refused():
    with pytest.raises(ValueError,match='synthetic'):
        production_bench(n=10,burst=2,mode='real')
