import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { searchAll, searchSite } from './search.ts';
import type { PageResult } from '../fetch.ts';

const fixture = readFileSync(new URL('../../../../../spec/fixtures/pages/poshmark.html', import.meta.url), 'utf8');
const page = (html: string, status = 200): PageResult => ({ ok: true, html, status, final_url: '', rung: 'plain', ms: 0, searched: [] });

test('one site uses the same reader and counts as searchAll, with exactly one fetch', async () => {
  let calls = 0;
  const opts = { sites: ['poshmark'] as const, now: () => 0, fetchPage: async () => { calls++; return page(fixture); } };
  const one = await searchSite('poshmark', 'levi 501', 'search', opts);
  assert.equal(calls, 1);
  assert.deepEqual(await searchAll('levi 501', opts), { results: one.rows.map(row => ({ site: 'poshmark', row })), searched: [one.searched] });
  assert.equal(calls, 2);
});

test('one site distinguishes 403, login walls, empty pages and a changed reader', async () => {
  for (const [site, html, status, outcome] of [
    ['poshmark', fixture, 403, 'blocked'],
    ['facebook', '<form action="/login">Log in</form>', 200, 'blocked'],
    ['poshmark', 'No results', 200, 'empty'],
    ['poshmark', '<nav><a href="/login">Sign in</a></nav><main>No results</main>', 200, 'empty'],
    ['poshmark', '<a href="/listing/missing-6af924447625b11bb42ec837">missing card</a>', 200, 'page_changed'],
  ] as const) {
    const result = await searchSite(site, 'levi 501', 'search', { fetchPage: async () => page(html, status) });
    assert.equal(result.searched.outcome, outcome);
    assert.equal(result.searched.count, 0); assert.deepEqual(result.rows, []);
  }
});

test('a thrown fetch is recorded as timeout with its reason; unsupported sold search does not fetch', async () => {
  const fetchPage = async (): Promise<PageResult> => { throw new Error('page deadline'); };
  const failed = await searchSite('poshmark', 'x', 'search', { fetchPage });
  assert.equal(failed.searched.outcome, 'timeout');
  assert.equal(failed.searched.reason, 'page deadline');
  const sold = await searchSite('depop', 'x', 'sold', { fetchPage });
  assert.equal(sold.searched.outcome, 'empty');
  assert.match(sold.searched.reason!, /sold/);
});
