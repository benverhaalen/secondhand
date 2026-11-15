// The hosted browser pool on our own compute (bp-1; spec/engines/protocol-and-adapters.md §3.1, §3.8). Server only.
// Each linked account keeps one persistent profile (its own directory, its own steady address) warm in a context;
// a dispatch opens a page in that warm context, so it pays ~60 ms, not a ~1.7 s cold launch (research/cross-cutting/nate/runs/bp-1.md).
// Public reads with no account run on anonymous contexts of one shared warm browser, many at once.
// Only accounts the person linked (an account row with stored sign-in state) are ever launched or warmed (product/words.md, Nate,
// "Per user, we only run the systems for what they link and store auth for"). Their sign-in loads at lease start and is exported at lease end.
// No code here solves a CAPTCHA or defeats a challenge: a challenge pauses the session and the person clears it in the live browser.
import { join } from 'node:path';
import type { Log } from '../../../../log/index.js';
import type { Accounts, AuthVault, StorageState } from './auth.ts';
import { PROFILES } from '../harness/platform.ts';
import type { Site } from '../harness/protocol.ts';

export type PoolPage = { close(): Promise<void> };
export type PoolContext<P extends PoolPage = PoolPage> = { newPage(): Promise<P>; close(): Promise<void>; onClose(fn: () => void): void;
  loadState?(s: StorageState): Promise<void>; exportState?(): Promise<StorageState> };
export type LaunchOptions = { headless: boolean; proxy?: { server: string } };
export type Launcher<P extends PoolPage = PoolPage> = {
  persistent(profileDir: string, opts: LaunchOptions): Promise<PoolContext<P>>;   // one account's profile, kept on disk
  anonymous(opts: LaunchOptions): Promise<PoolContext<P>>;                         // a throwaway context on the shared browser
};
// Where an account's steady address comes from (a proxy in the person's region); undefined means this host's own address.
export type AddressBook = (account_id: string) => string | undefined;

export type Task<P extends PoolPage, T> = { account_id?: string; site?: Site; job_id: string; run(page: P): Promise<T> };
export type Dispatched<T> = { ok: true; value: T; ms: number; warm: boolean } | { ok: false; status: 409 | 'not_linked' | 'error'; message: string; ms: number };

type Slot<P extends PoolPage> = { ctx: Promise<PoolContext<P>>; ready: boolean; dead: boolean; leasedBy?: string; lastUsed: number; loaded?: boolean; headless?: boolean };

export function createPool<P extends PoolPage>({ launcher, profileRoot, accounts: linked, vault, address = () => undefined, maxAccounts = 32,
  publicConcurrency = 8, log, now = () => performance.now() }: {
  launcher: Launcher<P>; profileRoot: string; accounts?: Accounts; vault?: AuthVault; address?: AddressBook; maxAccounts?: number;
  publicConcurrency?: number; log?: Log; now?: () => number;
}) {
  const accounts = new Map<string, Slot<P>>();
  const publicSlots: (Slot<P> & { busy: boolean })[] = [];
  const waiting: (() => void)[] = [];
  let launches = 0;

  // A site whose profile says headed gets a real window; everything else runs headless.
  const opts = (account_id?: string, site?: Site): LaunchOptions => {
    const server = account_id ? address(account_id) : undefined, headless = !(site && PROFILES[site].headed);
    return server ? { headless, proxy: { server } } : { headless };
  };
  const profileDir = (account_id: string) => profileDirFor(profileRoot, account_id);

  function slotFor(account_id: string, site?: Site): Slot<P> {
    const have = accounts.get(account_id);
    if (have && !have.dead) return have;
    evictIdle();
    const slot: Slot<P> = { ctx: Promise.resolve(null as never), ready: false, lastUsed: now(), dead: false };
    launches++;
    // A restart relaunches the same directory, so the login survives; a site that logged us out answers auth_expired in its adapter.
    slot.ctx = launcher.persistent(profileDir(account_id), opts(account_id, site)).then(c => { slot.ready = true; c.onClose(() => { slot.dead = true; }); return c; },
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

  function publicSlot(site?: Site): (Slot<P> & { busy: boolean }) | undefined {
    for (let i = publicSlots.length - 1; i >= 0; i--) if (publicSlots[i].dead) publicSlots.splice(i, 1);
    const headless = opts(undefined, site).headless;
    const free = publicSlots.find(s => !s.busy && s.headless === headless);
    if (free) return free;
    if (publicSlots.length < publicConcurrency) return launchPublic(site);
    // Full: close an idle slot of the other kind to make room, so a headed site is never starved by headless ones.
    const idle = publicSlots.findIndex(s => !s.busy);
    if (idle < 0) return undefined;
    const [old] = publicSlots.splice(idle, 1);
    void old.ctx.then(c => c.close(), () => undefined);
    return launchPublic(site);
  }

  function launchPublic(site?: Site): Slot<P> & { busy: boolean } {
    launches++;
    const o = opts(undefined, site);
    const s: Slot<P> & { busy: boolean } = { ctx: Promise.resolve(null as never), ready: false, busy: false, dead: false, lastUsed: now(), headless: o.headless };
    s.ctx = launcher.anonymous(o).then(c => { s.ready = true; c.onClose(() => { s.dead = true; }); return c; }, e => { s.dead = true; throw e; });
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
        // Not linked, or no stored sign-in: nothing is launched for it.
        const acct = linked ? await linked.byId(task.account_id) : undefined;
        if (!acct) return { ok: false, status: 'not_linked', message: 'this account is not linked', ms: now() - t0 };
        const before = accounts.get(task.account_id);
        const warm = !!before && !before.dead && before.ready;
        const slot = slotFor(task.account_id, acct.site);
        // One task drives an account's session at a time, even two tasks of one job: the second is told 409 at once.
        if (slot.leasedBy) return { ok: false, status: 409, message: `account busy with ${slot.leasedBy}`, ms: now() - t0 };
        slot.leasedBy = task.job_id;
        let ran = false;
        try {
          const ctx = await slot.ctx;
          if (!slot.loaded && ctx.loadState && vault) { const st = await vault.get(acct.token_ref); if (st) await ctx.loadState(st); }
          slot.loaded = true;
          const value = await runOn(slot.ctx, task);
          ran = true;
          return { ok: true, value, ms: now() - t0, warm };
        } finally {
          // The sign-in goes back to the vault after a lease that loaded and ran cleanly, so a cloud browser or a host move loses
          // nothing. Never after a failed load or run, and never a state with no cookies over one that has them (a logout or an
          // expiry must not erase the stored sign-in; the adapter reports auth_expired and the person relinks).
          const ctx = ran && slot.ready && !slot.dead ? await slot.ctx : undefined;
          if (ctx?.exportState && vault) await ctx.exportState().then(async st => {
            const had = await vault.get(acct.token_ref);
            if (st.cookies.length || !had?.cookies.length) await vault.put(acct.token_ref, st);
          }, () => undefined);
          slot.leasedBy = undefined; slot.lastUsed = now();
        }
      }
      let s = publicSlot(task.site);
      while (!s) { await new Promise<void>(r => waiting.push(r)); s = publicSlot(task.site); }
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
    // Launch the person's linked profiles (and the public contexts) ahead of any call, so the first dispatch is warm.
    // An id that is not linked is skipped: warming never launches a site the person did not link.
    async warm(account_ids: string[], publicSlotsWanted = Math.min(2, publicConcurrency)) {
      for (const id of account_ids) { const a = linked && await linked.byId(id); if (a) slotFor(id, a.site); }
      while (publicSlots.length < publicSlotsWanted) launchPublic();
      await Promise.allSettled([...[...accounts.values()].map(s => s.ctx), ...publicSlots.map(s => s.ctx)]);
    },
    async warmLinked(person_id?: string, publicSlotsWanted?: number) {
      return this.warm(linked ? (await linked.linked(person_id)).map(a => a.account_id) : [], publicSlotsWanted);
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

// One account's profile directory: the pool and the hosted sign-in open the same one.
export const profileDirFor = (profileRoot: string, account_id: string) => join(profileRoot, encodeURIComponent(account_id));

export type Pool<P extends PoolPage = PoolPage> = ReturnType<typeof createPool<P>>;
