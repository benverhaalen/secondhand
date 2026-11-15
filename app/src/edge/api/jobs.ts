// /v1/jobs and SSE (spec/product.md#jobs-and-the-event-stream; spec/plans/finalization.md SV1/SV2).
// Durable jobs and frames share SQLite; live rows and open connections stay in this process.
import { DatabaseSync } from 'node:sqlite';
import type { JobRow, Store } from '../events/ports.ts';
import { sqliteStore } from '../events/sqlite-store.ts';
import { db, migrate, tx } from '../store/db.ts';
import { kv } from '../store/kv.ts';
import { ApiError, deps, type Handler } from './http.ts';
import { EXAMPLES, STREAMS, examplesServed } from './examples.ts';
import { dropped, storable } from './keep.ts';
import { store } from './store.ts';
import { searchParams } from '../intel/run.ts';

export type SseFrame = { id: number; event: string; data: Record<string, unknown> };
export const streamOpts = { heartbeatMs: 15000 };
const TERMINAL = new Set(['done', 'failed', 'cancelled']);
const EXAMPLE_USER = 'usr_8f2k', EXAMPLE_VISITOR = 'vis_example01';
const INTERNAL = ['user_id', 'event_id', 'idempotency_key', 'args', 'attempts', 'created_at', 'ended_at'];

export type ApiJobRow = Omit<JobRow, 'kind'> & { kind: JobRow['kind'] | 'assist'; ended_at?: string; fill_until?: string };

const liveJobs = () => ({ log: new Map<string, SseFrame[]>(), results: new Map<string, unknown>(), ears: new Map<string, Set<() => void>>() });
type LiveJobs = ReturnType<typeof liveJobs>;
const frameTtl = () => (searchParams.read('search_frame_ttl_s', {}).value as number) * 1000;

function keptRows(value: unknown, field?: string): number {
  if (Array.isArray(value)) return (value as unknown[]).reduce<number>((count, row) => count +
    (field !== 'searched' && typeof row === 'object' && row !== null && 'site' in row && typeof row.site === 'string' ? 1 : 0) + keptRows(row), 0);
  if (typeof value !== 'object' || value === null) return 0;
  return Object.entries(value).reduce((count, [key, nested]) => count + keptRows(nested, key), 0);
}

export function jobsOn(st: Store, database: DatabaseSync = db(), env: Record<string, string | undefined> = process.env, live: LiveJobs = liveJobs()) {
  migrate(database, 'jobs-1', `CREATE TABLE frames (
    key TEXT, id INTEGER, event TEXT, data TEXT, at INTEGER, PRIMARY KEY(key, id)
  )`);
  const cache = kv(database), examples = examplesServed(env);
  const { log, results, ears } = live;
  const storedJob = (id: string): ApiJobRow | undefined => cache.get<ApiJobRow>('assist_job', id) ?? st.getJob(id);
  const withLive = (row: ApiJobRow): ApiJobRow => results.has(row.id) ? { ...row, result: results.get(row.id) } : row;
  const readJob = (id: string): ApiJobRow | undefined => {
    const row = storedJob(id);
    return row ? withLive(row) : undefined;
  };
  const report = (row: ApiJobRow, now = Date.now()) => {
    deps.log.note('Job result stored', { job: row.id, kept_rows: keptRows(storable(row.result, now)), dropped_rows: dropped(row.result, now) });
  };
  const saveAssist = (row: ApiJobRow) => {
    const remaining = row.ended_at ? Math.max(0, Date.parse(row.ended_at) + frameTtl() - Date.now()) : undefined;
    cache.set('assist_job', row.id, row, remaining);
  };
  const wake = (key: string) => [...(ears.get(key) ?? [])].forEach((f) => f());
  const owns = (row: ApiJobRow, who: string) => row.user_id === who || (examples && row.user_id === EXAMPLE_VISITOR && who.startsWith('vis_'));
  const s = {
    st: { ...st, getJob(id: string): JobRow | undefined {
      const row = st.getJob(id);
      return row && results.has(id) ? { ...row, result: results.get(id) } : row;
    } }, examples,
    owner: (id: string) => readJob(id)?.user_id,
    start(j: Partial<ApiJobRow> & Pick<ApiJobRow, 'kind' | 'id'>, owner: string): ApiJobRow {
      return tx(database, () => {
        const old = readJob(j.id);
        if ((!old || owns(old, owner)) && cache.add('claimed_seed', j.id, true)) {
          if (old) { const { kind: _kind, ...patch } = j; return s.update(j.id, { ...patch, user_id: owner }); }
          return s.put(j, owner);
        }
        return s.put({ ...j, id: `job_${crypto.randomUUID().replaceAll('-', '')}` }, owner);
      });
    },
    // Contract examples keep their fixed job ids.
    put(j: Partial<ApiJobRow> & Pick<ApiJobRow, 'kind'>, owner: string): ApiJobRow {
      const now = Date.now(), savedInput = storable(j, now);
      if (TERMINAL.has(j.state ?? '')) savedInput.ended_at ??= new Date(now).toISOString();
      if (j.kind === 'assist') {
        const row: ApiJobRow = { event_id: 'seed', idempotency_key: `seed:${j.id}`, args: {}, attempts: 0, trace_id: '', created_at: new Date(0).toISOString(), stages: [], state: 'queued', ...savedInput, id: j.id ?? `job_${crypto.randomUUID().replaceAll('-', '')}`, kind: 'assist', user_id: owner };
        saveAssist(row);
        if ('result' in j) results.set(row.id, structuredClone(j.result));
        const answer = withLive(row);
        if (TERMINAL.has(row.state)) report(answer);
        return answer;
      }
      const { id, ...rest } = { ...savedInput, kind: j.kind };
      const { row } = st.insertJob({ event_id: 'seed', idempotency_key: `seed:${id ?? crypto.randomUUID()}`, args: {}, attempts: 0, trace_id: '', created_at: new Date(0).toISOString(), stages: [], state: 'queued', ...rest, user_id: owner });
      const saved = id ? st.updateJob(row.id, { id }) : row;
      if ('result' in j) results.set(saved.id, structuredClone(j.result));
      const answer = withLive(saved);
      if (TERMINAL.has(saved.state)) report(answer);
      return answer;
    },
    update(id: string, patch: Partial<Omit<ApiJobRow, 'kind'>>) {
      const { old, saved } = tx(database, () => {
        const old = storedJob(id);
        if (!old) throw new Error(`no job ${id}`);
        const { kind, ...body } = storable({ ...old, ...patch }, Date.now());
        if (patch.state) body.ended_at = TERMINAL.has(patch.state)
          ? patch.ended_at ?? old.ended_at ?? new Date().toISOString() : undefined;
        const saved = kind === 'assist' ? { ...body, kind } : st.updateJob(id, body);
        if (saved.kind === 'assist') saveAssist(saved);
        return { old, saved };
      });
      if ('result' in patch) results.set(id, structuredClone(patch.result));
      const next = withLive(saved);
      if (TERMINAL.has(next.state) && (!TERMINAL.has(old.state) || 'result' in patch)) report(next);
      return next;
    },
    finish(id: string, result: unknown) {
      tx(database, () => {
        const row = readJob(id);
        if (!row) throw new Error(`no job ${id}`);
        const ended_at = new Date().toISOString();
        s.update(id, { result, state: 'done', stages: row.stages.map(stage =>
          stage.state === 'running' || stage.state === 'started' ? { ...stage, state: 'arrived', ended_at } : stage) });
        s.append(id, 'job.state', { job_id: id, state: 'done' });
      });
    },
    get: (id: string, who: string) => { const r = readJob(id); return r && owns(r, who) ? r : undefined; },
    view: (r: ApiJobRow) => Object.fromEntries(Object.entries(r).filter(([k, v]) => !INTERNAL.includes(k) && !(k === 'trace_id' && v === ''))),
    // A refused frame is never stored: a stage with no found{} or a fact with no name and value is a bug in the writer.
    append(key: string, event: string, data: Record<string, unknown>, id?: number): SseFrame {
      const bad = (m: string) => new ApiError('invalid', `${event}: ${m}`, 'frame');
      if (id !== undefined && (!Number.isSafeInteger(id) || id < 1)) throw bad('frame id must be a positive integer');
      if (event === 'job.stage' && (typeof data.found !== 'object' || data.found === null)) throw bad('a stage frame needs found{}');
      if (event === 'fact.found') {
        const a = data.attribute as { name?: unknown; value?: unknown } | undefined;
        if (!a || typeof a.name !== 'string' || a.value === undefined) throw bad('attribute needs name and value');
      }
      const list = log.get(key) ?? [];
      const f = tx(database, () => {
        const storedId = database.prepare('SELECT MAX(id) AS id FROM frames WHERE key = ?').get(key)!.id as number | null;
        const next = Math.max(storedId ?? 0, list.at(-1)?.id ?? 0) + 1;
        const frame = { id: Math.max(id ?? next, next), event, data: structuredClone(data) };
        database.prepare('INSERT INTO frames (key, id, event, data, at) VALUES (?, ?, ?, ?, ?)')
          .run(key, frame.id, event, JSON.stringify(storable(data, Date.now())), Date.now());
        if (event === 'job.state' && typeof data.state === 'string' && storedJob(key)) {
          s.update(key, { state: data.state as JobRow['state'],
            ...(TERMINAL.has(data.state) && typeof data.at === 'string' ? { ended_at: data.at } : {}) });
        }
        return frame;
      });
      log.set(key, list);
      list.push(f);
      wake(key);
      return f;
    },
    framesAfter(key: string, after: number): SseFrame[] {
      const local = new Map((log.get(key) ?? []).map(frame => [frame.id, frame]));
      const stored = database.prepare('SELECT id, event, data FROM frames WHERE key = ? AND id > ? ORDER BY id').all(key, after);
      // Read every stored id so a local batch never hides frames appended by another process.
      return stored.map(row => local.get(row.id as number) ?? {
        id: row.id as number, event: row.event as string, data: JSON.parse(row.data as string) as SseFrame['data'],
      });
    },
    prune(now: number) {
      tx(database, () => {
        const ttl = frameTtl();
        const assist = database.prepare("SELECT value FROM kv WHERE ns = 'assist_job'").all().map(row => JSON.parse(row.value as string) as ApiJobRow);
        for (const row of [...st.jobs(), ...assist] as ApiJobRow[]) {
          if (TERMINAL.has(row.state) && row.ended_at && now - Date.parse(row.ended_at) > ttl) {
            database.prepare('DELETE FROM frames WHERE key = ?').run(row.id);
            cache.delete('assist_job', row.id);
            cache.delete('claimed_seed', row.id);
            log.delete(row.id); results.delete(row.id);
            if (row.kind === 'assist') continue;
          }
          if (dropped(row, now) === 0) continue;
          const { kind, ...body } = storable(row, now);
          if (kind === 'assist') saveAssist({ ...body, kind }); else st.updateJob(row.id, body);
          if (TERMINAL.has(row.state)) report(row, now);
        }
        for (const frame of database.prepare('SELECT key, id, data FROM frames').all()) {
          const data: unknown = JSON.parse(frame.data as string);
          if (dropped(data, now) === 0) continue;
          database.prepare('UPDATE frames SET data = ? WHERE key = ? AND id = ?')
            .run(JSON.stringify(storable(data, now)), frame.key as string, frame.id as number);
        }
        // Another bundle may have pruned a key for which this process still has live data.
        for (const key of log.keys()) {
          if (database.prepare('SELECT 1 FROM frames WHERE key = ? LIMIT 1').get(key)) continue;
          log.delete(key); results.delete(key);
        }
      });
    },
    listen(key: string, fn: () => void) {
      const set = ears.get(key) ?? new Set<() => void>(); ears.set(key, set); set.add(fn);
      return () => { set.delete(fn); if (set.size === 0 && ears.get(key) === set) ears.delete(key); };
    },
    listenerCount: (key: string) => ears.get(key)?.size ?? 0,
  };
  return s;
}
export type JobStore = ReturnType<typeof jobsOn>;
export const memoryJobs = () => { const database = new DatabaseSync(':memory:'); return jobsOn(sqliteStore(database), database); };

// The contract examples as live data: each example job and stream frame lands in the store, keeping its own ids.
// The seeded contract jobs: boot recovery leaves them as the examples show them, never requeued into the pipeline.
export function exampleJobIds(): Set<string> {
  const ids = new Set<string>();
  for (const e of EXAMPLES) if (e.endpoint === 'GET /v1/jobs/:id' && e.status === 200) ids.add((e.response as { id: string }).id);
  for (const name of ['identify_then_valuate', 'visitor_search']) for (const f of STREAMS[name]) if (typeof f.data?.job_id === 'string') ids.add(f.data.job_id);
  return ids;
}

export function seedExamples(s: JobStore) {
  if (!s.examples) return;
  for (const e of EXAMPLES) {
    if (e.endpoint === 'GET /v1/jobs/:id' && e.status === 200) {
      const row = e.response as Partial<JobRow> & Pick<JobRow, 'id' | 'kind'>;
      if (!s.owner(row.id)) s.put(row, EXAMPLE_USER);
    }
  }
  for (const name of ['identify_then_valuate', 'visitor_search', 'user_stream']) {
    for (const f of STREAMS[name]) {
      if (!f.event || !f.id) continue;
      const key = name === 'user_stream' ? `user:${EXAMPLE_USER}` : f.data!.job_id as string;
      if (s.framesAfter(key, Number(f.id) - 1).some(frame => frame.id === Number(f.id))) continue;
      if (name === 'user_stream') { s.append(key, f.event, f.data!, Number(f.id)); continue; }
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
// drain terminal jobs, keeping done open for fill_until within job_fill_grace_s. Cancel releases every timer and listener.
function sse(s: JobStore, key: string, from: number, closeWhenDone: boolean): Response {
  const enc = new TextEncoder(); let stop = (_close = true, _reason = 'client cancelled') => {};
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      let cursor = from, closed = false, filling = false;
      let doneAt: number | undefined, fillTimer: ReturnType<typeof setTimeout> | undefined;
      const pump = () => {
        if (closed) return;
        const send = () => { for (const f of s.framesAfter(key, cursor)) { c.enqueue(enc.encode(encode(f))); cursor = f.id; } };
        send();
        const row = s.get(key, s.owner(key) ?? '');
        if (!closeWhenDone || !row || !TERMINAL.has(row.state)) return;
        send();
        if (row.state !== 'done') { stop(true, row.state); return; }
        const now = Date.now();
        doneAt ??= now;
        const fillUntil = row.fill_until ? Date.parse(row.fill_until) : now;
        const graceUntil = doneAt + (searchParams.read('job_fill_grace_s', {}).value as number) * 1000;
        const deadline = Math.min(fillUntil, graceUntil);
        if (now >= deadline) { stop(true, fillUntil <= graceUntil ? 'fill_until passed' : 'grace reached'); return; }
        if (!filling) {
          filling = true;
          deps.log.note('Job stream waiting for fill', { job: key, reason: 'fill pending' });
        }
        clearTimeout(fillTimer);
        fillTimer = setTimeout(pump, deadline - now);
        fillTimer.unref?.();
      };
      const off = s.listen(key, pump);
      const timer = setInterval(() => { if (!closed) c.enqueue(enc.encode(': heartbeat\n\n')); }, streamOpts.heartbeatMs);
      const poll = setInterval(pump, 1000);
      timer.unref?.();
      poll.unref?.();
      stop = (close = true, reason = 'client cancelled') => {
        if (closed) return;
        closed = true;
        clearInterval(timer); clearInterval(poll); clearTimeout(fillTimer); off();
        if (filling) deps.log.note('Job stream fill closed', { job: key, reason });
        if (close) c.close();
      };
      pump();
    },
    cancel() { stop(false); },
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

const shared = globalThis as { __secondhandJobsLive?: LiveJobs };
export const jobs: JobStore = jobsOn(store, db(), process.env, shared.__secondhandJobsLive ??= liveJobs());

// The contract example jobs are seeded on the first request to a job route, never at import: importing this module
// (the runtime, the watch worker, capture, search) must leave the background queue free of example rows.
let seeded = false;
const seeding = (handler: Handler): Handler => (ctx, req) => {
  if (!seeded) { seeded = true; seedExamples(jobs); }
  return handler(ctx, req);
};
export const routeHandlers = {
  'GET /v1/jobs/:id': seeding(getJob()),
  'GET /v1/jobs/:id/events': seeding(jobEvents()),
  'GET /v1/stream': seeding(userStream()),
};
const routeAuth: Record<string, 'user' | 'visitor' | 'none'> = {
  'GET /v1/jobs/:id': 'visitor',
  'GET /v1/jobs/:id/events': 'visitor',
};
export const manifest = Object.keys(routeHandlers).map(endpoint => ({ endpoint, source: 'engine' as const, auth: routeAuth[endpoint] ?? 'user' as const }));
