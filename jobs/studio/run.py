"""Run studio on folders of casual photos: python3 jobs/studio/run.py <command> [args]

  models <out.json>                     which image and vision models OpenRouter carries now
  slides <items dir> <out dir> [names]  casual photos in, an ordered and checked slide set out
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "log"))
from secondhand_log import create_log, stdout_sink
log = create_log('jobs.studio.run', 'dev', stdout_sink)

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from studio import openrouter  # noqa: E402


def cmd_smoke(out_dir: str) -> None:
    """One read and one render on the tee, to prove the key, the slugs and the answer shapes."""
    os.makedirs(out_dir, exist_ok=True)
    src = open("assets/demo-items/real/marquette-tee/01_cover.jpg", "rb").read()
    rows = []
    for m in ("google/gemini-4-carbon", "google/gemini-4-hydrogen"):
        ans, info = openrouter.read(m, 'Answer JSON {"garment": str, "text_seen": [str]} for this photo.', [src], 800)
        rows.append({"model": m, "answer": ans, **info})
    for m in ("google/gemini-nano-banana-2.1", "google/gemini-3-pro-image", "openai/gpt-5.4-image-2"):
        raw, info = openrouter.render(m, "Return this exact photo with even, soft daylight. Change nothing else.", [src])
        if raw:
            open(os.path.join(out_dir, m.split("/")[1] + ".jpg"), "wb").write(raw)
        rows.append({"model": m, "image": bool(raw), **info})
    json.dump(rows, open(os.path.join(out_dir, "smoke.json"), "w"), indent=1)
    log.note('studio.smoke', rows=rows)


def cmd_models(out_path: str) -> None:
    ms = openrouter.models()
    rows = [{"id": m["id"], "in": m.get("architecture", {}).get("input_modalities"),
             "out": m.get("architecture", {}).get("output_modalities"), "pricing": m.get("pricing")}
            for m in ms if "image" in (m.get("architecture", {}).get("input_modalities") or [])]
    picked = {"image": openrouter.pick(ms, openrouter.IMAGE_PREFS, True),
              "vision": openrouter.pick(ms, openrouter.VISION_PREFS, False)}
    image_out = [r["id"] for r in rows if "image" in (r["out"] or [])]
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w") as f:
        json.dump({"picked": picked, "image_out": image_out, "vision_in": rows}, f, indent=1)
    log.note('studio.models', picked=picked, image_out=image_out)


if __name__ == "__main__":
    cmd, *rest = sys.argv[1:] or ["help"]
    if cmd == "models":
        cmd_models(*rest)
    elif cmd == "smoke":
        cmd_smoke(*rest)
    elif cmd == "slides":
        from studio import slides_run
        slides_run.main(*rest)
    else:
        log.note('studio.usage', usage=__doc__)
