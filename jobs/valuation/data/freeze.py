"""Freeze one source's raw files into rows.csv.gz and manifest.json, byte-identical on every rerun.

    cd jobs && python -m valuation.data.freeze <source> <out_dir> <raw file...>

The raw files must match the sha256 recorded in sources.json, so a changed mirror is refused rather than frozen.
The manifest (inputs and their hashes, the output's hash, rows by price_type and kind, the date range, what was
dropped and why) is what goes in git; rows.csv.gz stays out of git (plan §6; the repo is public).
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import io
import json
import subprocess
import sys
from pathlib import Path

from secondhand_log import create_log, file_sink, stdout_sink, tee_sink

from valuation.data.rows import COLUMNS, LICENCE, MAY_MODEL, MULTI_FILE, READERS

HERE = Path(__file__).resolve().parent


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def _commit() -> str:
    out = subprocess.run(["git", "rev-parse", "HEAD"], cwd=HERE, capture_output=True, text=True)
    return out.stdout.strip() or "unknown"


def freeze(source: str, inputs: list[Path], out_dir: Path, expect: dict | None = None, log=None) -> dict:
    inputs = sorted(Path(p) for p in inputs)
    seen = []
    for p in inputs:
        digest = sha256(p)
        if expect and p.name in expect and expect[p.name] != digest:
            raise ValueError(f"{p.name}: sha256 {digest} is not the frozen {expect[p.name]}")
        seen.append({"file": p.name, "bytes": p.stat().st_size, "sha256": digest})

    dropped: dict = {}
    reader = READERS[source]
    rows = reader(inputs, dropped) if source in MULTI_FILE else (r for p in inputs for r in reader(p, dropped))
    text = io.StringIO()
    w = csv.DictWriter(text, fieldnames=COLUMNS, lineterminator="\n")
    w.writeheader()
    n, by_type, by_kind, dates = 0, {}, {}, []
    for r in rows:
        w.writerow(r)
        n += 1
        by_type[r["price_type"]] = by_type.get(r["price_type"], 0) + 1
        by_kind[r["kind"]] = by_kind.get(r["kind"], 0) + 1
        if r["at"]:
            dates.append(r["at"])
    body = text.getvalue().encode()

    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_dir / "rows.csv.gz", "wb") as f:   # mtime 0 and no filename: the same rows give the same bytes
        with gzip.GzipFile(filename="", fileobj=f, mode="wb", mtime=0) as g:
            g.write(body)
    manifest = {
        "source": source, "licence": LICENCE[source], "may_model": MAY_MODEL[source], "code_commit": _commit(),
        "inputs": seen, "output": {"file": "rows.csv.gz", "sha256": hashlib.sha256(body).hexdigest(), "columns": list(COLUMNS)},
        "rows": n, "by_price_type": dict(sorted(by_type.items())), "by_kind": dict(sorted(by_kind.items())),
        "at_range": [min(dates), max(dates)] if dates else None, "dropped": dict(sorted(dropped.items())),
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    if log:
        log.job(f"freeze-{source}", "freeze", "done", n=n, source=source, sha256=manifest["output"]["sha256"])
    return manifest


def main(argv: list[str]) -> None:
    source, out_dir, raw = argv[0], Path(argv[1]), [Path(p) for p in argv[2:]]
    expect = {f["file"]: f["sha256"] for f in json.loads((HERE / "sources.json").read_text())[source]["files"]}
    log_dir = Path(__file__).resolve().parents[3] / "logs"
    log_dir.mkdir(exist_ok=True)
    log = create_log("job.freeze", _commit(), tee_sink(stdout_sink, file_sink(str(log_dir / f"freeze-{source}.jsonl"))))
    log.job(f"freeze-{source}", "freeze", "running", source=source, n=len(raw))
    try:
        m = freeze(source, raw, out_dir, expect, log)
    except Exception as e:
        log.error("freeze", e, source=source)
        log.job(f"freeze-{source}", "freeze", "failed", source=source)
        log.end()
        raise
    log.note("frozen", level="info", **{k: m[k] for k in ("source", "rows", "by_price_type", "at_range", "dropped")})
    log.end()


if __name__ == "__main__":
    main(sys.argv[1:])
