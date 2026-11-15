// Anonymous browser reads: spec/engines/protocol-and-adapters.md §8, “Where a read runs”.
import type { Log } from '../../../../log/index.js';
import type { Launcher, PoolContext } from '../browser/pool.ts';
import { parseListings, type ListingAsk, type ListingResult, type ListingSpec } from './listing-parser.ts';
import { CHALLENGE, ebayListingSpec, type EbayPage, type ListingRead, type PageClient } from './sites/ebay/adapter.ts';
import { API, WWW, type Client, type Reply } from './sites/depop/adapter.ts';

export type PublicPage = {
  goto(url: string, options: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<{ status(): number } | null>;
  content(): Promise<string>;
  waitForTimeout(ms: number): Promise<void>;
  waitForSelector(selector: string, options: { state: 'attached'; timeout: number }): Promise<unknown>;
  evaluate<T, A>(fn: string | ((arg: A) => T | Promise<T>), arg: A): Promise<T>;
  on(event: 'close' | 'crash', fn: () => void): void;
  off(event: 'close' | 'crash', fn: () => void): void;
  close(): Promise<void>;
};

type Site = 'ebay' | 'depop';
type Code = 'timeout' | 'aborted' | 'closed' | 'browser';
export class PublicClientError extends Error {
  readonly code: Code;
  constructor(code: Code) {
    super({ timeout: 'public read timed out', aborted: 'public read aborted', closed: 'public clients closed', browser: 'public browser read failed' }[code]);
    this.code = code;
    this.name = code === 'timeout' ? 'TimeoutError' : code === 'aborted' ? 'AbortError' : 'PublicClientError';
  }
}

type Slot = {
  context: Promise<PoolContext<PublicPage>>;
  page?: PublicPage;
  dead: boolean;
  disconnected: boolean;
  closing?: Promise<void>;
  idle?: ReturnType<typeof setTimeout>;
  failure: Promise<never>;
  failed(error: PublicClientError): void;
  detach?(): void;
};
type Lane = { slot?: Slot; tail: Promise<void> };
type ReadMetrics = { bytes_out: number; parsed?: 'page' | 'server'; waited_ms?: number; fallback?: 'evaluation' | 'shape' | 'zero_cards' | 'page_state' };
type Outcome<T> = { ok: true; value: T } | { ok: false; error: PublicClientError };

export function publicClients({ launcher, log, now = () => performance.now(), idleMs = 120_000, timeoutMs = 30_000 }: {
  launcher: Launcher<PublicPage>; log: Log; now?: () => number; idleMs?: number; timeoutMs?: number;
}): { ebay: PageClient; depop: Client; close(): Promise<void> } {
  if (!(idleMs > 0 && Number.isFinite(idleMs)) || !(timeoutMs > 0 && Number.isFinite(timeoutMs))) throw new Error('public client limits must be positive finite milliseconds');
  const lanes: Record<Site, Lane> = { ebay: { tail: Promise.resolve() }, depop: { tail: Promise.resolve() } };
  const reads = new Set<(error: PublicClientError) => void>();
  const slots = new Set<Slot>();
  let closed = false, closing: Promise<void> | undefined;

  const reportClose = () => log.error('public.close', new Error('anonymous browser close failed'));
  function retire(slot: Slot): Promise<void> {
    if (slot.closing) return slot.closing;
    slot.dead = true; clearTimeout(slot.idle); slot.detach?.();
    slot.closing = slot.context.then(async context => {
      if (!slot.disconnected) await context.close();
    }, () => undefined).then(() => { slots.delete(slot); }, () => { throw new PublicClientError('browser'); });
    return slot.closing;
  }
  function open(): Slot {
    let failed!: Slot['failed'];
    const failure = new Promise<never>((_resolve, reject) => { failed = reject; });
    const slot: Slot = { context: launcher.anonymous({ headless: true }), dead: false, disconnected: false, failure, failed };
    slot.context = slot.context.then(context => {
      context.onClose(() => {
        slot.disconnected = true; slot.dead = true; clearTimeout(slot.idle);
        slot.failed(new PublicClientError('browser'));
      });
      return context;
    });
    slots.add(slot);
    return slot;
  }
  async function prepare(slot: Slot): Promise<PublicPage> {
    const context = await slot.context;
    if (slot.dead) throw new PublicClientError('browser');
    if (!slot.page) {
      const page = await context.newPage();
      const broken = () => {
        slot.failed(new PublicClientError('browser'));
        void retire(slot).catch(reportClose);
      };
      page.on('close', broken); page.on('crash', broken);
      slot.detach = () => { page.off('close', broken); page.off('crash', broken); };
      slot.page = page;
    }
    return slot.page;
  }

  async function read<T>(site: Site, url: string, signal: AbortSignal,
    work: (page: PublicPage, status: (value: number) => void, cold: boolean, metrics: ReadMetrics) => Promise<T>): Promise<T> {
    const target = new URL(url), fields = { site, origin: target.origin, path: target.pathname };
    const started = now(), lane = lanes[site], metrics: ReadMetrics = { bytes_out: 0 };
    let held: Slot | undefined, interrupted: PublicClientError | undefined, status = 0, warm = false;
    let rejectStop!: (error: PublicClientError) => void;
    const stopped = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
    const stop = (error: PublicClientError) => {
      if (interrupted) return;
      interrupted = error; rejectStop(error);
      if (held) void retire(held).catch(reportClose);
    };
    const abort = () => stop(new PublicClientError('aborted'));
    reads.add(stop);
    const timer = setTimeout(() => stop(new PublicClientError('timeout')), timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    if (closed) stop(new PublicClientError('closed'));
    else if (signal.aborted) abort();

    const task = lane.tail.then(async () => {
      if (interrupted) throw interrupted;
      if (lane.slot?.dead) { await retire(lane.slot); lane.slot = undefined; }
      if (interrupted) throw interrupted;
      warm = !!lane.slot;
      held = lane.slot ??= open();
      clearTimeout(held.idle);
      try {
        const page = await Promise.race([prepare(held), stopped, held.failure]);
        if (interrupted) throw interrupted;
        return await Promise.race([work(page, value => { status = value; }, !warm, metrics), stopped, held.failure]);
      } catch (error) {
        await retire(held);
        throw error;
      } finally {
        if (!held.dead) {
          held.idle = setTimeout(() => { void retire(held!).catch(reportClose); }, idleMs);
        }
      }
    });
    // The caller receives the error; consuming it here keeps one failed job from poisoning the site's queue.
    lane.tail = task.then(() => undefined, () => undefined);
    try {
      // Raw browser errors can contain full URLs and page text. Only the bounded outcome reaches the logger.
      const outcome = await log.call<Outcome<T>>('browser', 'public.read', fields, async () => {
        try { return { ok: true, value: await Promise.race([task, stopped]) }; }
        catch (error) {
          return { ok: false, error: error instanceof PublicClientError ? error : new PublicClientError(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'browser') };
        }
      }, out => ({ ...fields, status, warm, ...metrics, result: { ok: out.ok, code: out.ok ? 'ok' : out.error.code, ms: Math.round(now() - started) } }));
      if (!outcome.ok) throw outcome.error;
      return outcome.value;
    } finally {
      clearTimeout(timer); signal.removeEventListener('abort', abort); reads.delete(stop);
    }
  }

  const doc: Client['doc'] = (url, signal) => read('depop', url, signal, async (page, status, _cold, metrics) => {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const code = response?.status() ?? 0; status(code);
    const html = await page.content(); metrics.bytes_out = Buffer.byteLength(html); metrics.parsed = 'server';
    return { status: code, html, challenge: /just a moment|captcha|are you a robot/i.test(html.slice(0, 20_000)) };
  });
  const ebayRead = (url: string, signal: AbortSignal, spec?: ListingSpec, ask: ListingAsk = {}): Promise<EbayPage | ListingRead> => read('ebay', url, signal, async (page, status, _cold, metrics) => {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const code = response?.status() ?? 0; status(code);
    const data = spec ?? ebayListingSpec(), started = now();
    const selector = [data.card_selector, data.empty_selector].filter(Boolean).join(', ');
    try {
      await page.waitForSelector(selector, { state: 'attached', timeout: 1500 });
      metrics.waited_ms = Math.round(now() - started);
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error;
      // The readiness cap is normal for item pages, errors and layout changes.
      metrics.waited_ms = 1500;
    }
    const server = async (): Promise<EbayPage> => {
      const html = await page.content(); metrics.parsed = 'server'; metrics.bytes_out = Buffer.byteLength(html);
      return { status: code, html };
    };
    if (!spec) return server();
    if (code >= 400) { metrics.fallback = 'page_state'; return server(); }
    try {
      const state = await page.evaluate(({ spec, challenge }: { spec: ListingSpec; challenge: string }) => {
        const title = document.title;
        const empty = spec.empty_selector && document.querySelector(spec.empty_selector);
        const heading = spec.heading_selector && document.querySelector(spec.heading_selector);
        return {
          blocked: new RegExp(challenge, 'i').test(title) || new RegExp(challenge, 'i').test(document.documentElement.outerHTML.slice(0, 20_000)),
          signin: /^sign in or register\b/i.test(title), error: /^error page\b/i.test(title),
          heading: !spec.heading_selector || !!heading,
          empty: !!((empty && (!spec.empty_pattern || new RegExp(spec.empty_pattern).test(empty.textContent ?? ''))) || (heading && spec.empty_heading_pattern && new RegExp(spec.empty_heading_pattern).test(heading.textContent?.trim() ?? ''))),
        };
      }, { spec, challenge: CHALLENGE.source });
      if (state.blocked || state.signin || state.error || !state.heading) { metrics.fallback = 'page_state'; return server(); }
      // Playwright evaluates source directly in the page's realm; there is no captured module scope.
      const parsed: unknown = await page.evaluate(`(${parseListings.toString()})(document, ${JSON.stringify(spec)}, ${JSON.stringify(ask)})`, undefined);
      if (!isListingResult(parsed, spec)) { metrics.fallback = 'shape'; return server(); }
      if (parsed.total === 0 && !state.empty) { metrics.fallback = 'zero_cards'; return server(); }
      metrics.parsed = 'page'; metrics.bytes_out = Buffer.byteLength(JSON.stringify(parsed.rows));
      return { status: code, ...parsed };
    } catch {
      // Browser evaluation errors can hold page text/URLs. The fallback reason is bounded and logged by read().
      metrics.fallback = 'evaluation';
      if (signal.aborted) throw new PublicClientError('aborted');
      return server();
    }
  });
  return {
    ebay: { signed_in: false, page: (url, signal) => ebayRead(url, signal) as Promise<EbayPage>, listings: ebayRead },
    depop: { signed_in: false, doc, json: (path, signal) => read<Reply>('depop', API + path, signal, async (page, status, cold, metrics) => {
      // live.ts first navigates via search. A standalone JSON read also needs an open Depop origin for CORS.
      if (cold) await page.goto(WWW + '/', { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      const reply = await page.evaluate(async (url: string) => {
        const response = await fetch(url, { credentials: 'omit' });
        return { status: response.status, body: response.ok ? await response.json() : null };
      }, API + path);
      status(reply.status); metrics.bytes_out = Buffer.byteLength(JSON.stringify(reply));
      return reply;
    }) },
    close() {
      if (closing) return closing;
      closed = true;
      for (const stop of reads) stop(new PublicClientError('closed'));
      closing = Promise.all([...slots].map(retire)).then(() => undefined);
      return closing;
    },
  };
}

function isListingResult(value: unknown, spec: ListingSpec): value is ListingResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== 5 || !Object.keys(v).every(key => ['rows', 'dropped', 'total', 'facts', 'narrowed_out'].includes(key))) return false;
  if (!['total', 'dropped', 'facts', 'narrowed_out'].every(k => Number.isSafeInteger(v[k]) && Number(v[k]) >= 0) || !Array.isArray(v.rows)) return false;
  let facts = 0;
  for (const row of v.rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    const r = row as Record<string, unknown>;
    if (typeof r.item_id !== 'string' || !r.item_id || !Number.isSafeInteger(r.price_cents) || Number(r.price_cents) < 0 ||
        !Number.isSafeInteger(r.rank) || Number(r.rank) < 1 || Number(r.rank) > Number(v.total) || !['all', 'some', 'none'].includes(String(r.name_match))) return false;
    if (!Object.entries(r).every(([key, field]) => (key === 'rank' || key === 'name_match' || key in spec.fields) &&
        (typeof field === 'string' || typeof field === 'boolean' || (typeof field === 'number' && Number.isFinite(field))))) return false;
    facts += Object.entries(r).filter(([key, field]) => key !== 'name_match' && field !== '').length;
  }
  return facts === v.facts && v.rows.length + Number(v.dropped) + Number(v.narrowed_out) <= Number(v.total);
}
