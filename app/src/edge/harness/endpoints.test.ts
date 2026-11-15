import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PATHS, endpointDoc, endpoints } from './endpoints.ts';
import { SITES, VERBS, fakeManifest } from './protocol.ts';

test('ENDPOINTS.md is exactly what the profiles generate: the docs cannot drift', () => {
  assert.equal(readFileSync(new URL('./ENDPOINTS.md', import.meta.url), 'utf8'), endpointDoc(),
    'regenerate with: node app/src/edge/harness/endpoints.ts --write');
});

test('every site and verb is an endpoint; post is /write-listing; absent verbs say why', () => {
  const all = endpoints();
  assert.equal(all.length, SITES.length * VERBS.length);
  assert.equal(new Set(Object.values(PATHS)).size, VERBS.length);
  assert.equal(all.find(e => e.site === 'depop' && e.verb === 'post')?.path, '/depop/write-listing');
  assert.equal(all.find(e => e.site === 'depop' && e.verb === 'post')?.method, 'POST');
  assert.match(String(all.find(e => e.site === 'grailed' && e.verb === 'post')?.available), /planned/);
});

test('a manifest fills its endpoint\'s session and schemas', () => {
  const e = endpoints([fakeManifest('depop', 'search')]).find(x => x.site === 'depop' && x.verb === 'search');
  assert.equal(e?.session, 'public');
  assert.deepEqual(e?.output, { id: 'string', title: 'string', price_cents: 'cents' });
});
