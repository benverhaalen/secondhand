"""Runs on Databricks serverless job compute for T0-1: can a headless Chromium start with a kept profile, how fast, how much memory; and egress."""
import json
import os
import resource
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "log"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from secondhand_log import create_log, stdout_sink
log = create_log('probe.browser', 'dev', stdout_sink)
import tempfile
import time
import urllib.request

out = {}
t = time.monotonic()
try:
    r = subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], capture_output=True, text=True, timeout=600)
    out["install"] = "ok" if r.returncode == 0 else f"exit {r.returncode}: {r.stderr[-300:]}"
    out["install_ms"] = int((time.monotonic() - t) * 1000)
    from playwright.sync_api import sync_playwright

    profile = os.path.join(tempfile.gettempdir(), "sh-profile")
    t = time.monotonic()
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(profile, headless=True)
        page = ctx.new_page()
        page.goto("https://example.com", timeout=30000)
        out["title"] = page.title()
        ctx.close()
    out["cold_start_ms"] = int((time.monotonic() - t) * 1000)
    out["kept_profile"] = os.path.isdir(profile) and bool(os.listdir(profile))
    out["browser"] = "ok"
except Exception as e:  # noqa: BLE001
    out["browser"] = f"failed: {type(e).__name__}: {str(e)[-400:]}"
out["max_rss_mb"] = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss // 1024
for name, url in {"ebay": "https://api.ebay.com", "anthropic": "https://api.anthropic.com", "firecrawl": "https://api.firecrawl.dev"}.items():
    try:
        urllib.request.urlopen(url, timeout=10)
        out[f"egress_{name}"] = "reached"
    except urllib.error.HTTPError as e:
        out[f"egress_{name}"] = f"reached (HTTP {e.code})"
    except Exception as e:  # noqa: BLE001
        out[f"egress_{name}"] = f"blocked: {type(e).__name__}"
log.note('probe.browser.result', result=out)
log.end()
