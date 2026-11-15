// si-1: the person drives the cloud live view. Code only verifies and exports storage; it never types credentials.
import { randomUUID } from 'node:crypto';
import type { Log } from '../../../../log/index.js';
import type { Accounts, AuthVault, LinkedAccount } from '../browser/auth.ts';
import { profileDirFor, type Launcher, type PoolContext, type PoolPage } from '../browser/pool.ts';
import { PROFILES } from '../harness/platform.ts';
import type { Site } from '../harness/protocol.ts';
import type { Store, Leases } from '../events/ports.ts';

export type SigninResult = { state: 'dry' | 'waiting' | 'paused' | 'ok' | 'failed' | 'not_found' | 'busy';
  account_id?: string; session_id?: string; signin_session_url?: string; decision_id?: string; steps?: readonly string[] };
type Session<P extends PoolPage> = { account: LinkedAccount; ctx: PoolContext<P>; page: P; live_url: string; expires: number;
  result: SigninResult; closed: boolean; job: string; release(): void; assertLease(): void };
export function createSignin<P extends PoolPage & { goto(url: string): Promise<unknown> }>(o: {
  launcher: Launcher<P>; vault: AuthVault; accounts: Accounts; profileRoot: string; store: Store; log: Log; leases: Leases;
  invalidatePool(account_id: string): Promise<void>;
  ttlMs: number; now?: () => number; link(account: LinkedAccount): Promise<void>;
  probe(page: P, account: LinkedAccount): Promise<'ok' | 'signed_out' | 'second_factor' | 'blocked'>;
}) {
  const sessions = new Map<string, Session<P>>(), running = new Map<string, Promise<SigninResult>>();
  const now = o.now ?? Date.now;
  const call = <T>(name: string, a: LinkedAccount, run: () => Promise<T>) =>
    o.log.call('browser', name, { account_id: a.account_id, site: a.site }, async () => {
      try { return await run(); }
      catch { throw new Error(`${name} failed`); }
    }, () => ({ ok: true }));
  const owned = (person: string, id: string) => { const s = sessions.get(id); return s?.account.person_id === person ? s : undefined; };
  async function close(s: Session<P>) {
    if (s.closed) return;
    s.closed = true;
    s.live_url = '';
    try { await call('signin.close', s.account, () => s.ctx.close()); }
    finally { s.release(); }
  }
  function failed(s: Session<P>) {
    s.result = { state: 'failed', account_id: s.account.account_id };
    o.log.event('job.state', { job: s.job, kind: 'relink', state: 'failed' });
    return s.result;
  }
  async function complete(person: string, id: string): Promise<SigninResult> {
    const s = owned(person, id);
    if (!s) return { state: 'not_found' };
    if (s.closed) return s.result;
    if (now() >= s.expires) { failed(s); await close(s); return s.result; }
    if (!o.leases.take(s.account.account_id, s.job, s.expires - now()).ok) {
      failed(s); await close(s); return s.result;
    }
    try {
      s.assertLease();
      const status = await call('signin.probe', s.account, () => o.probe(s.page, s.account));
      s.assertLease();
      if (status === 'signed_out') return s.result;
      if (status !== 'ok') {
        if (s.result.decision_id) return s.result;
        const d = o.store.tx(t => t.raiseDecision({ user_id: person, kind: 'site_warning', subject: s.job,
          why: 'The site needs you to finish signing in', options: [{ id: 'continue', label: 'Continue' }], suggested: 'continue' }));
        if (!d.duplicate) o.log.event('decision.open', { decision: d.row.id, kind: 'site_warning', tier: 'ask' });
        return s.result = { ...s.result, state: 'paused', decision_id: d.row.id };
      }
      const state = await call('signin.export', s.account, () => s.ctx.exportState!());
      s.assertLease();
      await call('signin.invalidate_pool', s.account, () => o.invalidatePool(s.account.account_id));
      s.assertLease();
      await call('signin.store', s.account, () => o.vault.put(s.account.token_ref, state));
      s.assertLease();
      await call('signin.link', s.account, () => o.link(s.account));
      o.store.tx(t => {
        for (const d of t.decisions({ user_id: person, kind: 'site_warning', subject: s.job }))
          if (d.state === 'open') t.updateDecision(d.id, { state: 'answered' });
      });
      s.result = { state: 'ok', account_id: s.account.account_id };
      o.log.event('job.state', { job: s.job, kind: 'relink', state: 'done' });
    } catch {
      o.log.error('signin', new Error('hosted sign-in failed'), { account_id: s.account.account_id });
      failed(s);
    }
    await close(s);
    return s.result;
  }
  return {
    async start({ person_id, site, account_id, go = [] }: { person_id: string; site: Site; account_id?: string; go?: readonly Site[] }): Promise<SigninResult> {
      const prior = account_id ? await o.accounts.byId(account_id) : undefined;
      if (account_id && (!prior || prior.person_id !== person_id || prior.site !== site)) return { state: 'not_found' };
      if (!go.includes(site)) return { state: 'dry', steps: ['launch hosted browser', `open ${PROFILES[site].login ?? PROFILES[site].home}`, 'person signs in through live view', 'probe session',
        'pause for person if challenged', 'export storage', 'invalidate old pool context', 'store in AuthVault', 'link account', 'close browser'] };
      const id = randomUUID(), account: LinkedAccount = prior ?? { account_id: `acc_${randomUUID()}`, person_id, site, token_ref: `session/${randomUUID()}` };
      const job = `signin:${id}`;
      if (!o.leases.take(account.account_id, job, o.ttlMs).ok) return { state: 'busy' };
      const expires = now() + o.ttlMs;
      let lost = false;
      const renew = setInterval(() => {
        if (now() >= expires) { clearInterval(renew); return; }
        if (!o.leases.take(account.account_id, job, o.ttlMs).ok) lost = true;
      }, Math.max(1, Math.floor(o.ttlMs / 3)));
      renew.unref();
      const release = () => { clearInterval(renew); o.leases.give(account.account_id, job); };
      const assertLease = () => {
        if (lost || now() >= expires || !o.leases.take(account.account_id, job, o.ttlMs).ok) throw new Error('sign-in lease expired');
      };
      let ctx: PoolContext<P> | undefined;
      try {
        ctx = await call('signin.launch', account, () => o.launcher.persistent(profileDirFor(o.profileRoot, account.account_id), { headless: !PROFILES[site].headed }));
        const live_url = (ctx as PoolContext<P> & { live_url?: string }).live_url;
        if (!live_url || !ctx.exportState) throw new Error('cloud browser needs live view and storage export');
        const page = await call('signin.page', account, () => ctx!.newPage());
        await call('signin.open', account, () => page.goto(PROFILES[site].login ?? PROFILES[site].home));
        const result: SigninResult = { state: 'waiting', account_id: account.account_id, session_id: id, signin_session_url: `/v1/accounts/signin/${id}` };
        sessions.set(id, { account, ctx, page, live_url, expires, result, job, closed: false, release, assertLease });
        o.log.event('job.state', { job, kind: 'relink', state: 'running' });
        return result;
      } catch {
        o.log.error('signin', new Error('hosted sign-in could not start'), { account_id: account.account_id });
        try { if (ctx) await call('signin.close', account, () => ctx!.close()); }
        finally { release(); }
        return { state: 'failed', account_id: account.account_id };
      }
    },
    // Only an authenticated app route calls this. Never log or cache its response or redirect Location.
    async liveView(person: string, id: string): Promise<string | undefined> {
      const s = owned(person, id);
      if (!s || s.closed) return undefined;
      if (now() >= s.expires) { failed(s); await close(s); return undefined; }
      return s.live_url;
    },
    complete(person: string, id: string) {
      if (!owned(person, id)) return Promise.resolve<SigninResult>({ state: 'not_found' });
      const prior = running.get(id); if (prior) return prior;
      const p = complete(person, id).finally(() => running.delete(id)); running.set(id, p); return p;
    },
    async cancel(person: string, id: string) {
      const s = owned(person, id); if (!s || s.closed) return;
      const pending = running.get(id); if (pending) await pending;
      if (!s.closed) { failed(s); await close(s); }
    },
  };
}
