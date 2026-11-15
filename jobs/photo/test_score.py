"""ph-1: quality score and frame pool. Each test names the cause it guards."""
import numpy as np

from photo import pool, score

RNG = np.random.default_rng(7)


def textured(h=120, w=120):
    """Sharp 3-px cells of random grey: strong edges everywhere."""
    cells = RNG.integers(40, 215, (h // 3 + 1, w // 3 + 1), dtype=np.uint8)
    g = np.kron(cells, np.ones((3, 3), np.uint8))[:h, :w]
    return np.stack([g] * 3, -1)


def box_blur(img, k=3):
    p = k // 2
    f = np.pad(img.astype(float), ((p, p), (p, p), (0, 0)), mode="edge")
    out = sum(f[i:i + img.shape[0], j:j + img.shape[1]] for i in range(k) for j in range(k)) / k**2
    return out.round().astype(np.uint8)


def frame(pid, role="front", lap=500.0, sharp=0.9, exp=0.9, cov=0.9, sc=80, dh=None, emb=None, **kw):
    return dict(photo_id=pid, role=role, sharpness=sharp, exposure=exp, coverage=cov, score=sc,
                lap_var=lap, dhash=dh, embedding=emb, **kw)


def test_blur_scores_low_and_original_high_sharpness_k_is_wrong_if_this_fails():
    img = textured()
    assert score.parts(img)["sharpness"] > 0.7
    assert score.parts(box_blur(img, 7))["sharpness"] < 0.3


def test_parts_are_the_seven_named_and_in_range():
    p = score.parts(textured())
    assert set(p) == set(score.WEIGHTS) and all(0 <= v <= 1 for v in p.values())
    assert sum(score.WEIGHTS.values()) == 100


def test_blurred_photo_scores_lower_overall():
    img = textured()
    assert score.score(box_blur(img))["score"] < score.score(img)["score"]


def test_label_roles_use_three_parts_only():
    img = textured()
    w = score.WEIGHTS
    for role in ("tag", "care_label", "flaw", "fabric", "screenshot"):
        r = score.score(img, role=role)
        expect = (w["sharpness"] * r["parts"]["sharpness"] + w["exposure"] * r["parts"]["exposure"]
                  + w["clipping"] * r["parts"]["clipping"]) / (w["sharpness"] + w["exposure"] + w["clipping"]) * 100
        assert r["score"] == round(expect), role


def test_centred_item_scores_centring_higher():
    img = np.full((100, 100, 3), 128, np.uint8)
    c = np.zeros((100, 100), bool); c[30:70, 30:70] = True
    e = np.zeros((100, 100), bool); e[0:40, 0:40] = True
    assert score.parts(img, c)["centring"] > score.parts(img, e)["centring"]


def test_mask_restricts_measurement_to_the_item():
    img = np.zeros((100, 100, 3), np.uint8); img[30:70, 30:70] = 128
    m = np.zeros((100, 100), bool); m[30:70, 30:70] = True
    assert score.parts(img, m)["clipping"] > score.parts(img)["clipping"]


def test_blurred_hero_never_ranks_first_through_pool():
    sharp = frame("sharp", lap=600, sharp=0.6, exp=0.5, cov=0.5, sc=50)
    blur = frame("blur", lap=100, sharp=0.9, exp=0.9, cov=0.9, sc=99)  # best pick numbers, but 100 < 0.5*600
    r = pool.keep([blur, sharp])
    assert [f["photo_id"] for f in r["kept"]] == ["sharp"]
    assert {"photo_id": "blur", "reason": "blurred"} in r["dropped"]


def test_blurred_frame_goes_to_retake():
    r = pool.keep([frame("a", lap=600), frame("b", lap=50)])
    assert r["retake"] == ["b"]


def test_below_floor_blurred_even_when_alone():
    r = pool.keep([frame("only", lap=40)])
    assert r["kept"] == [] and r["retake"] == ["only"]


def test_duplicate_frames_one_kept_with_near_duplicate_reason():
    r = pool.keep([frame("a", dh=0b1010, sc=90), frame("b", dh=0b1011, sc=40)])
    assert [f["photo_id"] for f in r["kept"]] == ["a"]
    assert {"photo_id": "b", "reason": "near_duplicate"} in r["dropped"]


def test_dedupe_never_crosses_bins():
    r = pool.keep([frame("f", "front", dh=5, emb=[1, 0]), frame("b", "back", dh=5, emb=[1, 0])])
    assert {f["photo_id"] for f in r["kept"]} == {"f", "b"}


def test_two_flaw_ids_both_kept_even_if_look_alike():
    r = pool.keep([frame("x", "flaw", dh=5, flaw_id="f1"), frame("y", "flaw", dh=5, flaw_id="f2")])
    assert {f["photo_id"] for f in r["kept"]} == {"x", "y"}


def test_same_flaw_id_keeps_one():
    r = pool.keep([frame("x", "flaw", flaw_id="f1", sc=90), frame("y", "flaw", flaw_id="f1", sc=10)])
    assert [f["photo_id"] for f in r["kept"]] == ["x"]


def test_lower_pick_reason_for_non_duplicates():
    r = pool.keep([frame("a", sc=90), frame("b", sc=10, lap=400)])
    assert {"photo_id": "b", "reason": "lower_pick"} in r["dropped"]


def test_embedding_cosine_marks_duplicates():
    r = pool.keep([frame("a", emb=[1.0, 0.0], sc=90), frame("b", emb=[0.99, 0.05], sc=10)])
    assert {"photo_id": "b", "reason": "near_duplicate"} in r["dropped"]


def test_dhash_is_64_bit_and_stable_under_small_noise():
    img = textured(64, 64)
    h = pool.dhash(img)
    assert 0 <= h < 2**64
    noisy = np.clip(img.astype(int) + 1, 0, 255).astype(np.uint8)
    assert bin(h ^ pool.dhash(noisy)).count("1") <= 10
