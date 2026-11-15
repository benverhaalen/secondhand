// The offer_outcome row (product.md; negotiation.md §1, §6): one offer round, no buyer identity.
// In memory; the Lakebase writer comes later. Amounts are integer cents. Key: (conversation_id, round, side).
export type Response = 'accepted' | 'countered' | 'declined' | 'expired' | 'walked';
export type OfferOutcome = {
  conversation_id: string; item_id: string; site: string; round: number; side: 'sell' | 'buy';
  offer: number; ask: number; counter: number | null; response: Response | null;
  final_price: number | null; ms_to_response: number | null; overruled?: boolean;
};
export type OfferRead = { conversation_id: string; item_id: string; site: string; offer_cents: number; ask_cents: number; at: number; round?: number; side?: 'sell' | 'buy' };
export type Reply = { conversation_id: string; round?: number; side?: 'sell' | 'buy'; at: number; response?: Response; counter_cents?: number; final_price_cents?: number; outcome_unknown?: boolean; overruled?: boolean };
export type Observed = { response: Response; counter_cents?: number; final_price_cents?: number; at?: number; overruled?: boolean };

export function outcomeStore() {
  const map = new Map<string, OfferOutcome>();
  const offeredAt = new Map<string, number>();
  const key = (c: string, r: number, side: string) => `${c}|${r}|${side}`;
  const get = (c: string, r: number, side: 'sell' | 'buy') => {
    const row = map.get(key(c, r, side));
    if (!row) throw new Error(`no offer read for ${c} round ${r} ${side}`);
    return row;
  };
  function settle(row: OfferOutcome, k: string, o: Observed) {
    if (row.response !== null && row.response !== o.response) throw new Error(`round already ${row.response}, not ${o.response}`);
    row.response = o.response;
    row.counter = o.counter_cents ?? row.counter;
    row.final_price = o.final_price_cents ?? (o.response === 'accepted' ? (row.counter ?? row.offer) : row.final_price) // a buyer taking our counter pays the counter;
    if (o.at !== undefined) row.ms_to_response = o.at - (offeredAt.get(k) ?? o.at);
    if (o.overruled !== undefined) row.overruled = o.overruled;
  }
  return {
    fromOffer(r: OfferRead): void {
      const round = r.round ?? 1, side = r.side ?? 'sell', k = key(r.conversation_id, round, side);
      if (map.has(k)) return;
      // Whitelisted fields only: nothing about the buyer is copied in.
      map.set(k, { conversation_id: r.conversation_id, item_id: r.item_id, site: r.site, round, side, offer: r.offer_cents, ask: r.ask_cents, counter: null, response: null, final_price: null, ms_to_response: null });
      offeredAt.set(k, r.at);
    },
    fromReply(r: Reply): void {
      const round = r.round ?? 1, side = r.side ?? 'sell', k = key(r.conversation_id, round, side), row = get(r.conversation_id, round, side);
      if (r.outcome_unknown || !r.response) return; // reconcile() settles it when the reply is read back
      settle(row, k, { response: r.response, counter_cents: r.counter_cents, final_price_cents: r.final_price_cents, at: r.at, overruled: r.overruled });
    },
    reconcile(conversation_id: string, round: number, observed: Observed, side: 'sell' | 'buy' = 'sell'): void {
      settle(get(conversation_id, round, side), key(conversation_id, round, side), observed);
    },
    rows(): OfferOutcome[] {
      return [...map.values()].map((r) => ({ ...r }));
    },
  };
}
