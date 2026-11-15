"""Whole-cent boundary shared by trust training decision costs."""
import math

def cents(value, field):
    if isinstance(value, bool) or not isinstance(value,(float,int)) or not math.isfinite(value) or value < 0 or int(value) != value or value > 9007199254740991:
        raise ValueError(field)  # Fixed JS safe-integer limit keeps both twins representable.
    return int(value)

def half_up(value):
    if isinstance(value, bool) or not isinstance(value,(float,int)) or not math.isfinite(value) or value < 0: raise ValueError('amount_cents')
    if int(value) == value: return cents(value,'amount_cents')
    return cents(math.floor(value+.5),'amount_cents')  # Fixed rounding contract matches Math.round for nonnegative money.
