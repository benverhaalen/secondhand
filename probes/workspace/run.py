"""T0-1: check the workspace before anything is built on it (spec/plans/backend/plan.json T0-1, spec/assessment.md 1.5).

python probes/workspace/run.py --profile Nate --report research/data/nate/workspace-checks.md [--allow-create] [--only id,id]

Every probe runs in parallel with its own timeout and returns a dated verdict: pass, fail or skipped, with what was seen.
The run exits 0 whenever every probe has a verdict (pass or fail alike); 2 only on bad arguments or an unwritable report.
No --profile: every probe is skipped, never a default profile. Probes that create resources need --allow-create.
All text that reaches the report or stdout goes through redact().
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import json
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

CENTRAL = dt.timezone(dt.timedelta(hours=-6), "CST")
TIMEOUT_S = 120

SECRET_PATTERNS = [
    (re.compile(r"dapi[0-9a-f]{16,}(-\d+)?", re.I), "dapi<redacted>"),
    (re.compile(r"dose[0-9a-f]{16,}", re.I), "dose<redacted>"),
    (re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+"), "Bearer <redacted>"),
    (re.compile(r"eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*"), "<jwt redacted>"),
    (re.compile(r"(?i)((?:set-)?cookie\s*[:=]\s*)[^\n;]+"), r"\1<redacted>"),
    (re.compile(r'(?i)("?(?:access_token|refresh_token|token|password|secret|client_secret)"?\s*[:=]\s*)"?[^",\s}]+'), r"\1<redacted>"),
]


def redact(text: str) -> str:
    for pat, rep in SECRET_PATTERNS:
        text = pat.sub(rep, text)
    return text


@dataclass
class Result:
    verdict: str  # pass | fail | skipped
    detail: str
    measured: dict = field(default_factory=dict)


Runner = Callable[[list, float], tuple]  # (args, timeout) -> (exit code, stdout, stderr)


def real_runner(profile: str) -> Runner:
    def run(args: list, timeout: float) -> tuple:
        p = subprocess.run(["databricks", *args, "--profile", profile, "-o", "json"], capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    return run


@dataclass
class Ctx:
    profile: str | None
    cli: Runner
    allow_create: bool
    now: Callable[[], float] = time.monotonic

    def json(self, args: list, timeout: float = 60) -> Any:
        code, out, err = self.cli(args, timeout)
        if code != 0:
            raise RuntimeError(f"`databricks {' '.join(args)}` exited {code}: {(err or out).strip()[:300]}")
        return json.loads(out) if out.strip() else []


def listed(ctx: Ctx, args: list, key: str = "name") -> list:
    d = ctx.json(args)
    if isinstance(d, dict):
        d = next((v for v in d.values() if isinstance(v, list)), [d])
    return [x.get(key, "?") if isinstance(x, dict) else str(x) for x in d]


# ---- probes ---------------------------------------------------------------------------------------------------------

FEATURES = {
    "apps": ["apps", "list"],
    "lakebase_autoscaling": ["postgres", "list-projects"],
    "lakebase_provisioned": ["database", "list-database-instances"],
    "serving_endpoints": ["serving-endpoints", "list"],
    "warehouses": ["warehouses", "list"],
    "clusters": ["clusters", "list"],
    "secret_scopes": ["secrets", "list-scopes"],
    "vector_search": ["vector-search-endpoints", "list-endpoints"],
    "catalogs": ["catalogs", "list"],
}


def p_edition(ctx: Ctx) -> Result:
    seen, broken = {}, {}
    for k, args in FEATURES.items():
        try:
            seen[k] = len(listed(ctx, args))
        except Exception as e:  # noqa: BLE001 - every failure is a recorded finding
            broken[k] = str(e)[:160]
    eps = listed(ctx, FEATURES["serving_endpoints"]) if "serving_endpoints" in seen else []
    only_open = bool(eps) and not any(re.search(r"claude|gpt-5|gpt-6|gemini", e) for e in eps)
    free_like = only_open and seen.get("apps", 0) == 0 and seen.get("lakebase_autoscaling", 0) == 0 and seen.get("clusters", 0) == 0
    detail = f"answered: {seen}; refused: {broken or 'none'}; endpoints only open models: {only_open}"
    edition = "looks like Free Edition (no apps, no Lakebase, no classic clusters, only open-model endpoints)" if free_like else "full or partly provisioned"
    return Result("pass" if not broken else "fail", f"{edition}. {detail}", {"features": seen})


# The models product.md §6 Model allocation names on the gateway.
WANTED_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-sonnet-5"]


def p_gateway(ctx: Ctx) -> Result:
    eps = listed(ctx, FEATURES["serving_endpoints"])
    norm = [e.replace("-", "").replace(".", "") for e in eps]
    found = {m: next((e for e, n in zip(eps, norm) if m.replace("-", "") in n), None) for m in WANTED_MODELS}
    answered = {}
    for m, ep in found.items():
        if not ep:
            continue
        t = ctx.now()
        body = json.dumps({"messages": [{"role": "user", "content": "Say ok."}], "max_tokens": 5})
        try:
            ctx.json(["serving-endpoints", "query", ep, "--json", body], 90)
            answered[m] = f"ok {int((ctx.now() - t) * 1000)} ms"
        except Exception as e:  # noqa: BLE001
            answered[m] = f"error {str(e)[:120]}"
    missing = [m for m, ep in found.items() if not ep]
    detail = f"wanted {WANTED_MODELS}; present {[e for e in found.values() if e]}; answered {answered or 'none'}; missing {missing}; endpoints on workspace: {eps}"
    return Result("pass" if not missing and all(v.startswith("ok") for v in answered.values()) else "fail", detail, {"answered": answered})


def p_open_model_answers(ctx: Ctx) -> Result:
    """The fallback the plan keeps: does an open model on the workspace answer, and how fast."""
    eps = [e for e in listed(ctx, FEATURES["serving_endpoints"]) if "embedding" not in e and "gte" not in e and "bge" not in e]
    if not eps:
        return Result("fail", "no chat endpoint on the workspace")
    ep = next((e for e in eps if "gpt-oss-120b" in e), eps[0])
    t = ctx.now()
    ctx.json(["serving-endpoints", "query", ep, "--json", json.dumps({"messages": [{"role": "user", "content": "Say ok."}], "max_tokens": 16})], 90)
    return Result("pass", f"{ep} answered", {"ms": int((ctx.now() - t) * 1000), "endpoint": ep})


def p_warehouse(ctx: Ctx) -> Result:
    whs = ctx.json(["warehouses", "list"])
    if not whs:
        return Result("fail", "no SQL warehouse")
    w = whs[0]
    t = ctx.now()
    stmt = json.dumps({"warehouse_id": w["id"], "statement": "select 1", "wait_timeout": "50s"})
    r = ctx.json(["api", "post", "/api/2.0/sql/statements", "--json", stmt], 110)
    state = (r.get("status") or {}).get("state") if isinstance(r, dict) else None
    return Result("pass" if state == "SUCCEEDED" else "fail", f"warehouse {w.get('name')} ({w.get('state')} before) -> statement {state}",
                  {"first_statement_ms": int((ctx.now() - t) * 1000), "was": w.get("state")})


def p_secret_scope(ctx: Ctx) -> Result:
    scopes = listed(ctx, FEATURES["secret_scopes"])
    if "secondhand" in scopes:
        return Result("pass", f"scope secondhand present (scopes: {scopes}); values never read")
    if not ctx.allow_create:
        return Result("fail", f"no secondhand scope (scopes: {scopes or 'none'}); create needs --allow-create")
    ctx.json(["secrets", "create-scope", "secondhand"])
    return Result("pass", "created scope secondhand; values never read")


def p_lakebase(ctx: Ctx) -> Result:
    projects = listed(ctx, FEATURES["lakebase_autoscaling"])
    if not ctx.allow_create and "sh-probe" not in projects:
        return Result("fail", f"no Lakebase project (projects: {projects or 'none'}); wake-from-zero and RLS need --allow-create. Fallback: the in-memory or SQL-warehouse-backed store behind the same interface")
    if "sh-probe" not in projects:
        t = ctx.now()
        ctx.json(["postgres", "create-project", "sh-probe", "--json", json.dumps({"spec": {"display_name": "sh-probe"}})], TIMEOUT_S * 4)
        return Result("pass", "created Lakebase project sh-probe; wake and RLS run on the next pass", {"create_ms": int((ctx.now() - t) * 1000)})
    return Result("pass", "Lakebase project sh-probe exists; RLS and wake are checked by db-1's migrations against it")


def p_apps(ctx: Ctx) -> Result:
    apps = listed(ctx, FEATURES["apps"])
    if "sh-probe" in apps:
        a = ctx.json(["apps", "get", "sh-probe"])
        return Result("pass", f"probe app present: {(a.get('compute_status') or {}).get('state')}; front door checks (federated token, unauthenticated webhook, SSE) need its code deployed")
    if not ctx.allow_create:
        return Result("fail", f"no probe app (apps: {apps or 'none'}); the front door checks need --allow-create")
    t = ctx.now()
    ctx.json(["apps", "create", "sh-probe"], TIMEOUT_S * 5)
    return Result("pass", "created app sh-probe", {"create_ms": int((ctx.now() - t) * 1000)})


BROWSER_TASK = Path(__file__).with_name("browser_task.py")


def p_hosted_browser(ctx: Ctx) -> Result:
    """Whether a headless Chromium starts on serverless job compute, its cold start and memory; also egress (assessment 592)."""
    if not ctx.allow_create:
        return Result("fail", "not run: a one-time serverless run needs --allow-create. If no: the own-compute host bp-1 names runs the browser pool")
    me = ctx.json(["current-user", "me"])
    dest = f"/Workspace/Users/{me['userName']}/secondhand-probes/browser_task.py"
    ctx.json(["workspace", "mkdirs", str(Path(dest).parent).replace("\\", "/")])
    ctx.json(["workspace", "import", dest, "--file", str(BROWSER_TASK), "--format", "AUTO", "--overwrite"])
    run = {"run_name": "secondhand-t0-1-browser", "tasks": [{"task_key": "browser", "spark_python_task": {"python_file": dest}, "environment_key": "e"}],
           "environments": [{"environment_key": "e", "spec": {"client": "3", "dependencies": ["playwright==1.49.1"]}}]}
    t = ctx.now()
    r = ctx.json(["jobs", "submit", "--json", json.dumps(run)], TIMEOUT_S * 8)
    state = (r.get("state") or {}) if isinstance(r, dict) else {}
    out = ""
    try:
        task_run = r["tasks"][0]["run_id"]
        out = (ctx.json(["jobs", "get-run-output", str(task_run)]) or {}).get("logs", "")
    except Exception as e:  # noqa: BLE001
        out = f"no output: {e}"
    ok = state.get("result_state") == "SUCCESS" and '"browser": "ok"' in out
    return Result("pass" if ok else "fail", f"run {state.get('result_state')}: {out[-600:]}", {"wall_ms": int((ctx.now() - t) * 1000)})


def p_agent_bricks(ctx: Ctx) -> Result:
    eps = ctx.json(["serving-endpoints", "list"])
    agents = [e["name"] for e in eps if any((s.get("entity_name") or "").startswith("agent") for s in (e.get("config") or {}).get("served_entities", []))
              or e.get("task") in ("agent/v1/chat", "agent/v2/chat", "agent/v1/responses")]
    if agents:
        return Result("pass", f"agent endpoints present: {agents}")
    return Result("fail", "no agent endpoint on the workspace; one Agent Bricks agent with an MLflow trace needs a full workspace with Agent Bricks enabled")


PROBES: dict = {
    "edition": p_edition,
    "gateway_models": p_gateway,
    "open_model_answers": p_open_model_answers,
    "sql_warehouse": p_warehouse,
    "secret_scope": p_secret_scope,
    "lakebase": p_lakebase,
    "apps_front_door": p_apps,
    "hosted_browser": p_hosted_browser,
    "agent_bricks": p_agent_bricks,
}


def run_probe(fn: Callable, ctx: Ctx, timeout: float) -> Result:
    one = cf.ThreadPoolExecutor(1)
    fut = one.submit(fn, ctx)
    one.shutdown(wait=False)  # a hung probe (a sleeping Lakebase) must not hold the run past its timeout
    try:
        return fut.result(timeout=timeout)
    except cf.TimeoutError:
        return Result("fail", f"timed out after {timeout:g} s")
    except subprocess.TimeoutExpired as e:
        return Result("fail", f"timed out after {e.timeout:g} s: {' '.join(map(str, e.cmd[:4]))}")
    except Exception as e:  # noqa: BLE001
        return Result("fail", f"{type(e).__name__}: {e}")


def run_all(ctx: Ctx, only: list | None, timeout: float, probes: dict = PROBES) -> dict:
    chosen = {k: v for k, v in probes.items() if not only or k in only}
    stamp = lambda: dt.datetime.now(CENTRAL).isoformat(timespec="seconds")  # noqa: E731
    if not ctx.profile:
        return {k: (stamp(), Result("skipped", "no profile chosen; pass --profile")) for k in chosen}
    out = {}
    # Each probe waits in its own thread so a hung one cannot hold the others (cancel_futures leaves it to the timeout).
    pool = cf.ThreadPoolExecutor(len(chosen) or 1)
    futs = {k: pool.submit(run_probe, fn, ctx, timeout) for k, fn in chosen.items()}
    for k, f in futs.items():
        out[k] = (stamp(), f.result())
    pool.shutdown(wait=False, cancel_futures=True)
    return out


def report(results: dict, profile: str | None, workspace_id: str | None) -> str:
    lines = [
        "# Workspace checks (T0-1)", "",
        f"Written by `python probes/workspace/run.py`; profile `{profile or 'none'}`, workspace id `{workspace_id or 'unknown'}`. "
        "Each row is one probe's dated verdict; a fail records what was seen and the fallback. No token, cookie or secret appears here.", "",
        "| Probe | Verdict | At (Central) | What was seen | Measured |", "|---|---|---|---|---|",
    ]
    for k, (at, r) in results.items():
        cell = lambda s: str(s).replace("|", "/").replace("\n", " ")  # noqa: E731
        lines.append(f"| {k} | {r.verdict} | {at} | {cell(r.detail)} | {cell(json.dumps(r.measured) if r.measured else '')} |")
    return redact("\n".join(lines) + "\n")


def main(argv: list | None = None, runner: Runner | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile")
    ap.add_argument("--report", required=True)
    ap.add_argument("--only")
    ap.add_argument("--allow-create", action="store_true")
    ap.add_argument("--timeout", type=float, default=TIMEOUT_S * 10)
    try:
        a = ap.parse_args(argv)
    except SystemExit:
        return 2
    ctx = Ctx(a.profile, runner or (real_runner(a.profile) if a.profile else (lambda *_: (1, "", "no profile"))), a.allow_create)
    ws = None
    if a.profile:
        try:
            ws = str(ctx.json(["metastores", "current"]).get("workspace_id", "")) or None
        except Exception:  # noqa: BLE001
            ws = None
    results = run_all(ctx, a.only.split(",") if a.only else None, a.timeout)
    text = report(results, a.profile, ws)
    try:
        Path(a.report).parent.mkdir(parents=True, exist_ok=True)
        Path(a.report).write_text(text, encoding="utf-8")
    except OSError as e:
        print(redact(f"cannot write report: {e}"), file=sys.stderr)
        return 2
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
