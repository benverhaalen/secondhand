import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import run  # noqa: E402

EPS = [{"name": "databricks-gpt-oss-120b"}, {"name": "databricks-gte-large-en"}]


def fake(table):
    def cli(args, timeout):
        for prefix, reply in table.items():
            if " ".join(args).startswith(prefix):
                return reply(args, timeout) if callable(reply) else (0, json.dumps(reply), "")
        return 0, "[]", ""
    return cli


def test_no_profile_skips_every_probe_and_exits_0(tmp_path):
    rep = tmp_path / "r.md"
    assert run.main(["--report", str(rep)]) == 0
    text = rep.read_text()
    assert text.count("| skipped |") == len(run.PROBES)


def test_timeout_records_fail():
    def slow(ctx):
        time.sleep(5)
    ctx = run.Ctx("p", fake({}), False)
    t = time.monotonic()
    res = run.run_all(ctx, None, 0.5, probes={"lakebase": slow, "edition": lambda c: run.Result("pass", "ok")})
    assert time.monotonic() - t < 3
    assert res["lakebase"][1].verdict == "fail" and "timed out" in res["lakebase"][1].detail
    assert res["edition"][1].verdict == "pass"


def test_exit_0_when_probes_fail(tmp_path):
    rep = tmp_path / "r.md"
    boom = lambda args, t: (1, "", "PERMISSION_DENIED")  # noqa: E731
    assert run.main(["--profile", "p", "--report", str(rep)], runner=boom) == 0
    assert "| fail |" in rep.read_text()


def test_no_secret_in_report(tmp_path, capsys):
    leak = "dapi0123456789abcdef0123 Bearer abc.def-ghi eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig Set-Cookie: sid=s3cr3t; token=hunter2"
    rep = tmp_path / "r.md"
    run.main(["--profile", "p", "--report", str(rep)], runner=lambda args, t: (1, "", leak))
    for text in (rep.read_text(), capsys.readouterr().out):
        for bit in ("0123456789abcdef0123", "abc.def-ghi", "eyJzdWIiOiIxIn0", "s3cr3t", "hunter2"):
            assert bit not in text


def test_gateway_fails_naming_missing_claude_models():
    ctx = run.Ctx("p", fake({"serving-endpoints list": EPS}), False)
    r = run.p_gateway(ctx)
    assert r.verdict == "fail" and "claude-opus-5-5" in r.detail


def test_create_probes_do_not_create_without_allow_create():
    calls = []
    def cli(args, t):
        calls.append(args)
        return 0, "[]", ""
    ctx = run.Ctx("p", cli, False)
    for p in (run.p_lakebase, run.p_apps, run.p_secret_scope, run.p_hosted_browser):
        assert p(ctx).verdict == "fail"
    assert not any(a[1].startswith("create") or a[0] == "jobs" for a in calls)


def test_edition_reads_free_edition_shape():
    ctx = run.Ctx("p", fake({"serving-endpoints list": EPS, "catalogs list": [{"name": "workspace"}]}), False)
    assert "Free Edition" in run.p_edition(ctx).detail
