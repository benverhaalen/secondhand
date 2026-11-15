"""Plan a listing's slides from a handful of casual photos (jobs/studio/slides.json). Pure: no pixels, no network.

look = {"kind": "tee", "photos": [{"id", "role", "side", "zone", "px": [w, h], "sharp": float,
         "item_box": [x0, y0, x1, y1] (0..1), "graphics": [{"zone", "box", "text"}], "flaws": [{"kind", "zone", "box", "severity"}]}]}
role is one of front, back, tag, graphic, flaw, fabric, detail, measure, care, angle. Boxes are fractions of the photo.

plan(look) -> {"kind", "slides": [{"slot", "type", "photo", "crop", "route", "zone", "why"}], "asks": [...], "notes": [...]}
Every rule here is one of slides.json's "rules"; each slide says which one put it there.
"""
from __future__ import annotations

import json
from pathlib import Path

SPEC = json.loads((Path(__file__).parent / "slides.json").read_text())
CLOSE = SPEC["frame"]["close_up_min_px"]
# what a site cap drops first; cover, tag and every flaw are never dropped
DROP_ORDER = ("extra", "detail", "care", "fabric", "measure", "graphic", "back")


def kind_of(name: str) -> str:
    n = (name or "").lower().replace("_", " ")
    if n.replace(" ", "_") in SPEC["kinds"]:
        return n.replace(" ", "_")
    names = sorted(((a, k) for k, v in SPEC["kinds"].items() for a in v["names"]), key=lambda x: -len(x[0]))
    return next((k for a, k in names if a in n), "accessory")  # longest name first: "hooded sweatshirt" is a hoodie


def _best(photos, **match):
    c = [p for p in photos if all(p.get(k) == v for k, v in match.items())]
    return max(c, key=lambda p: p.get("sharp", 0)) if c else None


def _square(box, px, pad=1.6):
    """A square cut around a box, padded, kept inside the photo; returns (box fractions, side in source px)."""
    w, h = px
    x0, y0, x1, y1 = box[0] * w, box[1] * h, box[2] * w, box[3] * h
    side = min(max(x1 - x0, y1 - y0) * pad, w, h)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    ax = min(max(cx - side / 2, 0), w - side)
    ay = min(max(cy - side / 2, 0), h - side)
    return [round(ax / w, 4), round(ay / h, 4), round((ax + side) / w, 4), round((ay + side) / h, 4)], int(side)


def _plain_box(p):
    """A patch of plain fabric on the item away from every print and flaw: the lower middle of the body."""
    ib = p.get("item_box") or [0.1, 0.1, 0.9, 0.9]
    w, hgt = ib[2] - ib[0], ib[3] - ib[1]
    s = 0.22 * min(w, hgt)
    for fx, fy in ((0.5, 0.72), (0.3, 0.6), (0.7, 0.6), (0.5, 0.45)):
        cx, cy = ib[0] + fx * w, ib[1] + fy * hgt
        b = [cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2]
        hits = [g["box"] for g in p.get("graphics", []) + p.get("flaws", [])]
        if not any(b[0] < h[2] and h[0] < b[2] and b[1] < h[3] and h[1] < b[3] for h in hits):
            return b
    return None


def _ask(t, **kw):
    text = SPEC["slide_types"][t]["ask"]
    for k, v in kw.items():
        text = text.replace("{" + k + "}", str(v).replace("_", " "))
    return {"type": t, "text": text, **kw}


RELAY_NEEDS = {"shirt": ("pit_to_pit", "length"), "sweatshirt": ("pit_to_pit", "length")}


def relay_measured(ks: dict, measured: dict, by: str | None = None) -> bool:
    """A re-lay needs the item's measurements from the LiDAR capture (Ben, 09:00 and 09:09: "only allow this from lidar
    flow too"), and a check that can hold the redraw to them. Tops have both. Pants have no ruler yet (measure.py reads
    tops), so they are touched up in place. A tape photo or a typed number does not open it."""
    need = RELAY_NEEDS.get(ks.get("template"))
    return by == "lidar" and bool(need) and all(measured.get(k) for k in need)


def plan(look: dict) -> dict:
    kind = kind_of(look.get("kind", ""))
    ks = SPEC["kinds"][kind]
    photos = look["photos"]
    whole = {s: _best(photos, role=s) for s in ("front", "back")}
    slides, asks, notes = [], [], []
    used = set()
    route = ks["whole_route"]
    if route == "relay" and not relay_measured(ks, look.get("measured") or {}, look.get("measured_by")):
        # Ben, 09:00: the re-lay is for phones that measure (LiDAR). No measurement, nothing to hold a redrawn shape to,
        # so the whole photo is only touched up where it lies
        route = "light"
        notes.append("no LiDAR measurement, so the cover is touched up in place, not re-laid")

    def add(t, p, route, why, crop=None, zone=None, extra=None):
        slides.append({"type": t, "photo": p["id"], "crop": crop, "route": route, "zone": zone, "why": why, **(extra or {})})
        used.add(p["id"])

    # 1. whole-item slides: only ever from a real photo of the same side
    if whole["front"]:
        add("cover", whole["front"], route, "front photo")
    else:
        angle = _best(photos, role="angle")
        if angle:
            add("cover", angle, "level0", "no straight front photo; the best angle stands in, not redrawn")
        asks.append(_ask("cover"))
    if whole["back"]:
        add("back", whole["back"], route, "back photo")
    else:
        asks.append(_ask("back"))
        notes.append("no back photo, so no back slide: a back is never drawn from the front")

    # 2. prints and logos: one slide per zone, from its own close-up, else cut from the whole photo of that side
    seen = []
    for side in ("front", "back"):
        p = whole[side]
        for g in (p or {}).get("graphics", []):
            if g["zone"] in seen:
                continue
            seen.append(g["zone"])
            close = next((q for q in photos if q["role"] == "graphic" and q.get("zone") == g["zone"] and q["id"] not in used), None)
            if close:
                add("graphic", close, "level0", "its own close-up", zone=g["zone"])
                continue
            crop, side_px = _square(g["box"], p["px"])
            if side_px >= CLOSE:
                add("graphic", p, "level0", f"cut from the {side} photo at {side_px} px", crop=crop, zone=g["zone"])
            else:
                asks.append(_ask("graphic", zone=g["zone"]))
                notes.append(f"the {g['zone'].replace('_', ' ')} print is {side_px} px in the {side} photo, under {CLOSE}: asked, not upscaled")
    for q in photos:  # close-ups of prints the whole photos did not box
        if q["role"] == "graphic" and q["id"] not in used:
            add("graphic", q, "level0", "its own close-up", zone=q.get("zone"))

    # 3. the tag is never cut from far away and never redrawn
    tag = _best(photos, role="tag")
    if tag:
        add("tag", tag, "level0", "brand and size")
    elif ks["family"] in ("apparel", "shoes"):
        asks.append(_ask("tag"))

    # 4. every flaw gets a slide; a flaw seen only from far away is cut out, or asked for
    flaws, fz = [], set()
    for q in photos:
        if q["role"] == "flaw":
            key = (q.get("zone"), q.get("flaw_kind"))
            fz.add(key)
            flaws.append(("photo", q, None, key))
    for side in ("front", "back"):
        p = whole[side]
        for f in (p or {}).get("flaws", []):
            key = (f["zone"], f["kind"])
            if key in fz:
                continue
            fz.add(key)
            flaws.append(("cut", p, f, key))
    for how, q, f, key in flaws:
        if how == "photo":
            add("flaw", q, "as_shot", "flaw close-up, as shot", zone=key[0], extra={"flaw": key[1]})
            continue
        crop, side_px = _square(f["box"], q["px"], pad=2.4)
        if side_px >= CLOSE:
            add("flaw", q, "as_shot", f"cut from the {q['role']} photo at {side_px} px", crop=crop, zone=f["zone"],
                extra={"flaw": f["kind"], "severity": f.get("severity")})
        else:
            add("flaw", q, "as_shot", "only seen from far away; shown in place until a close-up comes", crop=crop,
                zone=f["zone"], extra={"flaw": f["kind"], "severity": f.get("severity"), "low_res": True})
            asks.append(_ask("flaw", kind=f["kind"], zone=f["zone"]))

    # 5. fabric and wear: its own close-up, else a plain patch of the cover
    fab = _best(photos, role="fabric")
    if fab:
        add("fabric", fab, "level0", "fabric close-up")
    elif whole["front"]:
        b = _plain_box(whole["front"])
        if b:
            crop, side_px = _square(b, whole["front"]["px"], pad=1.0)
            if side_px >= CLOSE:
                add("fabric", whole["front"], "level0", f"plain patch cut from the front at {side_px} px", crop=crop)

    # 6. the rest of the real photos, each once
    for role, t in (("detail", "detail"), ("measure", "measure"), ("care", "care")):
        for q in sorted([q for q in photos if q["role"] == role and q["id"] not in used], key=lambda q: -q.get("sharp", 0)):
            add(t, q, "level0", role)
    for q in photos:
        if q["id"] not in used:
            add("extra", q, "level0", f"{q['role']} photo, kept")

    rank = {t: i for i, t in enumerate(ks["order"] + ["extra"])}
    slides.sort(key=lambda s: rank.get(s["type"], 99))  # stable: within a type, the order they were added
    for i, s in enumerate(slides, 1):
        s["slot"] = i
    if ks["measurements"] and not any(s["type"] == "measure" for s in slides):
        notes.append("no tape photo: measurements for " + ", ".join(ks["measurements"]) + " come from capture; the redraw's shape is checked against the real photo only when that photo is laid flat")
        if ks["whole_route"] == "relay":
            asks.append(_ask("measure", name=ks["measurements"][0]))
    return {"kind": kind, "whole_route": route, "slides": slides, "asks": asks, "notes": notes}


def for_site(p: dict, cap: int) -> dict:
    """Cut a plan to a site's photo cap. Cover, tag and flaws stay; past the cap a flaw goes to the description."""
    slides = list(p["slides"])
    dropped = []
    for t in DROP_ORDER:
        while len(slides) > cap:
            c = [s for s in slides if s["type"] == t]
            if not c:
                break
            slides.remove(c[-1])
            dropped.append(c[-1]["slot"])
    flaw_in_text = []
    while len(slides) > cap:  # only cover, tag and flaws are left past here
        f = [s for s in slides if s["type"] == "flaw"]
        if not f:
            break
        slides.remove(f[-1])
        flaw_in_text.append(f[-1]["slot"])
    return {"slots": [s["slot"] for s in slides], "dropped": dropped, "flaw_in_text": flaw_in_text}
