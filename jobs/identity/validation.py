"""Boundary checks shared by identity arithmetic."""
import math

# JavaScript's largest exactly representable integer (IEEE 754 binary64).
MAX_SAFE = 2**53 - 1


class RangeError(ValueError):
    pass


def money(value, field, *, positive=False):
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= MAX_SAFE or (positive and value == 0):
        raise RangeError(field + ' must be nonnegative safe integer cents' if not positive else field + ' must be positive safe integer cents')
    return value


def half_up(value, field):
    if not math.isfinite(value) or value < 0 or value > MAX_SAFE:
        raise RangeError(field + ' must be nonnegative safe integer cents')
    # Integral values need no rounding; adding .5 near MAX_SAFE loses a bit.
    return money(int(value) if value == math.floor(value) else math.floor(value + .5), field)


def unit(value, field):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1:
        raise RangeError(field + ' must be finite and in [0, 1]')
    return value
