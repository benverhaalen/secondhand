// Payouts: where each sale's money is (spec/features/insights.md, Kept versus sold; spec/edge-cases.md, "The money arrives
// at different times", Ben 05:05). Each sale moves through four words, Sold, On its way, Ready on the site, In your bank, and
// its row says where it is and the next word with its date. Money is on its way until the last word: it is never added to
// what landed, because a claim or a return can still take it back. A row opens the four words with their dates; where the
// site sells a faster payout, it is offered there with its fee, as the second choice under the free wait.
import { useState } from 'react';
import { List, Amount, EmptyState, FootButton, Nav, Screen, Section, Sheet, Txt } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { inLine, moneyLine, moneyRows, type MoneyRow } from './money-steps';
import { cash, changed, drawn, PAGES, useGo, usePage } from './state';
import { PageStatus } from './page-status';

export function Payouts() {
  const { w, asked } = usePage(), go = useGo();
  const rows = moneyRows(w);
  const [open, setOpen] = useState<MoneyRow | null>(null);
  const [instant, setInstant] = useState<Record<string, boolean>>({});
  const coming = rows.filter(r => !r.arrived), arrived = rows.filter(r => r.arrived);
  const sum = (rs: MoneyRow[]) => rs.reduce((a, r) => a + r.kept, 0);
  const row = (r: MoneyRow) => (
    <ListRow key={r.o.id} id={`payout-${r.o.id}`} site={r.o.site} label={r.title}
      detail={instant[r.o.id] ? 'Ready on the site. In your bank today' : moneyLine(r)} value={cash(r.kept)} onPress={() => setOpen(r)} />
  );
  const bank = open ? open.steps[open.steps.length - 1] : null;
  return (
    <Screen name="you-payouts" state={drawn(w, rows.length, asked)} nav={<Nav back={() => go.back()} />}>
      <Txt role="heading">{PAGES.payouts.title}</Txt>
      <PageStatus asked={asked} what="your payouts">
      {!rows.length ? (
        <EmptyState title="No payouts yet" line="Money from a sale shows here until it lands." />
      ) : (
        <Amount value={(coming.length ? sum(coming) : sum(arrived)) / 100} what={coming.length ? 'On its way, after fees' : 'Paid out, after fees'} />
      )}
      {coming.length ? <Section title="On its way"><List>{coming.map(row)}</List></Section> : null}
      {arrived.length ? <Section title="Paid out"><List>{arrived.map(row)}</List></Section> : null}

      </PageStatus>
      <Sheet open={open !== null} title={open?.title} onClose={() => setOpen(null)}>
        {open ? (
          <List>
            {open.steps.map((s, i) => {
              const today = instant[open.o.id] && i === open.steps.length - 1;
              return <ListRow key={s.word} id={`money-step-${i}`} lead={s.done ? 'checkmark-circle-02' : 'clock-01'} label={s.word} detail={today ? 'Today, with the fee' : s.when} />;
            })}
            <ListRow id="money-item" lead="package" label="See the item" onPress={() => { const id = open.o.item_id; setOpen(null); go.to(`/item/${id}`); }} />
          </List>
        ) : null}
        {open?.instantCents && !instant[open.o.id] && bank ? (
          <>
            <Txt role="caption">{`Free if you wait: in your bank ${inLine(bank.when)}.`}</Txt>
            <FootButton id="payout-instant" kind="second" label={`Get it today for ${cash(open.instantCents)}`}
              onPress={() => { changed('payout', open.o.id, 'instant_requested'); setInstant(x => ({ ...x, [open.o.id]: true })); }} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
