"""ph-2: the photo order and truncation per site (photo.md section 3 step 3)."""
import json
from functools import lru_cache
from pathlib import Path

FIT_PATH = Path(__file__).resolve().parents[2] / "research" / "list" / "ben" / "platforms" / "platform-fit.json"
PROTECTED = {"tag", "care_label", "flaw", "screenshot"}


@lru_cache(maxsize=1)
def _fit() -> dict:
    return json.loads(FIT_PATH.read_text(encoding="utf-8"))


def plan(site: str, photos: list, fit: dict | None = None) -> dict:
    cap = (fit or _fit())["platforms"][site]["photos"]["max"]
    improved = [p for p in photos if p["use"] == "improved"]
    replaced = {p.get("improved_of") for p in improved}
    reals = [p for p in photos if p["use"] != "improved"]
    by_score = lambda ps: sorted(ps, key=lambda p: -p["score"])  # stable: ties keep input order
    ok = lambda p: not (site == "ebay" and p.get("cover_ok") is False)

    cover, reason = None, "cover_true_color"
    fronts = by_score([p for p in reals if p["role"] == "front" and ok(p)])
    if fronts:
        cover = fronts[0]
    else:
        heroes = by_score([p for p in reals if p["role"] not in PROTECTED and ok(p)])
        cover, reason = (heroes[0], "hero_chosen") if heroes else (None, "")

    rows: list = []  # (photo, reason, tier); tier orders the cap drops
    if cover:
        rows.append((cover, reason, "cover"))
    imp = sorted(improved, key=lambda p: (not (cover and p.get("improved_of") == cover["photo_id"]), -p["score"]))
    for p in imp:
        front = cover and p.get("improved_of") == cover["photo_id"]
        rows.append((p, "improved_chosen", "improved_front" if front else "improved"))
    rest = [p for p in reals if p is not cover and p["photo_id"] not in replaced]
    taken: set = set()
    for role in ("back", "tag", "care_label"):
        c = by_score([p for p in rest if p["role"] == role])[:1]
        for p in c:
            taken.add(p["photo_id"])
            rows.append((p, "coverage", "tag" if role == "tag" else role))
    for p in sorted([p for p in rest if p["role"] == "flaw"], key=lambda p: (p.get("severity") != "major", -p["score"])):
        taken.add(p["photo_id"])
        rows.append((p, "flaw_kept", "flaw_major" if p.get("severity") == "major" else "flaw_minor"))
    for p in by_score([p for p in rest if p["photo_id"] not in taken]):
        rows.append((p, "extra", "extra"))

    dropped = [{"photo_id": p["photo_id"], "reason": "replaced_by_improved"} for p in reals if p["photo_id"] in replaced and p is not cover]
    flaw_in_text: list = []
    # cap drop order; within a tier the lowest score goes first
    # a site cap is hard: past it even major flaws move to the description's flaw list; cover and tag never drop
    for tier in ("extra", "improved", "care_label", "back", "flaw_minor", "flaw_major"):
        for row in sorted([r for r in rows if r[2] == tier], key=lambda r: r[0]["score"]):
            if len(rows) <= cap:
                break
            rows.remove(row)
            dropped.append({"photo_id": row[0]["photo_id"], "reason": "over_cap"})
            if tier.startswith("flaw"):
                flaw_in_text.append(row[0]["photo_id"])
    slots = [{"photo_id": p["photo_id"], "version_id": p.get("version_id"), "slot": i, "reason": r}
             for i, (p, r, _) in enumerate(rows, 1)]
    return {"site": site, "slots": slots, "dropped": dropped, "flaw_in_text": flaw_in_text}
