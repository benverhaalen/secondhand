// The hosted browser pool on our own compute (bp-1; spec/engines/protocol-and-adapters.md §3.1, §3.8). Server only.
// Each linked account keeps one persistent profile (its own directory, its own steady address) warm in a context;
// a dispatch opens a page in that warm context, so it pays ~60 ms, not a ~1.7 s cold launch (research/cross-cutting/nate/runs/bp-1.md).
// Public reads with no account run on anonymous contexts of one shared warm browser, many at once.
// Nothing here forges a fingerprint or solves a challenge: launch options carry no user agent, no stealth flag, no solver.
import { join } from 'node:path';
import type { Log } from '../../../../log/index.js';

export type PoolPage = { close(): Promise<void> };
export type PoolContext<P extends PoolPage = PoolPage> = { newPage(): Promise<P>; close(): Promise<void>; onClose(fn: () => void): void };
export type LaunchOptions = { headless: true; proxy?: { server: string } };
export type Launcher<P extends PoolPage = PoolPage> = {
  persistent(profileDir: string, opts: LaunchOptions): Promise<PoolContext<P>>;   // one account's profile, kept on disk
  anonymous(opts: LaunchOptions): Promise<PoolContext<P>>;                         // a throwaway context on the shared browser
};
// Where an account's steady address comes from (a proxy in the person's region); undefined means this host's own address.
export type AddressBook = (account_id: string) => string | undefined;

export type Task<P extends PoolPage, T> = { account_id?: string; job_id: string; run(page: P): Promise<T> };
export type Dispatched<T> = { ok: true; value: T; ms: number; warm: boolean } | { ok: false; status: 409 | 'error'; message: string; ms: number };

type Slot<P extends PoolPage> = { ctx: Promise<PoolContext<P>>; ready: boolean; dead: boolean; leasedBy?: string; lastUsed: number };

export function createPool<P extends PoolPage>({ launcher, profileRoot, address = () => undefined, maxAccounts = 32, publicConcurrency = 8,
  log, now = () => performance.now() }: {
  launcher: Launcher<P>; profileRoot: string; address?: AddressBook; maxAccounts?: number; publicConcurrency?: number; log?: Log; now?: () => number;
}) {
  const accounts = new Map<string, Slot<P>>();
  const publicSlots: (Slot<P> & { busy: boolean })[] = [];
  const waiting: (() => void)[] = [];
  let launches = 0;

  const opts = (account_id?: string): LaunchOptions => {
    const server = account_id ? address(account_id) : undefined;
    return server ? { headless: true, proxy: { server } } : { headless: true };
  };
  const profileDir = (account_id: string) => join(profileRoot, encodeURIComponent(account_id));

  function slotFor(account_id: string): Slot<P> {
    const have = accounts.get(account_id);
    if (have && !have.dead) return have;
    evictIdle();
    const slot: Slot<P> = { ctx: Promise.resolve(null as never), ready: false, lastUsed: now(), dead: false };
    launches++;
    // A restart relaunches the same directory, so the login survives; a site that logged us out answers auth_expired in its adapter.
    slot.ctx = launcher.persistent(profileDir(account_id), opts(account_id)).then(c => { slot.ready = true; c.onClose(() => { slot.dead = true; }); return c; },
      e => { slot.dead = true; throw e; });
    accounts.set(account_id, slot);
    return slot;
  }

  function evictIdle() {
    if (accounts.size < maxAccounts) return;
    const idle = [...accounts.entries()].filter(([, s]) => !s.leasedBy).sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
    if (!idle) return; // every account is mid-job: the pool grows past its cap rather than drop a lease
    accounts.delete(idle[0]);
    void idle[1].ctx.then(c => c.close(), () => undefined);
  }

  function publicSlot(): (Slot<P> & { busy: boolean }) | undefined {
    for (let i = publicSlots.length - 1; i >= 0; i--) if (publicSlots[i].dead) publicSlots.splice(i, 1);
    const free = publicSlots.find(s => !s.busy);
    if (free) return free;
    return publicSlots.length < publicConcurrency ? launchPublic() : undefined;
  }

  function launchPublic(): Slot<P> & { busy: boolean } {
    launches++;
    const s: Slot<P> & { busy: boolean } = { ctx: Promise.resolve(null as never), ready: false, busy: false, dead: false, lastUsed: now() };
    s.ctx = launcher.anonymous(opts()).then(c => { s.ready = true; c.onClose(() => { s.dead = true; }); return c; }, e => { s.dead = true; throw e; });
    publicSlots.push(s);
    return s;
  }

  async function runOn<T>(ctx: Promise<PoolContext<P>>, task: Task<P, T>): Promise<T> {
    const page = await (await ctx).newPage();
    try { return await task.run(page); } finally { await page.close().catch(() => undefined); }
  }

  async function dispatch<T>(task: Task<P, T>): Promise<Dispatched<T>> {
    const t0 = now();
    const go = async (): Promise<Dispatched<T>> => {
      if (task.account_id) {
        const before = accounts.get(task.account_id);
        const warm = !!before && !before.dead && before.ready;
        const slot = slotFor(task.account_id);
        // One job drives an account's session at a time; a second job is told 409 at once, never queued into the first's steps.
        if (slot.leasedBy && slot.leasedBy !== task.job_id) return { ok: false, status: 409, message: `account busy with ${slot.leasedBy}`, ms: now() - t0 };
        slot.leasedBy = task.job_id;
        try { const value = await runOn(slot.ctx, task); return { ok: true, value, ms: now() - t0, warm }; }
        finally { slot.leasedBy = undefined; slot.lastUsed = now(); }
      }
      let s = publicSlot();
      while (!s) { await new Promise<void>(r => waiting.push(r)); s = publicSlot(); }
      const warm = s.ready;
      s.busy = true;
      try { const value = await runOn(s.ctx, task); return { ok: true, value, ms: now() - t0, warm }; }
      finally { s.busy = false; waiting.shift()?.(); }
    };
    try {
      return log ? await log.call('browser', 'pool.dispatch', { job_id: task.job_id, account: task.account_id ? 'linked' : 'public' }, go,
        (d: Dispatched<T>) => ({ result: { ok: d.ok, code: d.ok ? 'ok' : String(d.status), ms: Math.round(d.ms) } })) : await go();
    } catch (e) {
      return { ok: false, status: 'error', message: (e as Error)?.message ?? String(e), ms: now() - t0 };
    }
  }

  return {
    // Launch these accounts' profiles (and the public contexts) ahead of any call, so the first dispatch is warm.
    async warm(account_ids: string[], publicSlotsWanted = Math.min(2, publicConcurrency)) {
      for (const id of account_ids) slotFor(id);
      while (publicSlots.length < publicSlotsWanted) launchPublic();
      await Promise.allSettled([...[...accounts.values()].map(s => s.ctx), ...publicSlots.map(s => s.ctx)]);
    },
    dispatch,
    // Every task is sent at once, each on its own page; nothing waits on another except two jobs on one account (409).
    dispatchAll<T>(tasks: Task<P, T>[]) { return Promise.all(tasks.map(t => dispatch(t))); },
    stats: () => ({ launches, accounts: accounts.size, public: publicSlots.length, leased: [...accounts.values()].filter(s => s.leasedBy).length }),
    async close() {
      const all = [...[...accounts.values()].map(s => s.ctx), ...publicSlots.map(s => s.ctx)];
      accounts.clear(); publicSlots.length = 0;
      await Promise.allSettled(all.map(c => c.then(x => x.close())));
    },
  };
}

export type Pool<P extends PoolPage = PoolPage> = ReturnType<typeof createPool<P>>;
