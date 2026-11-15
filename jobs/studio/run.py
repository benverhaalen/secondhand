"""Run studio on folders of casual photos: python3 jobs/studio/run.py <command> [args]

  models <out.json>                     which image and vision models OpenRouter carries now
  slides <items dir> <out dir> [names]  casual photos in, an ordered and checked slide set out
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import openrouter  # noqa: E402


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
    print(json.dumps({"picked": picked, "image_out": image_out}, indent=1))


if __name__ == "__main__":
    cmd, *rest = sys.argv[1:] or ["help"]
    if cmd == "models":
        cmd_models(*rest)
    elif cmd == "slides":
        import slides_run
        slides_run.main(*rest)
    else:
        print(__doc__)
