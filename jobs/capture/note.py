"""cap-7: the free note (capture step 7a), typed or spoken, read into facts.

Stored as `item.note` (the person's own text, private; never logged, never listed). Before anything reads
it, private details are cut: phone numbers, card numbers (Luhn), email, street addresses, payment handles
(Venmo, Cash App, Zelle, PayPal), bank account and routing numbers. The reader (a language model in the
job, a rule reader by default) sees only the redacted text, and every fact must quote a span found word
for word in it (LangExtract's rule, research/cross-cutting/nate/capture-expert-session.md); a fact with no
span is dropped. A fact that matches a held one confirms it (source becomes `asked`); one that contradicts
it becomes a `note_conflict` mark; a new fact fills its row or becomes a description line. Every field the
note covers joins `asked`, so it is never asked again.
"""
from __future__ import annotations

import re
from typing import Any, Callable

REDACTED = "[removed]"

_PHONE = re.compile(r"(?<![\w$@])(?:\+?\d[\s().-]{0,2}){7,15}(?!\w)")
_CARDISH = re.compile(r"(?<!\d)(?:\d[ -]?){12,19}(?!\d)")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_HANDLE = re.compile(
    r"(?i)(?:\b(?:venmo|cash\s*app|cashapp|zelle|paypal(?:\.me)?|apple\s*pay)\b[\s:/]*(?:me\s*)?(?:at\s+|to\s+)?[@$]?[\w.\-]*\d*[\w.\-]*"
    r"|(?<![\w])\$[A-Za-z][\w]{1,20}|(?<![\w.])@[A-Za-z][\w.]{2,30})")
_BANK = re.compile(r"(?i)\b(?:routing|account|acct|iban|sort code)\b[\s#:no.]*[\w -]{4,34}\d")
_SUFFIX = (r"street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|terrace|"
           r"circle|cir|parkway|pkwy|highway|hwy|trail|apt|apartment|suite|unit")
_ADDRESS = re.compile(
    rf"(?i)\b\d{{1,6}}\s+(?:[A-Za-z0-9.'-]+\s+){{0,4}}(?:{_SUFFIX})\b\.?(?:[\s,]+(?:apt|unit|suite|#)\s*\w+)?"
    rf"|\b(?:apt|apartment|unit|suite)\s*#?\s*\d+\w?|\bp\.?\s?o\.?\s+box\s+\d+|\b\d{{5}}(?:-\d{{4}})?\b(?=\s*$|\s*[,.])")


def _luhn(digits: str) -> bool:
    total, alt = 0, False
    for ch in reversed(digits):
        d = int(ch)
        if alt:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
        alt = not alt
    return total % 10 == 0


def redact(text: str) -> tuple[str, list[str]]:
    """The note with private details cut, and the kinds cut (never the values)."""
    kinds: list[str] = []

    def cut(kind):
        def _sub(m):
            kinds.append(kind)
            return REDACTED
        return _sub

    def card(m):
        d = re.sub(r"\D", "", m.group(0))
        if 13 <= len(d) <= 19 and _luhn(d):
            kinds.append("card")
            return REDACTED
        return m.group(0)

    def phone(m):
        d = re.sub(r"\D", "", m.group(0))
        if 7 <= len(d) <= 15:
            kinds.append("phone")
            return REDACTED
        return m.group(0)

    out = _EMAIL.sub(cut("email"), text)
    out = _BANK.sub(cut("bank"), out)
    out = _CARDISH.sub(card, out)
    out = _HANDLE.sub(cut("payment_handle"), out)
    out = _ADDRESS.sub(cut("address"), out)
    out = _PHONE.sub(phone, out)
    return out, kinds


def has_private(text: str) -> bool:
    return bool(redact(text)[1])


# The default reader: rules for what a seller usually says. The job swaps in the language model reader.
_RULES: list[tuple[str, re.Pattern]] = [
    ("size", re.compile(r"(?i)\bsize\s+(xxs|xs|s|m|l|xl|xxl|xxxl|\d{1,2}(?:\.5)?)\b")),
    ("colour", re.compile(r"(?i)\b(?:colou?r is|it'?s)\s+(black|white|grey|gray|navy|blue|red|green|brown|beige|cream|pink|purple|yellow|orange)\b")),
    ("brand", re.compile(r"(?i)\bbrand is\s+([A-Z][\w&'.-]*(?:\s[A-Z][\w&'.-]*)?)")),
    ("provenance", re.compile(r"(?i)\b(?:bought|got|purchased)\s+(?:it\s+|this\s+)?(?:at|from|in)\s+([^.,;!\n]+)")),
    ("owned_for", re.compile(r"(?i)\b(?:had|owned|used)\s+(?:it|this)\s+(?:for\s+)?((?:about\s+)?\w+\s+(?:years?|months?|weeks?))")),
    ("receipt", re.compile(r"(?i)\b(have|with|includes?|got)\s+(?:the\s+)?(?:original\s+)?receipt\b")),
    ("repair", re.compile(r"(?i)\b((?:re-?soled|repaired|fixed|replaced|restitched|serviced)\b[^.;!\n]*)")),
    ("selling_because", re.compile(r"(?i)\bselling (?:it |this )?because\s+([^.;!\n]+)")),
]


def rule_reader(text: str) -> list[dict[str, Any]]:
    found = []
    for name, rx in _RULES:
        m = rx.search(text)
        if m:
            value = m.group(1).strip()
            found.append({"name": name, "value": "yes" if name == "receipt" else value, "span": m.group(0).strip()})
    return found


def _norm(v: Any) -> str:
    return re.sub(r"\s+", " ", str(v)).strip().lower()


def read_note(text: str, source: str, held: dict[str, dict] | None = None, row_fields: set[str] | frozenset = frozenset(),
              reader: Callable[[str], list[dict]] = rule_reader) -> dict[str, Any]:
    """held: {field: {value, source}} the system already has. row_fields: fields of the item's requirement rows."""
    if source not in ("typed", "spoken"):
        raise ValueError(f"note source {source}")
    held = held or {}
    clean, cut_kinds = redact(text)
    confirmed, marks, filled, description, asked = [], [], [], [], set()
    for fact in reader(clean):
        span = str(fact.get("span") or "")
        if not span or span not in clean or REDACTED in span:
            continue  # a fact must quote the redacted note word for word
        name, value = fact["name"], fact["value"]
        if has_private(str(value)):
            continue
        asked.add(name)
        if name in held:
            if _norm(held[name].get("value")) == _norm(value):
                confirmed.append({"name": name, "value": held[name].get("value"), "source": "asked", "evidence": "owner"})
            else:
                marks.append({"kind": "note_conflict", "name": name, "held": held[name].get("value"), "said": value, "span": span})
        elif name in row_fields:
            filled.append({"name": name, "value": value, "source": "asked", "evidence": "owner"})
        else:
            description.append({"name": name, "line": span})
    return {"item_note": text, "item_note_source": source,  # private to the person; never in a listing or a log
            "redacted": clean, "removed": sorted(set(cut_kinds)),
            "confirmed": confirmed, "marks": marks, "filled": filled, "description": description,
            "asked": sorted(asked)}


def listing_text(result: dict[str, Any]) -> str:
    """The only note-derived words a listing may carry."""
    lines = [d["line"] for d in result["description"]] + [f"{f['name']}: {f['value']}" for f in result["filled"]]
    out = "\n".join(lines)
    assert not has_private(out) and REDACTED not in out, "private detail reached listing text"
    return out
