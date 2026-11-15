"""GTIN-14 joins, including Vision's leading-zero EAN-13 form of UPC-A.

Twin: app/src/engines/trust/recall.ts gtin14; shared fixture records the required
GS1 check-digit contract (the TypeScript check-digit guard is still to land).
"""
import re


def gtin14(raw):
    digits = re.sub(r'[^0-9]', '', raw or '')
    # GS1 identifiers have at most 14 digits; stripped leading zeroes may leave 8..14.
    if not 8 <= len(digits) <= 14:
        return None
    digits = digits.zfill(14)
    # GS1 mod-10: alternating weights 3 and 1 from the rightmost data digit.
    check = (-sum(int(d) * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(digits[:-1])))) % 10
    return digits if check == int(digits[-1]) else None
