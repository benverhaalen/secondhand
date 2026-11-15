import type { AssistEvent } from './types.ts';
import type { Photo } from './events.ts';
import { isAnswer, parseEvent, record } from './contract.ts';

export class ApiFailure extends Error {
  state: 'rate_limited' | 'failed';
  constructor(status: number) { super(status === 429 ? 'Request rate limited' : 'Request failed'); this.state = status === 429 ? 'rate_limited' : 'failed'; }
}
export class JobFailure extends Error {}
export async function ask(text: string, image: Photo | undefined, visitor: string, key: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<string> {
  const response = await fetcher('/v1/assist', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': visitor, 'Idempotency-Key': key }, body: JSON.stringify({ surface: 'buy', text, ...(image ? { image } : {}) }), signal });
  if (!response.ok) throw new ApiFailure(response.status);
  const reply: unknown = await response.json();
  if (response.status !== 202 || !record(reply) || typeof reply.id !== 'string' || !/^job_[a-zA-Z0-9_-]+$/.test(reply.id) || reply.kind !== 'assist' || typeof reply.state !== 'string' || !Array.isArray(reply.stages)) throw new Error('Invalid job reply');
  return reply.id;
}
export interface StreamPort {
  addEventListener(name: string, callback: (event: { data: string; lastEventId?: string }) => void): void;
  onerror: (() => void) | null;
  close(): void;
}
export interface FollowOptions {
  source?: (url: string) => StreamPort;
  fetcher?: typeof fetch;
  schedule?: (callback: () => void, ms: number) => () => void;
  onEvent(event: AssistEvent): void;
  onError(error: unknown): void;
  onFallback?(error: unknown): void;
}
export function openEventSource(url: string): StreamPort {
  const stream = new EventSource(url);
  const port: StreamPort = {
    addEventListener(name, callback) {
      stream.addEventListener(name, event => {
        if (event instanceof MessageEvent && typeof event.data === 'string') callback({ data: event.data, lastEventId: event.lastEventId });
      });
    },
    onerror: null,
    close: () => stream.close(),
  };
  stream.onerror = () => port.onerror?.();
  return port;
}
export function followJob(id: string, visitor: string, options: FollowOptions): () => void {
  const fetcher = options.fetcher ?? fetch;
  const schedule = options.schedule ?? ((callback, ms) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); });
  const controller = new AbortController();
  let source: StreamPort | undefined;
  let cancelTimer: (() => void) | undefined;
  let stopped = false;
  let polling = false;
  const seen = new Set<string>();
  const stop = () => { stopped = true; source?.close(); source = undefined; cancelTimer?.(); controller.abort(); };
  const fail = (error: unknown) => { if (stopped) return; stop(); options.onError(error); };
  const emit = (event: AssistEvent) => { if (stopped) return; options.onEvent(event); if (event.event === 'assist.settled') stop(); };
  const poll = async () => {
    if (stopped) return;
    try {
      const response = await fetcher(`/v1/jobs/${encodeURIComponent(id)}`, { headers: { 'X-Visitor-Id': visitor }, signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new ApiFailure(response.status);
      const job: unknown = await response.json();
      if (!record(job)) throw new Error('Invalid job reply');
      if (job.result !== undefined && job.result !== null) {
        if (!isAnswer(job.result)) throw new JobFailure('Invalid answer reply');
        emit({ event: 'assist.settled', data: job.result });
        return;
      }
      if (job.state === 'failed' || job.state === 'done') throw new JobFailure('Job ended without an answer');
      if (job.state !== 'running' && job.state !== 'queued') throw new Error('Invalid job state');
      if (!stopped) cancelTimer = schedule(() => { void poll(); }, 2000);
    } catch (error) { fail(error); }
  };
  const fallback = (error: unknown) => {
    if (stopped || polling) return;
    polling = true;
    source?.close(); source = undefined; cancelTimer?.();
    options.onFallback?.(error);
    cancelTimer = schedule(() => { void poll(); }, 2000);
  };
  try {
    const opened = (options.source ?? openEventSource)(`/v1/jobs/${encodeURIComponent(id)}/events`);
    source = opened;
    for (const name of ['assist.tool', 'assist.text', 'assist.settled']) opened.addEventListener(name, frame => {
      if (stopped || polling || frame.lastEventId && seen.has(frame.lastEventId)) return;
      try {
        const event = parseEvent(name, JSON.parse(frame.data));
        if (frame.lastEventId) seen.add(frame.lastEventId);
        cancelTimer?.();
        emit(event);
        if (!stopped) cancelTimer = schedule(() => fallback(new Error('Event stream stalled')), 10000);
      } catch (error) { fallback(error); }
    });
    opened.onerror = () => fallback(new Error('Event stream unavailable'));
    cancelTimer = schedule(() => fallback(new Error('Event stream stalled')), 10000);
  } catch (error) { fallback(error); }
  return stop;
}
