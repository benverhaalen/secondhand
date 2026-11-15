// The §5 policy check, plain code that runs before every outward verb (spec/product.md §5, §6 "Policy").
// A model never decides it. Other streams import `check`, `MODE_FOR` and `NEVER_PROMOTED` from here.
// Design: app/src/edge/events/README.md "App actions and the policy check".
import type { Actor, Site } from './event.ts';
import type { Mode } from './ports.ts';

// product.md §5 "Decision kinds (the complete list)": mode per kind. Mixed rows ("auto inside limits", "auto at or
// above always_accept, else ask") are auto here; the limits are checked below (floor) or in `check` (always_accept).
export const MODE_FOR: Record<string, Mode> = {
  first_post: 'ask', agent_revision: 'ask', relist: 'ask', delist_after_sale: 'auto', failed_post: 'ask', failed_delist: 'ask',
  site_changed_listing: 'ask', push_my_edit: 'auto', answer_fact: 'auto', reply_other: 'ask', counter_offer: 'auto',
  accept_offer: 'ask', decline_offer: 'auto', offer_to_watchers: 'auto', bundle_offer: 'auto', scam_warning: 'ask',
  move_off_site: 'locked', book_pickup: 'auto', pickup_outside_hours: 'ask', share_address: 'locked', markdown: 'auto',
  price_below_floor: 'ask', clarify: 'ask', identity_claim: 'locked', retake: 'ask', missing_shot: 'ask', confirm_flaw: 'ask',
  approve_groups: 'ask', category_unsure: 'ask', measure_review: 'ask', studio_approve: 'ask', ship_by: 'ask', buy_label: 'ask',
  cancel_sale: 'ask', no_show: 'ask', double_sale: 'ask', refund: 'locked', return_claim: 'ask', claim_reply: 'ask', dispute: 'ask',
  leave_review: 'ask', relink: 'ask', site_warning: 'ask', merge_items: 'ask', buy_offer: 'ask', offer_over_ceiling: 'ask',
  seller_counter: 'ask', did_you_buy: 'ask', replace_after_sale: 'ask', save_match: 'ask', complete_purchase: 'locked',
  rule_expiring: 'ask', unbacked_claim: 'ask', join_experiment: 'ask', digest: 'auto', promote_spend: 'ask', bulk_action: 'ask',
  end_unsold: 'ask',
  confirm_trade: 'ask', // NEW (README): ask, never promoted, until Nate says otherwise
};

// "Promotable: yes" rows. "Always do this" can lift only these.
const PROMOTABLE = new Set(['first_post', 'agent_revision', 'relist', 'reply_other', 'counter_offer', 'accept_offer', 'decline_offer',
  'offer_to_watchers', 'bundle_offer', 'markdown', 'studio_approve', 'buy_label', 'leave_review', 'save_match']);

// Never promoted: every locked kind, plus price_below_floor and pickup_outside_hours (lifecycle.mjs NEVER_PROMOTED),
// plus the buyer-side offer and confirm_trade (README).
export const NEVER_PROMOTED = new Set([
  ...Object.keys(MODE_FOR).filter(k => MODE_FOR[k] === 'locked'),
  'price_below_floor', 'pickup_outside_hours', 'buy_offer', 'confirm_trade',
]);

// No job or tap performs these; the check answers with a handoff that opens the site for the person.
export const NEVER_PERFORMED = new Set(['complete_purchase', 'refund', 'payment', 'move_off_site']);

export interface PolicyInput {
  action: string; // an app.* kind or the job's verb
  decision_kind: string;
  actor: Actor;
  price_cents?: number;
  floor_cents?: number;
  always_accept_cents?: number;
  promoted: Set<string>; // kinds the person promoted with "Always do this"
  site: Site | string;
}
export type PolicyResult =
  | { allow: true }
  | { allow: false; mode: 'ask' | 'locked' | 'never'; decision_kind: string; hint: { do: 'raise_decision'; kind: string } | { do: 'handoff'; url?: string } };

const ask = (decision_kind: string, mode: 'ask' | 'locked'): PolicyResult =>
  ({ allow: false, mode, decision_kind, hint: { do: 'raise_decision', kind: decision_kind } });

export function check(i: PolicyInput): PolicyResult {
  const k = i.decision_kind;
  if (NEVER_PERFORMED.has(i.action) || NEVER_PERFORMED.has(k)) return { allow: false, mode: 'never', decision_kind: k, hint: { do: 'handoff' } };
  if (k === 'share_address') return i.actor === 'user' ? { allow: true } : ask(k, 'locked');
  // a price below the floor needs the person's own tap, whatever else was promoted
  if (i.actor !== 'user' && i.price_cents !== undefined && i.floor_cents !== undefined && i.price_cents < i.floor_cents) return ask('price_below_floor', 'ask');
  if (i.actor === 'user') return { allow: true };
  let mode = MODE_FOR[k] ?? 'ask'; // an unknown kind fails closed
  if (k === 'accept_offer' && i.price_cents !== undefined && i.always_accept_cents !== undefined && i.price_cents >= i.always_accept_cents) mode = 'auto';
  if (mode === 'auto') return { allow: true };
  if (mode === 'locked') return ask(k, 'locked');
  const lifted = i.promoted.has(k) && PROMOTABLE.has(k) && !NEVER_PROMOTED.has(k) && !(k === 'relist' && i.site === 'poshmark');
  return lifted ? { allow: true } : ask(k, 'ask');
}
