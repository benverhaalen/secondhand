"""Read a handful of casual photos once: what each photo is, where every print and flaw sits, and what the tag says.

One vision call per item, all photos in it, so the model can tell the front from the back and a print close-up from a
flaw. Boxes come back as [ymin, xmin, ymax, xmax] on 0..1000 (the convention Gemini is trained on) and leave here as
[x0, y0, x1, y1] fractions, the shape plan.py takes.
"""
from __future__ import annotations

import io
import json

from PIL import Image, ImageOps

from studio import openrouter

ROLES = ["front", "back", "angle", "tag", "graphic", "flaw", "fabric", "detail", "measure", "care", "other"]

PROMPT = """These {n} photos are one second-hand item a person is selling, taken casually with a phone, in no set order.
Photo numbers start at 0. Describe them for building a listing. Be literal: report only what is visible.

Answer one JSON object:
{{
 "kind": one of {kinds},
 "name": short plain name with brand and colour, e.g. "gold Fruit of the Loom Marquette tee",
 "item_text": every word printed, stitched or patched on the item itself (not the tag), exactly as written,
 "tag_text": the brand and size label exactly as written, or "",
 "photos": [ {{
   "index": int,
   "role": one of {roles}. front/back = the whole item seen straight on from that side; angle = the whole item seen at a slant;
           graphic = a close-up of a print, logo or patch; flaw = a close-up whose point is damage;
           fabric = a close-up of plain fabric; detail = a close-up of a part (cuff, pocket, waistband, hood, sole);
           measure = a tape or ruler across the item; care = care or fibre label; tag = brand and size label,
   "side": "front", "back" or null,
   "zone": for close-ups, where on the item, e.g. chest_centre, left_chest, full_back, back_pocket, cuff, hem, hood; else null,
   "item_box": [ymin, xmin, ymax, xmax] of the whole item on 0..1000, for front, back and angle photos; else null,
   "graphics": for front, back and angle photos, each print, logo or patch: {{"zone": str, "box": [ymin, xmin, ymax, xmax], "text": exact letters or ""}},
   "flaws": every stain, hole, crack in a print, pull, pilling patch, missing button or tear you can actually see:
            {{"kind": str, "zone": str, "box": [ymin, xmin, ymax, xmax], "severity": "minor" or "major", "sure": true or false}},
   "measure": for measure photos, {{"name": "pit_to_pit", "length", "sleeve", "waist" or "inseam", "value_in": number or null}}; else null,
   "wrinkled": 0 none to 3 crumpled, for front and back photos,
   "laid_well": true if a front or back photo shows the item flat, straight and complete (no folded sleeve or leg)
 }} ]
}}
Wear that is normal for the age (even fading, softness) is not a flaw. Do not guess at flaws you cannot see."""


def small_jpeg(path: str, side: int = 1024) -> bytes:
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    im.thumbnail((side, side))
    b = io.BytesIO()
    im.save(b, "JPEG", quality=88)
    return b.getvalue()


def _box(b):
    if not b or len(b) != 4:
        return None
    y0, x0, y1, x1 = (max(0.0, min(1.0, v / 1000)) for v in b)
    return [x0, y0, x1, y1] if x1 > x0 and y1 > y0 else None


def look(paths: list[str], kinds: list[str], model: str) -> tuple[dict | None, dict]:
    imgs = [small_jpeg(p) for p in paths]
    prompt = PROMPT.format(n=len(paths), kinds=json.dumps(kinds), roles=json.dumps(ROLES))
    ans, info = openrouter.read(model, prompt, imgs, max_tokens=6000)
    return ans, info


def to_plan_input(ans: dict, paths: list[str], ids: list[str]) -> dict:
    """The model's answer in plan.py's shape, with each photo's real pixel size."""
    photos = []
    for p in ans.get("photos", []):
        i = p.get("index")
        if not isinstance(i, int) or not 0 <= i < len(paths):
            continue
        w, h = ImageOps.exif_transpose(Image.open(paths[i])).size
        role = p.get("role") if p.get("role") in ROLES else "other"
        photos.append({
            "id": ids[i], "file": paths[i], "role": role, "side": p.get("side"), "zone": p.get("zone"), "px": [w, h],
            "item_box": _box(p.get("item_box")),
            "graphics": [{"zone": g.get("zone") or "print", "box": _box(g.get("box")), "text": g.get("text", "")}
                         for g in p.get("graphics") or [] if _box(g.get("box"))],
            "flaws": [{"kind": f.get("kind", "flaw"), "zone": f.get("zone") or "item", "box": _box(f.get("box")),
                       "severity": f.get("severity", "minor")}
                      for f in p.get("flaws") or [] if _box(f.get("box")) and f.get("sure")],
            "unsure_flaws": [f for f in p.get("flaws") or [] if not f.get("sure")],
            "flaw_kind": (p.get("flaws") or [{}])[0].get("kind") if role == "flaw" else None,
            "measure": p.get("measure"), "wrinkled": p.get("wrinkled"), "laid_well": p.get("laid_well"),
        })
    seen = {q["id"] for q in photos}
    for i, pid in enumerate(ids):  # a photo the model skipped is still the person's photo: it stays, as "other"
        if pid not in seen:
            w, h = Image.open(paths[i]).size
            photos.append({"id": pid, "file": paths[i], "role": "other", "px": [w, h], "graphics": [], "flaws": []})
    return {"kind": ans.get("kind", ""), "name": ans.get("name", ""), "item_text": ans.get("item_text") or [],
            "tag_text": ans.get("tag_text", ""), "photos": photos}
