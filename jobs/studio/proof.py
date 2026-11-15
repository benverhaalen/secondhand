"""The tape against the pictures: does a published redraw keep the item's real measurements?

  python3 jobs/studio/proof.py <run dir> <items dir> <out dir>

For every top in the run whose seller taped pit to pit and length (tape.json in the item folder, else what the run read
off the tape photos), three pictures of the same item are measured with measure.py:
  photo   the phone photo as taken
  drawn   the winning redraw exactly as the image model returned it, before any check or repair
  final   the cover slide as published
Each is calibrated on its length (a photo has no scale of its own), then its pit to pit is read in inches and set against
the tape. Writes per item: <name>.png for each picture with the two tape lines drawn on and nothing else (for the site
and the pitch to set their own type on), proof.json with every number, and preview.jpg, a captioned working sheet in a
stand-in face. Also bench.json: the published slide stretched and squeezed on purpose, to show the ruler sees it.
"""
from __future__ import annotations

import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from studio import check as C  # noqa: E402
from studio import measure as M  # noqa: E402
from studio import scale as S  # noqa: E402

BAND = 0.05      # agent proposal: a published top reads within 5% of the tape (about one inch on a 21 in chest)
TAPE_READ = 0.25  # inches: how well a person reads a cloth tape laid on a garment
TOPS = ("tee", "long_sleeve", "sweatshirt", "hoodie", "jacket")
STRETCH = (0.88, 0.92, 0.95, 0.97, 1.03, 1.05, 1.08, 1.12)


def rgb(path: str) -> np.ndarray:
    return np.asarray(ImageOps.exif_transpose(Image.open(path)).convert("RGB"))


def draw_lines(img: np.ndarray, mx: dict) -> np.ndarray:
    """White tape lines with an ink edge and end ticks, so they read on any cloth and any floor."""
    v = img.copy()
    s = max(img.shape[:2]) / 1080
    for key in ("length_line", "pit_line"):
        if not mx.get(key):
            continue
        p, q = (np.array(a) for a in mx[key])
        d = (q - p) / max(np.linalg.norm(q - p), 1)
        n = np.array([-d[1], d[0]]) * 14 * s
        segs = [(p, q), (p - n, p + n), (q - n, q + n)]
        for width, col in ((int(7 * s), (10, 10, 10)), (int(3 * s) or 1, (255, 255, 255))):
            for a, b in segs:
                cv2.line(v, tuple(int(x) for x in a), tuple(int(x) for x in b), col, width, cv2.LINE_AA)
    return v


def winner_raw(run_item: str, man: dict) -> str | None:
    cover = next((s for s in man["slides"] if s["type"] == "cover"), {})
    if not cover.get("ai_marked"):
        return None
    k = cover.get("cand")
    if k is None:  # runs before the index was recorded: the k-th cover candidate with the winner's model and seed
        covers = [c for c in man["candidates"] if c["slide"] == "cover"]
        k = next((i for i, c in enumerate(covers) if c["model"] == cover.get("model") and c["seed"] == cover.get("seed")), None)
    covers = [c for c in man["candidates"] if c["slide"] == "cover"]
    if k is not None and cover.get("pass", 1) == 2 and cover.get("from"):
        # a second pressing starts from a redraw the check already repaired; "as drawn" means the model's first draw
        k = next((i for i, c in enumerate(covers) if c.get("pass", 1) == 1
                  and f"{c['model'].split('/')[1]} seed {c['seed']}" == cover["from"]), None)
    p = os.path.join(run_item, f"cand_cover_{k}.jpg")
    return p if k is not None and os.path.exists(p) else None


def tape_of(item_dir: str, man: dict) -> dict:
    t = (man.get("tape") or {}).get("inches") or {}
    if not t:
        for p in man["read"]["photos"]:
            m = p.get("measure") or {}
            if m.get("name") and m.get("value_in"):
                t[m["name"]] = m["value_in"]
    f = os.path.join(item_dir, "tape.json")
    if os.path.exists(f):
        with open(f) as fh:
            t = {**t, **{k: v for k, v in json.load(fh).items() if isinstance(v, (int, float))}}
    return t


def item(run_item: str, item_dir: str, out: str) -> dict | None:
    with open(os.path.join(run_item, "manifest.json")) as f:
        man = json.load(f)
    tape = tape_of(item_dir, man)
    cover = next((s for s in man["slides"] if s["type"] == "cover"), None)
    if not cover:
        return None
    pics = {"photo": os.path.join(item_dir, cover["photo"] + ".jpg"), "drawn": winner_raw(run_item, man),
            "final": os.path.join(run_item, cover["file"])}
    os.makedirs(out, exist_ok=True)
    rows = {}
    ruler = print_ruler(item_dir, man) if tape.get("print_width") else None
    for k, path in pics.items():
        if not path or not os.path.exists(path):
            rows[k] = {"tested": False, "note": "no such picture"}
            continue
        im = C.fit(rgb(path))
        mx = M.measure(C.mask_of(im), tape.get("length"), im)
        Image.fromarray(draw_lines(im, mx)).save(os.path.join(out, f"{k}.png"))
        rows[k] = {**M.against_tape(mx, tape), "note": mx.get("note"), "length_px": mx["length_px"], "pit_px": mx.get("pit_px"),
                   "file": os.path.relpath(path)}
        if ruler:  # the print as the ruler: both numbers are tests, nothing is calibrated on the tape
            sc = S.print_px_per_inch(ruler["img"], im, ruler["box"], tape["print_width"])
            if sc:
                by = {"px_per_in": sc["px_per_in"], "length_in": round(mx["length_px"] / sc["px_per_in"], 2)}
                by["length_off"] = round(by["length_in"] / tape["length"] - 1, 4) if tape.get("length") else None
                if mx.get("pit_px"):
                    by["pit_in"] = round(mx["pit_px"] / sc["px_per_in"], 2)
                    by["pit_off"] = round(by["pit_in"] / tape["pit_to_pit"] - 1, 4) if tape.get("pit_to_pit") else None
                rows[k]["by_print"] = by
            else:
                rows[k]["by_print"] = {"note": "the print was not found clearly enough to take a scale from"}
    res = {"item": man["item"], "kind": man["kind"], "tape": tape, "band": BAND, "tape_read_in": TAPE_READ, "pictures": rows,
           "redraw": {k: cover.get(k) for k in ("model", "seed", "pass", "from")}}
    with open(os.path.join(out, "proof.json"), "w") as f:
        json.dump(res, f, indent=1)
    preview(res, out)
    return res


def print_ruler(item_dir: str, man: dict) -> dict | None:
    """The front print's own close-up and its box, as the vision read placed it."""
    front = [p for p in man["read"]["photos"] if p.get("role") == "graphic" and p.get("side") in ("front", None) and p.get("graphics")]
    if not front:
        return None
    p = max(front, key=lambda q: max((g["box"][2] - g["box"][0]) * (g["box"][3] - g["box"][1]) for g in q["graphics"]))
    g = max(p["graphics"], key=lambda g: (g["box"][2] - g["box"][0]) * (g["box"][3] - g["box"][1]))
    y0, x0, y1, x1 = (v / 1000 for v in g["box"])
    name = sorted(f for f in os.listdir(item_dir) if f.lower().endswith((".jpg", ".jpeg", ".png")))[p["index"]]
    return {"img": rgb(os.path.join(item_dir, name)), "box": [x0, y0, x1, y1]}


def bench(run_item: str, tape: dict, cover_file: str) -> list[dict]:
    """Stretch the published slide sideways on purpose; the reading should move by the same amount."""
    im = C.fit(rgb(os.path.join(run_item, cover_file)))
    h, w = im.shape[:2]
    out = []
    for k in STRETCH:
        wide = cv2.resize(im, (round(w * k), h), interpolation=cv2.INTER_CUBIC)
        if wide.shape[1] >= w:  # wider: cut the extra floor off both sides
            x = (wide.shape[1] - w) // 2
            canvas = wide[:, x:x + w]
        else:  # narrower: the floor mirrored out to the old width
            pad = w - wide.shape[1]
            canvas = cv2.copyMakeBorder(wide, 0, 0, pad // 2, pad - pad // 2, cv2.BORDER_REFLECT)
        r = M.against_tape(M.measure(C.mask_of(canvas), tape.get("length"), canvas), tape)
        base = M.against_tape(M.measure(C.mask_of(im), tape.get("length"), im), tape)
        moved = (r["pit_in"] / base["pit_in"] - 1) if r.get("tested") and base.get("tested") else None
        out.append({"stretch": k, "pit_in": r.get("pit_in"), "off": r.get("off"), "reading_moved": None if moved is None else round(moved, 4),
                    "outside_band": None if r.get("off") is None else abs(r["off"]) > BAND})
    return out


def _font(size):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def preview(res: dict, out: str) -> None:
    """A working sheet for review, in a stand-in face; the site and the deck set the real type on the plain pictures."""
    t = res["tape"]
    side = 640
    names = {"photo": "Phone photo, as laid", "drawn": "AI redraw, as drawn", "final": "Published slide"}
    sheet = Image.new("RGB", (side * 3, side + 150), "white")
    d = ImageDraw.Draw(sheet)
    for i, k in enumerate(("photo", "drawn", "final")):
        p = os.path.join(out, f"{k}.png")
        if os.path.exists(p):
            im = Image.open(p)
            im.thumbnail((side, side))
            sheet.paste(im, (i * side, 0))
        r = res["pictures"][k]
        d.text((i * side + 16, side + 14), names[k], fill=(10, 10, 10), font=_font(26))
        if r.get("tested"):
            line = f"pit to pit {r['pit_in']:.1f} in, tape {t['pit_to_pit']:g} in"
            off = f"{r['off_in'] + 0:+.1f} in ({r['off'] + 0:+.1%})".replace("-0.0 in", "0.0 in").replace("(-0.0%)", "(0.0%)")
        elif r.get("note"):
            line, off = "pit to pit: no line to draw", "a sleeve hides the armpit"
        else:
            line, off = "no tape to test against", ""
        d.text((i * side + 16, side + 54), line, fill=(10, 10, 10), font=_font(22))
        d.text((i * side + 16, side + 86), off, fill=(10, 10, 10, 160), font=_font(22))
    if t.get("length"):
        d.text((16, side + 120), f"Each picture is scaled so its length reads the taped {t.get('length', 0):g} in; then its pit to pit is read.",
               fill=(90, 90, 90), font=_font(18))
    sheet.save(os.path.join(out, "preview.jpg"), quality=90)


def main(run_dir: str, items_dir: str, out_dir: str) -> None:
    allres = []
    for name in sorted(os.listdir(run_dir)):
        ri = os.path.join(run_dir, name)
        if not os.path.exists(os.path.join(ri, "manifest.json")):
            continue
        with open(os.path.join(ri, "manifest.json")) as f:
            kind = json.load(f)["kind"]
        if kind not in TOPS:
            allres.append({"item": name, "kind": kind, "pictures": {"final": {"tested": False, "note": f"{kind}: the ruler reads tops only so far"}}})
            continue
        r = item(ri, os.path.join(items_dir, name), os.path.join(out_dir, name))
        if r:
            if r["pictures"]["final"].get("tested"):
                r["bench"] = bench(ri, r["tape"], next(s for s in json.load(open(os.path.join(ri, "manifest.json")))["slides"] if s["type"] == "cover")["file"])
                with open(os.path.join(out_dir, name, "proof.json"), "w") as f:
                    json.dump(r, f, indent=1)
            allres.append(r)
    tested = [r for r in allres if r["pictures"]["final"].get("tested")]
    summ = {"run": os.path.relpath(run_dir), "band": BAND, "items": len(allres), "tested": len(tested),
            "untested": {r["item"]: (r["pictures"]["final"].get("note") or "no pit to pit and length on the tape") for r in allres if r not in tested}}
    for k in ("photo", "drawn", "final"):
        offs = [abs(r["pictures"][k]["off"]) for r in tested if r["pictures"][k].get("tested")]
        summ[k] = {"n": len(offs), "within_band": sum(o <= BAND for o in offs), "max_off": round(max(offs), 4) if offs else None}
    with open(os.path.join(out_dir, "summary.json"), "w") as f:
        json.dump(summ, f, indent=1)
    print(json.dumps(summ, indent=1))


if __name__ == "__main__":
    main(*sys.argv[1:4])
