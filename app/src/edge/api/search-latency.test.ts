// Offline gate for J12. Delays belong to source reads; no benchmark or network is used.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { handlers, ports, searchJobs } from './search.ts';
import { jobs, type ApiJobRow } from './jobs.ts';
import { SOURCES } from '../intel/public/sources.ts';
import { _reset, searchParams } from '../intel/run.ts';
import { createHarness } from '../harness/protocol.ts';
import { ebayPageAdapters } from '../harness/sites/ebay/adapter.ts';
import { depopAdapters } from '../harness/sites/depop/adapter.ts';
import type { SearchOpts } from '../intel/public/search.ts';

const original = { ...ports };
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const fixture = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const ask: typeof ports.ask = async (_state, questions) => ({ ok: true, ms: 0,
  answers: Object.fromEntries(Object.keys(questions).map(k => [k, { choice: k.startsWith('m') ? 'likely_same_model' : 'keep' }])) });
beforeEach(() => {
  _reset(); deps.idem.clear(); deps.visits.clear(); deps.verify = async () => null;
  deps.log = createLog({ src: 'test.latency', build: 'test', sink: memorySink() }); deps.now = Date.now;
  searchParams.declare({ name: 'search_browser_start_ms', family: 'scalar', prior: 30000 });
  Object.assign(ports, { ...original, harness: undefined, accounts: undefined, apify: undefined, routed: () => false, ask, deadline_ms: 2500,
    sources: SOURCES.filter(s => ['dupe', 'poshmark', 'facebook', 'depop', 'ebay', 'mercari'].includes(s.id)).map(s => ({ ...s, pace: { per_minute: 1e12, min_gap_ms: 0 } })) });
});
afterEach(async () => { await Promise.all(searchJobs.pendingSearches.values()); Object.assign(ports, original); _reset(); });

async function search(text: string, visitor: string) {
  const response = await route('POST /v1/search', handlers['POST /v1/search'], { auth: 'visitor' })(new Request('http://edge.test/v1/search', {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-Visitor-Id': visitor, 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ text }),
  }));
  assert.equal(response.status, 202);
  const body = await response.json() as { id: string };
  await searchJobs.pendingSearches.get(body.id);
  const saved = jobs.st.getJob(body.id)! as Omit<ApiJobRow, 'stages'> & { stages: (ApiJobRow['stages'][number] & { error?: { code: string } })[] };
  const frames = jobs.framesAfter(body.id, 0);
  return { saved, frames };
}

function reads(ebayRouted: boolean, completions: number[], ebayStarts: number[]) {
  ports.dupe = { search: async () => {
    await sleep(300); completions.push(performance.now());
    return { ok: true, data: { rows: [{ id: 'dupe-demo', title: 'levi 501', price_cents: 1200, currency: 'USD', url: 'https://dupe.com/demo',
      commercial_link: true, attribution: 'Dupe.com', source_site: 'ebay', secondhand: true, keep_until: new Date().toISOString() }], total: 1, dropped: 0, keep_until: new Date().toISOString() } };
  } };
  ports.fetchPage = async () => { await sleep(600); completions.push(performance.now()); return {
    ok: true, status: 200, html: fixture('../../../../spec/fixtures/pages/poshmark.html'), final_url: '', rung: 'plain', ms: 600, searched: [],
  }; };
  const apify: NonNullable<SearchOpts['apify']> = { search: async lane => {
    if (lane === 'ebay') return { ok: false, error: { code: 'no_route', message: 'no live route composed', hint: { do: 'handoff', url: '' } } };
    await sleep(1500); completions.push(performance.now());
    return { ok: true, data: { rows: [{ id: 'facebook:demo', title: 'levi 501', price_cents: 1200, currency: 'USD', url: 'https://www.facebook.com/marketplace/item/demo',
      via: 'apify', actor: 'apify~facebook-marketplace-scraper', may_model: false, use_scope: 'hackathon_demo' }], total: 1, dropped: 0 } };
  } };
  // This fake has a Facebook route only; eBay fallback immediately answers no_route.
  ports.apify = apify;
  if (ebayRouted) {
    ports.harness = createHarness({ adapters: ebayPageAdapters({ signed_in: false, page: async () => {
      ebayStarts.push(performance.now()); await sleep(400); completions.push(performance.now());
      return { status: 200, html: fixture('../harness/sites/ebay/fixtures/page-search.html') };
    } }) });
    ports.routed = site => site === 'ebay';
    ports.sources = ports.sources.map(s => s.id === 'ebay' ? { ...s, pace: SOURCES.find(s => s.id === 'ebay')!.pace } : s);
  }
}

for (const ebayRouted of [false, true]) test(`three unsigned searches settle at their slowest runnable read; eBay routed=${ebayRouted}`, async () => {
  const completions: number[] = [], ebayStarts: number[] = [];
  reads(ebayRouted, completions, ebayStarts);
  for (let i = 0; i < 3; i++) {
    completions.length = 0;
    const at = performance.now();
    const { saved, frames } = await search(`levi 501 latency ${i}`, `vis_latency${ebayRouted ? 'yes' : 'no'}${i}`);
    for (const stage of saved.stages.filter(s => s.name === 'site:depop' || s.name === 'site:mercari' || !ebayRouted && s.name === 'site:ebay')) {
      assert.equal(stage.error?.code, 'no_route');
      assert.ok(Date.parse(stage.ended_at!) - Date.parse(stage.started_at!) < 100, `${stage.name}: a not-routed source delayed the stage`);
    }
    const settled = frames.find(f => f.event === 'answer.settled')!.data.answer as { ms: { first: number; settled: number } };
    assert.ok(performance.now() - Math.max(...completions) < 150, 'answer.settled waited after the slowest routed stub');
    assert.ok(settled.ms.first >= 290 && settled.ms.first <= 450, `first useful answer did not follow the 300 ms read: ${settled.ms.first}`);
    assert.ok(settled.ms.settled >= 1490);
    if (!ebayRouted) assert.ok(performance.now() - at < 1650, 'a not-routed source delayed answer.settled');
  }
  if (ebayRouted) {
    const pace = SOURCES.find(s => s.id === 'ebay')!.pace;
    const gap = Math.max(pace.min_gap_ms, 60000 / pace.per_minute);
    assert.equal(ebayStarts.length, 3);
    for (let i = 1; i < 3; i++) assert.ok(ebayStarts[i] - ebayStarts[i - 1] <= gap + 150, 'eBay waited on a slot belonging to a read that did not run');
  }
});

test('browser-start allowance extends a read deadline without adding a wait before a runnable or unrouted stage', async () => {
  ports.sources = ports.sources.filter(s => s.id === 'depop');
  const at = performance.now(); const { saved } = await search('no browser', 'vis_allowance');
  assert.equal(saved.stages[0].error?.code, 'no_route');
  assert.ok(performance.now() - at < 100, 'startup allowance added an unconditional wait');
  searchParams.declare({ name: 'search_browser_start_ms', family: 'scalar', prior: 60 });
  ports.deadline_ms = 20;
  ports.routed = () => true;
  let endedAt = 0;
  ports.harness = createHarness({ adapters: depopAdapters({ signed_in: false,
    doc: async () => { await sleep(40); endedAt = performance.now(); return { status: 200, html: fixture('../harness/sites/depop/fixtures/search.html') }; },
    json: async () => { assert.fail('Depop search must use its page client'); },
  }) });
  const runnableAt = performance.now();
  const runnable = await search('started browser', 'vis_allowance');
  assert.equal(runnable.saved.stages[0].state, 'arrived', 'browser-start allowance was not available to its own read');
  assert.ok(endedAt - runnableAt < 100, 'browser-start allowance delayed starting a runnable read');
  assert.ok(performance.now() - endedAt < 50, 'browser-start allowance waited after its own read answered');
});

test('cached-then-live refresh waits only for its own pace slot and its own second read', async () => {
  ports.sources = ports.sources.filter(s => s.id === 'poshmark').map(s => ({ ...s, pace: { per_minute: 120, min_gap_ms: 500 } }));
  const starts: number[] = [], ends: number[] = [];
  ports.fetchPage = async () => {
    starts.push(performance.now()); await sleep(80); ends.push(performance.now());
    return { ok: true, status: 200, html: fixture('../../../../spec/fixtures/pages/poshmark.html'), final_url: '', rung: 'plain', ms: 80, searched: [] };
  };
  await search('cached query', 'vis_cached');
  const { frames } = await search('cached query', 'vis_cached');
  assert.equal(starts.length, 2, 'cached-then-live made an extra read');
  assert.ok(starts[1] - starts[0] >= 490 && starts[1] - starts[0] < 650, 'refresh waited on more than its own pace gap');
  assert.equal(frames.filter(f => f.event === 'answer.partial').length, 2, 'cached batch and live delta must both land');
  assert.ok(performance.now() - ends[1] < 150, 'settled waited after the live refresh answered');
});
