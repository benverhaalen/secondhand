// dl-1 Delist everywhere after a sale (spec/features/sold.md, product.md "Sale to delist, handover, payout and ledger").
// How it operates: once a sale is CONFIRMED by a signed-in read (sold's poll_orders job), fanOut writes, in one
// transaction, one `app.delist` event and so one `delist` job per other listing of the item that a buyer could
// still pay for (live, delistFailed, posting). The dedupe key is `delist:<listing_id>`, so a repeat sale event or
// a second confirmation never doubles a job. The jobs run in parallel in the pipeline, one per account session,
// each `end` verb held through its read-back. A public "sold" mark alone never delists: confirmed is required.
// settle() closes one delist job from its harness envelope: ok or not_found (already gone) is delisted; an expired
// session is paused by as-1 (never dropped, never failed); anything else retries up to `delist_max_attempts`
// (param, prior 3), then fails and raises one `failed_delist` decision for that listing.
// Poshmark early delist is Nate's call (sold.md, open); until he decides, Poshmark is delisted like every site,
// at the pace its harness manifest sets.
// Likely breaks, each tested: delist on an unconfirmed sale; the sold listing delisted; a double fan-out;
// a failed site never surfaced; a stale account's job dropped or marked failed.
import { write, logReceived, type LogLike } from '../events/intake.ts';
import type { Site } from '../events/event.ts';
import type { JobRow, Params, Store } from '../events/ports.ts';

export interface ItemListing { listing_id: string; item_id: string; site: Site; account_id: string; state: string }
const BUYABLE = new Set(['live', 'delistFailed', 'posting']);

export function fanOut(store: Store, log: LogLike, s: {
  user_id: string; item_id: string; sold_listing_id: string; confirmed: boolean; trace_id: string;
  listings: ItemListing[]; now?: () => string;
}): { jobs: JobRow[] } | { refused: 'not_confirmed' } {
  if (!s.confirmed) return { refused: 'not_confirmed' };
  const at = (s.now ?? (() => new Date().toISOString()))();
  const targets = s.listings.filter(l => l.item_id === s.item_id && l.listing_id !== s.sold_listing_id && BUYABLE.has(l.state));
  const done = store.tx(t => targets.map(l => write(t, {
    user_id: s.user_id, source: 'app', site: l.site, account_id: l.account_id, action: 'app.delist',
    item_id: s.item_id, listing_id: l.listing_id, dedupe_key: `delist:${l.listing_id}`, actor: 'auto',
    why: 'sold on another site', observed_at: at, effective_at: at, trace_id: s.trace_id,
    payload: { verb: 'end', decision_kind: 'delist_after_sale', sold_listing_id: s.sold_listing_id },
  }, () => at)));
  for (const r of done) logReceived(log, r);
  return { jobs: done.map(r => r.job) };
}

type Envelope = { ok: true } | { ok: false; error: { code: string; message: string } };

export function settle(store: Store, log: LogLike, params: Params, job: JobRow, env: Envelope):
  'delisted' | 'retry' | 'failed' | 'paused' {
  if (env.ok || env.error.code === 'not_found') {
    store.updateJob(job.id, { state: 'done', result: { listing_state: 'delisted' } });
    return 'delisted';
  }
  if (env.error.code === 'auth_expired') return 'paused'; // as-1 markStale pauses it; nothing is dropped here
  const attempts = job.attempts + 1;
  if (attempts < params.get('delist_max_attempts', { site: job.site })) {
    store.updateJob(job.id, { state: 'queued', attempts, error: env.error });
    return 'retry';
  }
  store.updateJob(job.id, { state: 'failed', attempts, error: env.error, result: { listing_state: 'delistFailed' } });
  const d = store.raiseDecision({
    user_id: job.user_id, kind: 'failed_delist', subject: job.listing_id ?? job.id, item_id: job.item_id, job_id: job.id,
    why: `${job.site} did not take the listing down`, options: [{ id: 'retry', label: 'Try again' }, { id: 'open_site', label: `Open ${job.site}` }],
    suggested: 'retry',
  });
  if (!d.duplicate) log.event('decision.open', { decision: d.row.id, kind: 'failed_delist', tier: 'ask' });
  return 'failed';
}
