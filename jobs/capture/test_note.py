"""cap-7: the free note. Planted private details never reach a listing; matches confirm, contradictions mark."""
import pytest

from capture.note import has_private, listing_text, read_note, redact

# Planted private details, all fake: test card numbers from card networks' published test ranges.
PLANTED = [
    "call me at 612-555-0147 if you want it",
    "text 6125550147 for pickup",
    "my number is (612) 555 0147",
    "+1 612 555 0147 anytime",
    "+44 20 7946 0958 in London",
    "pick up at 1234 Maple Street",
    "I'm at 55 Oak Ave Apt 4B",
    "come to 9 West Elm Rd, unit 12",
    "ship to 300 Lakeshore Blvd",
    "apt 7 on the second floor",
    "PO Box 4411 works",
    "I live at 18 Birch Lane",
    "my zip is 55401.",
    "pay with card 4242 4242 4242 4242",
    "card 4111-1111-1111-1111 exp 12/29",
    "5555555555554444 is my mastercard",
    "amex 378282246310005",
    "venmo @jane-doe-22",
    "Venmo me at jdoe99",
    "cash app $JaneDoe",
    "send it to $kevin22 on cashapp",
    "zelle to 612-555-0199",
    "Zelle jane.doe@example.com",
    "paypal.me/janedoe",
    "email me jane.doe@example.com",
    "routing 021000021 account 123456789",
    "acct # 000123456789",
    "IBAN GB82 WEST 1234 5698 7654 32",
    "find me on ig @vintage.jane",
    "my cell: 612.555.0147",
]


@pytest.mark.parametrize("planted", PLANTED)
def test_planted_private_detail_never_reaches_a_listing(planted):
    note = f"Bought it at a thrift store in Austin. {planted}. Size M."
    r = read_note(note, "typed", row_fields={"size"})
    assert r["removed"], planted
    assert not has_private(r["redacted"]), r["redacted"]
    text = listing_text(r)
    assert not has_private(text)
    for token in ("555", "4242", "1111", "Maple", "jane", "Jane", "021000021", "@", "$"):
        assert token not in text, (planted, text)


def test_note_gives_a_phone_number_dropped_from_listing():
    r = read_note("Selling because I moved, call 612-555-0147", "spoken")
    assert "phone" in r["removed"]
    assert "555" not in listing_text(r)
    assert r["item_note"].endswith("0147") and r["item_note_source"] == "spoken"  # the person keeps their own words


def test_plain_notes_are_not_cut():
    for text in ["Had it for 3 years, size 10", "Bought it in 2019 at Nordstrom", "Resoled in March, 2 small scuffs",
                 "worn maybe 5 times", "Model 1234 from 2008"]:
        clean, kinds = redact(text)
        assert kinds == [], (text, kinds)


def test_a_match_confirms_and_source_becomes_asked():
    r = read_note("It's size M and I love it", "typed", held={"size": {"value": "M", "source": "label"}})
    assert r["confirmed"] == [{"name": "size", "value": "M", "source": "asked", "evidence": "owner"}]
    assert "size" in r["asked"]


def test_note_contradicts_a_fact_mark():
    r = read_note("size L, fits big", "typed", held={"size": {"value": "M", "source": "label"}})
    assert r["marks"] == [{"kind": "note_conflict", "name": "size", "held": "M", "said": "L", "span": "size L"}]
    assert not r["confirmed"]


def test_new_fact_fills_its_row_or_goes_to_description():
    r = read_note("Got it from the Patagonia outlet. Resoled last year. Have the receipt.", "typed",
                  row_fields={"receipt"})
    assert {"name": "receipt", "value": "yes", "source": "asked", "evidence": "owner"} in r["filled"]
    lines = [d["line"] for d in r["description"]]
    assert "Got it from the Patagonia outlet" in lines and "Resoled last year" in lines


def test_nothing_in_the_note_is_asked_again():
    r = read_note("size 9, had it for 2 years", "typed", row_fields={"size"})
    assert {"size", "owned_for"} <= set(r["asked"])


def test_a_fact_without_its_span_is_dropped():
    r = read_note("lovely coat", "typed", reader=lambda t: [{"name": "brand", "value": "Gucci", "span": "a Gucci coat"}])
    assert not (r["filled"] or r["description"] or r["confirmed"]) and r["asked"] == []


def test_reader_sees_only_the_redacted_text():
    seen = []
    read_note("call 612-555-0147, size M", "typed", reader=lambda t: seen.append(t) or [])
    assert "555" not in seen[0]


def test_reader_value_with_private_detail_dropped():
    r = read_note("ask me", "typed", reader=lambda t: [{"name": "provenance", "value": "612-555-0147", "span": "ask me"}])
    assert r["description"] == [] and r["filled"] == []


def test_source_must_be_typed_or_spoken():
    with pytest.raises(ValueError):
        read_note("hi", "email")
