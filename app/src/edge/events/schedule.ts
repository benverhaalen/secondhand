// ws-1 Watcher scheduling (protocol-and-adapters §3.6, "Our watchers, signed in").
// How it operates: one sweep per linked account per due time. Each tick reads every account's state
// (hot: an open offer or negotiation, or the hour after posting; live: live listings; quiet: none),
// and for each due, unpaused account takes the account's session lease, runs the platform team's
// sweep (notification feed first, then the sections it points at), gives the lease back, and sets the
// next due time from cadenceOf, or the `watch_cadence_s` param read at that moment (scope site + state), so a
// changed param applies on the next tick. Accounts sweep in parallel; one account never twice at once.
// It runs through the night; pace and quiet hours per site live in the harness manifest, not here.
// Saved due times and pause reasons survive restarts; accounts without a due time start spread over
// one cadence. A challenge waits for the person; a retry hint can only lengthen the next cadence.
import { mask } from '../../../../log/index.js';
import { createHash } from 'node:crypto';
import type { Site, Snapshot } from './event.ts';
import type { Accounts } from '../browser/auth.ts';
import { sweepStorefronts, type SnapshotStore } from '../harness/storefront.ts';
import type { Harness } from '../harness/protocol.ts';
import type { Leases, Params } from './ports.ts';

export interface Account { account_id: string; site: Site; user_id: string }
export type CadenceOf = (account: Account, snapshot: Snapshot | undefined) => number;
export type Tier = 'hot' | 'live' | 'quiet';
type SweepResult = { ok: true } | { ok: false; error: { code: string; message: string; hint?: unknown } };
type PauseReason = 'auth_expired' | 'blocked';
export type SchedulePatch = { due?: number; paused?: PauseReason | null };
export interface ScheduleState {
  load(): { due: Record<string, number>; paused: Record<string, PauseReason> };
  save(account_id: string, patch: SchedulePatch): void;
}

export function createScheduler(o: {
  params: Params; leases: Leases; now: () => number;
  accounts: () => Account[]; stateOf: (a: Account) => Tier;
  cadenceOf?: CadenceOf; snapshotOf?: (a: Account) => Snapshot | undefined;
  priorityOf?: (a: Account) => number;
  permitSweep?: (a: Account) => boolean;
  runSweep: (a: Account) => Promise<SweepResult>;
  onStale: (a: Account) => void | Promise<void>; // as-1 markStale: one relink decision, jobs paused
  onBlocked?: (a: Account) => void | Promise<void>;
  state?: ScheduleState;
  leaseTtlMs?: number;
  storefront?: { accounts: Accounts; harness: Harness; store: SnapshotStore };
}) {
  const saved = o.state?.load();
  const due = new Map<string, number>(Object.entries(saved?.due ?? {}));
  const paused = new Map<string, PauseReason>(Object.entries(saved?.paused ?? {}));
  const ttl = o.leaseTtlMs ?? 120_000;
  const cadence = (a: Account) => {
    const seconds = o.cadenceOf?.(a, o.snapshotOf?.(a)) ?? o.params.get('watch_cadence_s', { site: a.site, segment: o.stateOf(a) });
    if (!Number.isFinite(seconds) || seconds <= 0) throw new RangeError('watch cadence must be finite and positive');
    return seconds * 1000;
  };

  function save(account_id: string, patch: SchedulePatch) {
    o.state?.save(account_id, patch);
    if (patch.due !== undefined) due.set(account_id, patch.due);
    if (patch.paused === null) paused.delete(account_id);
    else if (patch.paused !== undefined) paused.set(account_id, patch.paused);
  }

  async function isLinked(a: Account): Promise<boolean> {
    if (!o.storefront) return true;
    const linked = await o.storefront.accounts.byId(a.account_id, a.user_id);
    return !!linked && linked.person_id === a.user_id && linked.site === a.site;
  }

  async function sweep(a: Account): Promise<'ran' | 'skipped' | 'stale' | 'blocked'> {
    const storefront = o.storefront;
    if (!await isLinked(a)) return 'skipped';
    const job = `sweep:${a.account_id}`;
    const leased = await o.leases.withLease(a.account_id, job, ttl, async () => {
      if (o.permitSweep && !o.permitSweep(a)) return null;
      let r: SweepResult;
      try {
        r = await o.runSweep(a);
        if (r.ok && storefront) {
          // Recheck the link after the watcher read, and restrict the helper to this leased account.
          const accounts: Accounts = { byId: (id, person_id) => storefront.accounts.byId(id, person_id), async linked() {
            const linked = await storefront.accounts.byId(a.account_id, a.user_id);
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
    if (r === null) return 'skipped';
    if (!r.ok && (r.error.code === 'auth_expired' || r.error.code === 'blocked')) {
      save(a.account_id, { paused: r.error.code });
      if (r.error.code === 'auth_expired') { await o.onStale(a); return 'stale'; }
      await o.onBlocked?.(a); return 'blocked';
    }
    let after = !r.ok && r.error.code === 'rate_limited' ? 60000 : 0;
    if (!r.ok && r.error.hint && typeof r.error.hint === 'object') {
      const hint = r.error.hint;
      if (r.error.code === 'rate_limited' || 'do' in hint && hint.do === 'retry_after') {
        after = 'after_s' in hint && typeof hint.after_s === 'number' && Number.isFinite(hint.after_s) ? Math.max(1, hint.after_s) * 1000 : 60000;
      }
    }
    save(a.account_id, { due: o.now() + Math.max(cadence(a), after) });
    return 'ran';
  }

  return {
    async tick() {
      const t = o.now();
      const candidates = o.accounts();
      const allowed = await Promise.all(candidates.map(isLinked));
      const accounts = candidates.filter((_, i) => allowed[i]);
      const refused = candidates.filter((_, i) => !allowed[i]).map(a => a.account_id);
      for (const a of accounts) {
        if (!paused.has(a.account_id) && !due.has(a.account_id)) save(a.account_id, { due: t + firstDelay(a.account_id, cadence(a)) });
      }
      const ready = accounts.filter(a => !paused.has(a.account_id) && due.get(a.account_id)! <= t);
      if (o.permitSweep) ready.sort((a, b) => (o.priorityOf ? o.priorityOf(b) - o.priorityOf(a) : cadence(a) - cadence(b)) || a.account_id.localeCompare(b.account_id));
      const out = await Promise.all(ready.map(a => sweep(a).then(r => [a.account_id, r] as const)));
      const by = (k: string) => out.filter(([, r]) => r === k).map(([id]) => id);
      return { ran: by('ran'), skipped: [...refused, ...by('skipped')], stale: by('stale'), blocked: by('blocked') };
    },
    resume(account_id: string) { save(account_id, { due: o.now(), paused: null }); },
    paused: () => [...paused.keys()],
    nextDue: () => Object.fromEntries(due),
  };
}

function firstDelay(account_id: string, cadenceMs: number): number {
  const hash = createHash('sha256').update(account_id).digest().readUInt32BE(0);
  return Math.floor(hash / 0x1_0000_0000 * cadenceMs) + 1;
}

export function sweepFailure(e: unknown): SweepResult {
  const code = e && typeof e === 'object' && 'code' in e && typeof e.code === 'string' ? e.code : 'error';
  const hint = e && typeof e === 'object' && 'hint' in e ? e.hint : undefined;
  return { ok: false, error: { code, hint, message: JSON.stringify(mask({ message: e instanceof Error ? e.message : String(e) })) } };
}
