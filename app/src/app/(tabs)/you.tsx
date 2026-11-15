// You (spec/pages.md §6.16), a dashboard (Ben 06:19: "I want to know my sales, I want to know my listings, I want to know how
// they're doing ... how much I could earn", explained "using visuals ... and in context too"). Top to bottom:
// - what selling brought in after fees and from how many sales, then one bar of where that money is and what the live things
//   could still bring (paid out, on its way, could still earn), each part a row into its page;
// - a site that signed the person out, with Sign in on the row: the first thing after the money that needs them;
// - money kept each week on a dollar axis with each week's count of sales under it, once there are 3 sales to draw;
// - everything being sold by where it is, a bar and a tile per part into that shelf on Sell;
// - how each live thing is doing against what is usual for it, the slow ones first;
// - the rows into each page.
// No goal on this page: Ben, 06:19, "I don't really like the November goal type thing". A goal the person sets stays on By site.
// Behavior: app/behavior/(tabs)/you.json.
import { insights, unread } from '@/demo';
import { EmptyState, List, Screen, Section, Amount } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { shortName } from '@/demo/short-name';
import { TabNav } from '@/ui/parts/tab-nav';
import { MoneyBar, type MoneyPart } from '@/ui/parts/money-bar';
import { PulseKey, PulseRow } from '@/ui/parts/pulse-row';
import { StateBar, type StatePart } from '@/ui/parts/state-bar';
import { WeekChart } from '@/ui/parts/week-chart';
import { photo } from '@/demo/photos';
import type { PhotoKey } from '@/demo/photo-keys';
import type { PhotoSrc } from '@/ui';
import { byState, cells, couldEarn, niceTop, pulse, salesWeeks, type StateKey } from '@/you/dashboard';
import { moneyRows, soonest } from '@/you/money-steps';
import { PageStatus } from '@/you/page-status';
import { SignInRow } from '@/you/sign-in-row';
import { cash, drawn, PAGES, plural, span, SITE_ORDER, useGo, useLinks, usePage } from '@/you/state';

const SHOWN = 4;
// Each part of Your things wears its state's fill and icon from Sell (ui/states.ts); kept and didn't sell have no tag there, so
// they take the two hues no state uses.
const LOOK: Record<StateKey, Pick<StatePart, 'fill' | 'icon'>> = {
  in_progress: { fill: 'gray', icon: 'search-01' }, live: { fill: 'sky', icon: 'live-streaming-02' }, sold: { fill: 'mint', icon: 'money-03' },
  unsold: { fill: 'peach', icon: 'clock-01' }, kept: { fill: 'lilac', icon: 'store-01' },
};
// A guess is said in whole dollars: cents on a range claim a precision it does not have.
const dollars = (cents: number) => cash(Math.round(cents / 100) * 100);

export default function You() {
  const { w, asked } = usePage(), go = useGo();
  const { links, link } = useLinks(w);
  const n = insights(w);
  // A site that signed the person out stays on the page through its sign-in, so the row can say it worked.
  const signedOut = SITE_ORDER.filter(s => w.connections.find(c => c.site === s && c.error));
  const linked = SITE_ORDER.filter(s => links[s].state === 'connected').length;
  const auto = w.rules.filter(r => r.state === 'auto').length;
  // Money is on its way until it is in the bank or in hand (spec/edge-cases.md, the four words), so this bar and Payouts agree.
  const money = moneyRows(w), coming = money.filter(r => !r.arrived);
  const onItsWay = coming.reduce((a, r) => a + r.kept, 0), landed = n.kept_cents - onItsWay;
  const could = couldEarn(w), things = byState(w), rows = pulse(w), weeks = salesWeeks(w);
  const keptWorth = n.kept_worth.filter(k => k.range).reduce((a, k) => ({ low: a.low + k.range!.low, high: a.high + k.range!.high }), { low: 0, high: 0 });
  const state = drawn(w, n.sold + things.reduce((a, t) => a + t.count, 0), asked);

  const parts: MoneyPart[] = [
    ...(landed > 0 ? [{ id: 'you-paid-out', label: 'Paid out', value: cash(landed), low: landed, fill: 'lime' as const, onPress: () => go.to('/you/payouts') }] : []),
    ...(onItsWay > 0 ? [{ id: 'you-on-its-way', label: 'On its way', detail: soonest(coming) ?? undefined, value: cash(onItsWay), low: onItsWay, fill: 'mint' as const, onPress: () => go.to('/you/payouts') }] : []),
    // Across sites the same thing is up at different prices, so this is a range; on one site it is one number (Ben 06:19).
    ...(could ? [{ id: 'you-live', label: 'Could still earn', detail: `If your ${plural(could.things, 'live thing sells', 'live things sell')}`,
      value: could.low === could.high ? dollars(could.low) : `${dollars(could.low)} to ${dollars(could.high)}`, low: could.low, high: could.high, fill: 'sky' as const, onPress: () => go.to('/sell?filter=live') }] : []),
  ];

  return (
    <Screen name="you" state={state} wash nav={<TabNav title="You" inbox={{ count: unread(w), onPress: () => go.to('/messages') }} />}>
      <PageStatus asked={asked} what="your numbers">
      <Section>
        {n.sold ? (
          <Amount value={n.kept_cents / 100} what={`You got from ${plural(n.sold, 'sale', 'sales')}, after fees`} />
        ) : (
          <EmptyState title="Nothing sold yet" line="What you get after fees shows here." action={could ? undefined : { id: 'you-sell', label: 'Sell something', onPress: () => go.to('/new') }} />
        )}
        {parts.length ? <MoneyBar parts={parts} /> : null}
      </Section>

      {/* Under the money, not over it: a person opens You for the money first, and a signed-out site is the first thing after it
          that needs them, still on the first screen (Mail and Settings put an account's alert under its header). */}
      {signedOut.length ? <List>{signedOut.map(s => <SignInRow key={s} site={s} link={links[s]} onSignIn={() => link(s)} />)}</List> : null}

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

      {n.sold ? (
        <List>
          <ListRow id="you-insights" lead={PAGES.insights.icon} label={PAGES.insights.title} onPress={() => go.to('/you/insights')} />
          <ListRow id="you-records" lead={PAGES.records.icon} label={PAGES.records.title} onPress={() => go.to('/you/records')} />
        </List>
      ) : null}

      <List>
        <ListRow id="you-connections" lead={PAGES.connections.icon} label={PAGES.connections.title} value={`${linked} of ${w.connections.length}`} onPress={() => go.to('/you/connections')} />
        <ListRow id="you-rules" lead={PAGES.rules.icon} label={PAGES.rules.title} value={auto ? `${auto} on their own` : undefined} onPress={() => go.to('/you/rules')} />
        {w.events.length ? <ListRow id="you-log" lead={PAGES.log.icon} label={PAGES.log.title} onPress={() => go.to('/you/log')} /> : null}
        <ListRow id="you-notifications" lead={PAGES.notifications.icon} label={PAGES.notifications.title} onPress={() => go.to('/you/notifications')} />
        <ListRow id="you-settings" lead={PAGES.settings.icon} label={PAGES.settings.title} onPress={() => go.to('/you/settings')} />
      </List>
      </PageStatus>
    </Screen>
  );
}
