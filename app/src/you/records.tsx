// Records: the year's sales, what each sold for, what the site and the label took, and what was kept; the cost only where a
// purchase told us, never asked (insights.md, Profit). A CSV of every line is the one act, labelled a record, never tax advice.
import { useState } from 'react';
import { Platform } from 'react-native';
import { day, records } from '@/demo';
import { EmptyState, FootButton, List, Nav, Screen, Section, Txt } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { cash, changed, drawn, PAGES, plural, useGo, usePage } from './state';
import { PageStatus } from './page-status';

export function Records() {
  const { w, asked } = usePage(), go = useGo();
  const rows = records(w);
  const year = w.now.slice(0, 4);
  const sold = rows.reduce((a, r) => a + r.price_cents, 0), fees = rows.reduce((a, r) => a + r.fees_cents + r.shipping_cents, 0);
  const kept = rows.reduce((a, r) => a + r.kept_cents, 0), costs = rows.filter(r => r.cost_cents !== null);
  const [saved, setSaved] = useState(false);

  // Every line with where it came from. On the web it downloads; on a phone the share sheet takes it (a later step).
  const download = () => {
    const head = 'date,title,site,sold,fees,shipping,cost,kept';
    const body = rows.map(r => [r.date, `"${r.title.replace(/"/g, '""')}"`, r.site, r.price_cents / 100, r.fees_cents / 100, r.shipping_cents / 100, r.cost_cents === null ? '' : r.cost_cents / 100, r.kept_cents / 100].join(','));
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([[head, ...body].join('\n')], { type: 'text/csv' }));
      a.download = `secondhand-${year}.csv`;
      a.click();
    }
    changed('records', year, 'downloaded');
    setSaved(true);
  };

  return (
    <Screen name="you-records" state={drawn(w, rows.length, asked)} nav={<Nav back={() => go.back()} />}
      foot={rows.length ? <FootButton id="records-csv" label={saved ? 'Downloaded' : 'Download CSV'} kind={saved ? 'second' : 'primary'} icon={saved ? 'checkmark-circle-02' : undefined} onPress={download} /> : undefined}>
      <Txt role="heading">{PAGES.records.title}</Txt>
      <PageStatus asked={asked} what="your records">
      {rows.length ? (
        <>
          <Section title={year}>
            <List>
              <ListRow id="records-sold" label={`Sold, ${plural(rows.length, 'sale', 'sales')}`} value={cash(sold)} />
              <ListRow id="records-fees" label="Fees and labels" value={cash(fees)} />
              {costs.length ? <ListRow id="records-cost" label={`What you paid, for ${costs.length} of them`} value={cash(costs.reduce((a, r) => a + (r.cost_cents ?? 0), 0))} /> : null}
              <ListRow id="records-kept" label="Kept" value={cash(kept)} />
            </List>
          </Section>
          <Section title="Sales">
            <List>
              {rows.map(r => {
                const item = w.orders.find(o => o.id === r.order_id)?.item_id;
                const fee = r.fees_cents + r.shipping_cents;
                const detail = [day(r.date + 'T18:00:00Z', w.now), fee ? `fees ${cash(fee)}` : 'no fees', r.cost_cents !== null ? `paid ${cash(r.cost_cents)}` : null].filter(Boolean).join(', ');
                return <ListRow key={r.order_id} id={`record-${r.order_id}`} site={r.site} label={r.title} detail={detail} value={cash(r.kept_cents)} onPress={item ? () => go.to(`/item/${item}`) : undefined} />;
              })}
            </List>
          </Section>
        </>
      ) : (
        <EmptyState title="No sales this year" line="Each sale shows here with its fees." />
      )}
      </PageStatus>
    </Screen>
  );
}
