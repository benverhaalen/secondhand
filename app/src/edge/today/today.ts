// Today: the decisions queue (td-1). Rests: spec/features/today.md#what-the-person-does-and-sees,
// spec/product.md#decision-kinds-the-complete-list (§5) and §5 Undo.
//
// Operating notes
// - Reads: store.decisions / store.events only; the clock is passed in. No model, no outside call.
// - queue: one read of the person's open decisions, one sort: row-carried value_cents high first, then deadline sooner
//   first, a decision with no deadline last. The value is carried on the row (a guarded number computed upstream); this
//   file never computes money.
// - expire: every open decision whose deadline has passed becomes `expired` and gets its kind's safe default, returned
//   as {id, kind, default}. It NEVER acts outward: no job is created and no harness is called. For unbacked_claim the
//   default is 'send_without_claim' (product.md §5), which the caller sends through the normal gate; for every other
//   kind it is 'nothing'. Closing only open rows makes a second run a no-op.
// - undo: allowed while undo.allowed and now < undo.until (else observed_at + 24 h); otherwise {error: 'site_no_undo',
//   status: 409}. It writes one event with undo_of (dedupe key undo:<id>, so a second undo is refused, not doubled).
//   Reverting on the site is the pipeline's job when it reads that event; this only records the person's undo.
// - Likely breaks, each with a test: ordering with ties and no deadline, another person's decisions, closed decisions in
//   the queue, expire acting or repeating, undo past until / not allowed / past 24 h / twice / unknown id.
import type { EventRow } from '../events/event.ts';
import type { DecisionRow, Store } from '../events/ports.ts';

// product.md §5, in table order, plus confirm_trade (NEW), ask and never promoted
export const DECISION_KINDS: string[] = [
  'first_post', 'agent_revision', 'relist', 'delist_after_sale', 'failed_post', 'failed_delist', 'site_changed_listing',
  'push_my_edit', 'answer_fact', 'reply_other', 'counter_offer', 'accept_offer', 'decline_offer', 'offer_to_watchers',
  'bundle_offer', 'scam_warning', 'move_off_site', 'book_pickup', 'pickup_outside_hours', 'share_address', 'markdown',
  'price_below_floor', 'clarify', 'identity_claim', 'retake', 'missing_shot', 'confirm_flaw', 'approve_groups',
  'category_unsure', 'measure_review', 'studio_approve', 'ship_by', 'buy_label', 'cancel_sale', 'no_show', 'double_sale',
  'refund', 'return_claim', 'claim_reply', 'dispute', 'leave_review', 'relink', 'site_warning', 'merge_items', 'buy_offer',
  'offer_over_ceiling', 'seller_counter', 'did_you_buy', 'replace_after_sale', 'save_match', 'complete_purchase',
  'rule_expiring', 'unbacked_claim', 'join_experiment', 'digest', 'promote_spend', 'bulk_action', 'end_unsold',
  'confirm_trade', 'ask',
];

type Valued = DecisionRow & { value_cents?: number };
const ms = (s: string | undefined) => { const n = s ? Date.parse(s) : NaN; return Number.isNaN(n) ? Infinity : n; };

export function queue(store: Store, { user_id }: { user_id: string; now: string }): DecisionRow[] {
  return (store.decisions({ user_id, state: 'open' }) as Valued[])
    .sort((a, b) => (b.value_cents ?? 0) - (a.value_cents ?? 0) || ms(a.deadline) - ms(b.deadline));
}

export function expire(store: Store, { now }: { now: string }): { id: string; kind: string; default: 'send_without_claim' | 'nothing' }[] {
  const t = ms(now);
  return store.decisions({ state: 'open' }).filter(d => ms(d.deadline) <= t).map(d => {
    store.updateDecision(d.id, { state: 'expired' });
    return { id: d.id, kind: d.kind, default: d.kind === 'unbacked_claim' ? 'send_without_claim' as const : 'nothing' as const };
  });
}

export function undo(store: Store, event_id: string, now: string): { event: EventRow } | { error: 'site_no_undo'; status: 409 } | { error: 'not_found'; status: 404 } {
  const e = store.events().find(x => x.id === event_id);
  if (!e) return { error: 'not_found', status: 404 };
  const until = e.undo?.until ? Date.parse(e.undo.until) : Date.parse(e.observed_at) + 24 * 3600_000;
  const done = store.events().some(x => x.undo_of === e.id);
  if (!e.undo?.allowed || done || !(Date.parse(now) < until)) return { error: 'site_no_undo', status: 409 };
  const { row } = store.insertEvent({
    user_id: e.user_id, source: 'app', site: e.site, account_id: e.account_id, action: e.action, item_id: e.item_id, listing_id: e.listing_id,
    dedupe_key: `undo:${e.id}`, actor: 'user', why: 'undo', observed_at: now, effective_at: now, trace_id: e.trace_id, undo_of: e.id,
  });
  return { event: row };
}
