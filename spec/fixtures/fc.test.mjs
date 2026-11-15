import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirHash, filesUnder, piiHits } from './frames/lib.mjs';

const dir = fileURLToPath(new URL('./fc/', import.meta.url));
const PINNED = { version: 1, sha256: 'a259d0e3a73df3a46eb63788ee468c44511be0e7dbf243b54dd1ceb075ddc476' };
const read = (f) => JSON.parse(fs.readFileSync(dir + f, 'utf8'));
const manifest = read('manifest.json'), fcs = read('forecasts.json'), expected = read('expected.json');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(dir + f)).digest('hex');

// Reference scoring (demand-and-trend: pinball loss at p10, p50, p90; 80% inside p10 to p90).
const pin = (y, p, q) => Math.max(q * (y - p), (q - 1) * (y - p));
export function score(fcs, now) {
  const res = fcs.filter((f) => f.resolved_value != null);
  const ends = (f) => Date.parse(f.as_of) + f.horizon_weeks * 7 * 864e5;
  const inside = res.filter((f) => f.resolved_value >= f.p10 && f.resolved_value <= f.p90).map((f) => f.id);
  return {
    resolved_ids: res.map((f) => f.id),
    pinball_loss: Object.fromEntries(res.map((f) => [f.id, Math.round(((pin(f.resolved_value, f.p10, 0.1) + pin(f.resolved_value, f.p50, 0.5) + pin(f.resolved_value, f.p90, 0.9)) / 3) * 100) / 100])),
    inside_p10_p90: inside,
    coverage: { inside: inside.length, of: res.length },
    due_unresolved_ids: fcs.filter((f) => f.resolved_value == null && ends(f) <= Date.parse(now)).map((f) => f.id),
    open_ids: fcs.filter((f) => f.resolved_value == null && ends(f) > Date.parse(now)).map((f) => f.id),
  };
}

test('hash pinned: a changed fixture needs a new version and a new pin', () => {
  assert.equal(manifest.version, PINNED.version, 'version moved: update PINNED with the new hash');
  for (const [f, h] of Object.entries(manifest.sha256)) assert.equal(sha(f), h, `${f} changed without a manifest update`);
  assert.equal(dirHash(dir), PINNED.sha256, 'fixture bytes changed: bump version and re-pin');
});

test('every forecast has the fc_ row fields from product.md and ordered quantiles', () => {
  for (const f of fcs) {
    for (const k of ['id', 'subject', 'horizon_weeks', 'metric', 'p10', 'p50', 'p90', 'basis_count', 'param_versions', 'model_version', 'as_of']) assert.ok(k in f, `${f.id} ${k}`);
    assert.match(f.id, /^fc_/);
    assert.ok(f.p10 <= f.p50 && f.p50 <= f.p90, f.id);
    assert.ok([4, 8, 12].includes(f.horizon_weeks));
  }
  assert.equal(new Set(fcs.map((f) => f.id)).size, fcs.length);
  assert.ok(fcs.some((f) => f.resolved_value == null), 'unresolved rows present');
});

test('expected answer beside the input: resolved, loss, coverage, due and open', () => {
  const { now, rule, ...answer } = expected;
  assert.deepEqual(score(fcs, now), answer);
  assert.deepEqual(expected.due_unresolved_ids, ['fc_fx9'], 'a forecast past its horizon without a value is due, not scored');
  assert.deepEqual(expected.coverage, { inside: 6, of: 8 });
});

test('no PII: no email, phone, street, token or location in any file', () => {
  for (const f of filesUnder(dir, '.json')) assert.deepEqual(piiHits(fs.readFileSync(f, 'utf8')), [], f);
});

test('planted PII is caught', () => {
  assert.ok(piiHits('{"owner":"jane.doe@example.com"}').includes('email'));
  assert.ok(piiHits('call 555-123-4567').length > 0);
});
