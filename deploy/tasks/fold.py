"""One nightly fold task: run jobs/<engine>/learn.py or fit.py's main(). An engine whose fold has not landed is skipped, not failed."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # deploy/tasks/fold.py -> repo root (bundle sync root)


def find(engine: str, root: Path = ROOT) -> Path | None:
    for name in ("learn.py", "fit.py"):
        p = root / "jobs" / engine / name
        if p.exists():
            return p
    return None


def run(engine: str, root: Path = ROOT) -> dict:
    path = find(engine, root)
    if path is None:
        return {"engine": engine, "state": "skipped", "why": "no jobs/<engine>/learn.py or fit.py yet"}
    sys.path.insert(0, str(path.parent))
    spec = importlib.util.spec_from_file_location(f"fold_{engine}", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not hasattr(mod, "main"):
        return {"engine": engine, "state": "skipped", "why": f"{path.name} has no main()"}
    return {"engine": engine, "state": "ran", "result": mod.main()}


if __name__ == "__main__":
    print(json.dumps(run(sys.argv[1]), default=str))
