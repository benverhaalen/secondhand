// /v1/jobs and the SSE streams (spec/product.md#jobs-and-the-event-stream). Jobs live in the shared `store`; the frame log lives here,
// keyed by job id (or `user:<id>` for GET /v1/stream), with integer ids per key so Last-Event-ID resumes from the next frame.
import { memoryStore, type JobRow, type Store } from '../events/ports.ts';
import { ApiError, type Handler } from './http.ts';
import { EXAMPLES, STREAMS } from './examples.ts';
import { store } from './store.ts';
import { searchParams } from '../intel/run.ts';

export type SseFrame = { id: number; event: string; data: Record<string, unknown> };
export const streamOpts = { heartbeatMs: 15000 };
const TERMINAL = new Set(['done', 'failed']);
const EXAMPLE_USER = 'usr_8f2k', EXAMPLE_VISITOR = 'vis_example01';
const INTERNAL = ['user_id', 'event_id', 'idempotency_key', 'args', 'attempts', 'created_at'];

export type ApiJobRow = Omit<JobRow, 'kind'> & { kind: JobRow['kind'] | 'assist' };

export function jobsOn(st: Store) {
  const claimedSeedIds = new Set<string>();
  const assistJobs = new Map<string, ApiJobRow>();
  const ended = new Map<string, number>();
  const readJob = (id: string): ApiJobRow | undefined => assistJobs.get(id) ?? st.getJob(id);
  const log = new Map<string, SseFrame[]>(), ears = new Map<string, Set<() => void>>();
  const wake = (key: string) => [...(ears.get(key) ?? [])].forEach((f) => f());
  // shortcut: the seeded example visitor job is open to any visitor, since the example sends no X-Visitor-Id; goes when the examples stop being served.
  const owns = (row: ApiJobRow, who: string) => row.user_id === who || (row.user_id === EXAMPLE_VISITOR && who.startsWith('vis_'));
  const s = {
    st,
    owner: (id: string) => readJob(id)?.user_id,
    start(j: Partial<ApiJobRow> & Pick<ApiJobRow, 'kind' | 'id'>, owner: string): ApiJobRow {
      const old = readJob(j.id);
      if (!claimedSeedIds.has(j.id) && (!old || old.user_id === owner || old.user_id === EXAMPLE_VISITOR && owner.startsWith('vis_'))) {
        claimedSeedIds.add(j.id);
        if (old) { const { kind: _kind, ...patch } = j; return s.update(j.id, { ...patch, user_id: owner }); }
        return s.put(j, owner);
      }
      return s.put({ ...j, id: `job_${crypto.randomUUID().replaceAll('-', '')}` }, owner);
    },
    // `id` is kept when given: the example jobs have fixed ids, and the memory store's updateJob accepts an id patch.
    put(j: Partial<ApiJobRow> & Pick<ApiJobRow, 'kind'>, owner: string): ApiJobRow {
      if (j.kind === 'assist') {
        const row: ApiJobRow = { event_id: 'seed', idempotency_key: `seed:${j.id}`, args: {}, attempts: 0, trace_id: '', created_at: new Date(0).toISOString(), stages: [], state: 'queued', ...j, id: j.id ?? `job_${crypto.randomUUID().replaceAll('-', '')}`, kind: 'assist', user_id: owner };
        assistJobs.set(row.id, row);
        if (TERMINAL.has(row.state)) ended.set(row.id, Date.now());
        return row;
      }
      const { id, ...rest } = { ...j, kind: j.kind };
      const { row } = st.insertJob({ event_id: 'seed', idempotency_key: `seed:${id ?? crypto.randomUUID()}`, args: {}, attempts: 0, trace_id: '', created_at: new Date(0).toISOString(), stages: [], state: 'queued', ...rest, user_id: owner });
      const saved = id ? st.updateJob(row.id, { id }) : row;
      if (TERMINAL.has(saved.state)) ended.set(saved.id, Date.now());
      return saved;
    },
    update(id: string, patch: Partial<Omit<ApiJobRow, 'kind'>>) {
      const row = assistJobs.get(id);
      const next = row ? { ...row, ...patch } : st.updateJob(id, patch);
      if (row) assistJobs.set(id, next);
      if (patch.state && TERMINAL.has(patch.state) && !ended.has(id)) ended.set(id, Date.now());
      else if (patch.state && !TERMINAL.has(patch.state)) ended.delete(id);
      return next;
    },
    finish(id: string, result: unknown) {
      const row = readJob(id);
      if (!row) throw new Error(`no job ${id}`);
      const ended_at = new Date().toISOString();
      s.update(id, { result, state: 'done', stages: row.stages.map(stage => ({ ...stage, state: 'arrived', ended_at })) });
      s.append(id, 'job.state', { job_id: id, state: 'done' });
    },
    get: (id: string, who: string) => { const r = readJob(id); return r && owns(r, who) ? r : undefined; },
    view: (r: ApiJobRow) => Object.fromEntries(Object.entries(r).filter(([k, v]) => !INTERNAL.includes(k) && !(k === 'trace_id' && v === ''))),
    // A refused frame is never stored: a stage with no found{} or a fact with no name and value is a bug in the writer.
    append(key: string, event: string, data: Record<string, unknown>, id?: number): SseFrame {
      const bad = (m: string) => new ApiError('invalid', `${event}: ${m}`, 'frame');
      if (event === 'job.stage' && (typeof data.found !== 'object' || data.found === null)) throw bad('a stage frame needs found{}');
      if (event === 'fact.found') {
        const a = data.attribute as { name?: unknown; value?: unknown } | undefined;
        if (!a || typeof a.name !== 'string' || a.value === undefined) throw bad('attribute needs name and value');
      }
      const list = log.get(key) ?? []; log.set(key, list);
      const f = { id: id ?? (list.at(-1)?.id ?? 0) + 1, event, data };
      list.push(f);
      if (event === 'job.state' && typeof data.state === 'string' && readJob(key)) {
        s.update(key, { state: data.state as JobRow['state'] });
        if (TERMINAL.has(data.state) && typeof data.at === 'string') ended.set(key, Date.parse(data.at));
      }
      wake(key);
      return f;
    },
    framesAfter: (key: string, after: number) => (log.get(key) ?? []).filter((f) => f.id > after),
    prune(now: number) {
      const ttl = (searchParams.read('search_frame_ttl_s', {}).value as number) * 1000;
      for (const [id, at] of ended) {
        if (now - at <= ttl || !TERMINAL.has(readJob(id)?.state ?? '')) continue;
        log.delete(id);
        ears.delete(id);
        assistJobs.delete(id);
        claimedSeedIds.delete(id);
        ended.delete(id);
      }
    },
    listen(key: string, fn: () => void) {
      const set = ears.get(key) ?? new Set<() => void>(); ears.set(key, set); set.add(fn);
      return () => { set.delete(fn); };
    },
    listenerCount: (key: string) => ears.get(key)?.size ?? 0,
  };
  return s;
}
export type JobStore = ReturnType<typeof jobsOn>;
export const memoryJobs = () => jobsOn(memoryStore());

// The contract examples as live data: each example job and stream frame lands in the store, keeping its own ids.
export function seedExamples(s: JobStore) {
  for (const e of EXAMPLES) {
    if (e.endpoint === 'GET /v1/jobs/:id' && e.status === 200) s.put(e.response as Partial<JobRow> & Pick<JobRow, 'id' | 'kind'>, EXAMPLE_USER);
  }
  for (const name of ['identify_then_valuate', 'visitor_search', 'user_stream']) {
    for (const f of STREAMS[name]) {
      if (!f.event || !f.id) continue;
      if (name === 'user_stream') { s.append(`user:${EXAMPLE_USER}`, f.event, f.data!, Number(f.id)); continue; }
      const jid = f.data!.job_id as string;
      if (!s.st.getJob(jid)) s.put({ id: jid, kind: (f.data!.kind ?? 'identify') as JobRow['kind'], state: 'running' }, name === 'visitor_search' ? EXAMPLE_VISITOR : EXAMPLE_USER);
      s.append(jid, f.event, f.data!, Number(f.id));
    }
  }
}

const who = (ctx: { user_id: string | null; visitor_id: string | null }) => ctx.user_id ?? ctx.visitor_id ?? '';
const notFound = (id: string) => new ApiError('not_found', `no job ${id} for this user`, 'read');
const lastId = (h: Headers) => Number(h.get('Last-Event-ID')) || 0;
const encode = (f: SseFrame) => `id: ${f.id}\nevent: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`;

// One SSE response over a frame log: replay after `from`, then wake on append, beat every heartbeatMs, and (for a job)
// close once the job is done or failed and every frame is sent. Cancel removes the listener and the timer.
function sse(s: JobStore, key: string, from: number, closeWhenDone: boolean): Response {
  const enc = new TextEncoder(); let stop = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      let cursor = from, closed = false;
      const pump = () => {
        if (closed) return;
        for (const f of s.framesAfter(key, cursor)) { c.enqueue(enc.encode(encode(f))); cursor = f.id; }
        const row = s.get(key, s.owner(key) ?? '');
        if (closeWhenDone && row && TERMINAL.has(row.state)) stop();
      };
      const off = s.listen(key, pump);
      const timer = setInterval(() => { if (!closed) c.enqueue(enc.encode(': heartbeat\n\n')); }, streamOpts.heartbeatMs);
      timer.unref?.();
      stop = () => { if (closed) return; closed = true; clearInterval(timer); off(); try { c.close(); } catch { /* already cancelled */ } };
      pump();
    },
    cancel() { stop(); },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
}

export const getJob = (s: JobStore = jobs): Handler => (ctx) => {
  const r = s.get(ctx.params.id, who(ctx));
  if (!r) throw notFound(ctx.params.id);
  return { status: 200, body: s.view(r) };
};
export const jobEvents = (s: JobStore = jobs): Handler => (ctx, req) => {
  if (!s.get(ctx.params.id, who(ctx))) throw notFound(ctx.params.id);
  return sse(s, ctx.params.id, lastId(req.headers), true);
};
export const userStream = (s: JobStore = jobs): Handler => (ctx, req) => sse(s, `user:${ctx.user_id}`, lastId(req.headers), false);

// One job store per process: Expo bundles each API route on its own, so a module-level store was one per route and a
// search's job was not_found at /v1/jobs/:id on the dev server (2026-11-15). The first route to load makes it.
const shared = globalThis as { __secondhandJobs?: JobStore };
export const jobs: JobStore = shared.__secondhandJobs ??= (() => { const s = jobsOn(store); seedExamples(s); return s; })();

export const routeHandlers = {
  'GET /v1/jobs/:id': getJob(),
  'GET /v1/jobs/:id/events': jobEvents(),
  'GET /v1/stream': userStream(),
};
const routeAuth: Record<string, 'user' | 'visitor' | 'none'> = {
  'GET /v1/jobs/:id': 'visitor',
  'GET /v1/jobs/:id/events': 'visitor',
};
export const manifest = Object.keys(routeHandlers).map(endpoint => ({ endpoint, source: 'engine' as const, auth: routeAuth[endpoint] ?? 'user' as const }));
