// Check: node --test --test-concurrency=1 scripts/realtime-proof.test.mjs
// Rests-on: spec/product.md §3, §6; spec/engines/intelligence-api.md §3.5, §4;
// spec/engines/valuation.md §3–4; spec/determinations/money.md D1; spec/plans/joins.md.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const AS_OF = '2026-11-15T00:00:00.000Z';
const LATER = '2026-12-15T00:00:00.000Z';
const sha = text => createHash('sha256').update(text).digest('hex');
const read = path => readFileSync(resolve(ROOT, path), 'utf8');
const json = value => JSON.parse(JSON.stringify(value));
const fixture = name => read(`scripts/fixtures/realtime/${name}.html`);
const FIXTURES = [
  ['depop', 'spec/fixtures/pages/depop.html', '2026-11-14'],
  ['poshmark', 'spec/fixtures/pages/poshmark.html', '2026-11-14'],
  ['poshmark-sold', 'app/src/edge/harness/sites/poshmark/fixtures/search-sold.html', '2026-11-15'],
  ['poshmark-empty', 'app/src/edge/harness/sites/poshmark/fixtures/search-empty.html', '2026-11-15'],
].map(([name, source, recorded_at]) => ({ path: `scripts/fixtures/realtime/${name}.html`, source,
  recorded_at, data: 'dataset:realtime-fixtures', sha256: sha(fixture(name)) }));

export async function withoutNetwork(run) {
  const original = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = () => { attempts++; throw new Error('network forbidden in realtime proof'); };
  try { return { value: await run(), attempts }; }
  finally { globalThis.fetch = original; }
}

function location(file, anchor) {
  const lines = read(file).split('\n');
  const i = lines.findIndex(line => line.trimStart().startsWith(anchor));
  assert.ok(i >= 0, `${file}: lost proof anchor ${anchor}`);
  return { file, line: i + 1 };
}

// This inventory is evidence of missing joins, not a replacement for executing the routes.
function importers(target) {
  const hits = [];
  const walk = dir => {
    for (const entry of readdirSync(resolve(ROOT, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { walk(path); continue; }
      if (!/\.(ts|tsx|js|mjs)$/.test(path) || /\.test\./.test(path)) continue;
      for (const m of read(path).matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
        if (!m[1].startsWith('.')) continue;
        if (relative(ROOT, resolve(ROOT, dirname(path), m[1])) === target) hits.push(path);
      }
    }
  };
  walk('app/src');
  return [...new Set(hits)].sort();
}

async function runOnce() {
  // Each worker has fresh module state and stores. Only clock inputs are fixed; no outputs are rounded or masked for equality.
  delete process.env.SECONDHAND_DATA_DIR;
  delete process.env.SECONDHAND_LIVE_SITES;
  const NativeDate = Date;
  globalThis.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [AS_OF])); }
    static now() { return NativeDate.parse(AS_OF); }
  };
  Object.defineProperty(performance, 'now', { value: () => 0, configurable: true });
  return withoutNetwork(async () => {
    const { createLog, memorySink } = await import('../log/index.js');
    const { checkLog } = await import('../spec/log.mjs');
    const valuation = await import('../app/src/edge/api/valuations.ts');
    const { soldSearch } = await import('../app/src/edge/api/valuation-sold.ts');
    const searchApi = await import('../app/src/edge/api/search.ts');
    const { jobs } = await import('../app/src/edge/api/jobs.ts');
    const { store } = await import('../app/src/edge/api/store.ts');
    const { TABLES } = await import('../app/src/edge/events/ports.ts');
    const { poshmarkAdapters } = await import('../app/src/edge/harness/sites/poshmark/adapter.ts');
    const { soldSources } = await import('../app/src/engines/valuation/sold.ts');
    const { check } = await import('../app/src/engines/valuation/check.ts');
    const { comparables, weigh, DEFAULTS } = await import('../app/src/engines/valuation/comps.ts');
    const { answer, guardWith } = await import('../app/src/engines/proof/proof.ts');
    const { memoryStore } = await import('../app/src/engines/param/param.ts');
    const { declareLearning, updateContribution, contributionMean, cutOrder } = await import('../app/src/edge/intel/learn.ts');
    const { gather, measure, protocolSteps } = await import('../app/src/edge/intel/gather.ts');
    const { runPlan } = await import('../app/src/edge/intel/run.ts');
    const { classify } = await import('../app/src/edge/intel/classify.ts');

    const sink = memorySink();
    const log = createLog({ src: 'realtime-proof', build: 'realtime-proof', sink, seed: 1, session: 'realtime-proof' });
    const params = memoryStore();
    declareLearning(params);
    const observeCalls = [];
    const observe = params.observe.bind(params);
    params.observe = (name, scope, outcome, at) => {
      observeCalls.push(json({ name, scope, outcome, at }));
      const result = observe(name, scope, outcome, at);
      log.change('param', name, result.reason, { version: result.read.version });
      return result;
    };
    const productWrites = [];
    const put = store.put.bind(store);
    store.put = (table, row) => {
      productWrites.push({ table, id: row.id });
      return put(table, row);
    };
    const ctx = body => ({ body, user_id: 'usr_8f2k', visitor_id: null, params: {}, query: new URLSearchParams(),
      headers: new Headers(), request_id: 'realtime-proof', log });

    // Use the real sold adapter and conversion; never turn an asking page into a sold page or assign a sale date.
    const soldRead = poshmarkAdapters({ signed_in: false,
      doc: async () => ({ status: 200, html: fixture('poshmark-sold') }),
      json: async () => { throw new Error('unexpected signed-in read'); },
    }).find(a => a.manifest.verb === 'search');
    assert.ok(soldRead, 'Poshmark sold reader is unavailable');
    const sources = soldSources(async (_site, query, signal) => {
      const reply = await soldRead.run({ q: query, status: 'sold' }, signal);
      if (!reply.ok) return { rows: [], outcome: reply.error.code, reason: reply.error.message };
      return { rows: Array.isArray(reply.data) ? reply.data : reply.data?.rows ?? [], outcome: 'hit' };
    }, ['poshmark'],
      { query: 'Levi 501', condition: 'good', error: (where, error) => log.error(where, error) });
    const sold = await sources[0](new AbortController().signal);
    assert.ok(sold.length > 1, 'recorded sold fixture no longer supplies the thin and wider diagnostic sets');
    const input = { product_id: 'pr_realtime', condition: 'good', as_of: AS_OF, floor_cents: 0,
      objective: 'balanced', param_version: 1, warm_comps: sold.slice(0, 1), sources: [], sites: [], log };
    const classified = await classify({ text: 'What is a Levi 501 worth?' });
    const thin = comparables({ condition: input.condition }, input.warm_comps, AS_OF);
    const offline = await valuation.ports.read(ctx({ item_id: 'it_7c2m' }));
    const disabledSearch = soldSearch({ live_sites: [] });
    // The explicit input port substitutes a recorded starting basis only. The actual POST handler calls check and stores its answer.
    const inputPort = { source_sha256: sha(valuation.ports.read.toString()),
      source: valuation.ports.read.toString(),
      offline: { product_id: offline.product_id, condition: offline.condition, param_version: offline.param_version,
        warm_comps: offline.warm_comps, sites: offline.sites,
        source_rows: await Promise.all(offline.sources.map(source => source(new AbortController().signal))),
        sold_search: await Promise.all(['mercari', 'poshmark'].map(site => disabledSearch(site, 'Carhartt Detroit Jacket J97', new AbortController().signal))) },
      limitation: 'Recorded input replaces this port. Its source hash is pinned in the test so a newly wired store or param read cannot pass unnoticed.' };
    valuation.ports.read = async () => input;
    const valuate = async () => {
      const reply = await valuation.handlers['POST /v1/valuations'](ctx({ item_id: 'it_7c2m' }), new Request('http://proof.invalid/v1/valuations'));
      const result = jobs.st.getJob(reply.body.id)?.result;
      assert.ok(result, 'valuation POST did not store an answer');
      return json(result);
    };
    const before = await valuate();

    const judgementRequests = [];
    searchApi.ports.ask = async (state, questions) => {
      judgementRequests.push({ target: state.target, rows: state.results.length, heads: Object.keys(questions) });
      // No model judgement was recorded with these pages. This is unavailable input, never a fabricated match.
      return { ok: false, reason: 'no_key', ms: 0 };
    };
    const searchReplay = {
      sources: json(searchApi.ports.sources), selected: ['poshmark'],
      excluded: searchApi.ports.sources.filter(s => s.id !== 'poshmark').map(s => ({ id: s.id,
        reason: !s.on ? s.reason : s.lane === 'apify' ? 'No recorded Apify response supplied.' : s.lane === 'harness' && !s.needs_ask ? 'Recorded HTML does not supply the current harness search verb.'
          : s.needs_ask ? 'No person account or recorded harness response supplied.' : 'No recorded MCP response supplied.' })),
      reads: [], unrecorded_requests: [],
    };
    // Select existing rows through the product port; never change a source's lane to fit an old fixture.
    searchApi.ports.sources = searchApi.ports.sources.filter(s => searchReplay.selected.includes(s.id));
    const recordedPages = new Map([
      ['https://poshmark.com/search?query=levi%20501', 'poshmark'],
      ['https://poshmark.com/search?query=no%20recorded%20matches', 'poshmark-empty'],
    ]);
    searchApi.ports.fetchPage = async url => {
      const name = recordedPages.get(url);
      if (!name) {
        searchReplay.unrecorded_requests.push('No exact recorded URL');
        throw new Error('no recorded page supplied for requested URL');
      }
      searchReplay.reads.push({ url, fixture: name });
      return { ok: true, status: 200, html: fixture(name), url };
    };
    const search = async text => {
      const reply = await searchApi.handlers['POST /v1/search'](ctx({ text }), new Request('http://proof.invalid/v1/search'));
      const task = searchApi.searchJobs.pendingSearches.get(reply.body.id);
      assert.ok(task, 'search POST never scheduled the product runner');
      await task;
      assert.deepEqual(searchReplay.unrecorded_requests, [], 'search requested an unrecorded page (possibly swallowed by product code)');
      const job = jobs.st.getJob(reply.body.id);
      assert.equal(job.state, 'done', 'recorded search failed');
      return json(job.result);
    };
    log.input('realtime-proof', 'separate-search', { data: 'dataset:realtime-fixtures' });
    const searched = await search('levi 501');
    const after = await valuate();
    const gatherEvents = sink.lines.map(line => JSON.parse(line)).filter(e => e.event === 'gather.update');

    // All calls below are isolated diagnostics. None bridges the product's missing collection or learning join.
    log.note('Begin direct diagnostics; these do not establish an end-to-end link.');
    const proofInput = { metric: 'valuation', filters: { product_id: input.product_id }, table_versions: [],
      definition_version: 'valuation.D1-D15', code_version: 'va-6', param_versions: { valuation: 1 }, model_version: null };
    const backed = answer({ lo: before.range.q10, hi: before.range.q90 }, before.comps.map(c => ({
      id: c.comp_id, source: c.citation, at: c.sold_at, weight: c.w, price_cents: c.adjusted_cents,
    })), proofInput, AS_OF);
    const guarded = guardWith(undefined, {}, backed).guarded;
    const fact = { name: 'sold_range', range: { low: before.range.q10, high: before.range.q90 }, unit: 'cents', guarded, sources: [] };
    const plan = { kind: classified.kind, slots: classified.slots, protocol_version: 1,
      first_ms: 1, settled_ms: 1000, targets: [], calculate: () => ({ facts: [fact] }) };
    const settled = await runPlan(plan, undefined, () => Date.parse(AS_OF));
    const options = { answer: settled, plan, arrivals: [], steps: protocolSteps('price_now', {}),
      product: input.product_id, now: () => Date.parse(AS_OF) };
    const gathered = await gather(options);
    const shownThinGather = await gather({ ...options, answer: { ...settled, facts: [{ ...fact, guarded: { ...guarded, state: 'shown' } }] } });
    const noBasisGuarded = guardWith(undefined, {}, answer({ lo: 0, hi: 0 }, [], proofInput, AS_OF)).guarded;
    const noBasisFact = { name: 'sold_range', unit: 'cents', guarded: noBasisGuarded, sources: [] };
    const noBasisGather = await gather({ ...options, answer: { ...settled, facts: [noBasisFact] },
      plan: { ...plan, calculate: () => ({ facts: [noBasisFact] }) } });
    const wider = comparables({ condition: input.condition }, sold, AS_OF);
    const directWider = await check({ ...input, warm_comps: sold });
    // Read the Store actually used by /v1 handlers, including an undeclared table if a new writer added one at runtime.
    const observations = store.systemRows('observation');
    const resolved = directWider.citation.basis_ids.filter(id => observations.some(o => o.id === id));
    const missing = directWider.citation.basis_ids.filter(id => !observations.some(o => o.id === id));
    // A controlled weight probe reuses the same recorded comp and the engine's declared priors, changing only match level.
    const matchWeights = Object.fromEntries(['variant', 'product', 'family'].map(level => [level,
      weigh([{ ...sold[0], level, w_match: DEFAULTS.w_match[level] }], AS_OF)[0].w]));

    const called = searched.searched.filter(s => s.outcome === 'hit').map(s => `public.${s.site}`);
    const used = [...new Set(searched.results.map(r => r.route_id))];
    const scope = { kind: 'listings_matching', segment: called[0] };
    const prior = json(params.read('intel_contribution', scope));
    const meanBefore = contributionMean(params, scope.kind, scope.segment);
    updateContribution(params, { kind: scope.kind, stage: 'settled', called, used }, AS_OF);
    const first = json(params.read('intel_contribution', scope));
    const emptySearch = await search('no recorded matches');
    assert.equal(emptySearch.results.length, 0, 'empty recorded search unexpectedly kept rows');
    const calledAgain = emptySearch.searched.filter(s => s.outcome === 'empty').map(s => `public.${s.site}`);
    updateContribution(params, { kind: scope.kind, stage: 'settled', called: calledAgain, used: [] }, LATER);
    const second = json(params.read('intel_contribution', scope));
    const meanAfter = contributionMean(params, scope.kind, scope.segment);
    const cut = cutOrder(params, scope.kind, called.map(target_id => ({ target_id, p95_ms: 100, cents: 1 })));
    const afterLearning = await valuate();
    log.end({ ok: true });
    const logProblems = checkLog(sink.text()).problems;
    assert.deepEqual(logProblems, [], 'proof log violates log/ contract');
    return json({ classified, before, thin, after, after_learning: afterLearning,
      search: searched, search_replay: searchReplay, judgement_requests: judgementRequests, gather_events_from_valuation: gatherEvents,
      gather: gathered, shown_thin_gather: shownThinGather, no_basis_gather: noBasisGather,
      tables: TABLES, observations, observation_writes: productWrites.filter(w => w.table === 'observation').length,
      input_port: inputPort,
      observation_import_in_search: /(?:memoryProof|\.observe\s*\(|['"]observation['"])/.test(read('app/src/edge/api/search.ts')),
      product_store_tables: Object.keys(store.dump().rows),
      direct_basis: { thin, wider, match_weights: matchWeights, gather_measure: measure([{ target_id: 'sold', route_id: 'poshmark.search.page', rows: sold, ms: 0 }], Date.parse(AS_OF)) },
      direct_wider: directWider, citation_resolution: { resolved, missing },
      learning: { product_observe_calls: null,
        product_observe_limitation: 'No param registry port is exposed by the exercised routes. This registry is diagnostic only; missing production callers are established by the import inventory and pinned input port.',
        prior, first, second, mean_before: meanBefore, mean_after: meanAfter,
        observe_calls: observeCalls, cut, empty_search: emptySearch },
      importers: { gather: importers('app/src/edge/intel/gather.ts'), learn: importers('app/src/edge/intel/learn.ts') },
      log: { checked: true, problems: logProblems },
    });
  });
}

function replay() {
  return new Promise((resolveRun, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: 'realtime-proof', stdout: true });
    // Imported modules emit startup logs. Keep raw logs off the report/table, as log/ requires.
    worker.stdout.resume();
    let result;
    worker.on('message', value => { result = value; });
    worker.on('error', reject);
    worker.on('exit', code => code === 0 && result ? resolveRun(result) : reject(new Error(`proof worker exited ${code} without a result`)));
  });
}

function linksFor(o, identical) {
  const link = (n, state, fn, file, anchor, reason, evidence, extra = {}) => ({ link: n, function: fn,
    ...location(file, anchor), state, reason, evidence, ...extra });
  return [
    link(1, 'wrong', 'POST /v1/valuations → check → comparables', 'app/src/engines/valuation/check.ts', 'return { product_id:',
      'check drops the level and too_few state computed by comparables; its answer has neither basis_level nor a too_few note.',
      `n_eff=${o.before.n_eff}; q10/q50/q90=${o.before.range.q10}/${o.before.range.q50}/${o.before.range.q90}; internal state=${o.thin.state}, level=${o.thin.level}; both absent from answer. Real input still uses the example item; live sites unset yield blocked searches and no comps.`,
      { spec: 'spec/product.md §6 Guard rules; spec/engines/valuation.md §3',
        spec_quote: 'the answer names its `basis_level`', code_quote: 'fast: warm ?? null, comps: found.comps, n_eff: found.n_eff, range, per_site: per_site.map(({ path: _path, ...s }) => s),' }),
    link(2, 'built, not called', 'gather', 'app/src/edge/intel/gather.ts', 'export async function gather',
      'check and runPlan never call gather; the proof invokes it separately on a guarded diagnostic.',
      `No production imports; guard returns shown with notes=${o.gather.answer.facts[0].guarded.notes.join(',')}; thin probe returns ${o.gather.stop} with no request. Separate no-basis control deadline=${o.no_basis_gather.request.deadline}.`,
      { spec: 'spec/engines/intelligence-api.md §3.5; spec/product.md §6 Guard rules', additional_defect: 'wantsGather requires hidden; canon also requires gathering for shown thin fallback answers.' }),
    link(3, 'built, not called', 'POST /v1/search → runPlan → searchSource → readPage', 'app/src/edge/api/search.ts', 'async function search(',
      'The proof starts POST /v1/search by hand; gather has no product-supplied widening steps.',
      `${o.search.found.results_found} rows from ${o.search.found.sources_searched} recorded source (${o.search_replay.selected.join(', ')}); ${o.search_replay.excluded.length} source rows excluded before execution; shown thin probe records ${o.gather.records.length} steps; separate no-basis control records only its skipped signed-in step.`,
      { spec: 'spec/engines/intelligence-api.md §3.5 step 1', caller: 'explicit proof request, not valuation',
        data_note: 'Inputs are dataset:realtime-fixtures. Search itself hardcodes live:<site>; that output label does not make this replay live.' }),
    link(4, 'built, not called', 'sameProduct (called inside the separate search)', 'app/src/edge/intel/reconcile.ts', 'export async function sameProduct',
      'Search calls sameProduct, but gathering never reaches search; recorded pages lack identifiers, pair scores and recorded model judgements.',
      `${o.search.results.length} unresolved rows kept; identity.by=${o.search.identity.by}, model_ok=${o.search.identity.model_ok}; product=null; no product identity invented.`,
      { spec: 'spec/engines/intelligence-api.md §3.3–3.4', missing_input: 'Recorded Jev/Decisions answers or identifier/pair-score evidence for these pages.' }),
    link(5, 'not built', 'search → observation writer (missing)', 'app/src/edge/events/ports.ts', 'export const TABLES',
      'No search-to-observation writer exists; the shared Store has no observation table. memoryProof is a separate in-memory store.',
      `${o.observations.length} observation rows; ${o.observation_writes} writes; no stored source/time/data/evidence chain.`,
      { spec: 'spec/product.md §3 observation and data provenance; §6 Information engines, Gatherer' }),
    link(6, 'built, not called', 'comparables / nEff / measure', 'app/src/engines/valuation/comps.ts', 'export function comparables',
      'comparables accepts Comp arrays; no observation-store projection feeds the Check. The wider sold set is a separate direct diagnostic.',
      `Direct sold control n_eff ${o.direct_basis.thin.n_eff} → ${o.direct_basis.wider.n_eff}; actual repeat stays ${o.after.n_eff}.`,
      { spec: 'spec/determinations/money.md D1; spec/engines/valuation.md §3',
        additional_defect: { function: 'measure', spec_quote: 'n_eff = (sum w)^2 / sum w^2',
          code_quote: 'n_eff: kept.reduce((n, c) => n + w(c), 0)', actual: o.direct_basis.gather_measure.n_eff, expected: o.direct_basis.wider.n_eff,
          reason: 'Gathering sums age weights and ignores match, extraction and adjustment; D1 uses Kish n_eff.' } }),
    link(7, 'built, not called', 'check → answer', 'app/src/engines/valuation/check.ts', 'const proof = answer',
      'The repeated valuation is unchanged; only hand-feeding sold comps changes it, and its citation ids resolve to no observation rows.',
      `Direct range ${o.direct_wider.range.q10}/${o.direct_wider.range.q50}/${o.direct_wider.range.q90}; ${o.citation_resolution.resolved.length} resolved, ${o.citation_resolution.missing.length} missing basis ids.`,
      { spec: 'spec/engines/intelligence-api.md §3.5; spec/product.md §6 proof layer',
        limitation: 'The wider control uses the sold adapter. These recorded sold rows have no sale dates; toComps falls back to their listing dates.' }),
    link(8, 'built, not called', 'updateContribution → ParamStore.observe', 'app/src/edge/intel/learn.ts', 'export function updateContribution',
      'No answer-settled caller invokes updateContribution; only the proof diagnostic calls it.',
      `No learning callers in import inventory; diagnostic Beta 1/1 → 2/1 → 1/1.5 after 30 days; version 0 → ${o.learning.second.version}.`,
      { spec: 'spec/engines/intelligence-api.md §4; spec/product.md §6 Real-time weights',
        limitation: 'Diagnostics use settled search target usage, not persisted observations. The proof never calls observe itself.' }),
    link(9, 'built, not called', 'contributionMean / cutOrder', 'app/src/edge/intel/learn.ts', 'export function contributionMean',
      'contributionMean and cutOrder read learned weights only in the direct diagnostic; runPlan and valuation do not read them.',
      `Direct mean ${o.learning.mean_before} → ${o.learning.mean_after}, read v${o.learning.second.version}; next valuation unchanged, supplied param_version=${o.after_learning.param_version}.`,
      { spec: 'spec/engines/intelligence-api.md §4; spec/product.md §6 Real-time weights, Read and Explain' }),
    link(10, identical ? 'works' : 'wrong', 'runProof (two fresh in-process product replays)', 'scripts/realtime-proof.mjs', 'export async function runProof',
      identical ? null : 'Two fresh stores and the same recorded inputs produced different observed outputs.',
      identical ? 'Two fresh worker isolates return byte-identical observed JSON; zero attempted fetches.' : 'Replay outputs differ.',
      { scope: 'Complete returned engine answers, search results, requests, diagnostics and inventories; transport job ids and raw logs are not part of the measured output. Fixed wall/performance clocks; report date is outside the replay.' }),
  ];
}

export async function runProof() {
  const first = await replay();
  const second = await replay();
  const a = JSON.stringify(first), b = JSON.stringify(second);
  const identical = a === b;
  assert.equal(first.attempts + second.attempts, 0, 'network was attempted (possibly swallowed by product code)');
  const links = linksFor(first.value, identical);
  return { date: new Date().toISOString().slice(0, 10), as_of: AS_OF, data: 'dataset:realtime-fixtures',
    works: links.filter(r => r.state === 'works').length, total: 10, links, fixtures: FIXTURES,
    network_attempts: first.attempts + second.attempts,
    determinism: { identical, first_sha256: sha(a), second_sha256: sha(b) }, observed: first.value };
}

if (!isMainThread && workerData === 'realtime-proof') parentPort.postMessage(await runOnce());
else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await runProof();
    mkdirSync(resolve(ROOT, 'scripts/out'), { recursive: true });
    writeFileSync(resolve(ROOT, 'scripts/out/realtime-proof.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write('link | state | function | file:line | evidence\n');
    for (const r of report.links) process.stdout.write(`${r.link} | ${r.state} | ${r.function} | ${r.file}:${r.line} | ${r.evidence}\n`);
    process.stdout.write(`${report.works}/10 works; ${report.date}; dataset replay; scripts/out/realtime-proof.json\n`);
  } catch (error) {
    process.stderr.write(`realtime-proof: ${error.stack}\n`);
    process.exitCode = 1;
  }
}
