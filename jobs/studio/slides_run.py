"""Casual photos in, a checked slide set out. Called as: python3 jobs/studio/run.py slides <items dir> <out dir> [item ...]

Per item folder: read the photos once (look.py), plan the slides (plan.py), make each slide by its route, check every
redrawn slide (check.py and the judge), and write:
  <item>/slide_NN_<type>.jpg   the set in order, 1080 px square, no text or border drawn on
  <item>/whole_<type>.jpg      the real photo, every candidate and the reason each was kept or dropped
  <item>/before_after.jpg      the photos as given, then the set
  <item>/manifest.json         the read, the plan, every check number, and which pixels a model drew (ai_marked)
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageOps

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from studio import check as C  # noqa: E402
from studio import look as L  # noqa: E402
from studio import openrouter  # noqa: E402
from studio import plan as P  # noqa: E402
from studio import measure as M  # noqa: E402
from lay import wrinkle  # noqa: E402  (research/studio/ben/prototype, on the path through check.py)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TEMPLATES = os.path.join(ROOT, "research", "studio", "ben", "templates")
VISION = ["google/gemini-4-carbon", "google/gemini-4-hydrogen", "google/gemini-2.5-pro"]
# candidates per whole slide: Nano Banana 2.1 is fast and cheap (6.8 s, $0.037 in the smoke run), Gemini 3 Pro Image a
# second opinion ($0.14); GPT image 2 took 95 s and is left out of the default
CANDIDATES = [("google/gemini-nano-banana-2.1", 1), ("google/gemini-nano-banana-2.1", 2), ("google/gemini-nano-banana-2.1", 3),
              ("google/gemini-nano-banana-2.1", 4), ("google/gemini-3-pro-image", 1)]
SIDE = 1080
STEAM_TOP = 2  # the two smoothest redraws that passed get a second pressing
STEAM_WITH = [("google/gemini-nano-banana-2.1", 1), ("google/gemini-nano-banana-2.1", 2)]

IRONED = ("Freshly steamed and pressed: the fabric lies taut, smooth and flat across the whole body and every sleeve or leg, "
          "as if it was just ironed on a board. Remove every crumple, fold line, ripple, pucker and crease, and the soft "
          "shadows they cast; the light falls evenly across the cloth. Only seams, hems, ribbing and pockets keep their "
          "shape. Wear is not a wrinkle: fading, discoloration, pilling, stains and thinning stay exactly where they are, at "
          "the same strength. The fabric is the same worn fabric with its real weave; it is not new, not glossy, not a flat "
          "graphic.")

RELAY = """Image 1 is a real phone photo of this exact second-hand {name}, lying on the floor. Image 2 is a blank layout guide:
a dashed outline showing where a {template} sits in a square frame. {refs}

Return image 1 as a clean listing photo: the same {name}, laid flat inside the outline from image 2 and squared to the
frame, seen from straight above, filling the outline. The lay: {look}. Do not draw the outline.

{ironed}

{tuck}

Nothing else about the item changes: the same color, the same fabric and fading, the same proportions of body, {limbs},
every print and logo at the same size and the same place with every letter exactly as in the photos{flaws}.
Keep the same floor surface and the same soft daylight as image 1. No studio backdrop, no props, no added text, labels,
tags, buttons or logos."""

# a second pass on a redraw that passed: models editing a photo keep most of its shading, so one more pressing helps
STEAM = """This is a listing photo of a second-hand {name}. Press it: remove the remaining wrinkles, creases, puckers and
crumple shadows so the fabric lies taut and smooth, as if just steamed. Change nothing else at all: the same outline,
size, position and lay, the same color, every print, letter and logo exactly as it is, the same fading, stains and wear
in the same places, the same floor and light. No added text, tags, labels or logos."""

LIGHT = """Touch up image 1. This is a real photo of a used {name} for a resale listing. Keep everything where it is: the same
surface, the same framing, the same position, size and shape of the {name}, its true color, texture, every print and logo,
and every sign of wear, crease, scuff or flaw exactly as it is. Do not replace the background, do not add or remove anything.
Change only the light: even, soft daylight, lifted shadows, neutral white balance, so it looks like the same photo taken on a
brighter day."""


def rgb(path_or_bytes) -> np.ndarray:
    im = Image.open(io.BytesIO(path_or_bytes) if isinstance(path_or_bytes, bytes) else path_or_bytes)
    return np.asarray(ImageOps.exif_transpose(im).convert("RGB"))


def jpeg(img: np.ndarray, q: int = 90) -> bytes:
    b = io.BytesIO()
    Image.fromarray(img).save(b, "JPEG", quality=q)
    return b.getvalue()


def sharp(img: np.ndarray) -> float:
    g = cv2.cvtColor(C.fit(img, 720), cv2.COLOR_RGB2GRAY)
    return float(cv2.Laplacian(g, cv2.CV_64F).var())


def level0(img: np.ndarray) -> np.ndarray:
    """True color only: one exposure gain on all three channels, so no hue moves; at most +25%."""
    y = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    g = min(1.25, max(1.0, 242.0 / max(np.percentile(y, 99.5), 1)))
    return np.clip(img.astype(np.float32) * g, 0, 255).astype(np.uint8)


def square(img: np.ndarray, crop=None, side: int = SIDE) -> np.ndarray:
    h, w = img.shape[:2]
    if crop:
        x0, y0, x1, y1 = (int(round(v)) for v in (crop[0] * w, crop[1] * h, crop[2] * w, crop[3] * h))
        img = img[y0:y1, x0:x1]
    h, w = img.shape[:2]
    s = min(h, w)  # a non-square photo is cut to its centre square, never padded (eBay bans borders)
    img = img[(h - s) // 2:(h - s) // 2 + s, (w - s) // 2:(w - s) // 2 + s]
    return cv2.resize(img, (side, side), interpolation=cv2.INTER_AREA if s >= side else cv2.INTER_CUBIC)


def print_refs(look: dict, side: str, photos_by_id: dict) -> list[dict]:
    """Real close-ups of each print on this side, with the print's box on them: its own close-up photo, else a cut
    from the whole photo (whose box is the cut minus its padding)."""
    whole = next((p for p in look["photos"] if p["role"] == side), None)
    out = []
    for g in (whole or {}).get("graphics", []):
        close = next((p for p in look["photos"] if p["role"] == "graphic" and p.get("zone") == g["zone"]), None)
        if close:
            boxes = sorted(close.get("graphics", []), key=lambda q: -(q["box"][2] - q["box"][0]) * (q["box"][3] - q["box"][1]))
            out.append({"img": photos_by_id[close["id"]], "box": boxes[0]["box"] if boxes else None})
        else:
            img = photos_by_id[whole["id"]]
            pad = 1.3
            box, _ = P._square(g["box"], [img.shape[1], img.shape[0]], pad=pad)
            h, w = img.shape[:2]
            inner = (1 - 1 / pad) / 2
            out.append({"img": img[int(box[1] * h):int(box[3] * h), int(box[0] * w):int(box[2] * w)],
                        "box": [inner, inner, 1 - inner, 1 - inner]})
    return out


def make_whole(slide: dict, look: dict, ks: dict, photos_by_id: dict, log: list) -> dict:
    src = photos_by_id[slide["photo"]]
    side = "back" if slide["type"] == "back" else "front"
    refs = print_refs(look, side, photos_by_id)
    name = look.get("name") or ks["names"][0]
    flaws = [f"{f['kind']} on the {f['zone'].replace('_', ' ')}" for p in look["photos"] if p["id"] == slide["photo"] for f in p.get("flaws", [])]
    if slide["route"] == "relay":
        tpl = rgb(os.path.join(TEMPLATES, f"{ks['template']}_1x1.png"))
        prompt = RELAY.format(
            name=name, template=ks["template"], look=ks["whole_look"], ironed=IRONED, tuck=ks.get("tuck", ""),
            limbs="legs and waist" if ks["template"] == "pants" else "sleeves and collar",
            refs=(f"Images 3 to {2 + min(len(refs), 2)} are real close-ups of the same item, only to show its true prints, letters and color."
                  if refs else ""),
            flaws=("; and these flaws stay exactly where they are: " + "; ".join(flaws)) if flaws else "")
        inputs = [jpeg(C.fit(src, 1280)), jpeg(tpl)] + [jpeg(C.fit(r["img"], 1024)) for r in refs[:2]]
    else:
        prompt = LIGHT.format(name=name)
        inputs = [jpeg(C.fit(src, 1280))]

    def one(cand):
        model, seed = cand
        raw, info = openrouter.render(model, prompt, inputs, seed=seed)
        return {"model": model, "seed": seed, "raw": raw, "info": {k: v for k, v in info.items() if k != "usage"},
                "cost": (info.get("usage") or {}).get("cost")}

    with ThreadPoolExecutor(5) as ex:
        cands = list(ex.map(one, CANDIDATES))
    real_bytes = [jpeg(C.fit(src, 1024))] + [jpeg(C.fit(r["img"], 768)) for r in refs[:2]]
    s_fit = C.fit(src)
    w_src = wrinkle(s_fit, C.mask_of(s_fit))

    def grade(c):
        if not c["raw"]:
            c.update(ok=False, reasons=["no image came back: " + json.dumps(c["info"])[:160]])
            return
        ren = rgb(c["raw"])
        if slide["route"] == "relay":
            laid = next((p.get("laid_well") for p in look["photos"] if p["id"] == slide["photo"]), True)
            r = C.check(src, ren, ks["template"], refs, look.get("tape_ratio"), laid_well=bool(laid))
        else:  # in place: the original gate, which aligns the render onto the photo and keeps the background
            r = in_place_check(src, ren)
        j, jinfo = (None, {})
        for m in VISION:
            j, jinfo = C.judge(m, name, real_bytes, jpeg(C.fit(r["image"], 1024)), flaws)
            if j:
                break
        c["judge"] = j
        c["reasons"] = r["reasons"] + C.judge_blocks(j)
        c["numbers"] = r["numbers"]
        w = wrinkle(C.fit(r["image"]), C.mask_of(C.fit(r["image"])))
        c["numbers"]["wrinkle"] = {"photo": round(w_src, 2), "render": round(w, 2), "left": round(w / max(w_src, 1e-6), 3)}
        c["repairs"] = r.get("repairs", [])
        c["ok"] = not c["reasons"]
        c["image"] = r["image"]

    for c in cands:
        grade(c)
    if slide["route"] == "relay":
        first = sorted((c for c in cands if c.get("ok")), key=lambda c: c["numbers"]["wrinkle"]["left"])[:STEAM_TOP]
        steam = [(c, m, sd) for c in first for m, sd in STEAM_WITH]
        with ThreadPoolExecutor(5) as ex:
            more = list(ex.map(lambda t: steam_one(t[0], t[1], t[2], name), steam))
        for c in more:
            grade(c)
        cands += more
    passed = [c for c in cands if c.get("ok")]
    # smoothest first: the checks already hold the item to the real one, so among what passed, fewer wrinkles wins
    passed.sort(key=lambda c: (round(c["numbers"].get("wrinkle", {}).get("left", 1), 2), c["numbers"].get("color", 9)))
    for c in cands:
        log.append({"slide": slide["type"], "model": c["model"], "seed": c["seed"], "pass": c.get("pass", 1), "from": c.get("from"), "ok": c.get("ok"), "reasons": c.get("reasons"),
                    "numbers": c.get("numbers"), "repairs": c.get("repairs"), "judge": c.get("judge"), "cost": c.get("cost"), "seconds": c["info"].get("seconds")})
    if passed:
        win = passed[0]
        return {"image": square(win["image"]), "how": slide["route"], "ai_marked": True, "model": win["model"], "seed": win["seed"],
                "pass": win.get("pass", 1), "from": win.get("from"), "cand": cands.index(win), "cands": cands, "src": src}
    return {"image": square(level0(src)), "how": "level0", "ai_marked": False, "fallback": "every redraw was dropped; the real photo is used",
            "cands": cands, "src": src}


def steam_one(c: dict, model: str, seed: int, name: str) -> dict:
    """Press a redraw that passed once more. The result is a new candidate, checked again against the real photos from
    scratch: the first pass passing proves nothing about the second."""
    raw, info = openrouter.render(model, STEAM.format(name=name), [jpeg(C.fit(c["image"], 1280))], seed=seed)
    return {"model": model, "seed": seed, "pass": 2, "from": f"{c['model'].split('/')[1]} seed {c['seed']}", "raw": raw,
            "info": {k: v for k, v in info.items() if k != "usage"}, "cost": (info.get("usage") or {}).get("cost")}


def measure_audit(src: np.ndarray, cands: list, win: int | None, final: np.ndarray, tape: dict) -> dict:
    """The tape against three pictures of the same item: the phone photo, the redraw as the model drew it, and the slide
    as published. Each is calibrated on its length and tested on its pit to pit (measure.py)."""
    rows = {"photo": C.fit(src), "final": C.fit(final)}
    if win is not None and cands[win].get("raw"):
        rows["drawn"] = C.fit(rgb(cands[win]["raw"]))
    out = {}
    for k, im in rows.items():
        mx = M.measure(C.mask_of(im), tape.get("length"))
        out[k] = {**M.against_tape(mx, tape), **{a: mx.get(a) for a in ("length_px", "pit_px", "note")}}
    return out


def in_place_check(src, ren):
    from gate import gate  # research/studio/ben/prototype, on the path through check.py
    s, r = C.fit(src), cv2.resize(C.fit(ren), (C.fit(src).shape[1], C.fit(src).shape[0]))
    m = C.mask_of(s)
    g = gate(s, r, m, {}, keep_background=True)
    reasons = [] if g["verdict"] == "pass" else [g["verdict"]]
    nums = {k: round(v[0], 3) for k, v in g.items() if isinstance(v, tuple)}
    return {"reasons": reasons, "numbers": nums, "image": r}


def label(img: Image.Image, text: str, color=(0, 0, 0)) -> Image.Image:
    out = Image.new("RGB", (img.width, img.height + 54), "white")
    out.paste(img, (0, 54))
    d = ImageDraw.Draw(out)
    y = 4
    for line in text.split("\n")[:3]:
        d.text((6, y), line[:70], fill=color)
        y += 16
    return out


def sheet(tiles: list[Image.Image], cols: int, side: int = 360) -> Image.Image:
    rows = (len(tiles) + cols - 1) // cols
    th = max(t.height for t in tiles)
    out = Image.new("RGB", (cols * side, rows * th), "white")
    for i, t in enumerate(tiles):
        out.paste(t, ((i % cols) * side, (i // cols) * th))
    return out


def tile(img: np.ndarray, text: str, side: int = 360, color=(0, 0, 0)) -> Image.Image:
    im = Image.fromarray(img)
    im.thumbnail((side, side))
    pad = Image.new("RGB", (side, side), "white")
    pad.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    return label(pad, text, color)


def run_item(folder: str, out: str) -> dict:
    t0 = time.time()
    paths = sorted(os.path.join(folder, f) for f in os.listdir(folder) if f.lower().endswith((".jpg", ".jpeg", ".png")))
    ids = [os.path.splitext(os.path.basename(p))[0] for p in paths]
    imgs = {i: rgb(p) for i, p in zip(ids, paths)}
    ans, info = None, {}
    for m in VISION:
        ans, info = L.look(paths, list(P.SPEC["kinds"]), m)
        if ans:
            break
    if not ans:
        return {"item": os.path.basename(folder), "error": "no read", "info": info}
    look = L.to_plan_input(ans, paths, ids)
    for p in look["photos"]:
        p["sharp"] = sharp(imgs[p["id"]])
    meas = {(p.get("measure") or {}).get("name"): (p.get("measure") or {}).get("value_in") for p in look["photos"] if p.get("measure")}
    meas_from = "read off the tape photos"
    if os.path.exists(os.path.join(folder, "tape.json")):  # the seller's own numbers win over what the model read off a photo
        with open(os.path.join(folder, "tape.json")) as f:
            meas = {**meas, **{k: v for k, v in json.load(f).items() if isinstance(v, (int, float))}}
        meas_from = "tape.json"
    kind = P.kind_of(look["kind"])
    ks = P.SPEC["kinds"][kind]
    if ks["template"] in ("shirt", "sweatshirt") and meas.get("pit_to_pit") and meas.get("length"):
        look["tape_ratio"] = meas["pit_to_pit"] / meas["length"]
    pl = P.plan(look)
    os.makedirs(out, exist_ok=True)
    log, made = [], []
    audit = None
    for s in pl["slides"]:
        src = imgs[s["photo"]]
        if s["type"] in ("cover", "back") and s["route"] in ("relay", "light"):
            r = make_whole(s, look, ks, imgs, log)
            whole_tiles = [tile(level0(r["src"]), "real photo")]
            for k, c in enumerate(r["cands"]):
                if c.get("raw"):  # every candidate as the model drew it, for the planted-lie bench and for review
                    Image.fromarray(C.fit(rgb(c["raw"]), 1024)).save(os.path.join(out, f"cand_{s['type']}_{k}.jpg"), quality=88)
                if c.get("image") is not None:
                    tag = "KEPT" if c.get("ok") else "DROPPED"
                    whole_tiles.append(tile(c["image"], f"{tag} {c['model'].split('/')[1]} seed {c['seed']}\n" + "; ".join(c.get("reasons") or ["passed every check"]),
                                            color=(0, 110, 0) if c.get("ok") else (170, 0, 0)))
            sheet(whole_tiles, len(whole_tiles)).save(os.path.join(out, f"whole_{s['type']}.jpg"), quality=86)
            img, how, ai, extra = r["image"], r["how"], r["ai_marked"], {k: r[k] for k in ("model", "seed", "pass", "from", "cand", "fallback") if k in r}
        elif s["route"] == "as_shot":
            img, how, ai, extra = square(src, s["crop"]), "as_shot", False, {}
        else:
            img, how, ai, extra = square(level0(src), s["crop"]), "level0", False, {}
        fn = f"slide_{s['slot']:02d}_{s['type']}.jpg"
        Image.fromarray(img).save(os.path.join(out, fn), quality=90)
        made.append({**s, "file": fn, "how": how, "ai_marked": ai, **extra})
        if s["type"] == "cover" and ks["template"] in ("shirt", "sweatshirt") and s["route"] in ("relay", "light"):
            audit = measure_audit(src, r.get("cands", []), extra.get("cand"), img, meas)
    before = sheet([tile(imgs[i], f"as taken: {i}") for i in ids], max(4, len(ids)))
    after = sheet([tile(np.asarray(Image.open(os.path.join(out, m["file"]))), f"{m['slot']}. {m['type']}" + (f" ({m['zone']})" if m.get('zone') else "")
                        + ("\nredrawn, checked" if m["ai_marked"] else "\nreal photo" + (", cut" if m.get("crop") else "")))
                   for m in made], max(4, len(ids)))
    both = Image.new("RGB", (max(before.width, after.width), before.height + after.height + 20), "white")
    both.paste(before, (0, 0))
    both.paste(after, (0, before.height + 20))
    both.save(os.path.join(out, "before_after.jpg"), quality=86)
    sites = {site: P.for_site({"slides": made}, cap) for site, cap in (("depop", 8), ("mercari", 12), ("ebay", 24), ("facebook", 10))}
    man = {"item": os.path.basename(folder), "kind": kind, "read": ans, "read_model": info.get("model"), "plan": pl, "slides": made,
           "sites": sites, "tape": {"inches": meas, "from": meas_from}, "measure_audit": audit, "candidates": log, "seconds": round(time.time() - t0, 1),
           "cost": round(sum(c.get("cost") or 0 for c in log), 4)}
    with open(os.path.join(out, "manifest.json"), "w") as f:
        json.dump(man, f, indent=1, default=str)
    return {k: man[k] for k in ("item", "kind", "seconds", "cost")} | {
        "slides": [f"{m['type']}:{m['how']}" for m in made], "asks": [a["text"] for a in pl["asks"]],
        "whole": [(c["slide"], c["model"].split("/")[1], c["ok"], c["reasons"]) for c in log]}


def main(items_dir: str, out_dir: str, *names: str) -> None:
    names = names or tuple(sorted(n for n in os.listdir(items_dir) if os.path.isdir(os.path.join(items_dir, n))))
    rows = []
    for n in names:
        r = run_item(os.path.join(items_dir, n), os.path.join(out_dir, n))
        print(json.dumps(r, default=str), flush=True)
        rows.append(r)
    with open(os.path.join(out_dir, "summary.json"), "w") as f:
        json.dump(rows, f, indent=1, default=str)
