"""id-2: the capture ladder and its conformal set (identity §3.A; expert session: C = {c >= 1 - q_hat}, misses at 1)."""
import numpy as np

from identity.ladder import Hit, action, calibrate, candidates, conformal_set, label, nonconformity

ALPHA = 0.10


def synth(n, seed, miss=0.03):
    """Mocked rungs: the true product scores high with noise; three decoys score lower; sometimes it is absent."""
    rng = np.random.default_rng(seed)
    out = []
    for _ in range(n):
        hits = [Hit(rung=3, product=f"decoy{k}", s=float(rng.uniform(0.3, 0.85))) for k in range(3)]
        present = rng.random() > miss
        if present:
            hits.append(Hit(rung=int(rng.choice([1, 2, 3])), product="true", s=float(np.clip(rng.normal(0.9, 0.08), 0, 1))))
        out.append((candidates(hits), present))
    return out


def window(caps):
    return [nonconformity(c.get("true", (None,))[0] if present else None) for c, present in caps]


def test_coverage_holds_on_held_out_captures():
    cal, test = synth(1000, 1), synth(1000, 2)
    q = calibrate(window(cal), ALPHA)
    covered = [present and "true" in conformal_set(c, q) for c, present in test]
    assert np.mean(covered) >= 1 - ALPHA - 0.025


def test_missing_true_product_is_counted_not_dropped():
    caps = synth(1000, 3, miss=0.08)
    honest = calibrate(window(caps), ALPHA)
    dropped = calibrate([nonconformity(c["true"][0]) for c, present in caps if present], ALPHA)
    assert honest > dropped  # leaving misses out overstates coverage


def test_drift_widens_the_set():
    calm = calibrate(window(synth(500, 4, miss=0.0)), ALPHA)
    drifted = calibrate(window(synth(500, 5, miss=0.15)), ALPHA)
    c = candidates([Hit(rung=3, product="a", s=0.9), Hit(rung=3, product="b", s=0.6)])
    assert len(conformal_set(c, drifted)) >= len(conformal_set(c, calm))


def test_image_only_match_is_never_exact():
    c = candidates([Hit(rung=3, product="jacket", s=0.99)])
    assert label("jacket", c, confirmed=False) == "likely_same_model"
    assert label("jacket", c, confirmed=True) == "exact"
    coded = candidates([Hit(rung=1, product="jacket", s=1.0)])
    assert label("jacket", coded, confirmed=False) == "exact"


def test_worked_example_and_actions():
    # identity.md worked example: rung 2 black 0.82 -> 0.66; rung 3 black 0.91 -> 0.455, blue 0.89 -> 0.445
    c = candidates([Hit(2, "black", 0.82), Hit(3, "black", 0.91), Hit(3, "blue", 0.89)])
    assert abs(c["black"][0] - 0.656) < 1e-9 and abs(c["blue"][0] - 0.445) < 1e-9
    s = conformal_set(c, q_hat=0.40)  # threshold 0.60: only black
    assert s == ["black"] and action(s) == "confirm"
    assert action(["a", "b"]) == "pick" and action([]) == "ask" and action(list("abcde")) == "ask"
