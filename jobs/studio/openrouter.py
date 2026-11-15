"""The one door to OpenRouter for studio: image renders and the vision reads. Standard library only.

The key comes from OPENROUTER_API_KEY and is never logged, written or returned. Every call returns
(result, info) and never raises on an HTTP error, so a failed candidate is one row in the run, not a crash.
Model slugs are found at run time from the public model list, so a renamed model does not break a run.
"""
from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request

API = "https://openrouter.ai/api/v1"

# Preference order when picking a model by what it can do; the first slug that the live list carries wins.
# Seedream 5.5 first: Ben's pick for relights (product/words.md, 2026-11-14 and 2026-11-15). Its model page is live
# (openrouter.ai/bytedance-seed/seedream-5-5, observed 2026-11-15) but the slug was not on the live list that morning
# (research/studio/ben/slides/runs/*/models.json), so pick() falls through to the next model when it is missing.
IMAGE_PREFS = ("bytedance-seed/seedream-5-5", "google/gemini-nano-banana-2.1", "google/gemini-3-pro-image",
               "openai/gpt-5.4-image-2", "google/gemini-3.1-flash-image")
VISION_PREFS = ("google/gemini-4-carbon", "google/gemini-4-hydrogen", "google/gemini-3-pro", "google/gemini-3-flash",
                "google/gemini-2.5-pro", "google/gemini-2.5-flash", "anthropic/claude", "openai/gpt-5")


def _key() -> str:
    k = os.environ.get("OPENROUTER_API_KEY", "")
    if not k:
        raise SystemExit("OPENROUTER_API_KEY is not set")
    return k


def _post(path: str, body: dict, timeout: int = 300) -> tuple[dict | None, dict]:
    req = urllib.request.Request(API + path, json.dumps(body).encode(), {
        "Authorization": f"Bearer {_key()}", "Content-Type": "application/json",
        "X-Title": "secondhand studio"})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r), {"seconds": round(time.time() - t, 1)}
    except urllib.error.HTTPError as e:
        return None, {"http": e.code, "body": e.read().decode(errors="replace")[:400], "seconds": round(time.time() - t, 1)}
    except Exception as e:  # timeouts and resets are a failed call, not a crashed run
        return None, {"error": type(e).__name__, "seconds": round(time.time() - t, 1)}


def models() -> list[dict]:
    with urllib.request.urlopen(API + "/models", timeout=60) as r:
        return json.load(r)["data"]


def pick(all_models: list[dict], prefs: tuple, needs_image_out: bool) -> list[str]:
    """Slugs from the live list in preference order, filtered by what they can output."""
    def ok(m):
        arch = m.get("architecture", {})
        outs, ins = arch.get("output_modalities", []), arch.get("input_modalities", [])
        return "image" in ins and (("image" in outs) if needs_image_out else ("text" in outs))
    live = [m["id"] for m in all_models if ok(m)]
    out = []
    for p in prefs:
        out += [s for s in live if s.startswith(p) and s not in out and ":" not in s]
    return out


def data_url(img_bytes: bytes, mime: str = "image/jpeg") -> str:
    return f"data:{mime};base64," + base64.b64encode(img_bytes).decode()


def render(model: str, prompt: str, images: list[bytes], seed: int | None = None) -> tuple[bytes | None, dict]:
    """One image edit: the prompt plus reference images in order. Returns the first image the model sends back."""
    content = [{"type": "text", "text": prompt}] + [{"type": "image_url", "image_url": {"url": data_url(b)}} for b in images]
    info: dict = {}
    for modalities in (["image", "text"], ["image"]):
        body = {"model": model, "modalities": modalities, "messages": [{"role": "user", "content": content}]}
        if seed is not None:
            body["seed"] = seed
        out, info = _post("/chat/completions", body)
        if not out:
            continue
        msg = (out.get("choices") or [{}])[0].get("message", {})
        imgs = msg.get("images") or []
        if not imgs:
            info = {**info, "no_image": (msg.get("content") or "")[:300]}
            continue
        url = imgs[0]["image_url"]["url"]
        raw = base64.b64decode(url.split(",", 1)[1]) if url.startswith("data:") else urllib.request.urlopen(url, timeout=120).read()
        return raw, {**info, "usage": out.get("usage"), "model": out.get("model", model)}
    return None, info


def read(model: str, prompt: str, images: list[bytes], max_tokens: int = 4000) -> tuple[dict | None, dict]:
    """A vision read that must answer one JSON object."""
    content = [{"type": "text", "text": prompt}] + [{"type": "image_url", "image_url": {"url": data_url(b)}} for b in images]
    body = {"model": model, "max_tokens": max_tokens, "temperature": 0,
            "response_format": {"type": "json_object"}, "messages": [{"role": "user", "content": content}]}
    out, info = _post("/chat/completions", body, timeout=180)
    if not out:
        return None, info
    text = ((out.get("choices") or [{}])[0].get("message", {}) or {}).get("content") or ""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    try:
        return json.loads(text), {**info, "usage": out.get("usage"), "model": out.get("model", model)}
    except json.JSONDecodeError:
        return None, {**info, "bad_json": text[:300]}
