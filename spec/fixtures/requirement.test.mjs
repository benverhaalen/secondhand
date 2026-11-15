import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirHash, filesUnder, piiHits } from './frames/lib.mjs';

const dir = fileURLToPath(new URL('./requirement/', import.meta.url));
const PINNED = { version: 1, sha256: '6b48497a35a7071b70ad0e0879e8ca424e277ab9a22e8c1c9b2fe129f0ca2785' };
const reg = JSON.parse(fs.readFileSync(`${dir}requirement.json`, 'utf8'));
const { cases } = JSON.parse(fs.readFileSync(`${dir}cases.json`, 'utf8'));
const W = reg.importance_weight;

test('hash pinned: a changed fixture needs a new version and a new pin', () => {
  assert.equal(reg.version, PINNED.version, 'version moved: update PINNED in this test with the new hash');
  assert.equal(dirHash(dir), PINNED.sha256, 'fixture bytes changed without a version bump');
});

test('no PII: no person, address, phone, token or location key in any file', () => {
  for (const f of filesUnder(dir, '.json')) assert.deepEqual(piiHits(fs.readFileSync(f, 'utf8')), [], f);
});

test('no PII: the scan catches planted personal data', () => {
  for (const s of ['{"note":"call 555-123-4567"}', '{"note":"jo@example.com"}', '{"note":"12 Elm Street"}', '{"t":"ghp_abcdefghijklmnopqrstuvwx"}', '{"gps":1}'])
    assert.notDeepEqual(piiHits(s), [], s);
});

test('rows: shape, derived priority, ladder rungs', () => {
  const rungs = ['label', 'measured', 'seen', 'lookup', 'asked'];
  for (const r of reg.rows) {
    for (const k of ['item_kind', 'node', 'field', 'type', 'role', 'site_names', 'importance', 'fill_ladder', 'views_needed', 'seconds', 'effort', 'priority', 'version']) assert.ok(k in r, `${r.id}.${k}`);
    const all = [r.importance.match, r.importance.value, ...Object.values(r.importance.rank)];
    assert.equal(r.priority, all.sort((a, b) => W[b] - W[a])[0], r.id);
    assert.ok(r.fill_ladder.every((l) => rungs.includes(l.rung) && l.route), r.id);
    assert.ok([2, 3].includes(r.effort), r.id);
  }
});

test('expected answers: next view is the best worth over the bar, never a kept view', () => {
  for (const c of cases) {
    const cands = reg.rows.filter((r) => r.item_kind === c.kind && c.unmet.includes(r.field)).flatMap((r) =>
      r.views_needed.filter((v) => !c.kept_views.includes(v)).map((v) => ({ view: v, row_id: r.id, worth: Math.round(W[r.priority] * (c.p_view_fills[v]?.[r.field] ?? 0) * c.value_at_stake[r.field] * 1e6) / 1e6 })))
      .filter((x) => x.worth >= c.bar).sort((a, b) => b.worth - a.worth);
    assert.deepEqual(c.expected.next_view, cands[0] ?? null, c.name);
  }
});

test('expected answers: follow-ups at most 3, condition first, nothing a frame settled, function never preselected', () => {
  for (const c of cases) {
    const f = c.expected.follow_ups;
    assert.ok(f.length <= 3, c.name);
    if (f.length && c.facts.condition?.state === 'empty') assert.equal(f[0].field, 'condition', c.name);
    for (const x of f) {
      assert.notEqual(c.facts[x.field]?.state, 'settled', `${c.name}: ${x.field} already settled`);
      if (x.field === 'function') assert.equal(x.preselect, null);
    }
  }
  assert.ok(cases.some((c) => c.expected.follow_ups.some((x) => x.field === 'size_label') && c.facts.size_label?.state === 'empty'));
  assert.ok(cases.some((c) => c.facts.size_label?.state === 'settled' && !c.expected.follow_ups.some((x) => x.field === 'size_label')), 'a settled fact is never asked');
});
