"""ph-1: the frame pool (photo.md section 3 step 1 plus the expert's blur floor and dHash pre-filter)."""
import numpy as np
from PIL import Image


def dhash(img: np.ndarray) -> int:
    g = np.asarray(Image.fromarray(img).convert("L").resize((9, 8), Image.LANCZOS), dtype=np.int16)
    bits = (g[:, 1:] > g[:, :-1]).ravel()
    return int("".join("1" if b else "0" for b in bits), 2)


def _pick(f: dict) -> float:
    return 0.5 * f["sharpness"] + 0.2 * f["exposure"] + 0.2 * f["coverage"] + 0.1 * f["score"] / 100


def _dup(a: dict, b: dict) -> bool:
    if a.get("dhash") is not None and b.get("dhash") is not None and bin(a["dhash"] ^ b["dhash"]).count("1") <= 10:
        return True
    ea, eb = a.get("embedding"), b.get("embedding")
    if ea is not None and eb is not None:
        ea, eb = np.asarray(ea, float), np.asarray(eb, float)
        return float(ea @ eb / (np.linalg.norm(ea) * np.linalg.norm(eb))) > 0.95
    return False


def keep(frames: list, blur_ratio: float = 0.5, blur_floor: float = 100.0) -> dict:
    # bin = role; flaws are one bin per flaw_id so they never merge or dedupe across flaws
    bins: dict = {}
    for f in frames:
        key = (f["role"], f.get("flaw_id") if f["role"] == "flaw" else None)
        bins.setdefault(key, []).append(f)
    kept, dropped, retake = [], [], []
    for group in bins.values():
        best_lap = max(f["lap_var"] for f in group)
        live = []
        for f in group:
            if f["lap_var"] < blur_ratio * best_lap or f["lap_var"] < blur_floor:
                dropped.append({"photo_id": f["photo_id"], "reason": "blurred"})
                retake.append(f["photo_id"])
            else:
                live.append(f)
        live.sort(key=_pick, reverse=True)
        winners: list = []
        for f in live:
            reason = "near_duplicate" if any(_dup(f, w) for w in winners) else ("lower_pick" if winners else None)
            if reason:
                dropped.append({"photo_id": f["photo_id"], "reason": reason})
            else:
                winners.append(f)  # one winner per bin; the rest are lower_pick or near_duplicate of it
        kept += winners
    return {"kept": kept, "dropped": dropped, "retake": retake}
