// The HTTP side: one visitor session per process, JSON calls, and a job's event stream read to its end.
// Mirrors the app's client (app/src/api/client.ts) and SSE parser (app/src/api/sse.ts) without importing them,
// so this package installs on its own.

export const DEFAULT_ORIGIN = 'https://secondhand-api.fly.dev';
const VISITOR = /^vis_[a-z0-9]{8,32}$/;
const TERMINAL = new Set(['done', 'failed', 'cancelled']);
const RECONNECTS = 3;

export type Retry = { by: 'auto' | 'user' | 'none'; after_s?: number };
export class SecondhandError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retry?: Retry;
  readonly extra: Record<string, unknown>;
  constructor(code: string, message: string, status: number, retry?: Retry, extra: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.retry = retry;
    this.extra = extra;
  }
}

export type Frame = { id: number; event: string; data: Record<string, unknown> };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

// One SSE block to a frame; comments, frames without a numeric id, and non-object data are dropped.
export function parseBlock(block: string): Frame | null {
  let id: number | null = null, event = 'message';
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    const at = line.indexOf(':');
    const field = at < 0 ? line : line.slice(0, at);
    const value = at < 0 ? '' : line.slice(at + 1).replace(/^ /, '');
    if (field === 'id' && /^\d+$/.test(value)) id = Number(value);
    else if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  if (id === null || data.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(data.join('\n'));
    return isObject(parsed) ? { id, event, data: parsed } : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null; // a frame whose data is not JSON is skipped
    throw error;
  }
}

async function failure(response: Response): Promise<SecondhandError> {
  let body: unknown = null;
  try { body = await response.json(); } catch (error) {
    if (!(error instanceof SyntaxError)) throw error; // not JSON: fall through to the status
  }
  if (isObject(body) && typeof body.code === 'string' && typeof body.message === 'string') {
    const { code, message, retry, failed_step: _step, ...extra } = body;
    const parsed = isObject(retry) && ['auto', 'user', 'none'].includes(String(retry.by))
      ? { by: retry.by as Retry['by'], ...(typeof retry.after_s === 'number' ? { after_s: retry.after_s } : {}) } : undefined;
    return new SecondhandError(code, message, response.status, parsed, extra);
  }
  const after = Number(response.headers.get('retry-after'));
  return new SecondhandError(response.status === 429 ? 'rate_limited' : 'http_error', `The secondhand API answered ${response.status}.`, response.status,
    Number.isFinite(after) && after > 0 ? { by: 'auto', after_s: after } : undefined);
}

export function createClient(origin = DEFAULT_ORIGIN, fetchImpl: typeof fetch = fetch) {
  const base = origin.replace(/\/+$/, '');
  let visitor: string | undefined;

  async function call(method: string, path: string, init: { body?: unknown; headers?: Record<string, string>; signal?: AbortSignal } = {}) {
    const headers: Record<string, string> = { Accept: 'application/json', ...init.headers };
    if (visitor) headers['X-Visitor-Id'] = visitor;
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    let response: Response;
    try {
      response = await fetchImpl(base + path, { method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: init.signal });
    } catch (error) {
      if (init.signal?.aborted) throw new SecondhandError('timeout', 'The secondhand API did not finish in time.', 0, { by: 'user' });
      throw new SecondhandError('unreachable', `Could not reach the secondhand API at ${base}.`, 0, { by: 'user' }, { cause: String(error) });
    }
    const issued = response.headers.get('x-visitor-id');
    if (issued && VISITOR.test(issued)) visitor = issued;
    if (!response.ok) throw await failure(response);
    return response;
  }

  async function json(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
    return (await call(method, path, { body, signal })).json();
  }

  // Reads a job's stream until its terminal job.state, resuming from the last id when the connection drops.
  async function follow(stream: string, signal?: AbortSignal): Promise<Frame[]> {
    const frames: Frame[] = [];
    let last: number | null = null, lost = 0;
    for (;;) {
      const headers: Record<string, string> = { Accept: 'text/event-stream' };
      if (last !== null) headers['Last-Event-ID'] = String(last);
      const response = await call('GET', stream, { headers, signal });
      if (!response.body) throw new SecondhandError('stream_lost', 'The job stream had no body.', response.status, { by: 'user' });
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value;
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? '';
          for (const block of blocks) {
            const frame = parseBlock(block);
            if (!frame || (last !== null && frame.id <= last)) continue;
            last = frame.id;
            frames.push(frame);
            if (frame.event === 'job.state' && TERMINAL.has(String(frame.data.state))) {
              await reader.cancel(); // the server holds the stream open after the job ends; close it
              return frames;
            }
          }
        }
      } catch (error) {
        if (signal?.aborted) throw new SecondhandError('timeout', 'The secondhand API did not finish in time.', 0, { by: 'user' });
        if (error instanceof SecondhandError) throw error;
        // any other read error is a dropped connection: fall through and resume
      }
      if (++lost > RECONNECTS) throw new SecondhandError('stream_lost', 'The job stream closed before the job finished.', 0, { by: 'user' });
    }
  }

  return { origin: base, json, follow };
}
export type Client = ReturnType<typeof createClient>;
