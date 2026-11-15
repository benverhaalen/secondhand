"""dt-2: D, direction and the M15 test (demand-and-trend §3 step 3; market-insight M8, M15)."""
import math
from dataclasses import replace

import numpy as np

from demand.direction import Proxy, demand_index, direction, category_directions, m15_test, trending

W = {"sold": 1.0, "watchers": 0.6, "search": 0.4}  # weights come from param rows in production


def flat(n=10):
    return {"sold": Proxy(recent=n, base=n), "watchers": Proxy(recent=3 * n, base=3 * n)}


def test_noise_raises_no_alert():
    rng = np.random.default_rng(7)
    alerts = 0
    weekly_reads = []
    for week in ('2026-11-02', '2026-11-09'):
        candidates = []
        for _ in range(500):
            a, b = int(rng.poisson(20)), int(rng.poisson(60))
            proxies = {'sold': Proxy(recent=a, base=b / 3),
                       'watchers': Proxy(recent=int(rng.poisson(60)), base=60)}
            candidates.append(dict(proxies=proxies, sold_recent=a, sold_prior=b))
        weekly_reads.append(category_directions(candidates, W, week=week))
    alerts = sum(trending(list(reads)) == 'demand_rose' for reads in zip(*weekly_reads))
    assert alerts <= 1  # under 0.2% false alerts


def test_real_rise_is_demand_rose_after_two_reads():
    proxies = {"sold": Proxy(recent=40, base=20), "watchers": Proxy(recent=120, base=60)}
    read = category_directions([dict(proxies=proxies, sold_recent=40, sold_prior=60)], W, week="2026-11-02")[0]
    assert read.state == "rising" and read.D >= 0.15
    assert trending([read]) is None  # one read is not enough
    assert trending([read, replace(read, week="2026-11-09")]) == "demand_rose"


def test_more_for_sale_is_not_rising():
    proxies = {"sold": Proxy(recent=40, base=20), "watchers": Proxy(recent=120, base=60)}
    read = category_directions([dict(proxies=proxies, sold_recent=40, sold_prior=60, listed_recent=200, listed_base=50)], W, week="2026-11-02")[0]
    assert read.state == "more_for_sale"


def test_too_few_and_single_proxy_hidden():
    assert direction(flat(3), W, sold_recent=3, sold_prior=30).state == "too_few"
    one = {"sold": Proxy(recent=40, base=20)}
    assert direction(one, W, sold_recent=40, sold_prior=60).state == "hidden"


def test_category_tide_is_removed():
    # the whole category doubled; the product doubled with it: not a trend of its own
    p = m15_test([(40, 60)], category=(4000, 6000))
    assert p[0] > 0.05
    p_flat_cat = m15_test([(40, 60)], category=(2000, 6000))
    assert p_flat_cat[0] < 0.01


def test_index_formula():
    d = demand_index({"sold": Proxy(recent=20, base=10)}, W)
    assert abs(d - math.log(21 / 11)) < 1e-12
