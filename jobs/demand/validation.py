"""Numerical domains at demand calculation boundaries."""
import math
from numbers import Real

SAFE_INTEGER = 2 ** 53 - 1  # JavaScript's exact integer protocol limit.


def number(value, field, *, positive=False, integer=False):
    if (isinstance(value, bool) or not isinstance(value, Real) or not math.isfinite(value)
            or value < 0 or (positive and value == 0)
            or (integer and (value != math.floor(value) or value > SAFE_INTEGER))):
        raise ValueError(f'{field}: invalid numeric value')
    return value


def finite(value, field):
    if isinstance(value, bool) or not isinstance(value, Real) or not math.isfinite(value):
        raise ValueError(f'{field}: must be finite')
    return value


def probability(value, field='probability'):
    number(value, field)
    if value > 1:
        raise ValueError(f'{field}: must be in [0, 1]')
    return value


def money(value, field='price_cents'):
    return number(value, field, positive=True, integer=True)
