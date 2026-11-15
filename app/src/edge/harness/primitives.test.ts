import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog } from '../../../../log/index.js';
import { fakeManifest, VERBS } from './protocol.ts';
import { open, inspect, click, fill, extract, network, redact, isForbidden } from './primitives.ts';
import type { NetworkCapture, Page, PrimitiveContext } from './primitives.ts';
import { readFileSync } from 'node:fs';

function setup(name = 'Save listing', overrides: Partial<PrimitiveContext> = {}) {
  const calls: string[] = [], lines: string[] = [];
  const page: Page = {
    async goto(url) { calls.push('open'); return { page_id: 'p1', url, status: 200 }; },
    async inspect() { return [{ ref: 'save', role: 'button', name }]; },
    locator(ref) { return {
      async describe() { return { ref, role: 'button', name }; },
      async click() { calls.push('click'); }, async fill() { calls.push('fill'); }, async inputValue() { return 'hello'; },
    }; },
    async fingerprint() { return 'state-2'; },
    async extract() { return { data: { id: 'listing-1' }, sources: { id: 'save' } }; },
    async network() { return [{ url: 'https://example.test/items?token=secret-query', headers: { Cookie: 'secret-cookie' }, body: { id: 'listing-1', payment: { cvv: 'secret-cvv' } } }]; },
  };
  const ctx: PrimitiveContext = { page, manifest: fakeManifest('depop', 'save', { controls: ['save'] }),
    policy: async () => true, account: 'test', purpose: 'run', operation_id: 'op1',
    log: createLog({ src: 'test', build: 'test', sink: line => { lines.push(line); } }), ...overrides };
  return { ctx, calls, lines };
}

test('forbidden: actual control refused even if the recipe allowlists it', async () => {
  for (const name of ['Buy now', 'Complete purchase', 'Pay now', 'Payment details', 'Change password', 'Delete account', 'Close account', 'Enter home address', 'Solve captcha', 'buyNow', 'CHECKOUT']) {
    const { ctx, calls, lines } = setup(name);
    assert.equal(isForbidden({ ref: 'save', name }), true, name);
    for (const action of [() => click(ctx, 'save'), () => fill(ctx, 'save', 'secret-password')]) {
      const result = await action(); assert.equal(result.ok, false, name);
      if (!result.ok) assert.equal(result.error.code, 'policy_refused');
    }
    assert.deepEqual(calls, []); assert.match(lines.join(''), /policy_refused/);
    assert.doesNotMatch(lines.join(''), /secret-password/);
  }
  const { ctx, calls } = setup();
  assert.equal((await click(ctx, 'unlisted')).ok, false); assert.deepEqual(calls, []);
});

test('policy: no effects on refusal, missing operation_id or live repair account', async () => {
  for (const over of [{ policy: async () => false }, { operation_id: undefined }, { purpose: 'repair' as const, account: 'live' as const }]) {
    const { ctx, calls } = setup('Send message', over);
    assert.equal((await click(ctx, 'save')).ok, false); assert.deepEqual(calls, []);
  }
  const { ctx, calls } = setup('Safe', { policy: async () => false });
  assert.equal((await open(ctx, 'https://example.test')).ok, false); assert.deepEqual(calls, []);
});

test('primitives: one action, read-back, source refs and redacted network', async () => {
  const { ctx, calls, lines } = setup();
  assert.equal((await open(ctx, 'https://example.test')).ok, true);
  assert.equal((await inspect(ctx, 'dom')).ok, true);
  assert.deepEqual(await click(ctx, 'save'), { ok: true, data: { fingerprint: 'state-2' } });
  assert.deepEqual(await fill(ctx, 'save', 'hello'), { ok: true, data: { value: 'hello' } });
  assert.equal((await extract(ctx, { id: 'string' })).ok, true);
  const captured = await network(ctx, 'items');
  assert.equal(captured.ok, true); assert.doesNotMatch(JSON.stringify(captured), /secret-/);
  assert.doesNotMatch(lines.join(''), /secret-|hello|example.test/);
  assert.deepEqual(calls, ['open', 'click', 'fill']);
});

test('redaction: credentials and payment fields in headers, URL, JSON and form bodies', () => {
  const requests: NetworkCapture[] = [
    { url: 'https://user:secret-user@example.test/items?access_token=secret-token&q=jacket#secret-fragment', headers: { COOKIE: 'secret-cookie', 'Set-Cookie': 'secret-set', Authorization: 'Bearer secret-auth', 'X-API-Key': 'secret-key', Accept: 'application/json' }, body: { nested: [{ csrfToken: 'secret-csrf', credit_card: 'secret-card', billingAddress: 'secret-billing', title: 'jacket' }] } },
    { url: 'https://example.test', body: '{"token":"secret-json","price_cents":2500,"cardNumber":"secret-number"}' },
    { url: 'https://example.test', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'password=secret-form&cvv=secret-cvv&title=jacket' },
    { url: 'https://example.test', body: 'unstructured secret-raw' },
  ];
  for (const request of requests) {
    const before = JSON.stringify(request), result = redact(request);
    assert.doesNotMatch(JSON.stringify(result), /secret-/); assert.equal(JSON.stringify(request), before);
  }
  assert.match(JSON.stringify(redact(requests[0])), /jacket/);
});

test('OPERATING has one table for every protocol verb', () => {
  const doc = readFileSync(new URL('./OPERATING.md', import.meta.url), 'utf8');
  for (const verb of VERBS) assert.match(doc, new RegExp(`### ${verb}\\r?\\n\\|`));
});

test('redaction: serialized nested secrets, redirect URLs and payment aliases', () => {
  const result = redact({ url: 'https://example.test/items', body: {
    payload: '{"token":"secret-nested","title":"jacket"}',
    redirect: 'https://example.test?password=secret-redirect',
    bank_account: 'secret-bank', pan: 'secret-pan', pin: 'secret-pin',
  } });
  assert.doesNotMatch(JSON.stringify(result), /secret-/); assert.match(JSON.stringify(result), /jacket/);
});

test('forbidden: checkout synonyms and card autocomplete cannot bypass the code filter', async () => {
  for (const name of ['Place order', 'Confirm order', 'Submit order', 'cc-number', 'cc-exp', 'Street address', 'Reset credentials']) {
    const { ctx, calls } = setup(name);
    assert.equal((await click(ctx, 'save')).ok, false, name); assert.deepEqual(calls, []);
  }
});

test('extract: mistyped fields fail with their name; thrown browser error never leaks into logs', async () => {
  const { ctx, lines } = setup();
  ctx.page.extract = async () => ({ data: { id: 42 }, sources: { id: 'node' } });
  const result = await extract(ctx, { id: 'string' });
  assert.equal(result.ok, false); if (!result.ok) assert.match(result.error.message, /id/);
  ctx.page.locator = () => ({ describe: async () => ({ ref: 'save', name: 'Save' }), click: async () => { throw new Error('secret-browser-error'); }, fill: async () => {}, inputValue: async () => '' });
  const clicked = await click(ctx, 'save'); assert.equal(clicked.ok, false);
  if (!clicked.ok) assert.equal(clicked.error.code, 'outcome_unknown');
  assert.doesNotMatch(lines.join(''), /secret-browser-error/);
});
