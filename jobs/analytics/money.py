"""D9 boundary contract: nonnegative safe integer cents; Math.round ties."""
import math

# Fixed protocol limit: JavaScript Number.MAX_SAFE_INTEGER.
MAX_SAFE = 2**53 - 1


class RangeError(ValueError):
    pass


def cents(value, field):
    if (isinstance(value, bool) or not isinstance(value, (int, float)) or
            not math.isfinite(value) or value < 0 or value > MAX_SAFE or int(value) != value):
        raise RangeError(f'{field} must be nonnegative safe integer cents')
    return int(value)


def rounded(value, field):
    if not math.isfinite(value):
        raise RangeError(f'{field} must be finite cents')
    return cents(math.floor(value + .5), field)  # Fixed Math.round half-up rule.
