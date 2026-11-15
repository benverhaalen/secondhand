"""ph-4: route choice and pass rates (photo.md section 3 step 5, section 4)."""
import math

PROTECTED = {"tag", "care_label", "flaw", "screenshot"}
PRIOR = (2, 2)
EXPLORE_BELOW = 5  # trials


def n_for(p: float, target: float = 0.8, cap: int = 4) -> int:
    for n in range(1, cap + 1):
        if 1 - (1 - p) ** n >= target:
            return n
    return cap


def _p(rates: dict, route: str, kind) -> float:
    a, b = rates.get((route, kind), PRIOR)
    mean = a / (a + b)
    # a route with a few trials but under EXPLORE_BELOW is tried at mean + one sd; the bare prior keeps n = 3 (photo.md §4)
    if 0 < a + b - 4 < EXPLORE_BELOW:
        return min(0.99, mean + math.sqrt(a * b / ((a + b) ** 2 * (a + b + 1))))
    return mean


def offers(photos: list, ceiling: int, price_per_call: float, price_estimate: float, rates: dict,
           gain: dict | None = None, beta: float = 1.0) -> list:
    out = []
    for ph in photos:
        protected = ph["role"] in PROTECTED or ph.get("serial") or ph.get("use") == "raw"
        best = {"photo_id": ph["photo_id"], "level": 0, "n": 0, "cost": 0.0, "value": 0.0,
                "reason": "protected_role" if protected else "light_already_even"}
        kind, cover = ph.get("kind"), bool(ph.get("cover"))
        for level in () if protected else range(1, min(ceiling, 2) + 1):
            n = n_for(_p(rates, f"level{level}", kind))
            cost = price_per_call * n
            g = (gain or {}).get((level, kind), (0.05 if cover else 0.02) * level)
            value = g * (1.0 if cover else 0.3) * beta * price_estimate - cost
            if value > 0 and (best["level"] == 0 or value > best["value"]):
                best = {"photo_id": ph["photo_id"], "level": level, "n": n, "cost": cost, "value": value,
                        "reason": "best_value"}
        out.append(best)
    return out


def update(rates: dict, route: str, kind, passed: bool) -> dict:
    a, b = rates.get((route, kind), PRIOR)
    return {**rates, (route, kind): (a + 1, b) if passed else (a, b + 1)}
