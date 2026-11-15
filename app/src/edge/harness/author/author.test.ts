import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyRecipe, author, embeddedFromHtml, type Get } from './author.ts';
import { gate } from '../release.ts';
import { fakeManifest, type Manifest } from '../protocol.ts';
import type { RecordingBundle } from '../recon/recon.ts';

// A real signed-out Poshmark search, trimmed (author/fixtures/poshmark-search.json, from runs/hp-7.md).
const fx = JSON.parse(readFileSync(new URL('./fixtures/poshmark-search.json', import.meta.url), 'utf8'));
const items = fx.embedded.json.$_search.gridData.data as { id: string; title: string; price_amount: { val: string }; size: string; brand: string }[];
const manifest: Manifest = fakeManifest('poshmark', 'search', {
  output_schema: { id: 'string', title: 'string', price: 'string', size: 'string' },
  fields: [{ name: 'id', type: 'string', needs_session: false, required: true }, { name: 'title', type: 'string', needs_session: false, required: true },
    { name: 'price', type: 'string', needs_session: false, required: true }, { name: 'size', type: 'string', needs_session: false, required: true }],
});
const bundle: RecordingBundle = { site: 'poshmark', verb: 'search', url: fx.url, recorded_at: '2026-11-15T00:00:00Z', status: 200, title: 'levis 501 on Poshmark',
  network: [], embedded: [fx.embedded], controls: [], ms: { load: 0, total: 0 } };
const row = (i: number) => ({ id: items[i].id, title: items[i].title, price: items[i].price_amount.val, size: items[i].size });
const html = `<html><head><title>levis 501 on Poshmark</title></head><body><script>window.__INITIAL_STATE__ = ${JSON.stringify(fx.embedded.json)};</script></body></html>`;

test('a recording with no endpoint becomes a page recipe over the embedded state, generalised to every listing', () => {
  const a = author({ bundle, manifest, examples: [row(0), row(1)] });
  assert.ok(a.ok, JSON.stringify(a));
  if (!a.ok) return;
  assert.equal(a.recipe.strategy, 'embedded');
  assert.deepEqual(a.recipe.rows, ['$_search', 'gridData', 'data', '*']);
  assert.deepEqual(a.recipe.fields.price, ['price_amount', 'val']);
  assert.deepEqual(applyRecipe(a.recipe, fx.embedded.json), [row(0), row(1), row(2)], 'the third listing, never shown to the author, comes out too');
});

test('an endpoint that carries the fields wins: COOKIE strategy first', () => {
  const api = { url: 'https://poshmark.com/vm-rest/posts?query=levis', response: { data: items.map(i => ({ id: i.id, title: i.title, price_amount: i.price_amount, size: i.size })) } };
  const a = author({ bundle: { ...bundle, network: [api] }, manifest, examples: [row(0), row(1)] });
  assert.ok(a.ok && a.recipe.strategy === 'cookie' && a.recipe.url === api.url);
});

test('field gate: a field absent from the recording is not released', () => {
  const m = { ...manifest, fields: [...manifest.fields, { name: 'watchers', type: 'number' as const, needs_session: true, required: true }] };
  const a = author({ bundle, manifest: m, examples: [{ ...row(0), watchers: 7 }, { ...row(1), watchers: 9 }] });
  assert.ok(!a.ok && a.missing.includes('watchers'));
});

test('deterministic run: one plain request, no browser, under 1 s, and it passes the release gate', async () => {
  let requests = 0;
  const get: Get = async () => { requests++; return { status: 200, text: html }; };
  const a = author({ bundle, manifest, examples: [row(0), row(1)], get });
  assert.ok(a.ok);
  if (!a.ok) return;
  const t0 = performance.now();
  const r = await a.adapter.run({ query: 'levis 501' }, new AbortController().signal);
  assert.ok(performance.now() - t0 < 1000);
  assert.equal(requests, 1);
  assert.ok(r.ok && Array.isArray(r.data) && r.data.length === 3);
  const g = await gate(a.adapter, { capture: fx.embedded.json, args: { query: 'levis 501' }, expected: [row(0), row(1), row(2)] },
    { account: 'test', liveRead: (ad, args, s) => ad.run(args, s), dryRun: async () => [] });
  assert.deepEqual(g.failures, []);
});

test('a plain request refused (403 or a check page) is blocked, never routed around; zero listings is ok []', async () => {
  const blocked = author({ bundle, manifest, examples: [row(0), row(1)], get: async () => ({ status: 403, text: '' }) });
  assert.ok(blocked.ok);
  if (!blocked.ok) return;
  const r = await blocked.adapter.run({}, new AbortController().signal);
  assert.ok(!r.ok && r.error.code === 'blocked');
  const empty = author({ bundle, manifest, examples: [row(0), row(1)], get: async () => ({ status: 200, text: html.replace(JSON.stringify(fx.embedded.json), '{"$_search":{"gridData":{"data":[]}}}') }) });
  assert.ok(empty.ok);
  if (empty.ok) assert.deepEqual(await empty.adapter.run({}, new AbortController().signal), { ok: true, data: [] });
});

test('embeddedFromHtml survives a closing brace inside a string', () => {
  assert.deepEqual(embeddedFromHtml('<script>window.__INITIAL_STATE__ = {"t":"a } b","n":{"x":1}};</script>', 'window.__INITIAL_STATE__'), { t: 'a } b', n: { x: 1 } });
});
