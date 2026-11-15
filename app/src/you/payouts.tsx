// Payouts: where each sale's money is (spec/features/insights.md, Kept versus sold). On its way is money from a sale the
// site has not released yet; it is never added to what landed, because a claim or a return can still take it back.
// Each row says when it lands in words a person would use, and opens the item.
import { day, insights, payouts, records, when, type OrderState } from '@/demo';
import { Amount, EmptyState, List, Nav, Screen, Section, Txt } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { cash, drawn, PAGES, useGo, useWorld } from './state';

// When the money from an open sale lands, said plainly (pages.md §3, Money; the clocks are the site's, spec/sites.mjs).
function lands(state: OrderState, release?: string): string {
  if (state === 'pickup_booked') return 'Paid in hand at pickup';
  if (state === 'return_open' || state === 'dispute_open') return 'Held while the buyer’s claim is open';
  if (release) return `Lands ${when(release)}`;
  if (state === 'paid' || state === 'to_ship') return 'Lands after you ship and it arrives';
  return 'Lands after the buyer gets it';
}

export function Payouts() {
  const w = useWorld(), go = useGo();
  const n = insights(w);
  const open = records(w).map(r => ({ r, o: w.orders.find(o => o.id === r.order_id)! })).filter(x => x.o && x.o.state !== 'released');
  const done = payouts(w).filter(p => p.landed);
  const title = (id: string) => w.items.find(i => i.id === id)?.title ?? '';
  const landed = done.reduce((a, p) => a + p.amount_cents, 0);
  return (
    <Screen name="you-payouts" state={drawn(w, open.length + done.length)} nav={<Nav back={() => go.back()} />}>
      <Txt role="heading">{PAGES.payouts.title}</Txt>
      {!open.length && !done.length ? (
        <EmptyState title="No payouts yet" line="Money from a sale shows here until it lands." />
      ) : (
        <Amount value={(n.on_its_way_cents || landed) / 100} what={n.on_its_way_cents ? 'On its way, after fees' : 'Paid out, after fees'} />
      )}
      {open.length ? (
        <Section title="On its way">
          <List>
            {open.map(({ r, o }) => (
              <ListRow key={o.id} id={`payout-${o.id}`} site={o.site} label={r.title} detail={lands(o.state, o.clocks.release_at)} value={cash(r.kept_cents)} onPress={() => go.to(`/item/${o.item_id}`)} />
            ))}
          </List>
        </Section>
      ) : null}
      {done.length ? (
        <Section title="Paid out">
          <List>
            {done.map(p => (
              <ListRow key={p.order_id} id={`payout-${p.order_id}`} site={p.site} label={title(p.item_id)} detail={`Landed ${day(p.at, w.now)}`} value={cash(p.amount_cents)} onPress={() => go.to(`/item/${p.item_id}`)} />
            ))}
          </List>
        </Section>
      ) : null}
    </Screen>
  );
}
