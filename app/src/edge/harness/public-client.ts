// Anonymous browser reads: spec/engines/protocol-and-adapters.md §8, “Where a read runs”.
import type { Log } from '../../../../log/index.js';
import type { Launcher, PoolContext } from '../browser/pool.ts';
import type { PageClient } from './sites/ebay/adapter.ts';
import { API, WWW, type Client, type Reply } from './sites/depop/adapter.ts';

export type PublicPage = {
  goto(url: string, options: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<{ status(): number } | null>;
  content(): Promise<string>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T, A>(fn: (arg: A) => Promise<T>, arg: A): Promise<T>;
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
    work: (page: PublicPage, status: (value: number) => void, cold: boolean) => Promise<T>): Promise<T> {
    const target = new URL(url), fields = { site, origin: target.origin, path: target.pathname };
    const started = now(), lane = lanes[site];
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
        return await Promise.race([work(page, value => { status = value; }, !warm), stopped, held.failure]);
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
      }, out => ({ ...fields, status, warm, result: { ok: out.ok, code: out.ok ? 'ok' : out.error.code, ms: Math.round(now() - started) } }));
      if (!outcome.ok) throw outcome.error;
      return outcome.value;
    } finally {
      clearTimeout(timer); signal.removeEventListener('abort', abort); reads.delete(stop);
    }
  }

  const doc: Client['doc'] = (url, signal) => read('depop', url, signal, async (page, status) => {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const code = response?.status() ?? 0; status(code);
    const html = await page.content();
    return { status: code, html, challenge: /just a moment|captcha|are you a robot/i.test(html.slice(0, 20_000)) };
  });
  return {
    ebay: { signed_in: false, page: (url, signal) => read('ebay', url, signal, async (page, status) => {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      const code = response?.status() ?? 0; status(code);
      // The proved live-page.ts path lets eBay settle before capturing the rendered document.
      await page.waitForTimeout(1500);
      return { status: code, html: await page.content() };
    }) },
    depop: { signed_in: false, doc, json: (path, signal) => read<Reply>('depop', API + path, signal, async (page, status, cold) => {
      // live.ts first navigates via search. A standalone JSON read also needs an open Depop origin for CORS.
      if (cold) await page.goto(WWW + '/', { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      const reply = await page.evaluate(async (url: string) => {
        const response = await fetch(url, { credentials: 'omit' });
        return { status: response.status, body: response.ok ? await response.json() : null };
      }, API + path);
      status(reply.status);
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
