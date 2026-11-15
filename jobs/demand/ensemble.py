"""The research ensemble on the gateway, with its track record (demand-and-trend §3 step 7).

How it operates: a yes-or-no research question with a date gets 5 independent gateway calls, each handed the
cited comps and series ids; they run in parallel in production (sequential here, the order does not matter).
The answer is the geometric mean of the odds (the mean of the log odds), shown as the range across the 5 with
the ensemble's own Brier score and resolved count. It answers research questions only: nothing here is read by
direction.py or the forecasts. If the gateway fails, the reply is the arithmetic answer alone.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable

CALLS = 5
CLIP = 1e-4
BASELINE_BRIER = 0.25  # always saying 0.5
MIN_RECORD = 20  # a record on fewer resolved questions is not shown


def brier(ps: list[float], ys: list[int]) -> float:
    return sum((p - y) ** 2 for p, y in zip(ps, ys)) / len(ps)


@dataclass
class Record:
    ps: list[float] = field(default_factory=list)
    ys: list[int] = field(default_factory=list)

    def resolve(self, p: float, y: int, created: str = "9999", model_cutoff: str = "0000") -> None:
        if created <= model_cutoff:
            return  # the model may have seen the answer: it does not count toward the record
        self.ps.append(p)
        self.ys.append(y)

    def summary(self) -> dict:
        return {"brier": brier(self.ps, self.ys) if len(self.ps) >= MIN_RECORD else None, "resolved": len(self.ps)}

    def weight(self) -> float:
        """Shown weight: 1 at a perfect record, 0 at or worse than coin-flip; unproven starts at 0.5."""
        if not self.ps:
            return 0.5
        return max(0.0, 1 - brier(self.ps, self.ys) / BASELINE_BRIER)


def _logit(p: float) -> float:
    p = min(max(p, CLIP), 1 - CLIP)
    return math.log(p / (1 - p))


def ask(question: dict, evidence: list[str], call: Callable[[dict, list[str]], float], record: Record) -> dict:
    try:
        ps = [call(question, evidence) for _ in range(CALLS)]
    except (ConnectionError, TimeoutError) as e:
        return {"question": question["id"], "state": "arithmetic_only", "p": None, "reason": str(e),
                "record": record.summary()}
    p = 1 / (1 + math.exp(-sum(map(_logit, ps)) / len(ps)))
    return {"question": question["id"], "state": "answered", "p": p, "range": (min(ps), max(ps)), "calls": len(ps),
            "weight": record.weight(), "record": record.summary()}
