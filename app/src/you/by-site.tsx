// Insights: how selling is going, then by site, what your things are worth, and the monthly goal (spec/pages.md §6.16 By site,
// What your things are worth, Goals; spec/features/insights.md). The week chart, the things by state and how each live thing is
// doing moved here from You (app/src/you/trends.tsx; Ben, 10:27: "profile shouldnt have analytics").
// By site compares the person's own sales only, never other sellers. Worth is a range, never summed as exact.
import { useState } from 'react';
import { connectionState, insights, type Site } from '@/demo';
import { Blank, Guess, Line, List, Nav, Screen, Section, Txt } from '@/ui';
import { GoalBar } from '@/ui/parts/goal-bar';
import { ListRow } from '@/ui/parts/list-row';
import { cash, changed, drawn, PAGES, plural, span, useGo, usePage } from './state';
import { PageStatus } from './page-status';
import { Trends } from './trends';

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// What the person typed as an amount, in cents, or null when it is not one.
const cents = (typed: string) => { const v = Number(typed.replace(/[^0-9.]/g, '')); return typed.trim() && Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null; };

export function BySite() {
  const { w, asked } = usePage(), go = useGo();
  const n = insights(w);
  const month = MONTH[Number(w.now.slice(5, 7)) - 1];
  const [target, setTarget] = useState<number | null>(w.goal?.target_cents ?? null);
  const progress = n.goal?.progress_cents ?? 0;
  const things = w.items.filter(i => ['live', 'stale', 'kept', 'owned'].includes(i.state));
  const linked = (site: Site) => w.connections.some(c => c.site === site && connectionState(c) !== 'not_connected');

  const setGoal = (typed: string) => {
    const to = cents(typed);
    changed('goal', w.now.slice(0, 7), to === null ? 'none' : String(to), target === null ? 'none' : String(target));
    setTarget(to);
  };

  return (
    <Screen name="you-insights" state={drawn(w, n.by_site.length, asked)} nav={<Nav back={() => go.back()} />}>
      <Txt role="heading">{PAGES.insights.title}</Txt>
      <PageStatus asked={asked} what="your numbers">
      <Trends w={w} go={go} />
      <Section title="By site">
        {n.by_site.length ? (
          <List>
            {n.by_site.map(s => (
              <ListRow key={s.site} id={`site-${s.site}`} site={s.site}
                label={s.sold ? plural(s.sold, 'sale', 'sales') : 'Nothing sold yet'}
                detail={s.days_to_sell !== null ? `Sells in about ${plural(s.days_to_sell, 'day', 'days')}` : linked(s.site) ? 'Linked, no sale to measure yet' : 'Sold here before you linked it'}
                value={s.sold ? cash(s.kept_cents) : undefined} />
            ))}
          </List>
        ) : (
          <Txt role="body" tone="ink-2">Each site you sell on shows here once it has a sale.</Txt>
        )}
      </Section>

      {things.length ? (
        <Section title="What your things are worth">
          <List>
            {things.map(i => (
              <ListRow key={i.id} id={`worth-${i.id}`} label={i.title} detail={i.state === 'kept' || i.state === 'owned' ? 'Kept' : 'Live'}
                value={i.valuation && i.valuation.state === 'shown' ? span(i.valuation.range) : 'Not valued yet'} onPress={() => go.to(`/item/${i.id}`)} />
            ))}
          </List>
        </Section>
      ) : null}

      <Section title={`${month} goal`}>
        {target !== null ? <GoalBar label="Kept so far" kept={progress / 100} target={target / 100} /> : null}
        <List>
          <ListRow id="goal-row" label="Goal"
            trail={<Line>{target !== null
              ? <Guess id="goal-target" name="Goal" value={`${cash(target)} a month`} numeric changed onChange={setGoal} look="body" />
              : <Blank id="goal-target" name="Amount" numeric onChange={setGoal} look="body" />}</Line>} />
        </List>
      </Section>
      </PageStatus>
    </Screen>
  );
}
