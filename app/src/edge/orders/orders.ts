// od-1 Sale to handover, payout and ledger (product.md "Sale to delist, handover, payout and ledger", §4 Order).
// How it operates: every signed-in `read_orders` result is applied to the order table, keyed unique
// (site, external_order_id), so reading the same order twice changes nothing. A read moves the order only along
// the §4 order transitions; a read that would move it backwards (a stale page) is ignored and reported.
// The first time an order is seen as paid, `new_sale` is true: the caller (sold's poll_orders job) then fans out
// the delists (dl-1). The payout is written once, when the site reports `released`, and never again.
// A refund is only ever recorded from the site's own report (refunds are never automated); it reverses the
// ledger row. The ledger is a query over the orders, one row per sale order, never stored (product.md §3).
// Likely breaks, each tested: an order read twice making two rows or two payouts; a stale read moving state
// backwards; a refund left counted as earned; a purchase order showing as a sale.
import type { Site } from '../events/event.ts';

export const ORDER_STATES = ['paid', 'pickup_booked', 'to_ship', 'shipped', 'delivered', 'handed_over', 'claim_window',
  'released', 'cancelled', 'return_open', 'dispute_open', 'refunded'] as const;
export type OrderState = (typeof ORDER_STATES)[number];

// §4 Order transitions (from -> allowed next states)
const NEXT: Record<OrderState, OrderState[]> = {
  paid: ['to_ship', 'pickup_booked', 'cancelled'],
  pickup_booked: ['handed_over', 'pickup_booked', 'cancelled'],
  to_ship: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['claim_window'],
  handed_over: ['claim_window'],
  claim_window: ['released', 'return_open', 'dispute_open'],
  return_open: ['dispute_open', 'refunded', 'released'],
  dispute_open: ['refunded', 'released'],
  released: [], cancelled: [], refunded: [],
};
// a site page can skip states we never saw (shipped and delivered between two reads), so reachability, not one step
function reachable(from: OrderState, to: OrderState): boolean {
  const seen = new Set<OrderState>(), q = [from];
  for (let s; (s = q.shift());) for (const n of NEXT[s]) if (!seen.has(n)) { if (n === to) return true; seen.add(n); q.push(n); }
  return false;
}

export interface OrderRead {
  kind: 'sale' | 'purchase'; site: Site; external_order_id: string; user_id: string; item_id: string; listing_id?: string;
  state: OrderState; price_cents: number; fees_cents: number | null; shipping_cents: number; payout_cents?: number;
}
export interface OrderRow extends OrderRead { id: string; payout_recorded_at?: string; history: { state: OrderState; at: string }[] }

export function orderBook(now: () => string = () => new Date().toISOString()) {
  const rows = new Map<string, OrderRow>();
  const key = (site: string, ext: string) => `${site}:${ext}`;
  return {
    apply(r: OrderRead): { order: OrderRow; new_sale: boolean; changed: boolean; ignored?: 'backwards' } {
      const k = key(r.site, r.external_order_id), old = rows.get(k);
      if (!old) {
        const o: OrderRow = { ...r, id: `ord_${rows.size + 1}`, history: [{ state: r.state, at: now() }] };
        if (r.state === 'released' && r.payout_cents != null) o.payout_recorded_at = now();
        rows.set(k, o);
        return { order: o, new_sale: r.kind === 'sale', changed: true };
      }
      if (old.state === r.state) return { order: old, new_sale: false, changed: false };
      if (!reachable(old.state, r.state)) return { order: old, new_sale: false, changed: false, ignored: 'backwards' };
      const o: OrderRow = { ...old, state: r.state, fees_cents: r.fees_cents, shipping_cents: r.shipping_cents, history: [...old.history, { state: r.state, at: now() }] };
      if (r.state === 'released' && !old.payout_recorded_at && r.payout_cents != null) { o.payout_cents = r.payout_cents; o.payout_recorded_at = now(); }
      else o.payout_cents = old.payout_cents; // a payout is written once
      rows.set(k, o);
      return { order: o, new_sale: false, changed: true };
    },
    all: () => [...rows.values()],
  };
}

export interface LedgerRow { order_id: string; site: Site; item_id: string; state: OrderState; earned_cents: number; fees_cents: number | null; kept_cents: number | null; reversed: boolean; settled: boolean }

// One row per sale order. A refunded or cancelled sale is reversed: it counts zero.
export function ledger(orders: OrderRow[]): LedgerRow[] {
  return orders.filter(o => o.kind === 'sale').map(o => {
    const reversed = o.state === 'refunded' || o.state === 'cancelled';
    const earned = reversed ? 0 : o.price_cents;
    const fees = reversed ? 0 : o.fees_cents;
    const kept = reversed ? 0 : (o.fees_cents === null ? null : o.payout_cents ?? o.price_cents - o.fees_cents);
    return { order_id: o.id, site: o.site, item_id: o.item_id, state: o.state, earned_cents: earned, fees_cents: fees, kept_cents: kept, reversed, settled: !!o.payout_recorded_at };
  });
}
