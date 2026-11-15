import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { checkCapture, decodePNG, parseTree } from './native-check.mjs';

function png(width = 8, height = 24, gradient = false, filter = 0) {
  const chunk = (name, data) => {
    const b = Buffer.alloc(data.length + 12);
    b.writeUInt32BE(data.length); b.write(name, 4); data.copy(b, 8);
    let crc = 0xffffffff;
    for (const v of b.subarray(4, -4)) {
      crc ^= v;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    b.writeUInt32BE((crc ^ 0xffffffff) >>> 0, b.length - 4);
    return b;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let previous = Buffer.alloc(width * 3);
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(width * 3, gradient && y < 20 ? 100 + y : 255);
    raw[y * (width * 3 + 1)] = filter;
    for (let x = 0; x < row.length; x++) {
      const a = x >= 3 ? row[x - 3] : 0, b = previous[x], c = x >= 3 ? previous[x - 3] : 0;
      const p = a + b - c, distances = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
      const paeth = [a, b, c][distances.indexOf(Math.min(...distances))];
      raw[y * (width * 3 + 1) + x + 1] = row[x] - [0, a, b, Math.floor((a + b) / 2), paeth][filter];
    }
    previous = row;
  }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const tree = (content = '', app = 'secondhand') => `Attributes: Application, label: '${app}'
Element subtree:
 Application, label: '${app}'
  Window (Main), {{0, 0}, {390, 844}}
    ScrollView, {{0, 0}, {390, 760}}
      StaticText, {{20, 100}, {100, 20}}, label: 'Search'
${content}
    Button, {{0, 760}, {78, 50}}, identifier: 'tab-today', label: 'Today', Selected
Path to element:
 Application, label: '${app}'`;
const check = (text, slug = 'tabs-index', image = png()) => checkCapture({ slug, tree: text, png: image, pageColors: [[255, 255, 255]] });

test('parser keeps attributes, hierarchy and window points; drops query footer', () => {
  const parsed = parseTree(tree("      Button, {{12.5, -2}, {40, 32}}, identifier: 'tap', label: 'It’s here', value: 1"));
  assert.equal(parsed.elements.filter(e => e.type === 'Application').length, 1);
  assert.deepEqual(parsed.window.frame, { x: 0, y: 0, width: 390, height: 844 });
  const button = parsed.elements.find(e => e.identifier === 'tap');
  assert.equal(button.value, '1'); assert.equal(button.label, 'It’s here');
  assert.equal(parsed.elements[button.parent].type, 'ScrollView');
});
test('PNG decodes all five filters and rejects corrupt/truncated input', () => {
  for (let filter = 0; filter < 5; filter++) assert.deepEqual(decodePNG(png(8, 24, true, filter)), decodePNG(png(8, 24, true)));
  assert.throws(() => decodePNG(png().subarray(0, -10)));
  const broken = png(); broken[45] ^= 1; assert.throws(() => decodePNG(broken));
});
test('flat page top fails N2; gradient passes', () => {
  assert(check(tree()).some(f => f.id === 'N2' && f.level === 'ERROR'));
  assert(!check(tree(), 'tabs-index', png(8, 24, true)).some(f => f.id === 'N2'));
});
test('identity rejects SpringBoard, empty app, wrong landmark and unselected tab', () => {
  for (const text of [tree('', 'SpringBoard'), "Application, label: 'secondhand'", tree().replace(', Selected', '')]) assert(check(text).some(f => f.id === 'N1'));
  assert(check(tree(), 'messages-index').some(f => f.id === 'N1'));
  assert(!check(tree(), 'search').some(f => f.id === 'N1'));
});
test('margin violations on both edges; duplicate text emits once', () => {
  const text = "      StaticText, {{12, 100}, {370, 20}}, label: 'Bad'\n        StaticText, {{12, 100}, {370, 20}}, label: 'Bad'";
  assert.equal(check(tree(text)).filter(f => f.id === 'N3').length, 1);
});
test('horizontal scroll rows and marked full-bleed descendants are exempt', () => {
  const text = "      ScrollView, {{0, 200}, {390, 50}}, identifier: 'horizontal-chips'\n        Button, {{12, 200}, {400, 44}}, label: 'Chip'\n      Other, {{0, 300}, {390, 200}}, identifier: 'full-bleed-photo'\n        Button, {{0, 300}, {390, 44}}, label: 'Photo'";
  assert(!check(tree(text)).some(f => f.id === 'N3'));
});
test('pinned interaction under bar fails; scroll child and tab button exempt', () => {
  assert(check(tree("    Button, {{20, 750}, {100, 44}}, label: 'Pinned'")).some(f => f.id === 'N4'));
  assert(!check(tree("      Button, {{20, 750}, {100, 44}}, label: 'Scroll'")).some(f => f.id === 'N4'));
  assert(check(tree("    Button, {{20, 820}, {100, 20}}, label: 'Home'")).some(f => f.id === 'N4'));
});
test('small buttons warn about unobservable hitSlop; valid targets pass', () => {
  const findings = check(tree("      Button, {{20, 200}, {40, 40}}, label: 'Small'\n      Button, {{20, 260}, {44, 44}}, label: 'Big'"));
  assert.equal(findings.filter(f => f.id === 'N5').length, 1);
  assert.equal(findings.find(f => f.id === 'N5').level, 'WARN');
});
test('type scale warns for unsupported line boxes but accepts multiline and tolerance', () => {
  const findings = check(tree("      StaticText, {{20, 200}, {100, 29}}, label: 'Bad'\n      StaticText, {{20, 240}, {100, 40}}, label: 'Two lines'\n      StaticText, {{20, 300}, {100, 19}}, label: 'Tolerance'"));
  assert.equal(findings.filter(f => f.id === 'N6').length, 1);
  assert.equal(findings.find(f => f.id === 'N6').level, 'WARN');
});

test('run manifest errors do not hide checks on captured pairs', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { runChecks } = await import('./native-check.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'native-check-test-'));
  try {
    await writeFile(join(directory, 'tabs-index.tree.txt'), tree());
    await writeFile(join(directory, 'tabs-index.png'), png());
    let result = await runChecks(directory);
    assert(result.findings.some(f => f.id === 'N1' && f.slug === 'run'));
    assert(result.findings.some(f => f.id === 'N2'));
    await writeFile(join(directory, 'run.json'), JSON.stringify({ routes: [
      { slug: 'tabs-index', route: '/', png: 'features/app/native/tabs-index.png', tree: 'features/app/native/tabs-index.tree.txt' },
      { slug: 'missing', route: '/missing', png: 'features/app/native/missing.png', tree: 'features/app/native/missing.tree.txt' },
    ] }));
    result = await runChecks(directory);
    assert(!result.findings.some(f => f.slug === 'run'));
    assert(result.findings.some(f => f.id === 'N1' && f.slug === 'missing'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('tab New and nav inbox cannot impersonate a route landmark', () => {
  const text = tree("    Button, {{20, 80}, {44, 44}}, identifier: 'nav-inbox', label: 'Messages, 4 new'\n    Button, {{170, 760}, {44, 44}}, identifier: 'tab-new', label: 'New'");
  for (const slug of ['new', 'messages-index']) assert(check(text, slug).some(f => f.id === 'N1'));
});
test('overflowing vertical content is not mistaken for a horizontal chip row', () => {
  const text = tree("      Other, {{0, 0}, {420, 1200}}\n        StaticText, {{12, 100}, {100, 20}}, label: 'Overflow'");
  assert(check(text).some(f => f.id === 'N3'));
});
test('quoted attributes preserve commas and apostrophes', () => {
  const parsed = parseTree(tree("      Button, {{20, 200}, {44, 44}}, identifier: 'chair', label: 'Sam's, chair', value: 'ready'"));
  const button = parsed.elements.find(e => e.identifier === 'chair');
  assert.equal(button.label, "Sam's, chair"); assert.equal(button.value, 'ready');
});
