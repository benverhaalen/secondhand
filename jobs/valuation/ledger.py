"""The run ledger of spec/plans/backtest/datasets.md section 5 item 2: one line per backtest run, committed, so "did you
grade your own homework" is a query.

Each line names the rows (file and sha256), the window scored, the code commit, every contestant's settings, how many
distinct settings have been scored on those rows so far, and the result's sha256. A run marked `locked` scores the
pre-registered window once (plan decisions 3 and 4): it is refused when any earlier run on the same rows touched that
window, and any later run that touches a locked window is refused, unless the run names a deviation, which is then
in the ledger for anyone to read.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

END = "9999"   # an open window runs to the end of the rows


class LockedWindowError(ValueError):
    pass


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def sha256_json(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def read(path: str | Path) -> list[dict]:
    p = Path(path)
    return [json.loads(line) for line in p.read_text().splitlines() if line.strip()] if p.exists() else []


def _overlaps(a_from, a_to, b_from, b_to) -> bool:
    return a_from < (b_to or END) and b_from < (a_to or END)


def check(lines: list[dict], *, rows_sha256: str, test_from: str, test_to: str | None, locked: bool,
          deviation: str | None) -> list[dict]:
    """The earlier runs that make this one a second look. Raises unless the run names a deviation."""
    same = [x for x in lines if x["rows_sha256"] == rows_sha256 and _overlaps(test_from, test_to, x["test_from"], x["test_to"])]
    seen = same if locked else [x for x in same if x["locked"]]
    if seen and not deviation:
        runs = ", ".join(f'{x["run"]} ({x["test_from"]} to {x["test_to"] or "end"}{", locked" if x["locked"] else ""})' for x in seen)
        raise LockedWindowError(f"{'this locked window was already scored by' if locked else 'a locked window was already opened by'} {runs}; "
                                "pass --deviation with the reason to run it anyway, which the ledger records")
    return seen


def entry(lines: list[dict], *, run: str, at: str, rows: str, rows_sha256: str, commit: str, test_from: str,
          test_to: str | None, sample: int | None, locked: bool, deviation: str | None, settings: dict, result) -> dict:
    settings_sha = sha256_json(settings)
    tried = {x["settings_sha256"] for x in lines if x["rows_sha256"] == rows_sha256} | {settings_sha}
    return {"run": run, "at": at, "rows": Path(rows).name, "rows_sha256": rows_sha256, "commit": commit,
            "test_from": test_from, "test_to": test_to, "sample": sample, "locked": locked, "deviation": deviation,
            "settings": settings, "settings_sha256": settings_sha, "settings_tried_on_these_rows": len(tried),
            "result_sha256": sha256_json(result)}


def append(path: str | Path, line: dict) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(line, sort_keys=True) + "\n")
