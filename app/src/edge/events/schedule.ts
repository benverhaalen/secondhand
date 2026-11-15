// ws-1 Watcher scheduling (protocol-and-adapters §3.6, "Our watchers, signed in").
// How it operates: one sweep per linked account per due time. Each tick reads every account's state
// (hot: an open offer or negotiation, or the hour after posting; live: live listings; quiet: none),
// and for each due, unpaused account takes the account's session lease, runs the platform team's
// sweep (notification feed first, then the sections it points at), gives the lease back, and sets the
// next due time from the `watch_cadence_s` param read at that moment (scope site + state), so a
// changed param applies on the next tick. Accounts sweep in parallel; one account never twice at once.
// It runs through the night; pace and quiet hours per site live in the harness manifest, not here.
// Likely breaks, each tested: a cadence frozen as a constant; a param change not picked up; an expired
// session that keeps sweeping or raises a second decision; a lease left held after a throw; a busy
// lease that pushes the account a whole cadence back.
import { mask } from '../../../../log/index.js';
import type { Site } from './event.ts';
import type { Accounts } from '../browser/auth.ts';
import { sweepStorefronts, type SnapshotStore } from '../harness/storefront.ts';
import type { Harness } from '../harness/protocol.ts';
import type { Leases, Params } from './ports.ts';

export interface Account { account_id: string; site: Site; user_id: string }
export type Tier = 'hot' | 'live' | 'quiet';
type SweepResult = { ok: true } | { ok: false; error: { code: string; message: string; hint?: unknown } };

export function createScheduler(o: {
  params: Params; leases: Leases; now: () => number;
  accounts: () => Account[]; stateOf: (a: Account) => Tier;
  runSweep: (a: Account) => Promise<SweepResult>;
  onStale: (a: Account) => void | Promise<void>; // as-1 markStale: one relink decision, jobs paused
  leaseTtlMs?: number;
  storefront?: { accounts: Accounts; harness: Harness; store: SnapshotStore };
}) {
  const due = new Map<string, number>(), paused = new Set<string>();
  const ttl = o.leaseTtlMs ?? 120_000;

  async function sweep(a: Account): Promise<'ran' | 'skipped' | 'stale'> {
    const storefront = o.storefront;
    if (storefront) {
      const linked = await storefront.accounts.byId(a.account_id);
      if (!linked || linked.person_id !== a.user_id || linked.site !== a.site) return 'skipped';
    }
    const job = `sweep:${a.account_id}`;
    const leased = await o.leases.withLease(a.account_id, job, ttl, async () => {
      let r: SweepResult;
      try {
        r = await o.runSweep(a);
        if (r.ok && storefront) {
          // Recheck the link after the watcher read, and restrict the helper to this leased account.
          const accounts: Accounts = { byId: id => storefront.accounts.byId(id), async linked() {
            const linked = await storefront.accounts.byId(a.account_id);
            return linked && linked.person_id === a.user_id && linked.site === a.site ? [linked] : [];
          } };
          const result = await sweepStorefronts({ ...storefront, accounts, now: () => new Date(o.now()) });
          const failed = result.failed[0];
          if (failed) r = { ok: false, error: { code: failed.code, message: 'storefront read failed' } };
        }
      }
      catch (e) { r = sweepFailure(e); }
      return r;
    });
    if (!leased.ok) return 'skipped';
    const r = leased.value;
    if (!r.ok && r.error.code === 'auth_expired') { paused.add(a.account_id); await o.onStale(a); return 'stale'; }
    // any other failure keeps the cadence; the harness's own retry hints govern the calls inside the sweep
    due.set(a.account_id, o.now() + o.params.get('watch_cadence_s', { site: a.site, segment: o.stateOf(a) }) * 1000);
    return 'ran';
  }

  return {
    async tick() {
      const t = o.now();
      const ready = o.accounts().filter(a => !paused.has(a.account_id) && (due.get(a.account_id) ?? 0) <= t);
      const out = await Promise.all(ready.map(a => sweep(a).then(r => [a.account_id, r] as const)));
      const by = (k: string) => out.filter(([, r]) => r === k).map(([id]) => id);
      return { ran: by('ran'), skipped: by('skipped'), stale: by('stale') };
    },
    resume(account_id: string) { paused.delete(account_id); due.delete(account_id); },
    paused: () => [...paused],
    nextDue: () => Object.fromEntries(due),
  };
}

export function sweepFailure(e: unknown): SweepResult {
  const code = e && typeof e === 'object' && 'code' in e && typeof e.code === 'string' ? e.code : 'error';
  return { ok: false, error: { code, message: JSON.stringify(mask({ message: e instanceof Error ? e.message : String(e) })) } };
}
