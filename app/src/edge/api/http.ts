// The /v1 contract layer every route shares (spec/product.md §7): bearer auth that derives user_id (a client never sends it),
// visitors with a rate limit, the error shape, idempotency keys, X-Request-Id, params from the endpoint pattern, and request logs.
// Route files under app/src/app/v1/ stay thin: `export const GET = route('GET /v1/items/:id', handler)`.
import { consoleSink, createLog } from '../../../../log/index.js';
import { EXAMPLES, exampleFor, type Example } from './examples.ts';
import { memoryStore } from '../../engines/param/param.ts';

export type Retry = { by: 'auto' | 'user' | 'none'; after_s?: number };
export type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | Response;
export type Ctx = {
  user_id: string | null; visitor_id: string | null; request_id: string;
  params: Record<string, string>; query: URLSearchParams; body: Record<string, unknown>; headers: Headers; log: Log;
};
export type Handler = (ctx: Ctx, req: Request) => Promise<Reply> | Reply;
type Log = ReturnType<typeof createLog>;

const STATUS: Record<string, number> = {
  invalid: 400, unauthenticated: 401, locked: 403, not_found: 404, stale: 409, idempotency_mismatch: 409, site_no_undo: 409,
  outside_limits: 422, rate_limited: 429, site_failed: 502, waking: 503, unavailable: 503,
};
export type Code = keyof typeof STATUS;

export class ApiError extends Error {
  code: Code; failed_step: string; retry: Retry; extra: Record<string, unknown>;
  constructor(code: Code, message: string, failed_step: string, retry: Retry = { by: 'none' }, extra: Record<string, unknown> = {}) {
    super(message); this.code = code; this.failed_step = failed_step; this.retry = retry; this.extra = extra;
  }
  get status() { return STATUS[this.code]; }
  toJSON() { return { code: this.code, message: this.message, failed_step: this.failed_step, retry: this.retry, ...this.extra }; }
}

export type Deps = {
  verify: (token: string) => Promise<string | null>;
  log: Log;
  now: () => number;
  idem: Map<string, { hash: string; status: number; body: string; headers: Record<string, string>; at: number }>;
  visits: Map<string, { window: number; n: number }>;
  visitorPerMinute: number;
  connectingAddress: (req: Request) => string | null;
  started: boolean;
};

export const params = memoryStore();
// Prior from the J2 brief: at most 10000 visitor addresses retained in one process.
params.declare({ name: 'visitor_max_entries', family: 'scalar', prior: 10000, guard_lo: 1 });

const peerHeader = process.env.SECONDHAND_PEER_HEADER;

export const deps: Deps = {
  verify: async () => null, // set by app/src/edge/auth.ts at import (bindAuth), so tests can swap it
  log: createLog({ src: 'edge.api', build: process.env.npm_package_version ?? 'dev', sink: consoleSink }),
  now: () => Date.now(),
  // shortcut: process memory until the Store has http_idempotency; lost on restart
  idem: new Map(),
  visits: new Map(),
  visitorPerMinute: 30,
  // Deployment must name a client-address header that the host overwrites.
  connectingAddress: (req) => peerHeader ? req.headers.get(peerHeader)?.trim() || null : null,
  started: false,
};

const DAY_MS = 24 * 3600 * 1000;
const id = (p: string) => `${p}${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

// Matches "/v1/items/it_7c2m/attributes/size" against "/v1/items/:id/attributes/:name".
export function paramsOf(pattern: string, pathname: string): Record<string, string> | null {
  const a = pattern.split('/'), b = pathname.replace(/\/$/, '').split('/');
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) out[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return out;
}

function toResponse(reply: Reply, requestId: string): Response {
  if (reply instanceof Response) { reply.headers.set('X-Request-Id', requestId); return reply; }
  const headers = { 'X-Request-Id': requestId, ...reply.headers };
  if (reply.status === 204 || reply.status === 302 || reply.body === undefined || reply.body === null) return new Response(null, { status: reply.status, headers });
  return Response.json(reply.body, { status: reply.status, headers });
}

const stripUserId = (o: Record<string, unknown>) => { delete o.user_id; return o; };

function visit(address: string) {
  const minute = Math.floor(deps.now() / 60000);
  for (const [key, bucket] of deps.visits) {
    if (bucket.window === minute) break;
    deps.visits.delete(key);
  }
  const maximum = params.read('visitor_max_entries', {}).value;
  if (typeof maximum !== 'number' || !Number.isInteger(maximum) || maximum < 1) throw new Error('invalid visitor_max_entries');
  const bucket = deps.visits.get(address);
  const n = bucket?.window === minute ? bucket.n + 1 : 1;
  deps.visits.delete(address);
  while (deps.visits.size > maximum || (!deps.visits.has(address) && deps.visits.size === maximum)) {
    deps.visits.delete(deps.visits.keys().next().value!);
  }
  deps.visits.set(address, { window: minute, n });
  if (n > deps.visitorPerMinute) throw new ApiError('rate_limited', 'visitor bucket empty', 'edge', { by: 'auto', after_s: 60 - Math.floor((deps.now() / 1000) % 60) });
}

export function route(endpoint: string, handler: Handler, opts: { auth?: 'user' | 'visitor' | 'none' } = {}) {
  const [method, pattern] = endpoint.split(' ');
  const mode = opts.auth ?? 'user';
  return async function (req: Request): Promise<Response> {
    const t0 = deps.now();
    const request_id = req.headers.get('X-Request-Id') || id('rq_');
    const url = new URL(req.url);
    const log = deps.log.child({ req: request_id, route: pattern });
    log.event('request.start', { method });
    let res: Response;
    try {
      if (req.method !== method) throw new ApiError('invalid', `${req.method} on ${endpoint}`, 'route');
      const params = paramsOf(pattern, url.pathname) ?? {};
      const query = new URLSearchParams(url.search); query.delete('user_id');
      let body: Record<string, unknown> = {};
      const raw = ['GET', 'DELETE'].includes(method) ? '' : await req.text();
      if (raw) {
        try { body = JSON.parse(raw); } catch { throw new ApiError('invalid', 'body is not JSON', 'parse', { by: 'user' }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('invalid', 'body must be an object', 'parse', { by: 'user' });
        stripUserId(body);
      }
      const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1] ?? null;
      const user_id = token ? await deps.verify(token) : null;
      let visitor_id: string | null = null;
      if (mode === 'user' && !user_id) throw new ApiError('unauthenticated', token ? 'token expired or unknown' : 'no token', 'auth', { by: 'user' });
      if (mode === 'visitor' && !user_id) {
        const given = req.headers.get('X-Visitor-Id');
        visitor_id = given && /^vis_[a-z0-9]{8,32}$/.test(given) ? given : id('vis_');
        // shortcut: a visitor id is rotatable by the client; set SECONDHAND_PEER_HEADER in deployment so the bucket is the host's client address
        visit(deps.connectingAddress(req) ?? visitor_id);
      }
      const ctx: Ctx = { user_id, visitor_id, request_id, params, query, body, headers: req.headers, log: log.child({ user: user_id ?? visitor_id ?? 'none' }) };

      const key = method === 'POST' ? req.headers.get('Idempotency-Key') : null;
      const slot = key ? `${user_id ?? visitor_id ?? 'none'} ${endpoint} ${key}` : null;
      const seen = slot ? deps.idem.get(slot) : undefined;
      if (seen && deps.now() - seen.at < DAY_MS) {
        if (seen.hash !== raw) throw new ApiError('idempotency_mismatch', `key ${key} was used with a different body`, 'idempotency');
        res = new Response(seen.body || null, { status: seen.status, headers: { ...seen.headers, 'Idempotent-Replayed': 'true' } });
      } else {
        res = toResponse(await handler(ctx, req), request_id);
        if (slot && res.status < 500) {
          const copy = res.clone(); const headers: Record<string, string> = {}; copy.headers.forEach((v, k) => { headers[k] = v; });
          deps.idem.set(slot, { hash: raw, status: res.status, body: await copy.text(), headers, at: deps.now() });
        }
      }
      if (visitor_id) res.headers.set('X-Visitor-Id', visitor_id);
    } catch (e) {
      const err = e instanceof ApiError
        ? e.code === 'waking' && deps.started ? new ApiError('unavailable', 'dependency unavailable', e.failed_step, e.retry) : e
        : new ApiError('unavailable', 'internal error', 'handler', { by: 'auto', after_s: 2 });
      if (!(e instanceof ApiError)) log.error('edge.api', e, { endpoint });
      res = Response.json(err.toJSON(), { status: err.status, headers: { 'X-Request-Id': request_id } });
    }
    deps.started = true;
    log.event('request.end', { status: res.status, ms: deps.now() - t0 });
    return res;
  };
}

// Serve an endpoint from its contract example until the engine behind it lands: `route(e, served(e))`, then replace served(e) with the real handler.
// Until then it answers only the ids its examples name: any other id is not this user's, so 404, as the real route will answer.
export function served(endpoint: string): Handler {
  const pattern = endpoint.split(' ')[1];
  const options: Example[] = EXAMPLES.filter((e) => e.endpoint === endpoint && e.status < 400);
  if (!options.length) exampleFor(endpoint); // throws at import: a route with no example is a bug
  return (ctx) => {
    const same = (e: Example) => JSON.stringify(paramsOf(pattern, e.path.split('?')[0])) === JSON.stringify(ctx.params);
    const ex = options.find(same);
    if (!ex) throw new ApiError('not_found', `no ${Object.values(ctx.params).join('/')} for this user`, 'read');
    return { status: ex.status, body: ex.response, headers: ex.headers };
  };
}

export const requireFields = (body: Record<string, unknown>, ...names: string[]) => {
  const missing = names.filter((n) => body[n] === undefined || body[n] === null);
  if (missing.length) throw new ApiError('invalid', `missing ${missing.join(', ')}`, 'validate', { by: 'user' }, { fields: missing });
};
