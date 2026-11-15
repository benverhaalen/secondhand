import importlib.util
from pathlib import Path
import sys

spec = importlib.util.spec_from_file_location('workspace_result', Path(__file__).with_name('run.py'))
run = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = run
spec.loader.exec_module(run)


def test_browser_result_reads_structured_log_field():
    assert run.browser_result_ok('{"event":"note","result":{"browser":"ok"}}')


def test_browser_result_rejects_failed_probe_even_if_other_text_says_ok():
    assert not run.browser_result_ok('{"event":"note","result":{"browser":"failed"},"note":"browser ok"}')
    assert not run.browser_result_ok('not a JSON line')


def test_browser_result_keeps_old_plain_result_readable():
    assert run.browser_result_ok('{"browser": "ok"}')
