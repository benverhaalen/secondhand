// ho-1: copy phone storage into a leased hosted browser; publish to the vault only after a verified read.
// A challenge is a waiting state, never a solver call. Phone storage is never deleted here.
import { randomUUID } from 'node:crypto';
import type { Log } from '../../../../../log/index.js';
import type { Accounts, AuthVault, LinkedAccount, StorageState } from '../../browser/auth.ts';
import { profileDirFor, type Launcher, type PoolContext, type PoolPage } from '../../browser/pool.ts';
import { PROFILES } from '../platform.ts';
import type { Site } from '../protocol.ts';
import type { Leases, Store } from '../../events/ports.ts';
import { markStale } from '../../events/stale.ts';

export type HandoffInput = { person_id: string; account_id: string; site: Site; handoff_id: string; go?: readonly Site[] };
export type HandoffResult = { state: 'dry' | 'ok' | 'paused' | 'account_stale' | 'not_linked' | 'busy'; steps?: readonly string[]; decision_id?: string; session_id?: string; signin_session_url?: string };
type Session<P extends PoolPage> = { account: LinkedAccount; ctx: PoolContext<P>; page: P; result: HandoffResult; job: string; viewer_id: string; live_url?: string; expires: number; closed: boolean; renewLease(): void; assertLease(): void; release(): void };
export function createHandoff<P extends PoolPage & { goto(url: string): Promise<unknown> }>(o: {
  accounts: Accounts; vault: AuthVault; launcher: Launcher<P>; profileRoot: string; leases: Leases; leaseTtlMs: number;
  invalidatePool(account_id: string): Promise<void>; now?: () => number;
  store: Store; log: Log; readPhone(account: LinkedAccount): Promise<StorageState>;
  probe(page: P, account: LinkedAccount): Promise<'ok' | 'blocked' | 'auth_expired'>;
}) {
  const now = o.now ?? Date.now;
  const sessions = new Map<string, Session<P>>(), running = new Map<string, Promise<HandoffResult>>();
  const key = (i: HandoffInput) => JSON.stringify([i.person_id, i.account_id, i.handoff_id]);
  const call = <T>(name: string, a: LinkedAccount, run: () => Promise<T>) =>
    o.log.call('browser', name, { account_id: a.account_id, site: a.site }, async () => {
      try { return await run(); }
      catch { throw new Error(`${name} failed`); }
    }, () => ({ ok: true }));
  async function close(s: Session<P>) {
    if (s.closed) return;
    s.closed = true;
    s.live_url = undefined;
    try { await call('handoff.close', s.account, () => s.ctx.close()); }
    finally { s.release(); }
  }
  function stale(a: LinkedAccount): HandoffResult {
    markStale(o.store, o.log, { user_id: a.person_id, account_id: a.account_id, site: a.site });
    return { state: 'account_stale' };
  }
  async function verify(s: Session<P>): Promise<HandoffResult> {
    try {
      s.assertLease();
      const status = await call('handoff.probe', s.account, () => o.probe(s.page, s.account));
      s.assertLease();
      if (status === 'blocked') {
        if (!s.live_url) throw new Error('cloud browser has no live view');
        if (s.result.decision_id) return s.result;
        const d = o.store.tx(t => {
          const prior = t.decisions({ user_id: s.account.person_id, kind: 'site_warning', subject: s.job })[0];
          if (prior) return { row: prior, duplicate: true };
          return t.raiseDecision({ user_id: s.account.person_id, kind: 'site_warning',
            subject: s.job, why: 'The site needs you to verify this session', options: [{ id: 'continue', label: 'Continue' }], suggested: 'continue' });
        });
        if (!d.duplicate) o.log.event('decision.open', { decision: d.row.id, kind: 'site_warning', tier: 'ask' });
        return s.result = { state: 'paused', decision_id: d.row.id, session_id: s.viewer_id, signin_session_url: `/v1/accounts/handoff/${s.viewer_id}` };
      }
      if (status === 'auth_expired') { s.result = stale(s.account); }
      else {
        if (!s.ctx.exportState) throw new Error('hosted context has no storage export');
        const state = await call('handoff.export', s.account, () => s.ctx.exportState!());
        s.assertLease();
        await call('handoff.invalidate_pool', s.account, () => o.invalidatePool(s.account.account_id));
        s.assertLease();
        await call('handoff.store', s.account, () => o.vault.put(s.account.token_ref, state));
        o.store.tx(t => {
          for (const d of t.decisions({ user_id: s.account.person_id, kind: 'site_warning', subject: s.job }))
            if (d.state === 'open') t.updateDecision(d.id, { state: 'answered' });
        });
        s.result = { state: 'ok' };
      }
    } catch {
      // Vendor errors can contain credentials. Record the cause category, never the vendor's text.
      o.log.error('handoff', new Error('session transfer failed'), { account_id: s.account.account_id });
      s.result = stale(s.account);
    }
    await close(s);
    return s.result;
  }
  async function run(i: HandoffInput, resume: boolean): Promise<HandoffResult> {
    const id = key(i), s = sessions.get(id);
    const a = await o.accounts.byId(i.account_id, i.person_id);
    if (!a || a.person_id !== i.person_id || a.site !== i.site || s && a.site !== s.account.site) {
      if (s) { s.result = { state: 'not_linked' }; await close(s); }
      return { state: 'not_linked' };
    }
    if (!i.go?.includes(a.site)) return { state: 'dry', steps: ['read phone storage', 'launch hosted browser', 'load storage', `open ${PROFILES[a.site].home}`, 'probe session', 'pause for person if challenged', 'export verified storage', 'invalidate old pool context', 'store in AuthVault', 'close browser'] };
    if (s && (!resume || s.result.state !== 'paused')) return s.result;
    const job = `handoff:${i.handoff_id}`;
    if (!o.leases.take(a.account_id, job, o.leaseTtlMs).ok) return { state: 'busy' };
    if (s) { s.renewLease(); return verify(s); }
    let expires = now() + o.leaseTtlMs;
    let lost = false;
    let renew: ReturnType<typeof setInterval>;
    const renewLease = () => {
      clearInterval(renew); expires = now() + o.leaseTtlMs; lost = false;
      renew = setInterval(() => {
        if (now() >= expires) { clearInterval(renew); return; }
        if (!o.leases.take(a.account_id, job, o.leaseTtlMs).ok) lost = true;
      }, Math.max(1, Math.floor(o.leaseTtlMs / 3)));
      renew.unref();
    };
    renewLease();
    const release = () => { clearInterval(renew); o.leases.give(a.account_id, job); };
    const assertLease = () => {
      if (lost || now() >= expires || !o.leases.take(a.account_id, job, o.leaseTtlMs).ok) throw new Error('handoff lease expired');
    };
    let ctx: PoolContext<P> | undefined;
    try {
      const state = await call('handoff.phone', a, () => o.readPhone(a));
      ctx = await call('handoff.launch', a, () => o.launcher.persistent(profileDirFor(o.profileRoot, a.account_id), { headless: !PROFILES[a.site].headed }));
      if (!ctx.loadState || !ctx.exportState) throw new Error('hosted context has no storage state support');
      await call('handoff.load', a, () => ctx!.loadState!(state));
      const page = await call('handoff.page', a, () => ctx!.newPage());
      await call('handoff.open', a, () => page.goto(PROFILES[a.site].home));
      const session: Session<P> = { account: { ...a }, ctx, page, result: { state: 'paused' }, job, viewer_id: randomUUID(), live_url: (ctx as PoolContext<P> & { live_url?: string }).live_url, expires, closed: false, renewLease: () => { renewLease(); session.expires = expires; }, assertLease, release };
      sessions.set(id, session);
      return await verify(session);
    } catch {
      o.log.error('handoff', new Error('session transfer failed'), { account_id: a.account_id });
      const result = stale(a);
      try {
        const session = sessions.get(id);
        if (session) { session.result = result; await close(session); }
        else if (ctx) await call('handoff.close', a, () => ctx!.close());
      }
      finally { release(); }
      return result;
    }
  }
  function dispatch(i: HandoffInput, resume: boolean) {
    const id = key(i), prior = running.get(id);
    if (prior) return prior;
    const p = run(i, resume).finally(() => running.delete(id)); running.set(id, p); return p;
  }
  return {
    async liveView(person_id: string, session_id: string) {
      const s = [...sessions.values()].find(s => s.viewer_id === session_id && s.account.person_id === person_id);
      if (!s || s.closed || s.result.state !== 'paused') return undefined;
      const a = await o.accounts.byId(s.account.account_id, s.account.person_id);
      if (!a || a.person_id !== person_id || a.site !== s.account.site) { s.result = { state: 'not_linked' }; await close(s); return undefined; }
      if (now() >= s.expires) { s.result = stale(s.account); await close(s); return undefined; }
      return s.live_url;
    },
    start: (i: HandoffInput) => dispatch(i, false), resume: (i: HandoffInput) => dispatch(i, true),
    async cancel(i: HandoffInput) {
      const pending = running.get(key(i)); if (pending) await pending;
      const s = sessions.get(key(i));
      if (s?.result.state === 'paused') { s.result = stale(s.account); await close(s); }
    } };
}
