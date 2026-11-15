import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLog, memorySink } from '../../../../../../log/index.js';
import { searchParams } from '../../../intel/run.ts';
import { memoryShoppingSpend } from '../../../intel/public/search.ts';
import { createShopping, ENDPOINT, type ShoppingFetch } from './adapter.ts';

const fixture = readFileSync(new URL('./fixtures/shopping.json', import.meta.url), 'utf8');
const sentinel = 'SYNTHETIC_SHOPPING_SECRET';
const signal = () => new AbortController().signal;
function harness(options: { token?: string; status?: number; cost?: string | null; body?: string; fetch?: ShoppingFetch; spend?: ReturnType<typeof memoryShoppingSpend> } = {}) {
  const sink = memorySink(), sent: { url: string; init: Parameters<ShoppingFetch>[1] }[] = [];
  const log = createLog({ src: 'test.shopping', build: 'test', sink });
  const shopping = createShopping({ token: options.token ?? sentinel, log, now: () => Date.parse('2026-11-15T13:40:00Z'), spend: options.spend ?? memoryShoppingSpend(),
    fetch: async (url, init) => {
      sent.push({ url, init });
      if (options.fetch) return options.fetch(url, init);
      return new Response(options.body ?? fixture, { status: options.status ?? 200,
        headers: options.cost === null ? {} : { 'x-treg-cost-micro': options.cost ?? '2000', 'x-treg-call-id': 'synthetic-call' } });
    } });
  return { shopping, sent, sink };
}

test('request: shopping endpoint, US query, server token and one-call ceiling', async () => {
  const h = harness(); await h.shopping.search({ q: 'private words' }, signal());
  assert.equal(h.sent[0].url, ENDPOINT);
  assert.equal(ENDPOINT, 'https://treg.to/call/serper.google.serp.shopping');
  assert.equal(h.sent[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(h.sent[0].init.body), { q: 'private words', gl: 'us' });
  assert.equal(h.sent[0].init.headers['X-Treg-Token'], sentinel);
  assert.equal(h.sent[0].init.headers['X-Treg-Route-Max-Cost'], '0.005');
});

test('non-dollar or unparseable prices are dropped and counted; eBay is secondhand and retail is not', async () => {
  const h = harness(), r = await h.shopping.search({ q: 'x' }, signal()); assert.ok(r.ok);
  assert.equal(r.data.total, 4); assert.equal(r.data.dropped, 2);
  assert.deepEqual(r.data.rows.map(row => row.price_cents), [5947, 129900]);
  assert.deepEqual(r.data.rows.map(row => [row.source_site, row.secondhand]), [['ebay', true], ['walmart', false]]);
  assert.equal(r.data.rows[0].id, 'EXAMPLE_USED'); assert.match(r.data.rows[1].id, /^google_shopping-[a-f0-9]{12}$/);
  for (const row of r.data.rows) {
    assert.equal(row.attribution, 'Google Shopping'); assert.equal(row.currency, 'USD');
    assert.equal(row.may_store, false); assert.equal(row.may_model, false); assert.equal(row.sold, undefined);
  }
  assert.equal(r.data.rows[1].image_url, undefined);
});

test('all optional fields may be absent; only known resale merchants are secondhand', async () => {
  const merchants = ['Poshmark', 'Depop', 'Mercari', 'ThredUp', 'The RealReal', "Levi's", undefined];
  const body = JSON.stringify({ shopping: merchants.map((source, i) => ({ title: 'invented', link: `https://example.invalid/${i}`, price: '$1.00', source })) });
  const r = await harness({ body }).shopping.search({ q: 'x' }, signal()); assert.ok(r.ok);
  assert.equal(r.data.dropped, 0);
  assert.deepEqual(r.data.rows.map(row => row.secondhand), [true, true, true, true, true, false, false]);
});

test('no token: no fetch and no spend reservation', async () => {
  const h = harness({ token: '', spend: { reserve: async () => assert.fail('missing token reserved spend') } });
  const r = await h.shopping.search({ q: 'x' }, signal());
  assert.ok(!r.ok); assert.equal(r.error.code, 'no_route'); assert.equal(h.sent.length, 0);
});

test('cost from the header is logged per call; a missing header logs the estimated prior', async () => {
  for (const [cost, expected, estimated] of [['3400', 0.0034, false], [null, 0.002, true]] as const) {
    const h = harness({ cost }); await h.shopping.search({ q: 'private words' }, signal());
    const entries = h.sink.lines.map(line => JSON.parse(line));
    assert.ok(entries.some(e => e.event === 'call.start' && e.kind === 'tool' && e.name === 'google_shopping.search'));
    const end = entries.find(e => e.event === 'call.end');
    assert.equal(end.cost_usd, expected); assert.equal(end.cost_estimated, estimated); assert.equal(end.rows, 2);
    assert.equal(typeof end.ms, 'number'); assert.equal(h.sink.text().includes('private words'), false);
  }
});

test('over the daily cap: rate_limited, no fetch; reservations are atomic and reset by day', async () => {
  const name = 'search_shopping_usd_per_day', prior = searchParams.read(name, {}).value;
  try {
    searchParams.declare({ name, family: 'scalar', prior: 0.004, guard_lo: 0 });
    const spend = memoryShoppingSpend();
    const reservations = await Promise.all(Array.from({ length: 10 }, () => spend.reserve('2026-11-15', 0.002)));
    assert.equal(reservations.filter(r => r.ok).length, 2);
    const h = harness({ spend }), r = await h.shopping.search({ q: 'x' }, signal());
    assert.ok(!r.ok); assert.equal(r.error.code, 'rate_limited'); assert.equal(r.error.message, name); assert.equal(h.sent.length, 0);
    assert.deepEqual(await spend.reserve('2026-11-16', 0.002), { ok: true });
    searchParams.declare({ name, family: 'scalar', prior: 0, guard_lo: 0 });
    assert.equal((await harness().shopping.search({ q: 'x' }, signal())).ok, false);
  } finally { searchParams.declare({ name, family: 'scalar', prior, guard_lo: 0 }); }
});

test('4xx and 5xx fail without echoing a response body or token into errors or logs', async () => {
  for (const status of [401, 403, 429, 500, 503]) {
    const h = harness({ status, body: sentinel }), r = await h.shopping.search({ q: 'x' }, signal());
    assert.ok(!r.ok); assert.equal(h.sent.length, 1);
    assert.equal(JSON.stringify(r).includes(sentinel), false); assert.equal(h.sink.text().includes(sentinel), false);
    assert.ok(h.sink.lines.some(line => line.includes('"cost_usd":0.002')));
  }
});

test('abort cancels the fetch and counts timed_out; thrown transport errors cannot leak the token', async () => {
  const controller = new AbortController(); let observed: AbortSignal | undefined;
  const h = harness({ fetch: async (_url, init) => {
    observed = init.signal;
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error(sentinel)), { once: true }));
  } });
  const pending = h.shopping.search({ q: 'x' }, controller.signal);
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  const r = await pending; assert.ok(!r.ok); assert.equal(r.error.code, 'timed_out'); assert.equal(observed?.aborted, true);
  const thrown = harness({ fetch: async () => { throw new Error(sentinel); } });
  const failed = await thrown.shopping.search({ q: 'x' }, signal()); assert.ok(!failed.ok);
  assert.equal(JSON.stringify([r, failed, h.sink.lines, thrown.sink.lines]).includes(sentinel), false);
});

test('malformed JSON or shopping shape fails page_changed; invalid input makes no call', async () => {
  for (const body of ['not json', '{"shopping":null}']) {
    const r = await harness({ body }).shopping.search({ q: 'x' }, signal()); assert.ok(!r.ok); assert.equal(r.error.code, 'page_changed');
  }
  const h = harness(); const r = await h.shopping.search({ q: ' ' }, signal()); assert.ok(!r.ok); assert.equal(h.sent.length, 0);
});

test('failure envelopes retain the protocol hint beside code and message', async () => {
  const missing = await harness({ token: '' }).shopping.search({ q: 'x' }, signal());
  assert.ok(!missing.ok); assert.deepEqual(missing.error.hint, { do: 'handoff', url: 'https://shopping.google.com' });
  const capped = await harness({ spend: { reserve: async () => ({ ok: false, cap: 'search_shopping_usd_per_day' }) } }).shopping.search({ q: 'x' }, signal());
  assert.ok(!capped.ok); assert.equal(capped.error.hint.do, 'retry_after');
});
