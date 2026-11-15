// In-process recordings of search.test.ts's timed-out refresh and missing-account cases.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from '../../edge/api/http.ts';
import { jobs } from '../../edge/api/jobs.ts';
import { handlers, ports, searchJobs } from '../../edge/api/search.ts';
import { createHarness, fail, fakeManifest } from '../../edge/harness/protocol.ts';
import type { PageResult } from '../../edge/intel/fetch.ts';
import { _reset, searchParams } from '../../edge/intel/run.ts';
import { SOURCES } from '../../edge/intel/public/sources.ts';
import { BASE } from '../../edge/intel/public/readers.ts';

const originalPorts = { ...ports };
const originalDeps = { verify: deps.verify, log: deps.log, now: deps.now };
const page = (): PageResult => ({ ok: true,
  html: readFileSync(new URL('../../../../spec/fixtures/pages/poshmark.html', import.meta.url), 'utf8'),
  final_url: '', status: 200, rung: 'plain', ms: 1, searched: [] });
const blocked = (): PageResult => ({ ok: false, kind: 'blocked', reason: '403', status: 403, ms: 1, searched: [] });
const harness = createHarness({ adapters: [{ route_id: 'depop.search.page', manifest: fakeManifest('depop', 'search'),
  async run() { return fail('blocked', '403', { do: 'pause_session', site: 'depop' }); },
}] });

function setup() {
  _reset();
  searchParams.declare({ name: 'search_browser_start_ms', family: 'scalar', prior: 0 });
  deps.verify = async () => null;
  deps.log = createLog({ src: 'test', build: 'fixture', sink: memorySink() });
  deps.now = () => Date.now();
  deps.idem.clear(); deps.visits.clear();
  Object.assign(ports, { ...originalPorts, accounts: undefined, apify: undefined,
    sources: SOURCES.map(source => ({ ...source, pace: { per_minute: 1e12, min_gap_ms: 0 } })),
    harness, routed: () => true,
    dupe: { search: async () => ({ ok: true, data: { rows: [], dropped: 0, total: 0, keep_until: new Date().toISOString() } }) },
    deadline_ms: 80, fetchPage: async () => blocked(),
    ask: async (_state: object, questions: Record<string, unknown>) => ({ ok: true, ms: 0,
      answers: Object.fromEntries(Object.keys(questions).map(k => [k, { choice: k.startsWith('m') ? 'likely_same_model' : 'keep' }])) }),
  });
}

async function recordJob() {
  const response = await route('POST /v1/search', handlers['POST /v1/search'], { auth: 'visitor' })(new Request('http://edge.test/v1/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': 'vis_record01', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ text: 'levi 501' }),
  }));
  assert.equal(response.status, 202);
  const start: unknown = await response.json();
  assert.ok(start && typeof start === 'object' && 'id' in start && typeof start.id === 'string');
  const task = searchJobs.pendingSearches.get(start.id);
  await task;
  assert.equal(jobs.st.getJob(start.id)?.state, 'done', 'the real handler must finish its job');
  const frames = jobs.framesAfter(start.id, 0);
  assert.equal(frames.at(-1)?.data.state, 'done');
  return { start, frames };
}

function write(name: string, mirrors: string, job: Awaited<ReturnType<typeof recordJob>>) {
  const recorded = `Real POST /v1/search handler and jobs.framesAfter, in-process fake ports, no network; mirrors app/src/edge/api/search.test.ts ${mirrors}; ${new Date().toISOString().slice(0, 10)}`;
  writeFileSync(new URL(`./${name}.json`, import.meta.url), JSON.stringify({ recorded, ...job }, null, 1));
}

try {
  setup();
  let reads = 0;
  ports.fetchPage = async u => !u.startsWith(BASE.poshmark) ? blocked() : ++reads === 1 ? page() : new Promise(() => {});
  await recordJob();
  const cached = await recordJob();
  assert.equal(reads, 2, 'the second job must refresh the first job’s cached read');
  write('search-late-cached', ':464 to 475, a timed-out live refresh keeps fresh indexed offers', cached);

  setup();
  ports.sources = ports.sources.filter(s => s.id === 'mercari');
  write('search-needs-account', ':706 to 721, a site that needs the person’s account is needs_account', await recordJob());
} finally {
  await Promise.all(searchJobs.pendingSearches.values());
  Object.assign(ports, originalPorts);
  Object.assign(deps, originalDeps);
}
