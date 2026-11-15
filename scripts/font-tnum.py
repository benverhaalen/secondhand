#!/usr/bin/env python3
"""Gives a font tabular figures when it has none, so an amount keeps its width as its digits change.

    python3 scripts/font-tnum.py <font in> <font out>

Each digit gets a copy, centered in a cell as wide as the widest digit, and the OpenType feature tnum
swaps the copies in. After that `font-variant-numeric: tabular-nums` in CSS and
`fontVariant: ['tabular-nums']` in React Native do what they say. The digits themselves are untouched,
so text without that setting looks as it did. Needs fontTools. Font files stay out of git (brand/README.md).
"""
import json
import sys

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont, TTLibError, newTable
from fontTools.ttLib.tables import otTables as ot

TAG = 'tnum'


def gsub_of(font):
    """The font's substitution table, made empty when the font has none."""
    if 'GSUB' not in font:
        font['GSUB'] = newTable('GSUB')
        table = font['GSUB'].table = ot.GSUB()
        table.Version = 0x00010000
        table.ScriptList, table.FeatureList, table.LookupList = ot.ScriptList(), ot.FeatureList(), ot.LookupList()
        table.ScriptList.ScriptRecord, table.FeatureList.FeatureRecord, table.LookupList.Lookup = [], [], []
    return font['GSUB'].table


def lang_systems(gsub):
    for record in gsub.ScriptList.ScriptRecord:
        if record.Script.DefaultLangSys:
            yield record.Script.DefaultLangSys
        yield from (r.LangSys for r in record.Script.LangSysRecord)


def copy_shifted(font, source, name, dx, width):
    """Adds glyph `name`: the outline of `source` moved right by dx, with the advance `width`."""
    glyphs = font.getGlyphSet()
    outline = DecomposingRecordingPen(glyphs)
    glyphs[source].draw(outline)
    move = (1, 0, 0, 1, dx, 0)
    if 'glyf' in font:
        pen = TTGlyphPen(None)
        outline.replay(TransformPen(pen, move))
        font['glyf'][name] = pen.glyph()
    else:
        top = font['CFF '].cff.topDictIndex[0]
        private = top.Private
        # A charstring stores its width as the distance from the font's nominal width.
        stored = None if width == private.defaultWidthX else width - private.nominalWidthX
        pen = T2CharStringPen(stored, glyphs)
        outline.replay(TransformPen(pen, move))
        charstring = pen.getCharString(private=private, globalSubrs=top.GlobalSubrs)
        strings = top.CharStrings
        if strings.charStringsAreIndexed:
            strings.charStringsIndex.append(charstring)
            strings.charStrings[name] = len(strings.charStringsIndex) - 1
        else:
            strings.charStrings[name] = charstring
        top.charset.append(name)
    # Setting the order again drops fontTools' cached glyph ids, which were made before this glyph existed.
    font.setGlyphOrder(list(dict.fromkeys(font.getGlyphOrder() + [name])))


def add_feature(font, swaps):
    """Adds the feature to the font's own, in tag order, and turns it on for every script and language."""
    gsub = gsub_of(font)
    step = ot.SingleSubst()
    step.mapping = dict(swaps)
    lookup = ot.Lookup()
    lookup.LookupType, lookup.LookupFlag, lookup.SubTable = 1, 0, [step]
    gsub.LookupList.Lookup.append(lookup)

    record = ot.FeatureRecord()
    record.FeatureTag, record.Feature = TAG, ot.Feature()
    record.Feature.FeatureParams, record.Feature.LookupListIndex = None, [len(gsub.LookupList.Lookup) - 1]
    records = gsub.FeatureList.FeatureRecord
    at = sum(r.FeatureTag < TAG for r in records)
    records.insert(at, record)

    if not gsub.ScriptList.ScriptRecord:
        default = ot.ScriptRecord()
        default.ScriptTag, default.Script = 'DFLT', ot.Script()
        default.Script.DefaultLangSys, default.Script.LangSysRecord = ot.LangSys(), []
        default.Script.DefaultLangSys.ReqFeatureIndex, default.Script.DefaultLangSys.FeatureIndex = 0xFFFF, []
        gsub.ScriptList.ScriptRecord.append(default)
    for system in lang_systems(gsub):
        # Every feature after the new one moved up a place.
        moved = [i + (i >= at) for i in system.FeatureIndex]
        system.FeatureIndex = sorted(moved + [at])
        if system.ReqFeatureIndex != 0xFFFF and system.ReqFeatureIndex >= at:
            system.ReqFeatureIndex += 1


def main(source, out):
    try:
        font = TTFont(source)
    except (OSError, TTLibError) as error:
        sys.exit(f'{source}: {error}')
    if 'fvar' in font or 'CFF2' in font:
        sys.exit(f'{source} is a variable font. Make a static instance of it first.')
    if 'CFF ' in font and hasattr(font['CFF '].cff.topDictIndex[0], 'ROS'):
        sys.exit(f'{source} is a CID-keyed font, which this does not handle.')
    cmap = font.getBestCmap()
    digits = [cmap.get(ord('0') + i) for i in range(10)]
    if None in digits:
        sys.exit(f'{source} has no glyph for the digit {digits.index(None)}')

    gsub = font['GSUB'].table if 'GSUB' in font else None
    report = {'in': source, 'out': out, 'had_tnum': bool(gsub and gsub.FeatureList and any(r.FeatureTag == TAG for r in gsub.FeatureList.FeatureRecord))}
    if not report['had_tnum']:
        metrics = font['hmtx']
        cell = max(metrics[g][0] for g in digits)
        swaps = {}
        for glyph in digits:
            name = f'{glyph}.{TAG}'
            if name in font.getGlyphOrder():
                sys.exit(f'{source} already has a glyph named {name} but no {TAG} feature. Look at the file before changing it.')
            advance, bearing = metrics[glyph]
            dx = (cell - advance) // 2
            copy_shifted(font, glyph, name, dx, cell)
            metrics[name] = (cell, bearing + dx)
            swaps[glyph] = name
        add_feature(font, swaps)
        report |= {'cell': cell, 'added': len(swaps)}
    font.save(out)
    print(json.dumps(report))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])
