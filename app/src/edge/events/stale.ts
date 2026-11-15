// as-1 account stale. Operating notes:
// markStale: every queued or running job of the account gets paused 'account_stale' (kept, never dropped; stages and attempts stay).
//   A running job is released back to queued and paused in the same step, so no worker holds it. One `relink` decision per account
//   (subject = account_id, deduped while open) tells the person; the pipeline's claim skips paused jobs.
// markRelinked: clears paused on the account's jobs (attempts unchanged, so a resumed job picks up at its next unarrived stage)
//   and closes the open relink decision as answered.
// onHarnessError: an `auth_expired` envelope error from any verb calls markStale; other codes are not this module's.
// eBay OAuth refresh tokens last 18 months, so on eBay a stale account is rare and means a revoked or expired grant; Poshmark and
//   Mercari sessions expire much sooner. Either way the cure is the same one tap.
// Likely to break: a job claimed between the read and the write (the claim is released, the worker's next write finds it paused),
//   a second call while the decision is open (counts the new jobs, no second decision).
import type { LogLike } from './intake.ts';
import type { Store } from './ports.ts';

type Who = { user_id: string; account_id: string; site?: string };
export type StaleCounts = { paused: number; released: number; decision: string; duplicate: boolean };

export function markStale(store: Store, log: LogLike, w: Who): StaleCounts {
  const r = store.tx(t => {
    let paused = 0, released = 0;
    for (const j of t.jobs({ user_id: w.user_id, account_id: w.account_id })) {
      if (j.state !== 'queued' && j.state !== 'running') continue;
      if (j.state === 'running') { t.release(j.id); released++; }
      t.updateJob(j.id, { state: 'queued', paused: 'account_stale' });
      paused++;
    }
    const d = t.raiseDecision({
      user_id: w.user_id, kind: 'relink', subject: w.account_id,
      why: `${w.site ?? 'The'} account needs you to sign in again`, options: [{ id: 'relink', label: 'Re-link' }], suggested: 'relink',
    });
    return { paused, released, decision: d.row.id, duplicate: d.duplicate };
  });
  log.event('note', { msg: 'account stale: jobs paused', account_id: w.account_id, site: w.site, paused_count: r.paused, released_count: r.released });
  if (!r.duplicate) log.event('decision.open', { decision: r.decision, kind: 'relink', tier: 'ask' });
  return r;
}

export function markRelinked(store: Store, log: LogLike, w: Pick<Who, 'user_id' | 'account_id'>): { resumed: number; closed: number } {
  const r = store.tx(t => {
    let resumed = 0, closed = 0;
    for (const j of t.jobs({ user_id: w.user_id, account_id: w.account_id })) {
      if (j.paused !== 'account_stale') continue;
      t.updateJob(j.id, { paused: undefined }); resumed++;
    }
    for (const d of t.decisions({ user_id: w.user_id, kind: 'relink', subject: w.account_id })) {
      if (d.state === 'open') { t.updateDecision(d.id, { state: 'answered' }); closed++; }
    }
    return { resumed, closed };
  });
  log.event('note', { msg: 'account relinked: jobs resumed', account_id: w.account_id, resumed_count: r.resumed });
  return r;
}

export function onHarnessError(store: Store, log: LogLike, job: { user_id: string; account_id?: string; site?: string }, error: { code: string }): StaleCounts | undefined {
  if (error.code !== 'auth_expired' || !job.account_id) return undefined;
  return markStale(store, log, { user_id: job.user_id, account_id: job.account_id, site: job.site });
}
