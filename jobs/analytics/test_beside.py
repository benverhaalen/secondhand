"""pa-5: both definitions visible, missing is flagged, gap and drift hooks."""
from analytics.beside import beside, own_figure, comparison_stages


def test_missing_site_field_is_flagged():
    out = beside('poshmark', dict(value=.03, definition='cancelled orders / orders', flags=[]), None)
    assert out['site_figure'] is None and 'not_reported' in out['flags']


def test_gap_over_ten_points_flags_our_count_and_logs(log_lines):
    log, lines = log_lines
    ours = dict(value=.01, definition='our cancels', flags=[])
    site = dict(value=.12, definition='90-day site cancels')
    out = beside('poshmark', ours, site, log=log)
    assert out['data_quality'] and out['ours']['definition'] == 'our cancels'
    assert out['site_figure']['definition'] == '90-day site cancels'
    assert any(r['event'] == 'state.change' for r in lines)
    assert not beside('poshmark', ours, dict(site, value=.11))['data_quality']


def test_cross_listed_order_counted_once():
    orders = [dict(id='o', item_id='i', site='poshmark', kind='sale', state='delivered', clocks=dict(paid_at='2026-09-01', shipped_at='2026-09-03'))]
    assert own_figure(orders + orders, 'poshmark', 'ship_days')['value'] == 2
    assert own_figure(orders + orders, 'poshmark', 'cancel_rate')['basis_count'] == 1


def test_ranker_change_hides_views_but_never_sales():
    row = dict(stages=dict(exposure=10, attention=4, interest=2, outcome=1), flags=[])
    out = comparison_stages(row, ranker_changed=True)
    assert out['stages']['exposure'] is None and out['stages']['attention'] is None
    assert out['stages']['outcome'] == 1 and 'ranker_changed' in out['flags']
    assert row['stages']['exposure'] == 10
