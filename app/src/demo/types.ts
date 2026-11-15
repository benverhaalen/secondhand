// The shapes the demo world is made of. Field and state names are the canon's (spec/product.md §3 and §4,
// spec/examples/*.json); one change for the screens: money is a plain integer of cents, as in app/src/sell/grid.ts
// and app/src/engines/valuation/keep.ts, and the currency is the user's (USD in every world).
import type { Site } from '../sell/grid.ts';
import type { PhotoKey } from './photo-keys.ts';

export type { Site };
export type Cents = number;
export type Iso = string;

export type ItemState = 'capturing' | 'researching' | 'review' | 'live' | 'stale' | 'sold' | 'handed_over' | 'done' | 'unsold' | 'kept' | 'returned' | 'disputed' | 'failed' | 'owned';
export type ListingState = 'none' | 'posting' | 'live' | 'postFailed' | 'delisting' | 'delisted' | 'delistFailed';
export type OrderState = 'paid' | 'pickup_booked' | 'to_ship' | 'shipped' | 'delivered' | 'handed_over' | 'claim_window' | 'released' | 'cancelled' | 'return_open' | 'dispute_open' | 'refunded';
export type OfferState = 'open' | 'countered' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
export type DecisionState = 'open' | 'acting' | 'answered' | 'failed' | 'expired' | 'superseded';
export type KindFamily = 'apparel' | 'shoes' | 'bags' | 'jewellery_watches' | 'furniture' | 'lighting_home' | 'electronics' | 'appliances_tools' | 'media' | 'cards_collectibles' | 'toys_lego' | 'bikes_sports' | 'baby_gear' | 'other';

export type Photo = { id: string; role: 'front' | 'back' | 'tag' | 'detail' | 'flaw' | 'studio'; use: 'real' | 'improved'; ai_marked: boolean; key: PhotoKey };

// A guarded number: shown with its basis, or hidden with the reason (product.md §3 sub-shapes).
export type Guard = { basis_count: number; as_of: Iso; citation_id: string | null; state: 'shown' | 'hidden' | 'not_found'; hide_reason?: 'too_few' | 'too_wide' | 'stale' | 'mixed_types' | 'source_gap' | 'conflict' | 'noise' };
export type Range = { low: Cents; high: Cents };

export type Attribute = { id: string; name: string; value: string | number | null; unit?: string; source: 'measured' | 'label' | 'inferred' | 'spec' | 'you_said' | 'marketplace'; confirmed: boolean; unknown_reason?: 'not_visible' | 'not_read' | 'conflict' | 'not_asked' };

// Standing words are pages.md §3; `waiting_for_price` is the "Only at my price" case, never Slow or Stuck.
export type StandingWord = 'hot' | 'on_pace' | 'slow' | 'stuck' | 'still_learning' | 'waiting_for_price';
export type MarketStanding = { word: StandingWord; place?: { rank: number; of: number; basis: 'price' }; outlook?: { days_lo: number; days_hi: number }; fix?: { change: string; consequence: string }; line: string; citation_id: string | null; state: 'shown' | 'hidden' };

export type Listing = { id: string; item_id: string; site: Site; state: ListingState; price_cents: Cents; url: string; interest: { views?: number; watchers?: number; likes?: number };
  // What came in since the person last opened the app (read_stats rollups, spec/data-use.md): Today's interest rung.
  interest_new?: { views?: number; watchers?: number; likes?: number }; posted_at: Iso | null; market_standing?: MarketStanding; error?: string };

export type PlanChoice = 'sell' | 'fast' | 'best' | 'reserve' | 'check';
// spread: this item's own cross-listing price rule, when it is not the account's (app/src/engines/listing/spreads.ts).
// accept_mode: ask means every offer waits for the person, under any choice (ways-out §6.7, "Ask me before every offer").
export type Spread = 'same_keep' | 'same_price' | 'site_market' | 'home_first';
export type ItemLimits = { floor_cents: Cents; always_accept_cents: Cents | null; plan_choice: PlanChoice; gone_by: Iso | null; fallback: 'ask' | 'donate' | 'keep' | 'trade_in' | 'relist'; markdown_on: boolean;
  spread?: Spread; accept_mode?: 'ask' | 'rules' };

export type Valuation = Guard & { range: Range; per_site: { site: Site; low: Cents | null; high: Cents | null; basis_count: number }[]; level: 1 | 2 | 3;
  // How fast it sells at each way of pricing: the engine's slider point at that mode's mark (engines/valuation/posture.ts,
  // pointOnSite: days_t50 and p_sale_30 from the site's sale curve). Absent until a curve is fitted for the item.
  pace?: Partial<Record<'fast' | 'sell' | 'best', { days_t50: number | null; p_sale_30: number }>> };

export type Item = {
  id: string; state: ItemState; title: string; category: KindFamily; product_id?: string;
  // The kind of thing as platform-fit.json types it (fan_apparel, sneakers), when it is narrower than the family.
  kind?: string;
  cost?: { amount_cents: Cents; date: string; source: 'purchase' | 'bought_it' | 'you_said' };
  origin: 'capture' | 'purchase' | 'import' | 'folder'; location: { label: string }; quantity: number; group_id?: string;
  note?: string; kept_reason?: string; photos: Photo[]; attributes: Attribute[]; valuation?: Valuation; limits?: ItemLimits;
  listings: Listing[]; created_at: Iso; updated_at: Iso;
};

export type Account = { id: string; site: Site; route: 'harness' | 'search_only'; health: 'ok' | 'expiring' | 'broken' | 'paused'; linked_at: Iso; checked_at: Iso; capabilities: string[]; decision_id?: string };
// One row per site on You > Accounts and in setup. `linking` is a sign-in job still running; no account means not linked.
export type Connection = { site: Site; account: Account | null; linking: { stage: string; started_at: Iso } | null; error: string | null };
export type ConnectionState = 'connected' | 'loading' | 'error' | 'not_connected';

export type Offer = { id: string; conversation_id: string; listing_id: string; site: Site; direction: 'in' | 'out'; amount_cents: Cents; you_keep_cents: Cents; state: OfferState; sent_at: Iso; expires_at: Iso | null };

export type Order = {
  id: string; kind: 'sale' | 'purchase'; item_id: string; listing_id: string | null; site: Site; state: OrderState;
  price_cents: Cents; fees_cents: Cents; shipping_cents: Cents; payout_cents: Cents | null; buyer: string;
  label: { carrier: string; tracking_ref: string | null; cost_cents: Cents } | null;
  clocks: { ship_by?: Iso; claim_until?: Iso; release_at?: Iso }; external_order_id: string; created_at: Iso;
};
export type Appointment = { id: string; order_id: string; kind: 'pickup' | 'ship_by'; window: { start: Iso; end: Iso }; place: { label: string } | null; state: 'proposed' | 'booked' | 'done' | 'no_show' | 'cancelled' };

export type Message = { id: string; conversation_id: string; actor: 'user' | 'auto' | 'counterpart'; sent_at: Iso; intent: string; facets: ('possible_scam' | 'dispute')[]; text: string; offer_id?: string };
export type Conversation = { id: string; site: Site; item_id: string | null; listing_id: string | null; match_id?: string; role: 'sell' | 'buy'; buyer: string; intent_last: string; state: 'open' | 'closed' | 'blocked'; last_read_at: Iso; unread: number };

export type Feed = 'now' | 'when_you_can' | 'good_to_know';
export type Option = { id: string; label: string; does: string };
export type Decision = {
  id: string; kind: string; item_id: string | null; site: Site | null; state: DecisionState; tier: 'ask' | 'locked';
  feed: Feed; group_form: 'single' | 'batch' | 'queue'; group_key: string | null; group_rank: number | null;
  why: string; deadline: Iso | null; options: Option[]; suggested: string | null; allow_other: boolean;
  money?: { offer_cents?: Cents; you_keep_cents?: Cents; label_cents?: Cents; price_cents?: Cents; floor_cents?: Cents };
  offer_ids?: string[]; order_id?: string; account_id?: string; match_id?: string; conversation_id?: string;
  error?: string; created_at: Iso;
};
export type Notice = { id: string; kind: 'value_moved' | 'demand_rose' | 'listing_stale' | 'ranker_changed'; item_id: string; text: string; citation_id: string; at: Iso };

export type LogEvent = { event_id: string; item_id: string | null; action: string; actor: 'user' | 'auto' | 'site'; site: Site | null; at: Iso; why: string; undo: { allowed: boolean; until: Iso | null } };
export type Rule = { id: string; kind: string; scope: 'all' | string; state: 'ask' | 'eligible' | 'auto' | 'expired' | 'demoted'; unedited_approvals: number; last_used_at: Iso | null; when: string; if: string; then: string };
export type Limits = { handover: ('ship' | 'pickup')[]; pickup_windows: { weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'; from: string; to: string }[]; saved_spot: { label: string } | null; ask_every_time: boolean };

export type OnboardingStep = 'signed_in' | 'sites_picked' | 'sites_linked' | 'imported' | 'email' | 'pickups' | 'notifications';
export type User = {
  id: string; name: string; locale: 'en-US'; currency: 'USD'; timezone: string; last_open_at: Iso | null;
  auth_methods: { provider: 'apple' | 'google' | 'email'; linked_at: Iso }[];
  onboarding: { done_steps: OnboardingStep[]; finished_at: Iso | null };
  notification_pref: { event_kind: string; channel: 'push' | 'batch' | 'off' }[];
  experiments_consent: boolean;
};
export type Goal = { month: string; target_cents: Cents; target_sales: number | null };
export type StyleFacet = { name: 'brand' | 'category' | 'size' | 'colour' | 'era' | 'price_band'; value: string; weight: number; from: 'sold' | 'kept' | 'saved' | 'followed' | 'bought' | 'edited'; pinned: boolean; why: string };

// Buy side.
export type MatchLabel = 'exact' | 'likely_same_model' | 'same_family_other_variant' | 'comparable' | 'unresolved';
// Who clothes are cut for. A letter size means a different garment in each (the Brewers trial, research/watch/ben/brewers-alert-trial.md).
export type Cut = 'mens' | 'womens' | 'youth';
export type Want = { id: string; state: 'active' | 'paused' | 'ended'; text: string; product_id: string | null; fit: { size?: string; cut?: Cut; condition_floor?: string; radius_mi?: number }; max_total_cents: Cents | null; sites: Site[]; checked: Partial<Record<Site, Iso>>; behind: Site[]; quiet_hours: { from: string; to: string } | null; alert: 'available' | 'under' };
export type Match = { id: string; state: 'found' | 'alerted' | 'saved' | 'asked' | 'offered' | 'bought' | 'dismissed' | 'gone'; want_id: string | null; source: 'want' | 'search' | 'for_you'; label: MatchLabel; site: Site; title: string; key: PhotoKey; url: string; price_cents: Cents; delivered_cents: Cents; condition: string; seller: string; verdict: 'good' | 'fair' | 'high'; seen_at: Iso; product_id: string | null; size?: string };
export type RetailOffer = { id: string; product_id: string; relation: 'same_product' | 'successor' | 'functional_equivalent'; store: string; condition: 'new' | 'refurbished'; price_cents: Cents; delivered_cents: Cents; delivery_min_days: number; delivery_max_days: number; warranty_months: number; returns_days: number };
export type Product = {
  id: string; brand: string; model: string; variant: string; category: KindFamily; key: PhotoKey;
  used_price: Guard & { range: Range }; retail_price_cents: Cents | null; trend: 'rising' | 'flat' | 'falling';
  by_site: { site: Site; sold: Range | null; asking: Range | null; for_sale: number; median_days: number | null; basis_count: number }[];
  history: { month: string; new_cents: Cents | null; used_cents: Cents }[]; cheaper: { title: string; price_cents: Cents }[];
};
export type SearchResult = { id: string; query: string; product_id: string | null; sites_answered: Site[]; sites_waiting: Site[]; counts: Partial<Record<Site, number>>; fair: Range | null; rows: Match[]; retail: RetailOffer[] };
