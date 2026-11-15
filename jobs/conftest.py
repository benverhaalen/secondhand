"""Shared pytest scaffold for every engine folder under jobs/."""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "log"))
sys.path.insert(0, str(ROOT / "jobs"))

FIXTURES = ROOT / "spec" / "fixtures"


@pytest.fixture
def fixture_path():
    """fixture_path('orders/orders.json') -> Path under spec/fixtures/, failing loudly if absent."""
    def _path(rel):
        p = FIXTURES / rel
        assert p.exists(), f"missing fixture spec/fixtures/{rel}"
        return p
    return _path


@pytest.fixture
def load_fixture(fixture_path):
    """load_fixture('orders/orders.json') -> parsed JSON (or a list for .jsonl)."""
    def _load(rel):
        p = fixture_path(rel)
        text = p.read_text(encoding="utf-8")
        if p.suffix == ".jsonl":
            return [json.loads(line) for line in text.splitlines() if line.strip()]
        return json.loads(text)
    return _load


@pytest.fixture
def log_lines():
    """A log that goes through log/ masking; returns (log, lines) with lines as parsed dicts."""
    from secondhand_log import create_log

    lines = []
    log = create_log(src="job", build="test+0", sink=lambda line: lines.append(json.loads(line) if isinstance(line, str) else line))
    return log, lines


def pytest_sessionfinish(session, exitstatus):
    # pytest already exits 5 on an empty collection; keep it a failure, never a pass
    if session.testscollected == 0:
        session.exitstatus = 5
