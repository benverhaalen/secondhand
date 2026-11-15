import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { candidates, jevRung, withFallback, type Ask, type RepairCandidate } from './fallback.ts';
import { fakeAdapter, fakeManifest, fail, VERBS, type Manifest } from '../protocol.ts';

const manifest: Manifest = fakeManifest('poshmark', 'search', {
  fields: [{ name: 'id', type: 'string', needs_session: false, required: true }, { name: 'title', type: 'string', needs_session: false, required: true }],
  output_schema: { id: 'string', title: 'string' },
});
// The site moved its grid (a renamed key) and the page also carries a bigger "recommended" list: the trap Jev must avoid.
const state = { search: { results: { items: [{ id: 'g1', title: "Levi's 501 jeans" }, { id: 'g2', title: "Levi's 505" }] } },
  sidebar: { recommended: [1, 2, 3].map(i => ({ id: `r${i}`, title: `Sponsored boots ${i}` })) } };
const broken = { ...fakeAdapter('poshmark', 'search'), manifest, run: async () => fail('page_changed', 'grid moved', { do: 'author', missing: ['id'] }) };

test('deterministic command breaks: Jev picks the result set, code validates the rows, a repair candidate is filed', async () => {
  const filed: RepairCandidate[] = [];
  let asked = '';
  const ask: Ask = async s => { asked = String(s); return { ok: true, answers: { results: { choice: 'c1', confidence: 0.9 } }, ms: 120 }; };
  const found = candidates(state, manifest);
  assert.deepEqual(found.map(c => c.path.join('.')), ['sidebar.recommended', 'search.results.items']);
  const a = withFallback({ primary: broken, jev: jevRung({ state: async () => state, ask }), fileRepair: c => { filed.push(c); } });
  const r = await a.run({ query: 'levis' }, new AbortController().signal);
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.data, [{ id: 'g1', title: "Levi's 501 jeans" }, { id: 'g2', title: "Levi's 505" }]);
  assert.match(asked, /Sponsored boots/, 'Jev reads text only: the candidate lists as lines');
  assert.deepEqual(filed, [{ site: 'poshmark', verb: 'search', rung: 'jev', ok: true, path: ['search', 'results', 'items'], reason: undefined }]);
});

test('an invalid Jev answer is never used: the code default (the largest list) stands', async () => {
  const ask: Ask = async () => ({ ok: true, answers: { results: { choice: 'c9' } }, ms: 50 });
  const r = await jevRung({ state: async () => state, ask })(manifest, {}, new AbortController().signal);
  assert.deepEqual(r.path, ['sidebar', 'recommended']);
});

test('Jev finds nothing: the agent rung answers, and files its own repair candidate', async () => {
  const filed: RepairCandidate[] = [];
  const a = withFallback({ primary: broken, jev: jevRung({ state: async () => ({}), ask: async () => ({ ok: false, reason: 'no_key', ms: 0 }) }),
    agent: async () => ({ ok: true, data: [{ id: 'a1', title: 'from the agent' }] }), fileRepair: c => { filed.push(c); } });
  const r = await a.run({}, new AbortController().signal);
  assert.ok(r.ok);
  assert.deepEqual(filed.map(f => [f.rung, f.ok]), [['jev', false], ['agent', true]]);
});

test('bot check: a blocked command never falls to a rung; a rung that meets one stops there', async () => {
  let rungs = 0;
  const blocked = { ...broken, run: async () => fail('blocked', 'check page', { do: 'pause_session', site: 'poshmark' }) };
  const a = withFallback({ primary: blocked, jev: async () => { rungs++; return { result: { ok: true, data: [] } }; }, agent: async () => { rungs++; return { ok: true, data: [] }; }, fileRepair: () => {} });
  const r = await a.run({}, new AbortController().signal);
  assert.ok(!r.ok && r.error.code === 'blocked');
  assert.equal(rungs, 0);
  const b = withFallback({ primary: broken, jev: async () => ({ result: fail('blocked', 'check page', { do: 'pause_session', site: 'poshmark' }) }),
    agent: async () => { rungs++; return { ok: true, data: [] }; }, fileRepair: () => {} });
  const r2 = await b.run({}, new AbortController().signal);
  assert.ok(!r2.ok && r2.error.code === 'blocked');
  assert.equal(rungs, 0, 'the agent is not sent past a check page');
});

test('fallback/OPERATING.md has a table for every verb', () => {
  const doc = readFileSync(new URL('./OPERATING.md', import.meta.url), 'utf8');
  for (const verb of VERBS) assert.match(doc, new RegExp(`### ${verb}\\r?\\n\\|`), verb);
});
