// Check: node --test --test-concurrency=1 scripts/realtime-proof.test.mjs
// Rests-on: spec/product.md §3, §6; spec/engines/intelligence-api.md §3.5, §4;
// spec/engines/valuation.md §3–4; spec/determinations/money.md D1; spec/plans/joins.md.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const AS_OF = '2026-11-15T00:00:00.000Z';
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

async function runOnce() {
  process.env.NODE_ENV = 'development';
  process.env.SECONDHAND_DATA_DIR = mkdtempSync(join(tmpdir(), 'realtime-proof-'));
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
    const searchApi = await import('../app/src/edge/api/search.ts');
    const { jobs } = await import('../app/src/edge/api/jobs.ts');
    const { store } = await import('../app/src/edge/api/store.ts');
    const { writeObservations } = await import('../app/src/edge/events/observations.ts');
    const { poshmarkAdapters } = await import('../app/src/edge/harness/sites/poshmark/adapter.ts');
    const { soldSources } = await import('../app/src/engines/valuation/sold.ts');
    const { comparables } = await import('../app/src/engines/valuation/comps.ts');
    const { memoryStore } = await import('../app/src/engines/param/param.ts');
    const { declareLearning, contributionMean } = await import('../app/src/edge/intel/learn.ts');
    const sink = memorySink();
    const log = createLog({ src: 'realtime-proof', build: 'realtime-proof', sink, seed: 1, session: 'realtime-proof' });
    const ctx = (body, user_id) => ({ body, user_id, visitor_id: null, params: {}, query: new URLSearchParams(),
      headers: new Headers(), request_id: 'realtime-proof', log });
    const params = memoryStore(); declareLearning(params); valuation.ports.params = params;
    const observeCalls = [], reads = [];
    const observe = params.observe.bind(params), readParam = params.read.bind(params);
    params.observe = (name, scope, outcome, at) => {
      observeCalls.push(json({ name, scope, outcome, at }));
      return observe(name, scope, outcome, at);
    };
    params.read = (name, scope, at) => {
      const result = readParam(name, scope, at);
      reads.push(json({ name, scope, version: result.version })); return result;
    };
    const productWrites = [], put = store.put.bind(store);
    store.put = (table, row) => { productWrites.push({ table, id: row.id }); return put(table, row); };

    const soldRead = poshmarkAdapters({ signed_in: false,
      doc: async () => ({ status: 200, html: fixture('poshmark-sold') }),
      json: async () => { throw new Error('unexpected signed-in read'); },
    }).find(adapter => adapter.manifest.verb === 'search');
    assert.ok(soldRead, 'Poshmark sold reader is unavailable');
    const sources = soldSources(async (_site, query, signal) => {
      const reply = await soldRead.run({ q: query, status: 'sold' }, signal);
      if (!reply.ok) return { rows: [], outcome: reply.error.code, reason: reply.error.message };
      return { rows: Array.isArray(reply.data) ? reply.data : reply.data?.rows ?? [], outcome: 'hit' };
    }, ['poshmark'], { query: 'Levi 501', condition: 'good', error: (where, error) => log.error(where, error) });
    const sold = await sources[0](new AbortController().signal);
    assert.ok(sold.length > 1);
    const thin = comparables({ condition: 'good' }, sold.slice(0, 1), AS_OF);
    const item = { id: 'it_realtime', user_id: 'usr_proof', product_id: 'pr_realtime', title: 'Levi 501', condition: 'good' };
    store.put('item', item);
    let batch = sold.slice(0, 1);
    valuation.ports.sources = () => [async () => batch.map(comp => ({ ...comp, data: 'dataset:realtime-fixtures' }))];

    const judgementRequests = [];
    searchApi.ports.ask = async (state, questions) => {
      judgementRequests.push({ target: state.target, rows: state.results.length, heads: Object.keys(questions) });
      return { ok: false, reason: 'no_key', ms: 0 };
    };
    const configured = searchApi.ports.sources;
    searchApi.ports.sources = configured.filter(source => source.id === 'poshmark');
    const searchReplay = { selected: ['poshmark'], reads: [], unrecorded_requests: [] };
    searchApi.ports.fetchPage = async url => {
      if (url !== 'https://poshmark.com/search?query=levi%20501') {
        searchReplay.unrecorded_requests.push(url); throw new Error('no recorded page supplied for requested URL');
      }
      searchReplay.reads.push({ url, fixture: 'poshmark' });
      return { ok: true, status: 200, html: fixture('poshmark'), final_url: url, rung: 'plain', ms: 0, searched: [] };
    };
    let routeValuateCalls = 0; const routeValuateCounts = [];
    const realValuate = valuation.ports.valuate;
    valuation.ports.valuate = (...args) => { routeValuateCalls++; return realValuate(...args); };
    const call = async row => {
      const started = routeValuateCalls;
      const reply = await valuation.handlers['POST /v1/valuations'](ctx({ item_id: row.id }, row.user_id), new Request('http://proof.invalid/v1/valuations'));
      await valuation.pendingValuations.get(reply.body.id);
      routeValuateCounts.push(routeValuateCalls - started);
      const result = jobs.get(reply.body.id, row.user_id)?.result;
      assert.ok(result, 'valuation POST did not store an answer'); return json(result);
    };
    const before = await call(item);
    const routeSearchJobs = jobs.st.jobs({ user_id: item.user_id, kind: 'search' });
    const routeSearch = json(jobs.get(routeSearchJobs[0].id, item.user_id).result);
    batch = sold.slice(1);
    const after = await call(item);
    const observations = json(store.rows('observation', { user_id: item.user_id }));
    const personB = { ...item, id: 'it_realtime_b', user_id: 'usr_proof_b' }; store.put('item', personB);
    batch = [];
    const person_b = await call(personB);
    const basisIds = after.citation?.basis_ids ?? [];
    const resolved = basisIds.filter(id => observations.some(row => row.id === id));
    const missing = basisIds.filter(id => !observations.some(row => row.id === id));
    const datasetObserveCalls = observeCalls.length;

    // Separate synthetic permission control. It proves wiring, never sale accuracy or permission on the recorded public rows.
    const control = { id: 'it_learning', user_id: 'usr_learning', product_id: 'pr_learning', title: item.title, condition: 'good' };
    store.put('item', control);
    const comp = { comp_id: 'synthetic:agreement', site: 'depop', sold_at: AS_OF, price_cents: 1900,
      kind: 'sold', level: 'product', condition: 'good', w_match: .5, w_extract: .9, may_model: true, citation: 'https://synthetic.invalid/comp' };
    writeObservations(store, control.user_id, [{ kind: 'price', site: comp.site, product_id: control.product_id,
      subject_ref: comp.comp_id, observed_at: AS_OF, payload: comp, data: 'synthetic', may_store: true, may_model: true,
      source_url: comp.citation, extractor_version: 'synthetic-control', source_route: 'synthetic-control',
      rights: { may_store: true, may_model: true, may_show: true, may_share: false, ttl: null },
      use_scope: 'hackathon_demo', keep_until: null, channel: 'secondhand', retention_class: 'source_ttl', rights_mode: 'own_scope' }]);
    searchApi.ports.sources = ['poshmark', 'depop'].map(id => configured.find(source => source.id === id));
    const meanBefore = contributionMean(params, 'price_now', 'public.depop', control.user_id);
    const learningBefore = await call(control);
    const meanAfter = contributionMean(params, 'price_now', 'public.depop', control.user_id);
    const scope = { kind: 'price_now', segment: 'public.depop', person: control.user_id };
    const firstVersion = params.read('intel_contribution', scope).version;
    const learningAfter = await call(control);
    const repeatVersion = params.read('intel_contribution', scope).version;
    assert.deepEqual(searchReplay.unrecorded_requests, []);
    log.end({ ok: true });
    const logProblems = checkLog(sink.text()).problems;
    assert.deepEqual(logProblems, [], 'proof log violates log/ contract');
    return json({ before, after, thin, person_b, route_valuate_calls: routeValuateCalls, route_valuate_counts: routeValuateCounts,
      route_search: routeSearch, route_search_jobs: routeSearchJobs.map(job => ({ user_id: job.user_id, state: job.state })),
      gather_events_from_valuation: sink.lines.map(line => JSON.parse(line)).filter(event => event.event === 'gather.update').map(event => ({ n: event.n })),
      search_replay: searchReplay, judgement_requests: judgementRequests, observations,
      observation_writes: productWrites.filter(write => write.table === 'observation').length - 1,
      citation_resolution: { resolved, missing }, input_port: { item, route: 'POST /v1/valuations', source_fixture: 'poshmark-sold' },
      learning_control: { data: 'synthetic', signal: 'agent proposal: observed comp agreement, not a sale outcome',
        mean_before: meanBefore, mean_after: meanAfter, observe_calls: observeCalls, reads: reads.filter(read => read.name === 'intel_contribution'),
        first_version: firstVersion, repeat_version: repeatVersion, dataset_observe_calls: datasetObserveCalls,
        order_before: learningBefore.gather.records.flatMap(record => record.target_id ? [record.target_id] : []),
        order_after: learningAfter.gather.records.flatMap(record => record.target_id ? [record.target_id] : []) },
      log: { checked: true, problems: logProblems } });
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
  const link = (n, earned, fn, file, anchor, evidence, blocker) => ({ link: n, function: fn,
    ...location(file, anchor), state: earned ? 'works' : 'not earned', reason: earned ? null : blocker, evidence });
  const g = o.before.gather, c = o.learning_control;
  return [
    link(1, o.before.product_id === o.input_port.item.product_id && o.before.basis_level === 'product' && o.before.notes.includes('too_few'),
      'POST /v1/valuations → valuate → check → comparables', 'app/src/engines/valuation/check.ts', 'return { product_id:',
      `Stored item priced at ${o.before.range.q10}/${o.before.range.q50}/${o.before.range.q90}; n_eff=${o.before.n_eff}; basis_level=${o.before.basis_level}; notes=${o.before.notes.join(',')}.`, 'Route did not retain its product fallback and thin-basis note.'),
    link(2, !!g.request && o.route_valuate_counts.slice(0, 2).every(count => count === 2) && o.gather_events_from_valuation.length > 0,
      'gather → valuate again', 'app/src/edge/api/valuations.ts', 'gathered = await gather',
      `Route gather stop=${g.stop}, deadline=${g.request?.deadline}; ${o.route_valuate_calls} route valuate calls; fallback=${o.after.basis_level}.`, 'Route did not gather and revalue.'),
    link(3, g.records.some(record => record.n === 1 && record.outcome === 'ran') && o.route_search_jobs.length > 0 && o.route_search_jobs.every(job => job.user_id === o.input_port.item.user_id) && o.route_search.results.length > 0,
      'POST /v1/search → runPlan → searchSource → readPage', 'app/src/edge/intel/gather.ts', 'export function searchStep',
      `${o.route_search.results.length} recorded-page rows through the gather search handler and settled job frame, owned by the person.`, 'Gather did not produce person-owned search frames and rows.'),
    link(4, o.judgement_requests.length > 0 && o.route_search.results.every(row => row.relation === 'unresolved') && o.route_search.identity.by === 'default',
      'sameProduct', 'app/src/edge/intel/reconcile.ts', 'export async function sameProduct',
      `Route search invokes identity judgement; ${o.route_search.results.length} unresolved rows retained; model_ok=${o.route_search.identity.model_ok}; no identity invented.`, 'Gather did not reach identity reconciliation.'),
    link(5, o.observations.length > 0 && o.observation_writes > 0 && o.observations.every(row => row.evidence?.fingerprint && row.use_scope === 'hackathon_demo' && row.may_store === true && row.evidence.rights.may_share === false),
      'valuate → observations.write → writeObservations', 'app/src/edge/api/valuations.ts', 'const observation =',
      `${o.observations.length} stored dataset sales with SV7 evidence, hackathon_demo scope and may_share=false.`, 'Route did not persist permitted observations with evidence.'),
    link(6, o.after.n_eff > o.before.n_eff && o.person_b.n_eff === 0 && o.after.comps.some(comp => o.before.comps.some(prior => prior.comp_id === comp.comp_id)),
      'readObservations → comparables / nEff', 'app/src/edge/api/valuations.ts', 'read: (user, q) => readObservations',
      `Route n_eff ${o.before.n_eff} → ${o.after.n_eff}; next sold batch combines with stored rows; B n_eff=${o.person_b.n_eff}; active offers excluded.`, 'Stored sales did not grow the route basis or crossed people.'),
    link(7, o.citation_resolution.resolved.length > 0 && o.citation_resolution.missing.length === 0,
      'check → answer → stored citations', 'app/src/edge/api/valuations.ts', 'function storedCitations',
      `${o.citation_resolution.resolved.length} route citation ids resolved to stored observations; ${o.citation_resolution.missing.length} missing.`, 'Route citation ids do not resolve to stored rows.'),
    link(8, c.observe_calls.length > 0 && c.mean_after !== c.mean_before && c.dataset_observe_calls === 0 && c.first_version === c.repeat_version,
      'updateContribution → ParamStore.observe', 'app/src/edge/api/valuations.ts', 'updateContribution(ports.params',
      `Synthetic permission control only: agreement Beta mean ${c.mean_before} → ${c.mean_after}, v${c.first_version}; repeat v${c.repeat_version}; dataset fits=${c.dataset_observe_calls}. Agent proposal; no confirmed-sale learning hook.`, 'Route did not move a permitted contribution weight; public recorded rows may not model.'),
    link(9, c.order_before[0] !== c.order_after[0] && c.reads.some(read => read.version > 0),
      'contributionMean / cutOrder → next gather order', 'app/src/edge/intel/gather.ts', 'function orderedSteps',
      `Synthetic control's next route order ${c.order_before.join(',')} → ${c.order_after.join(',')}; reads moved param versions.`, 'A moved route weight did not change its next gather order.'),
    link(10, identical, 'runProof (two fresh in-process product replays)', 'scripts/realtime-proof.mjs', 'export async function runProof',
      identical ? 'Two fresh stores return byte-identical observed JSON; zero attempted fetches.' : 'Replay outputs differ.', 'Fresh replays differ.'),
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
    controls: [{ data: 'synthetic', links: [8, 9], signal: 'agent proposal: observed comp agreement' }],
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
    process.stdout.write(`${report.works}/10 works; ${report.date}; dataset replay + synthetic learning control; scripts/out/realtime-proof.json\n`);
  } catch (error) {
    process.stderr.write(`realtime-proof: ${error.stack}\n`);
    process.exitCode = 1;
  }
}
