"""Run the backtest experiment and print its summary: python3 scripts/bench/backtest.py self-test (see jobs/valuation/experiment.py)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "jobs"))
from valuation.experiment import main  # noqa: E402

code, brief = main(sys.argv[1:])
print(json.dumps(brief, indent=1))
sys.exit(code)
