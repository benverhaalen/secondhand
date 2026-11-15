"""ph-1: the seven-part quality score (photo.md section 3 step 2), measured on the mask where given."""
import numpy as np

WEIGHTS = {"exposure": 20, "contrast": 15, "sharpness": 15, "clipping": 10, "fill": 15, "centring": 10, "background": 15}
LABEL_ROLES = {"tag", "care_label", "flaw", "fabric", "screenshot"}
LABEL_PARTS = ("sharpness", "exposure", "clipping")
SHARP_K = 300.0  # calibrated: 3-px cell texture ~ var 1000+ -> >0.95; same image after a 3-px box blur ~ var 30 -> <0.1


def _grey(img: np.ndarray) -> np.ndarray:
    return img[..., :3].astype(np.float64) @ np.array([0.299, 0.587, 0.114])


def laplacian_var(img: np.ndarray, mask: np.ndarray | None = None) -> float:
    g = _grey(img)
    lap = 4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    if mask is not None:
        lap = lap[mask[1:-1, 1:-1]]
    return float(lap.var()) if lap.size else 0.0


def parts(img: np.ndarray, mask: np.ndarray | None = None, role: str = "front") -> dict:
    g = _grey(img)
    item = g[mask] if mask is not None and mask.any() else g.ravel()
    mean = item.mean() / 255
    clipped = np.mean((item <= 3) | (item >= 252))
    out = {
        "exposure": float(max(0.0, 1 - abs(mean - 0.5) * 2)),
        "contrast": float(min(1.0, item.std() / 255 / 0.25)),
        "sharpness": float(1 - np.exp(-laplacian_var(img, mask) / SHARP_K)),
        "clipping": float(1 - min(1.0, clipped * 5)),
    }
    if mask is None or not mask.any():
        # no mask: fill, centring and background are unknown, so neutral rather than guessed high or low
        return {**out, "fill": 0.5, "centring": 0.5, "background": 0.5}
    h, w = mask.shape
    ys, xs = np.nonzero(mask)
    out["fill"] = float(min(1.0, mask.mean() / 0.5))
    d = np.hypot(xs.mean() / w - 0.5, ys.mean() / h - 0.5)
    out["centring"] = float(max(0.0, 1 - 2 * d))
    bg = g[~mask]
    out["background"] = float(1 - min(1.0, bg.std() / 255 / 0.25)) if bg.size else 1.0
    return out


def score(img: np.ndarray, mask: np.ndarray | None = None, role: str = "front") -> dict:
    p = parts(img, mask, role)
    used = LABEL_PARTS if role in LABEL_ROLES else tuple(WEIGHTS)
    total = sum(WEIGHTS[k] for k in used)
    return {"score": int(round(sum(WEIGHTS[k] * p[k] for k in used) / total * 100)), "parts": p}
