import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { piiHits } from './fixtures/frames/lib.mjs';
import { MANIFEST, problems, score, photoPath } from './items/score.mjs';

const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const KINDS = ['clothes', 'shoes', 'electronics', 'furniture', 'small_goods'];
// A measured copy of the manifest for the arithmetic: every cm field answered 50, the tag read as a fixed text.
const measured = () => {
  const c = structuredClone(m);
  for (const it of c.items) for (const f of Object.values(it.fields)) { f.answer = f.unit === 'cm' ? 50 : 'size m'; f.measured_by = 'member-a'; f.measured_on = '2026-11-14'; }
  return c;
};
const predict = (c, shift) => Object.fromEntries(c.items.map((it) => [it.id, Object.fromEntries(Object.entries(it.fields).map(([k, f]) => [k, f.unit === 'cm' ? f.answer + shift : f.answer]))]));

test('manifest: every kind in product section 8, a tape-measure field and a hand-read tag on each item, photos as paths only', () => {
  assert.deepEqual([...new Set(m.items.map((i) => i.kind))].sort(), [...KINDS].sort());
  for (const it of m.items) {
    assert.ok(Object.values(it.fields).some((f) => f.unit === 'cm' && f.method === 'tape measure'), it.id);
    assert.equal(it.fields.tag_text.method, 'read by hand', it.id);
    for (const f of Object.values(it.fields)) for (const k of ['answer', 'measured_by', 'measured_on']) assert.ok(k in f, `${it.id}.${k}`);
    assert.ok('sold_price_cents' in it, it.id);
  }
  assert.deepEqual(problems(m), []);
  assert.match(photoPath(m, m.items[0].photos[0]), /^\/Volumes\/.+\/clothes-1\/front\.jpg$/);
});

test('no location fields: an address, GPS or EXIF key, an absolute or parent path, or personal data is rejected', () => {
  assert.deepEqual(piiHits(fs.readFileSync(MANIFEST, 'utf8')), []);
  for (const key of ['address', 'gps', 'latitude', 'lng', 'exif', 'location', 'phone']) {
    const c = structuredClone(m); c.items[0][key] = 'x';
    assert.ok(problems(c).length > 0, key);
    assert.throws(() => score(c, {}), /manifest rejected/, key);
  }
  const nested = structuredClone(m); nested.items[1].fields.tag_text.gps = [1, 2];
  assert.ok(problems(nested).length > 0, 'a nested key');
  for (const p of ['/etc/x.jpg', '../x.jpg', 'a/b.txt', 'https://x.test/a.jpg']) { const c = structuredClone(m); c.items[0].photos = [p]; assert.ok(problems(c).length > 0, p); }
});

test('scorer arithmetic: predictions shifted 2 cm score exactly 2 cm, exact ones 0, text 0 or 1, unmeasured skipped', () => {
  const c = measured();
  for (const r of score(c, predict(c, 2)).rows.filter((x) => x.unit === 'cm')) assert.equal(r.error, 2, `${r.item}.${r.field}`);
  for (const r of score(c, predict(c, -2)).rows.filter((x) => x.unit === 'cm')) assert.equal(r.error, 2);
  assert.ok(Object.entries(score(c, predict(c, 2)).mean_error).filter(([k]) => k.endsWith('_cm')).every(([, v]) => v.mean === 2));
  assert.ok(score(c, predict(c, 0)).rows.every((r) => r.error === 0));
  const wrong = predict(c, 0); wrong['clothes-1'].tag_text = 'size xl';
  assert.equal(score(c, wrong).rows.find((r) => r.item === 'clothes-1' && r.field === 'tag_text').error, 1);
  assert.equal(score(c, { ...predict(c, 0), 'shoes-1': {} }).rows.find((r) => r.item === 'shoes-1' && r.field === 'length_cm').status, 'missing');
  assert.ok(score(m, {}).rows.every((r) => r.status === 'unmeasured'));
  assert.notEqual(score(c, predict(c, 2.5)).rows.find((r) => r.unit === 'cm').error, 2, 'the check has teeth');
});

test('scorer prints the error per field for a predictions file', () => {
  const c = measured(), dir = fs.mkdtempSync(`${process.env.TEMP ?? '.'}/items-`);
  fs.writeFileSync(`${dir}/m.json`, JSON.stringify(c)); fs.writeFileSync(`${dir}/p.json`, JSON.stringify(predict(c, 2)));
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./items/score.mjs', import.meta.url)), `${dir}/p.json`, `${dir}/m.json`], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /clothes-1\tchest_width_cm\t2 cm/);
  assert.match(r.stdout, /"chest_width_cm": \{\s+"n": 2,\s+"mean": 2/);
});
