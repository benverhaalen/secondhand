import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useLiveData } from '@/data/live';
import { EmptyState, FootButton, List, Stack, Txt, log } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { moneyOf, sellerError, showMoney, type Money } from './item';

export type Sale = { id: string; item_id: string; listing_id?: string; site: string; state: string; price_cents: Money | null; fees_cents: Money | null; shipping_cents: Money | null; payout_cents: Money | null; url?: string; buyer?: string; external_order_id?: string; created_at?: string };
export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    return readSales(controller.signal).then(sales => {
      if (!controller.signal.aborted) setSales(sales);
    }, failure => {
      if (!controller.signal.aborted) { log.error('selling.sales', failure); setError(sellerError(failure)); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, []);
  const reload = useCallback(async () => { setLoading(true); setError(null); await load(); }, [load]);
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
  return { sales, loading, error, reload };
}
async function readSales(signal: AbortSignal) {
  const all: Sale[] = [], cursors = new Set<string>(); let cursor: string | null = null;
  do {
    const page: { data: Sale[]; next_cursor: string | null } = await api.call(`GET /v1/orders?kind=sale${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal });
    all.push(...page.data); cursor = page.next_cursor;
    if (cursor && cursors.has(cursor)) throw new Error('The sales list could not finish loading. Retry.');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return all;
}
export const saleStatus = (sale: Sale) => ({ paid: 'Paid', to_ship: 'To ship', pickup_booked: 'Pickup arranged', shipped: 'Shipped', delivered: 'Delivered', handed_over: 'Handed over', released: 'Completed', claim_window: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded', return_open: 'Return open', dispute_open: 'Dispute open' })[sale.state] ?? 'Status unavailable';
export const saleGroup = (sale: Sale) => ['cancelled','refunded'].includes(sale.state) ? 'canceled' : ['released','handed_over'].includes(sale.state) ? 'completed' : ['shipped','delivered','claim_window'].includes(sale.state) ? 'shipped' : ['paid','to_ship'].includes(sale.state) ? 'to_ship' : 'other';
export function LiveSales({ filter, sort }: { filter: string; sort: string }) {
  const state = useSales(), { w } = useLiveData();
  const entries = state.sales.filter(sale => filter === 'all' || saleGroup(sale) === filter).sort((left, right) => {
    if (sort === 'latest') return (right.created_at ?? '').localeCompare(left.created_at ?? '');
    const a = moneyOf(left.price_cents)?.amount_cents, b = moneyOf(right.price_cents)?.amount_cents;
    if (a == null) return b == null ? 0 : 1; if (b == null) return -1;
    return sort === 'price_high' ? b - a : a - b;
  });
  return <Stack>
    {state.loading ? <Txt role="body">Loading sales</Txt> : state.error ? <EmptyState title="Sales did not load" line={state.error} action={{ id: 'sales-retry', label: 'Retry', onPress: state.reload }} />
      : entries.length ? <List>{entries.map(sale => {
        const item = w.items.find(item => item.id === sale.item_id), payout = moneyOf(sale.payout_cents);
        return <ListRow key={sale.id} id={`sale-${sale.id}`} label={item?.title || 'Sold item'} photo={item?.photos[0]?.key ?? null}
          detail={`${saleStatus(sale)} · ${payout ? `You get ${showMoney(payout)}` : 'Net pending'}`}
          onPress={() => router.push(`/item/${sale.item_id}/${sale.state === 'pickup_booked' ? 'pickup' : 'ship'}?order=${encodeURIComponent(sale.id)}` as Href)} />;
      })}</List> : <EmptyState title="No sales here yet" />}
    {!state.loading ? <FootButton id="sales-refresh" label="Refresh sales" kind="second" onPress={state.reload} /> : null}
  </Stack>;
}
