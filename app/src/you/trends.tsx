// The analytics that sat on You until Ben, 10:27: "profile shouldnt have analytics ... for more detailed actions you can go
// into specific pages". They open from You's Insights row, at the top of Insights (app/src/you/by-site.tsx), unchanged:
// - money kept each week on a dollar axis with each week's count of sales under it, once there are 3 sales to draw;
// - everything being sold by where it is, a bar and a tile per part into that shelf on Sell;
// - how each live thing is doing against what is usual for it, the slow ones first.
import { insights, type World } from '@/demo';
import { List, Section, type PhotoSrc } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { PulseKey, PulseRow } from '@/ui/parts/pulse-row';
import { StateBar, type StatePart } from '@/ui/parts/state-bar';
import { WeekChart } from '@/ui/parts/week-chart';
import { photo } from '@/demo/photos';
import type { PhotoKey } from '@/demo/photo-keys';
import { shortName } from '@/demo/short-name';
import { byState, cells, niceTop, pulse, salesWeeks, type StateKey } from './dashboard';
import { cash, span, type useGo } from './state';

const SHOWN = 4;
// Each part of Your things wears its state's fill and icon from Sell (ui/states.ts); kept and didn't sell have no tag there, so
// they take the two hues no state uses.
const LOOK: Record<StateKey, Pick<StatePart, 'fill' | 'icon'>> = {
  in_progress: { fill: 'gray', icon: 'search-01' }, live: { fill: 'sky', icon: 'live-streaming-02' }, sold: { fill: 'mint', icon: 'money-03' },
  unsold: { fill: 'peach', icon: 'clock-01' }, kept: { fill: 'lilac', icon: 'store-01' },
};

export function Trends({ w, go }: { w: World; go: ReturnType<typeof useGo> }) {
  const n = insights(w);
  const things = byState(w), rows = pulse(w), weeks = salesWeeks(w);
  const keptWorth = n.kept_worth.filter(k => k.range).reduce((a, k) => ({ low: a.low + k.range!.low, high: a.high + k.range!.high }), { low: 0, high: 0 });
  return (
    <>
      {weeks ? (
        <Section title="Sales each week">
          <WeekChart weeks={weeks.map(x => ({ label: x.label, amount: x.cents / 100, n: x.sales, now: x.now }))} top={niceTop(Math.max(...weeks.map(x => x.cents))) / 100}
            axis="After fees" count={{ name: 'Sales', one: 'sale', many: 'sales' }} />
        </Section>
      ) : null}

      {things.length ? (
        <Section title="Your things">
          <StateBar parts={things.map(t => ({ ...t, ...LOOK[t.id], id: `things-${t.id}`, note: t.id === 'kept' && keptWorth.high ? `worth ${span(keptWorth)}` : undefined }))}
            onOpen={id => go.to(`/sell?filter=${id.replace('things-', '')}`)} />
        </Section>
      ) : null}

      {rows.length ? (
        <Section title="How they’re doing">
          <List>
            {rows.slice(0, SHOWN).map(r => (
              <PulseRow key={r.id} id={`pulse-${r.id}`} title={shortName(r)} photo={r.key ? (photo(r.key as PhotoKey) as PhotoSrc) : null} sites={r.sites}
                price={r.price.low === r.price.high ? cash(r.price.low) : `${cash(r.price.low)} to ${cash(r.price.high)}`} line={r.line} cells={cells(r)} onPress={() => go.to(`/item/${r.id}`)} />
            ))}
            {rows.length > SHOWN ? <ListRow id="you-all-live" label={`All ${rows.length} live`} onPress={() => go.to('/sell?filter=live')} /> : null}
          </List>
          <PulseKey text="The tick is what’s usual for it" />
        </Section>
      ) : null}
    </>
  );
}
