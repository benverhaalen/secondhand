"""A11: exact two-sample shift intervals, never pooled across sites or grades."""
from __future__ import annotations

from functools import lru_cache
import math
from statistics import NormalDist, mean, median

BRAND_LOCKED = frozenset(('m-electronics-1', 'm-electronics-2', 'm-electronics-4'))
EXCLUDED = {'m-small_goods-3': 'compatible-with sets can be counterfeits'}
MIN_SIDE = 8
EXACT_MAX_PAIRS = 2500


@lru_cache(maxsize=64)
def u_counts(n: int, m: int) -> tuple[int, ...]:
    """Count binary rank arrangements by inversions: F(n,m)=F(n,m-1)+q^m F(n-1,m)."""
    previous = [(1,)] * (m + 1)
    for i in range(1, n + 1):
        current = [(1,)]
        for j in range(1, m + 1):
            values = [0] * (i * j + 1)
            for u, count in enumerate(current[j - 1]):
                values[u] += count
            for u, count in enumerate(previous[j]):
                values[u + j] += count
            current.append(tuple(values))
        previous = current
    return previous[m]


def critical_value(n: int, m: int) -> int:
    """Largest c with P(U<=c)<=.025; -1 means the finite sample gives no finite bound."""
    if n * m > EXACT_MAX_PAIRS:
        sd = math.sqrt(n * m * (n + m + 1) / 12)
        # Phi((c+.5-mu)/sd)<=.025, the inclusive lower tail's continuity correction.
        return max(-1, math.floor(n * m / 2 + NormalDist().inv_cdf(.025) * sd - .5))
    counts = u_counts(n, m)
    total, cumulative, critical = sum(counts), 0, -1
    for u, count in enumerate(counts):
        cumulative += count
        if 40 * cumulative > total:
            break
        critical = u
    return critical


def _separation(b, o):
    both = b + o
    center = mean(both)
    total = sum((x - center) ** 2 for x in both)
    if total == 0:
        return 0.0
    between = len(b) * (mean(b) - center) ** 2 + len(o) * (mean(o) - center) ** 2
    return min(1.0, max(0.0, between / total))


def estimate(brand_prices: list[int], other_prices: list[int]) -> dict:
    if any(not math.isfinite(p) or p <= 0 for p in brand_prices + other_prices):
        raise ValueError('A11 prices must be finite and positive')
    n, m = len(brand_prices), len(other_prices)
    counts = {'n_B': n, 'n_O': m}
    if min(n, m) < MIN_SIDE:
        return {'state': 'not_known', **counts}
    b, o = [math.log(p) for p in brand_prices], [math.log(p) for p in other_prices]
    differences = sorted(x - y for x in b for y in o)
    c = critical_value(n, m)
    lower, upper = differences[c], differences[n * m - c - 1]
    theta = median(differences)
    return {'state': 'measured', **counts, 'theta': theta, 'lower': lower, 'upper': upper,
            'ratio': math.exp(theta), 'ratio_lower': math.exp(lower), 'ratio_upper': math.exp(upper),
            'se': (upper - lower) / 3.92, 'separation_S': _separation(b, o), 'critical_U': c,
            'interval_method': ('exact_mann_whitney' if n * m <= EXACT_MAX_PAIRS
                                else 'normal_mann_whitney_continuity_corrected')}


def measure_cells(item_id: str, groups: dict, observed_cells=()) -> dict:
    cells = sorted(set(observed_cells) | {row['cell'] for rows in groups.values() for row in rows})
    result = {}
    special = 'brand_locked' if item_id in BRAND_LOCKED else 'excluded' if item_id in EXCLUDED else None
    for cell in cells or ['all']:
        b = [r['price_cents'] for group in ('exact', 'same_product') for r in groups[group]
             if r['cell'] == cell and r['may_model']]
        o = [r['price_cents'] for r in groups['similar_other_brand'] if r['cell'] == cell and r['may_model']]
        if special:
            result[cell] = {'state': special, 'n_B': len(b), 'n_O': len(o)}
            if special == 'excluded':
                result[cell]['reason'] = EXCLUDED[item_id]
        elif cell.rsplit(':', 1)[-1] in ('unknown', 'listed'):
            result[cell] = {'state': 'not_known', 'n_B': len(b), 'n_O': len(o),
                            'reason': 'unknown condition'}
        else:
            result[cell] = estimate(b, o)
    return result


def kind_summary(cells: list[dict]) -> dict:
    measured = [c for c in cells if c['state'] == 'measured']
    usable = [c for c in measured if c['upper'] > c['lower']]
    counts = {'item_cells': len(usable), 'measured_cells': len(measured),
              'zero_width_cells': len(measured) - len(usable),
              'n_B': sum(c.get('n_B', 0) for c in usable), 'n_O': sum(c.get('n_O', 0) for c in usable)}
    if not usable:
        return {'state': 'not_known', **counts}
    weights = [(3.92 / (c['upper'] - c['lower'])) ** 2 for c in usable]
    total = sum(weights)
    theta = sum(w * c['theta'] for w, c in zip(weights, usable)) / total
    tau = math.sqrt(sum(w * (c['theta'] - theta) ** 2 for w, c in zip(weights, usable)) / total)
    se = math.sqrt(1 / total)
    return {'state': 'measured', **counts, 'theta': theta, 'tau_k': tau, 'se': se,
            'lower': theta - 1.96 * se, 'upper': theta + 1.96 * se, 'ratio': math.exp(theta),
            'ratio_lower': math.exp(theta - 1.96 * se), 'ratio_upper': math.exp(theta + 1.96 * se)}
