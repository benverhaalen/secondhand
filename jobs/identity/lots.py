"""A lot stays one comp/card and its total never becomes a piece's price."""
import re


def is_lot(comp):
    if comp.get("catalogue_set"):
        return False
    return (bool(comp.get("lot_parts")) or comp.get("quantity", 1) > 1
            or comp.get("vision_count", 1) > 1
            or bool(re.search(r"\b(lot|bundle|set)\s+of\b|\b(?:lot|bundle)\b", comp.get("title", ""), re.I)))


def lot_card(comp, *, identified_parts=()):
    if not is_lot(comp):
        return dict(comp)
    return {**comp, "lot_parts": list(identified_parts or comp.get("lot_parts", ())),
            "is_lot": True}


def single_product_comps(comps):
    return [c for c in comps if not c.get("is_lot") and not is_lot(c)]
