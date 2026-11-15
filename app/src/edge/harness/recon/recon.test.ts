import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recordVerb, type ReconPage, type ReconResponse } from './recon.ts';
import { VERBS } from '../protocol.ts';

type Seen = { embedded: { source: string; text: string }[]; controls: { ref: string; name?: string; role?: string; href?: string }[]; body: string };
function fakePage({ title = 'levis | Shop', seen, responses = [] }: { title?: string; seen: Seen; responses?: { url: string; type: string; kind: string; text: string }[] }): ReconPage & { gone: string[] } {
  let onResponse: (r: ReconResponse) => void = () => {};
  const gone: string[] = [];
  return {
    gone,
    on: (_ev, fn) => { onResponse = fn; },
    goto: async url => {
      gone.push(url);
      for (const r of responses) onResponse({ url: () => r.url, status: () => 200, headers: () => ({ 'content-type': r.type }),
        request: () => ({ method: () => 'GET', resourceType: () => r.kind }), text: async () => r.text });
      return { status: () => 200 };
    },
    waitForTimeout: async () => {},
    title: async () => title,
    evaluate: async <T>() => seen as unknown as T,
  };
}
const base: Seen = { embedded: [{ source: 'script#__NEXT_DATA__', text: JSON.stringify({ props: { items: [{ id: 'p1', price: { amount: '25.00' }, sessionToken: 'SECRET-tok' }] } }) }],
  controls: [{ ref: '#search', name: 'Search', role: 'input' }, { ref: '#buy', name: 'Buy now', role: 'button' }, { ref: 'a:nth-of-type(3)', name: 'Levis 501', href: 'https://www.depop.com/products/x/' }], body: '24 results' };

test('records the client\'s JSON calls, the embedded state and the controls, with forbidden controls dropped', async () => {
  const page = fakePage({ seen: base, responses: [
    { url: 'https://webapi.depop.com/api/v3/search/products/?what=levis&access_token=SECRET-qs', type: 'application/json', kind: 'fetch', text: JSON.stringify({ products: [{ id: 1, slug: 'x' }], meta: { cursor: 'c2' } }) },
    { url: 'https://www.depop.com/static/app.js', type: 'application/javascript', kind: 'script', text: 'x' },
    { url: 'https://api2.branch.io/v1/open', type: 'application/json', kind: 'xhr', text: '{}' },
  ] });
  const r = await recordVerb({ page, site: 'depop', verb: 'search', url: 'https://www.depop.com/search/?q=levis', account: 'public', settleMs: 0 });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.bundle.network.length, 1, 'only JSON from the client\'s own fetch/xhr calls');
  assert.match(r.bundle.network[0].url, /search\/products/);
  assert.doesNotMatch(JSON.stringify(r.bundle), /SECRET/, 'tokens in a query string or embedded JSON are redacted');
  assert.equal(r.bundle.embedded[0].source, 'script#__NEXT_DATA__');
  assert.deepEqual(r.bundle.controls.map(c => c.ref), ['#search', 'a:nth-of-type(3)']);
});

test('bot check: a challenge page pauses recon and asks the person; nothing is recorded', async () => {
  const r = await recordVerb({ page: fakePage({ title: 'Just a moment...', seen: base }), site: 'mercari', verb: 'search', url: 'https://www.mercari.com/search/?keyword=x', account: 'public', settleMs: 0 });
  assert.ok(!r.ok && 'paused' in r && r.paused === 'challenge' && /the person clears it/.test(r.ask));
});

test('never on a person\'s account without Nate\'s go', async () => {
  const page = fakePage({ seen: base });
  const r = await recordVerb({ page, site: 'depop', verb: 'read_listings', url: 'https://www.depop.com/', account: 'live', settleMs: 0 });
  assert.ok(!r.ok && 'refused' in r);
  assert.deepEqual(page.gone, [], 'the page was never opened');
});

test('redaction: a recorded request never carries a cookie', async () => {
  const page = fakePage({ seen: { ...base, embedded: [] }, responses: [{ url: 'https://api.example/x', type: 'application/json', kind: 'xhr', text: JSON.stringify({ cookie: 'SECRET-c', Set_Cookie: 'SECRET-s', ok: 1 }) }] });
  const r = await recordVerb({ page, site: 'poshmark', verb: 'search', url: 'https://poshmark.com/search?query=x', account: 'public', settleMs: 0 });
  assert.ok(r.ok && !JSON.stringify(r.bundle).includes('SECRET'));
});

test('recon/OPERATING.md has a table for every verb', () => {
  const doc = readFileSync(new URL('./OPERATING.md', import.meta.url), 'utf8');
  for (const verb of VERBS) assert.match(doc, new RegExp(`### ${verb}\\r?\\n\\|`), verb);
});
