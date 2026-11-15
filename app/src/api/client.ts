import { createLog, type Log } from '../../../log/index.js';
import type { Retry } from '../edge/api/http.ts';
import type { ApiJobRow, SseFrame } from '../edge/api/jobs.ts';
import type { SearchStage } from '../edge/api/search.ts';
import { fetch as platformFetch } from './fetch';
import { origin as platformOrigin } from './origin';
import { vault as platformVault, tokensOk, type Tokens, type Vault } from './vault';
import { createSseParser } from './sse.ts';
import { utf8Decoder } from './utf8.ts';

export type Session = { token: string | null; refresh: string | null; visitor: string | null };
export type SearchStart = Pick<ApiJobRow, 'id' | 'kind' | 'state'> & { stages: SearchStage[]; stream: string };
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
type Options = { origin: string | null; fetch: Fetch; now?: () => number; log?: Log; vault?: Vault };
type CallOptions = { body?: unknown; signal?: AbortSignal };

export class ApiFailure extends Error {
  status: number;
  code: string;
  retry: Retry | undefined;
  failed_step: string | undefined;
  // Which limit a 429 hit, when the server names one: 'daily' is the visitor demo's spend cap (assist).
  cap: string | undefined;
  // The answer's body as parsed, for a route whose failure still says something (/v1/health's 503 names its state).
  body: unknown;
  constructor(status: number, code: string, message: string, options: { retry?: Retry; failed_step?: string; cap?: string; body?: unknown; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'ApiFailure';
    this.status = status;
    this.code = code;
    this.retry = options.retry;
    this.failed_step = options.failed_step;
    this.cap = options.cap;
    this.body = options.body;
  }
}

// shortcut: API logs stay in bounded memory until the app supplies its shared logger and upload sink.
const lines: string[] = [];
const log = createLog({ src: 'app.api', build: 'dev', sink: line => { lines.push(line); if (lines.length > 2000) lines.shift(); } });

function retryOf(value: unknown): Retry | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const retry = value as Record<string, unknown>;
  if (retry.by !== 'auto' && retry.by !== 'user' && retry.by !== 'none') return undefined;
  return { by: retry.by, ...(typeof retry.after_s === 'number' ? { after_s: retry.after_s } : {}) };
}

async function failure(response: Response): Promise<ApiFailure> {
  let body: unknown;
  try { body = await response.json(); }
  catch (cause) {
    return new ApiFailure(response.status, 'http_error', response.statusText || `HTTP ${response.status}`, { cause });
  }
  const error = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return new ApiFailure(response.status, typeof error.code === 'string' ? error.code : 'http_error',
    typeof error.message === 'string' ? error.message : response.statusText || `HTTP ${response.status}`,
    { retry: retryOf(error.retry), failed_step: typeof error.failed_step === 'string' ? error.failed_step : undefined, cap: typeof error.cap === 'string' ? error.cap : undefined, body });
}

class StreamInterrupted extends Error {
  constructor(cause: unknown) { super('event stream interrupted', { cause }); }
}

function abortable<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return run();
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason ?? new Error('aborted')); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    run().then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => {
      signal.removeEventListener('abort', abort); reject(error);
    });
  });
}

export function createClient(options: Options) {
  const logger = options.log ?? log, now = options.now ?? Date.now;
  // shortcut: the visitor id is memory only, so an app restart is a new visitor; the tokens persist in the vault.
  const session: Session = { token: null, refresh: null, visitor: null };
  const store = options.vault ?? platformVault;
  const keep = async (t: Tokens | null) => { session.token = t?.access_token ?? null; session.refresh = t?.refresh_token ?? null; await store.set(t); };
  const ready = store.get().then(t => { if (t) { session.token = t.access_token; session.refresh = t.refresh_token; } },
    e => { logger.error('api.vault.read', e); });

  // A refresh token works once (the server rotates the pair), so every 401 that arrives while one refresh runs waits
  // for that refresh instead of sending its own; a second refresh with the same token would end the session.
  let refreshing: Promise<boolean> | null = null;
  const refreshed = () => refreshing ??= (async () => {
    const origin = options.origin;
    if (!session.refresh || origin === null) return false;
    try {
      const r = await options.fetch(origin.replace(/\/+$/, '') + '/v1/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh }) });
      const t: unknown = r.ok ? await r.json() : null;
      if (!tokensOk(t)) { await keep(null); logger.event('state.change', { entity: 'api.session', id: 'session', to: 'signed_out', status: r.status }); return false; }
      await keep(t);
      logger.event('state.change', { entity: 'api.session', id: 'session', to: 'refreshed' });
      return true;
    } catch (e) { logger.error('api.refresh', e); return false; }
    finally { refreshing = null; }
  })();

  async function request(endpoint: string, init: RequestInit = {}, again = false): Promise<Response> {
    const match = /^([A-Z]+) (\/v1\/\S*)$/.exec(endpoint);
    if (!match) throw new TypeError(`expected METHOD /v1/path: ${endpoint}`);
    const [, method, path] = match;
    const origin = options.origin;
    if (origin === null) throw new ApiFailure(0, 'unreachable', 'API origin is not configured');
    await ready;
    const headers = new Headers(init.headers);
    if (session.token) headers.set('Authorization', `Bearer ${session.token}`);
    if (session.visitor) headers.set('X-Visitor-Id', session.visitor);
    const started = now();
    return logger.call('http', endpoint, { method, path }, async ({ from }) => {
      headers.set('x-secondhand-from', from);
      let response: Response;
      try { response = await options.fetch(origin.replace(/\/+$/, '') + path, { ...init, method, headers }); }
      catch (cause) { throw new ApiFailure(0, 'unreachable', 'API could not be reached', { cause }); }
      const visitor = response.headers.get('X-Visitor-Id');
      if (visitor && /^vis_[a-z0-9]{8,32}$/.test(visitor) && visitor !== session.visitor) {
        session.visitor = visitor;
        logger.event('state.change', { entity: 'api.session', id: 'session', to: 'visitor_assigned' });
      }
      if (response.status === 401 && !again && !path.startsWith('/v1/auth/') && session.refresh && await refreshed()) return request(endpoint, init, true);
      if (!response.ok) throw await failure(response);
      return response;
    }, response => ({ status: response.status, ms: now() - started }));
  }

  async function call<T>(endpoint: string, { body, signal }: CallOptions = {}): Promise<T> {
    const response = await request(endpoint, { signal, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) });
    if (response.status === 204) return undefined as T;
    try { return await response.json() as T; }
    catch (cause) {
      if (cause instanceof SyntaxError) throw cause;
      throw new ApiFailure(0, 'unreachable', 'API response could not be read', { cause });
    }
  }

  function search(text: string, filters?: Record<string, unknown>): Promise<SearchStart> {
    return call<SearchStart>('POST /v1/search', { body: { text, ...(filters === undefined ? {} : { filters }) } });
  }

  async function jobFrames(jobId: string, { signal, onFrame }: { signal?: AbortSignal; onFrame: (frame: SseFrame) => void }): Promise<void> {
    let lastId: number | null = null;
    async function consume(response: Response): Promise<boolean> {
      const parser = createSseParser();
      let terminal = false;
      const deliver = (text: string) => {
        const skipped = parser.skipped;
        for (const frame of parser.push(text)) {
          if (signal?.aborted || terminal) break;
          if (lastId !== null && frame.id <= lastId) continue;
          lastId = frame.id;
          logger.note('job frame', { job: jobId, frame_id: frame.id, event: frame.event });
          onFrame(frame);
          terminal = frame.event === 'job.state' && (frame.data.state === 'done' || frame.data.state === 'failed');
        }
        if (parser.skipped > skipped) logger.note('invalid SSE blocks skipped', { job: jobId, count: parser.skipped - skipped });
      };
      if (response.body === null) {
        let text: string;
        try { text = await abortable(() => response.text(), signal); }
        catch (cause) { throw new StreamInterrupted(cause); }
        deliver(text);
        return terminal;
      }
      const reader = response.body.getReader(), decoder = utf8Decoder();
      let ended = false;
      try {
        while (!signal?.aborted) {
          let chunk: ReadableStreamReadResult<Uint8Array>;
          try { chunk = await abortable(() => reader.read(), signal); }
          catch (cause) { throw new StreamInterrupted(cause); }
          if (chunk.done) { ended = true; deliver(decoder.decode()); return terminal; }
          deliver(decoder.decode(chunk.value));
          if (terminal) return true;
        }
        return false;
      } finally {
        if (!ended) {
          try { await reader.cancel(); }
          catch (error) { logger.error('api.stream.cancel', error, { job: jobId }); }
        }
        reader.releaseLock();
      }
    }

    for (let reconnects = 0; ; reconnects++) {
      if (signal?.aborted) return;
      let cause: unknown;
      try {
        const response = await request(`GET /v1/jobs/${encodeURIComponent(jobId)}/events`, {
          signal, headers: { Accept: 'text/event-stream', ...(lastId === null ? {} : { 'Last-Event-ID': String(lastId) }) },
        }).catch(error => {
          if (error instanceof ApiFailure && error.code === 'unreachable') throw new StreamInterrupted(error);
          throw error;
        });
        if (await consume(response)) return;
      } catch (error) {
        if (signal?.aborted) return;
        if (!(error instanceof StreamInterrupted)) throw error;
        cause = error;
        logger.error('api.stream.read', error, { job: jobId });
      }
      if (signal?.aborted) return;
      if (reconnects === 3) throw new ApiFailure(0, 'stream_lost', 'Job event stream was lost', { cause });
      logger.note('reconnecting job event stream', { job: jobId, frame_id: lastId, attempt: reconnects + 1 });
    }
  }

  // The pair an auth route issued is kept until sign-out; signing out forgets it here and on the device.
  const signIn = (t: Tokens) => keep(t);
  const signOut = () => keep(null);

  return { call, search, jobFrames, session, signIn, signOut, ready };
}

export const api = createClient({ origin: platformOrigin, fetch: platformFetch });
