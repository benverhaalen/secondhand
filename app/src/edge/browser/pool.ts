// The hosted browser pool on our own compute (bp-1; spec/engines/protocol-and-adapters.md §3.1, §3.8). Server only.
// Each linked account keeps one persistent profile (its own directory, its own steady address) warm in a context;
// a dispatch opens a page in that warm context, so it pays ~60 ms, not a ~1.7 s cold launch (research/cross-cutting/nate/runs/bp-1.md).
// Public reads with no account run on anonymous contexts of one shared warm browser, many at once.
// Only accounts the person linked (an account row with stored sign-in state) are ever launched or warmed (product/words.md, Nate,
// "Per user, we only run the systems for what they link and store auth for"). Their sign-in loads at lease start and is exported at lease end.
// No code here solves a CAPTCHA or defeats a challenge: a challenge pauses the session and the person clears it in the live browser.
import { join } from 'node:path';
import { mask } from '../../../../log/index.js';
import type { Leases } from '../events/ports.ts';
import type { Log } from '../../../../log/index.js';
import type { Accounts, AuthVault, StorageState, ProfileRegistry } from './auth.ts';
import { PROFILES } from '../harness/platform.ts';
import type { Site } from '../harness/protocol.ts';

export type PoolPage = { close(): Promise<void> };
export type PoolContext<P extends PoolPage = PoolPage> = { newPage(): Promise<P>; close(): Promise<void>; onClose(fn: () => void): void;
  profileSaved?(): boolean; loadState?(s: StorageState): Promise<void>; exportState?(): Promise<StorageState> };
export type LaunchOptions = { headless: boolean; timeoutMin?: number; user_id?: string; account_id?: string; pending_profile_id?: string; proxy?: { server: string } };
export type Launcher<P extends PoolPage = PoolPage> = {
  persistent(profileDir: string, opts: LaunchOptions): Promise<PoolContext<P>>;   // one account's profile, kept on disk
  anonymous(opts: LaunchOptions): Promise<PoolContext<P>>;                         // a throwaway context on the shared browser
};
// Where an account's steady address comes from (a proxy in the person's region); undefined means this host's own address.
export type AddressBook = (account_id: string) => string | undefined;

export type Task<P extends PoolPage, T> = { user_id?: string; account_id?: string; site?: Site; job_id: string; run(page: P): Promise<T> };
export type Dispatched<T> = { ok: true; value: T; ms: number; warm: boolean } | { ok: false; status: 409 | 'not_linked' | 'error'; message: string; ms: number };

type Slot<P extends PoolPage> = { ctx: Promise<PoolContext<P>>; ready: boolean; dead: boolean; active?: boolean; lastUsed: number; loaded?: boolean; version?: number; headless?: boolean };

export function createPool<P extends PoolPage>({ launcher, profileRoot, accounts: linked, vault, registry, address = () => undefined, maxAccounts = 32,
  publicConcurrency = 8, leases, leaseTtlMs = 120_000, log, now = () => performance.now() }: {
  launcher: Launcher<P>; profileRoot: string; accounts?: Accounts; vault?: AuthVault; registry?: ProfileRegistry; address?: AddressBook; maxAccounts?: number;
  publicConcurrency?: number; leases: Leases; leaseTtlMs?: number; log?: Log; now?: () => number;
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

  function slotFor(account_id: string, site?: Site, user_id?: string): Slot<P> {
    const have = accounts.get(account_id);
    if (have && !have.dead) return have;
    evictIdle();
    const slot: Slot<P> = { ctx: Promise.resolve(null as never), ready: false, lastUsed: now(), dead: false };
    launches++;
    // A restart relaunches the same directory, so the login survives; a site that logged us out answers auth_expired in its adapter.
    slot.ctx = launcher.persistent(profileDir(account_id), { ...opts(account_id, site), ...(registry ? { user_id, account_id } : {}) }).then(c => { slot.ready = true; c.onClose(() => { slot.dead = true; }); return c; },
      e => { slot.dead = true; throw e; });
    accounts.set(account_id, slot);
    return slot;
  }

  function evictIdle() {
    if (accounts.size < maxAccounts) return;
    const idle = [...accounts.entries()].filter(([, s]) => !s.active).sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
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
    try { return await task.run(page); } finally { await page.close().catch(e => { log?.error('pool.page_close', registry ? new Error('profile page close failed') : e); }); }
  }

  async function dispatch<T>(task: Task<P, T>): Promise<Dispatched<T>> {
    const t0 = now();
    const go = async (): Promise<Dispatched<T>> => {
      if (task.account_id) {
        // Not linked, or no stored sign-in: nothing is launched for it.
        const profile = registry && task.user_id ? await registry.get(task.user_id, task.account_id) : undefined;
        const acct = registry ? (profile?.state === 'linked' && profile.site === task.site ?
          { account_id: profile.account_id, person_id: profile.user_id, site: profile.site, token_ref: '' } : undefined) :
          linked ? await linked.byId(task.account_id) : undefined;
        if (!acct) return { ok: false, status: 'not_linked', message: 'this account is not linked', ms: now() - t0 };
        const leased = await leases.withLease<Dispatched<T>>(acct.account_id, task.job_id, leaseTtlMs, async () => {
          const before = accounts.get(acct.account_id);
          const warm = !!before && !before.dead && before.ready;
          const slot = slotFor(acct.account_id, acct.site, task.user_id);
          if (slot.active) return { ok: false, status: 409, message: 'account already has a page in use', ms: now() - t0 };
          slot.active = true;
          let ran = false;
          try {
            const ctx = await slot.ctx;
            if (!registry && !slot.loaded && ctx.loadState && vault) {
              const snapshot = await vault.snapshot(acct.token_ref);
              if (!snapshot.state) {
                slot.dead = true; await ctx.close();
                return { ok: false, status: 'not_linked', message: 'stored sign-in was removed', ms: now() - t0 };
              }
              await ctx.loadState(snapshot.state);
              slot.version = snapshot.version;
            }
            slot.loaded = true;
            const value = await runOn(slot.ctx, task);
            ran = true;
            return { ok: true, value, ms: now() - t0, warm };
          } finally {
            // The sign-in goes back to the vault after a lease that loaded and ran cleanly, so a cloud browser or a host move loses
            // nothing. Never after a failed load or run, and never a state with no cookies over one that has them (a logout or an
            // expiry must not erase the stored sign-in; the adapter reports auth_expired and the person relinks).
            try {
              const ctx = ran && slot.ready && !slot.dead ? await slot.ctx : undefined;
              if (!registry && ctx?.exportState && vault && slot.version !== undefined) {
                const st = await ctx.exportState();
                const had = await vault.get(acct.token_ref);
                if (st.cookies.length || !had?.cookies.length) {
                  const version = await vault.compareAndPut(acct.token_ref, slot.version, st);
                  if (version !== undefined) slot.version = version;
                }
              }
            } finally {
              slot.active = false; slot.lastUsed = now();
            }
          }
        });
        return leased.ok ? leased.value : { ok: false, status: 409, message: 'account busy', ms: now() - t0 };
      }
      let s = publicSlot(task.site);
      while (!s) { await new Promise<void>(r => waiting.push(r)); s = publicSlot(task.site); }
      const warm = s.ready;
      s.busy = true;
      try { const value = await runOn(s.ctx, task); return { ok: true, value, ms: now() - t0, warm }; }
      finally { s.busy = false; waiting.shift()?.(); }
    };
    const safeGo = async (): Promise<Dispatched<T>> => {
      try { return await go(); }
      catch (e) {
        return { ok: false, status: 'error', message: JSON.stringify(mask({ message: e instanceof Error ? e.message : String(e) })), ms: now() - t0 };
      }
    };
    return log ? log.call('browser', 'pool.dispatch', { job_id: task.job_id, account: task.account_id ? 'linked' : 'public' }, safeGo,
      (d: Dispatched<T>) => ({ result: { ok: d.ok, code: d.ok ? 'ok' : String(d.status), ms: Math.round(d.ms) } })) : safeGo();
  }

  return {
    // Launch the person's linked profiles (and the public contexts) ahead of any call, so the first dispatch is warm.
    // Registry profiles need an owner: these legacy warm methods skip them; scoped dispatch launches them.
    async warm(account_ids: string[], publicSlotsWanted = Math.min(2, publicConcurrency)) {
      for (const id of registry ? [] : account_ids) { const a = linked && await linked.byId(id); if (a) slotFor(id, a.site); }
      while (publicSlots.length < publicSlotsWanted) launchPublic();
      await Promise.allSettled([...[...accounts.values()].map(s => s.ctx), ...publicSlots.map(s => s.ctx)]);
    },
    async warmLinked(person_id?: string, publicSlotsWanted?: number) {
      return this.warm(!registry && linked ? (await linked.linked(person_id)).map(a => a.account_id) : [], publicSlotsWanted);
    },
    async invalidate(account_id: string) {
      const slot = accounts.get(account_id);
      if (!slot) return;
      if (slot.active) throw new Error('cannot invalidate an active account');
      slot.dead = true;
      let ctx: PoolContext<P>;
      try { ctx = await slot.ctx; }
      catch {
        if (accounts.get(account_id) === slot) accounts.delete(account_id);
        log?.error('pool.invalidate', new Error('evicted a failed browser launch'), { account_id });
        return;
      }
      await ctx.close();
      if (accounts.get(account_id) === slot) accounts.delete(account_id);
    },
    dispatch,
    // Every task is sent at once, each on its own page; nothing waits on another except two jobs on one account (409).
    dispatchAll<T>(tasks: Task<P, T>[]) { return Promise.all(tasks.map(t => dispatch(t))); },
    stats: () => ({ launches, accounts: accounts.size, public: publicSlots.length, leased: [...accounts.values()].filter(s => s.active).length }),
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
