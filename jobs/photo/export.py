"""ph-5: marks at export (spec/engines/photo.md §3 step 7, §8; research/cross-cutting/nate/photo-expert-session.md).

`ai_marked` is set by what drew the pixels: false for the person's own photo (raw or level 0), true when a
model drew pixels (levels 1 and 2, re-lay, renders). Retouch is off unless the person asked; a photo with no
ask stays level 0. The export writes a fresh JPEG (upright, sRGB, crop, resize, no EXIF, no GPS, no vendor
credential). `export_mark` only adds a metadata tag (IPTC DigitalSourceType in XMP), never a visible mark
(eBay bans watermarks), and never removes `ai_marked`. A real photo carries no source type at all.
"""
from __future__ import annotations

import io

from PIL import Image, ImageOps

MARKS = ("none", "site_required", "retouched")
DST = "http://cv.iptc.org/newscodes/digitalsourcetype/"
COMPOSITE = DST + "compositeWithTrainedAlgorithmicMedia"
GENERATED = DST + "trainedAlgorithmicMedia"
DREW = {"raw": None, "level0": None, "level1": COMPOSITE, "level2": COMPOSITE, "relay": COMPOSITE, "paste_back": COMPOSITE,
        "render": GENERATED, "spin": GENERATED, "generated": GENERATED}
SHARP_ROLES = ("tag", "care_label", "flaw", "screenshot")


def drew(how: str) -> str | None:
    if how not in DREW:
        raise ValueError(f"unknown way the pixels were drawn: {how}")
    return DREW[how]


def ai_marked(how: str) -> bool:
    return drew(how) is not None


def route_for(asked_level: int | None) -> str:
    """Retouch is off by default: no ask, level 0."""
    return f"level{asked_level}" if asked_level else "level0"


def _xmp(dst: str) -> bytes:
    return ('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
            '<rdf:Description xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" '
            f'Iptc4xmpExt:DigitalSourceType="{dst}"/></rdf:RDF></x:xmpmeta>').encode()


def export(src: Image.Image, how: str, export_mark: str, role: str = "front", crop: tuple | None = None,
           export_px: int | None = None, site_requires_tag: bool = False) -> tuple[bytes, dict]:
    if export_mark not in MARKS:
        raise ValueError(f"export_mark {export_mark}")
    dst = drew(how)
    img = ImageOps.exif_transpose(src).convert("RGB")
    if crop:
        img = img.crop(tuple(crop))
    if export_px and max(img.size) > export_px:  # never upscaled
        img.thumbnail((export_px, export_px), Image.Resampling.LANCZOS)
    tag = dst is not None and (export_mark == "retouched" or (export_mark == "site_required" and site_requires_tag))
    kw: dict = {"quality": 90, "subsampling": 0 if role in SHARP_ROLES else 2}
    if tag:
        kw["xmp"] = _xmp(dst or "")
    buf = io.BytesIO()
    img.save(buf, "JPEG", **kw)  # a fresh save passes no exif, so EXIF, GPS and any vendor manifest are gone
    return buf.getvalue(), {"ai_marked": dst is not None, "export_tag": dst if tag else None, "exif_stripped": True,
                            "size": img.size}
