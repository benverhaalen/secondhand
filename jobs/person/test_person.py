"""lp-2: learning the person, the nightly fold (spec/features/score.md "Learning the person")."""
from param.registry import MemoryStore
from person.fold import PRIORS, fold_person, read

AT = "2026-11-15T03:00:00Z"


def events(trait, outcomes, person="usr_ana"):
    return [{"person": person, "trait": trait, "success": s, "at": f"2026-11-{1 + i // 4:02d}T{i % 24:02d}:00:00Z"}
            for i, s in enumerate(outcomes)]


def test_no_data_reads_the_prior():
    store = MemoryStore()
    out = fold_person(store, "usr_new", [], at=AT)
    assert out == {} and read(store, "usr_new", "person_keep_share") == PRIORS["person_keep_share"]


def test_a_real_habit_is_promoted_with_its_held_out_score():
    store = MemoryStore()
    out = fold_person(store, "usr_ana", events("person_keep_share", [1] * 40), at=AT)
    assert out["person_keep_share"][0], out
    row = store.champion("person_keep_share", {"person": "usr_ana"})
    assert row["held_out_score"] is not None and row["n_eff"] > 0


def test_worse_fold_is_rolled_back():
    store = MemoryStore()
    assert fold_person(store, "usr_ana", events("person_policy_agree", [1] * 40), at="t1")["person_policy_agree"][0]
    # habit flips: a fold on mixed history must not replace a champion that predicts held-out better
    flipped = events("person_policy_agree", [1] * 30 + [0] * 10)
    before = store.champion("person_policy_agree", {"person": "usr_ana"})["version"]
    ok, why = fold_person(store, "usr_ana", flipped, at="t2")["person_policy_agree"]
    assert not ok, why
    assert store.champion("person_policy_agree", {"person": "usr_ana"})["version"] == before


def test_one_persons_fold_never_reaches_another():
    store = MemoryStore()
    fold_person(store, "usr_ana", events("person_keep_share", [1] * 40), at=AT)
    assert store.champion("person_keep_share", {"person": "usr_ben"}) is None
    assert store.champion("person_keep_share", {}) is None  # nothing shared is written (J26)
    assert read(store, "usr_ben", "person_keep_share") == PRIORS["person_keep_share"]


def test_events_of_another_person_are_refused():
    store = MemoryStore()
    mixed = events("person_keep_share", [1] * 20) + events("person_keep_share", [0] * 20, person="usr_ben")
    try:
        fold_person(store, "usr_ana", mixed, at=AT)
    except ValueError as e:
        assert "usr_ben" in str(e)
    else:
        raise AssertionError("a fold over another person's events must refuse")
