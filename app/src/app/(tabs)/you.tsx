// You (spec/pages.md §6.16): what selling has earned, what is on its way, what is live and what it could fetch, the goal,
// and the rows into each page. It leads with numbers (decision: the You tab leads with numbers); the weekly chart lives
// here, not on Today, and shows only once 3 weeks have a sale (research/today/ben/top-of-today-and-stacking.md §1).
// Behavior: app/behavior/(tabs)/you.json.
import { connectionState, insights, unread } from '@/demo';
import { EmptyState, List, Notice, Screen, Section, Amount } from '@/ui';
import { GoalBar } from '@/ui/parts/goal-bar';
import { ListRow } from '@/ui/parts/list-row';
import { TabNav } from '@/ui/parts/tab-nav';
import { WeekBars } from '@/ui/parts/week-bars';
import { cash, drawn, PAGES, plural, span, useGo, useWorld, weeks } from '@/you/state';

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function You() {
  const w = useWorld(), go = useGo();
  const n = insights(w);
  const live = w.items.filter(i => i.state === 'live' || i.state === 'stale').length;
  const kept = w.items.filter(i => i.state === 'kept' || i.state === 'owned');
  const keptWorth = n.kept_worth.filter(k => k.range).reduce((a, k) => ({ low: a.low + k.range!.low, high: a.high + k.range!.high }), { low: 0, high: 0 });
  const broken = w.connections.filter(c => connectionState(c) === 'error').length;
  const linked = w.connections.filter(c => connectionState(c) === 'connected').length;
  const auto = w.rules.filter(r => r.state === 'auto').length;
  const bars = weeks(w);
  const landed = n.kept_cents - n.on_its_way_cents;
  const state = drawn(w, n.sold + live + kept.length);

  return (
    <Screen name="you" state={state} wash nav={<TabNav title="You" inbox={{ count: unread(w), onPress: () => go.to('/messages') }} />}>
      {broken ? (
        <Notice id="you-signed-out" icon="alert-02" tone="need" text={broken === 1 ? 'A site signed you out' : `${broken} sites signed you out`} onPress={() => go.to('/you/connections')} />
      ) : null}

      <Section>
        {n.sold ? (
          <Amount value={n.kept_cents / 100} what={`Earned after fees, from ${plural(n.sold, 'sale', 'sales')}`} />
        ) : (
          <EmptyState title="Nothing sold yet" line="What you keep after fees shows here." action={live ? undefined : { id: 'you-sell', label: 'Sell something', onPress: () => go.to('/new') }} />
        )}
        {n.sold || live || kept.length ? (
          <List>
            {n.on_its_way_cents > 0 ? <ListRow id="you-on-its-way" label="On its way" value={cash(n.on_its_way_cents)} onPress={() => go.to('/you/payouts')} /> : null}
            {n.on_its_way_cents === 0 && landed > 0 ? <ListRow id="you-paid-out" label="Paid out" value={cash(landed)} onPress={() => go.to('/you/payouts')} /> : null}
            {n.could_earn ? <ListRow id="you-live" label={`${live} live, could earn`} value={span(n.could_earn)} onPress={() => go.to('/sell')} /> : null}
            {kept.length ? <ListRow id="you-kept" label={`${kept.length} kept, worth`} value={keptWorth.high ? span(keptWorth) : 'Not valued yet'} onPress={() => go.to('/you/insights')} /> : null}
          </List>
        ) : null}
      </Section>

      {n.goal || bars ? (
        <Section>
          {n.goal ? <GoalBar label={`${MONTH[Number(n.goal.month.slice(5, 7)) - 1]} goal`} kept={n.goal.progress_cents / 100} target={n.goal.target_cents / 100} /> : null}
          {bars ? <WeekBars weeks={bars.map(b => ({ label: b.label, amount: b.cents / 100, now: b.now }))} /> : null}
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
        <ListRow id="you-settings" lead={PAGES.settings.icon} label={PAGES.settings.title} onPress={() => go.to('/you/settings')} />
      </List>
    </Screen>
  );
}
