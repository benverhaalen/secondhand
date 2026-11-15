import subprocess
import sys
from pathlib import Path

JOBS = Path(__file__).resolve().parent


def _pytest(tmp_path, *args):
    (tmp_path / "pytest.ini").write_text((JOBS / "pytest.ini").read_text())
    (tmp_path / "conftest.py").write_text((JOBS / "conftest.py").read_text().replace(
        "Path(__file__).resolve().parent.parent", f"Path(r'{JOBS.parent}')"))
    return subprocess.run([sys.executable, "-m", "pytest", *args], cwd=tmp_path, capture_output=True, text=True)


def test_same_basename_two_dirs(tmp_path):
    for engine in ("valuation", "negotiation"):
        d = tmp_path / engine
        d.mkdir()
        (d / "test_learn.py").write_text("def test_ok():\n    assert True\n")
    r = _pytest(tmp_path)
    assert r.returncode == 0, r.stdout + r.stderr
    assert "2 passed" in r.stdout


def test_exit5_is_failure(tmp_path):
    r = _pytest(tmp_path)
    assert r.returncode == 5, r.stdout + r.stderr


def test_log_sink_masks(log_lines):
    log, lines = log_lines
    log.note("x", buyer_email="a@b.co")
    assert "a@b.co" not in str(lines)


def test_fixture_loader_fails_loudly(fixture_path):
    import pytest
    with pytest.raises(AssertionError, match="missing fixture"):
        fixture_path("no/such.json")
