"""Twin of money/ending.ts: cents, decimal endings, ties down."""
import math

DEFAULT_ENDING = {"above_cents": 2000, "digits": [5, 8]}
DOLLAR = 100  # Fixed unit: cents per dollar.
MAX_SAFE = 9007199254740991  # JavaScript's exact integer protocol limit.


def money(value, field):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value != math.floor(value) or not 0 <= value <= MAX_SAFE:
        raise ValueError(f'{field} must be nonnegative safe integer cents')
    return int(value)


def _rule(rule):
    rule = DEFAULT_ENDING if rule is None else rule
    money(rule['above_cents'], 'above_cents')
    if not rule['digits'] or any(isinstance(d, bool) or not isinstance(d, int) or not 0 <= d <= 9 for d in rule['digits']):
        raise ValueError('digits must be decimal digits')
    return rule


def endings(lo_cents, hi_cents, rule=None):
    lo, hi, rule = money(lo_cents, 'lo_cents'), money(hi_cents, 'hi_cents'), _rule(rule)
    return [c for c in range(((lo + DOLLAR - 1) // DOLLAR) * DOLLAR, hi + 1, DOLLAR)
            if c <= rule['above_cents'] or (c // DOLLAR) % 10 in rule['digits']]


def round_to_ending(cents, rule=None, lo_cents=0, hi_cents=MAX_SAFE):
    cents = money(cents, 'cents')
    # Infinity is the existing TypeScript caller protocol for an unbounded search.
    if hi_cents == math.inf:
        hi_cents = MAX_SAFE
    lo, hi, rule = money(lo_cents, 'lo_cents'), money(hi_cents, 'hi_cents'), _rule(rule)
    if lo > hi:
        return None
    target = min(hi, max(lo, cents))
    cycle = 10 * DOLLAR  # Fixed decimal ending cycle.
    near = endings(max(lo, math.ceil(target - cycle), 0), min(hi, math.floor(target + cycle)), rule)
    return min(near, key=lambda c: abs(c - cents)) if near else None
