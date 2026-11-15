import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tool = fileURLToPath(new URL('./font-tnum.py', import.meta.url));
const py = process.platform === 'win32' ? 'python' : 'python3';
const python = (...args) => spawnSync(py, ['-I', ...args], { encoding: 'utf8' });
const skip = python('-c', 'import fontTools').status !== 0 && 'needs Python with fontTools (pip install fonttools)';

// Digit widths of the Neue Montreal Regular file on Ben's Mac (brand/explore/round-9/clofie-use.md), 30 left and 50 right of the ink.
const WIDTHS = { zero: 620, one: 346, two: 556, three: 569, four: 566, five: 553, six: 582, seven: 513, eight: 584, nine: 579 };
// Builds a small font whose digits are boxes of those widths, as TrueType or as CFF, with or without features of its own.
const BUILD = `
import sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
path, kind, fea = sys.argv[1:4]
D = ${JSON.stringify(WIDTHS)}
W = {'.notdef': 500} | D | {'dollar': 579, 'A': 600, 'A.alt': 640}
names = list(W)
def box(pen, w):
    pen.moveTo((30, 0)); pen.lineTo((30, 700)); pen.lineTo((w - 50, 700)); pen.lineTo((w - 50, 0)); pen.closePath(); return pen
fb = FontBuilder(1000, isTTF=kind == 'ttf')
fb.setupGlyphOrder(names)
fb.setupCharacterMap({0x30 + i: n for i, n in enumerate(D)} | {0x24: 'dollar', 0x41: 'A'})
if kind == 'ttf': fb.setupGlyf({n: box(TTGlyphPen(None), W[n]).glyph() for n in names})
else: fb.setupCFF('Test-Regular', {'FullName': 'Test Regular'}, {n: box(T2CharStringPen(W[n], None), W[n]).getCharString() for n in names}, {})
fb.setupHorizontalMetrics({n: (W[n], 30) for n in names})
fb.setupHorizontalHeader(ascent=800, descent=-200); fb.setupNameTable({'familyName': 'Test', 'styleName': 'Regular'}); fb.setupOS2(); fb.setupPost()
if fea: fb.addOpenTypeFeatures(fea)
fb.save(path)
`;
// Reads back what a renderer would use: the features, what tnum swaps in, and each glyph's advance and ink.
const READ = `
import sys, json
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
f = TTFont(sys.argv[1]); gs = f.getGlyphSet(); gsub = f['GSUB'].table if 'GSUB' in f else None
feats = [r.FeatureTag for r in gsub.FeatureList.FeatureRecord] if gsub else []
swaps = {}
scripts = {}
if gsub:
    for i, r in enumerate(gsub.FeatureList.FeatureRecord):
        for l in r.Feature.LookupListIndex:
            for st in gsub.LookupList.Lookup[l].SubTable:
                if hasattr(st, 'mapping'): swaps.setdefault(r.FeatureTag, {}).update(st.mapping)
    for s in gsub.ScriptList.ScriptRecord:
        scripts[s.ScriptTag] = sorted(gsub.FeatureList.FeatureRecord[i].FeatureTag for i in s.Script.DefaultLangSys.FeatureIndex)
def ink(n):
    b = BoundsPen(gs); gs[n].draw(b); return [b.bounds[0], b.bounds[2]]
print(json.dumps({'glyphs': f.getGlyphOrder(), 'features': feats, 'swaps': swaps, 'scripts': scripts,
                  'adv': {n: f['hmtx'][n][0] for n in f.getGlyphOrder()}, 'ink': {n: ink(n) for n in f.getGlyphOrder()}}))
`;
const dir = mkdtempSync(join(tmpdir(), 'font-tnum-'));
const read = file => JSON.parse(python('-c', READ, file).stdout);
function make(name, kind, fea = '') {
  const src = join(dir, `${name}.${kind}`), out = join(dir, `${name}.tnum.${kind}`);
  const built = python('-c', BUILD, src, kind, fea);
  assert.equal(built.status, 0, built.stderr);
  const ran = python(tool, src, out);
  return { src, out, ran, report: ran.status === 0 ? JSON.parse(ran.stdout) : null };
}
const OWN = 'feature salt { sub A by A.alt; } salt; feature zzzz { sub A by A.alt; } zzzz;';

for (const kind of ['ttf', 'otf']) {
  test(`${kind}: tnum swaps each digit for a copy of equal width, centered, and keeps what the font had`, { skip }, () => {
    const { src, out, ran, report } = make('own', kind, OWN);
    assert.equal(ran.status, 0, ran.stderr);
    const before = read(src), after = read(out), digits = Object.keys(WIDTHS);
    assert.deepEqual(report, { in: src, out, had_tnum: false, cell: 620, added: 10 });
    assert.deepEqual(after.features, ['salt', 'tnum', 'zzzz'], 'features stay in order by tag');
    assert.deepEqual(after.swaps.salt, { A: 'A.alt' });
    assert.deepEqual(after.swaps.zzzz, { A: 'A.alt' });
    assert.deepEqual(after.scripts, { DFLT: ['salt', 'tnum', 'zzzz'] }, 'the default script turns on what it had, and tnum');
    assert.deepEqual(Object.keys(after.swaps.tnum), digits);
    for (const d of digits) {
      const t = after.swaps.tnum[d], dx = Math.floor((620 - WIDTHS[d]) / 2);
      assert.equal(after.adv[t], 620, `${t} is one cell wide`);
      assert.deepEqual(after.ink[t], [before.ink[d][0] + dx, before.ink[d][1] + dx], `${t} is the same shape, moved to the middle`);
      assert.equal(after.adv[d], WIDTHS[d], `${d} itself is untouched`);
      assert.deepEqual(after.ink[d], before.ink[d]);
    }
    assert.deepEqual(after.glyphs.slice(0, before.glyphs.length), before.glyphs, 'old glyphs keep their places');
  });
}

test('a font with no features of its own gets tnum under the default script', { skip }, () => {
  const { out, ran } = make('bare', 'otf');
  assert.equal(ran.status, 0, ran.stderr);
  const after = read(out);
  assert.deepEqual(after.features, ['tnum']);
  assert.deepEqual(after.scripts, { DFLT: ['tnum'] });
});

test('a font that already has tnum is written back as it was', { skip }, () => {
  const { src, out, ran, report } = make('has', 'ttf', 'feature tnum { sub A by A.alt; } tnum;');
  assert.equal(ran.status, 0, ran.stderr);
  assert.deepEqual(report, { in: src, out, had_tnum: true });
  assert.deepEqual(read(out), read(src));
});

test('a file that is not a font with digits stops with the reason', { skip }, () => {
  const ran = python(tool, join(dir, 'missing.otf'), join(dir, 'x.otf'));
  assert.notEqual(ran.status, 0);
  assert.match(ran.stderr, /missing\.otf/);
});
