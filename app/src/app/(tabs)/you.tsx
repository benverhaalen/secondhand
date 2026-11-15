// You (spec/pages.md §6.16) has one job: see at a glance how selling is going, and get to each thing (Ben, 10:27: "each page
// should have one purpose ... profile shouldnt have analytics, linking services, tracking things, settings ... it should have
// simple ways to visualize and understand intutitively and go to each thing"). Read the way iOS Settings opens on the
// account and then its rows. Top to bottom:
// - what selling brought in after fees and from how many sales, with at most two numbers under it (on its way, live);
// - rows into each page, one line each: Insights and Payouts, then Your sites, Rules and limits, Notifications and Settings.
//   A row says nothing more unless it needs the person: Your sites carries a quiet Signed out when a site signed them out.
// Everything that was on this page lives behind its row: the week chart, the things by state and how each live thing is doing
// at the top of Insights (app/src/you/trends.tsx); the money's parts on Payouts; signing back in on Your sites; Activity
// under Rules and limits; Records under Settings.
// Behavior: app/behavior/(tabs)/you.json.
import type { ReactNode } from 'react';
import { insights, unread } from '@/demo';
import { EmptyState, Line, List, Screen, Tag } from '@/ui';
import { Glance, type Stat } from '@/ui/parts/glance';
import { ListRow } from '@/ui/parts/list-row';
import { TabNav } from '@/ui/parts/tab-nav';
import { byState, couldEarn } from '@/you/dashboard';
import { moneyRows } from '@/you/money-steps';
import { PageStatus } from '@/you/page-status';
import { cash, drawn, PAGES, plural, SITE_ORDER, useGo, usePage, type PageKey } from '@/you/state';

export default function You() {
  const { w, asked } = usePage(), go = useGo();
  const n = insights(w);
  const things = byState(w);
  const state = drawn(w, n.sold + things.reduce((a, t) => a + t.count, 0), asked);
  // A site that signed the person out: the one thing on this page that needs them, said on the row that fixes it.
  const signedOut = SITE_ORDER.some(s => w.connections.find(c => c.site === s && c.error));
  // Money is on its way until it is in the bank or in hand (spec/edge-cases.md, the four words), as Payouts counts it.
  const onItsWay = moneyRows(w).filter(r => !r.arrived).reduce((a, r) => a + r.kept, 0);
  const live = things.find(t => t.id === 'live')?.count ?? 0;
  const stats: Stat[] = [
    ...(onItsWay > 0 ? [{ value: cash(onItsWay), word: 'On its way' }] : []),
    ...(live ? [{ value: String(live), word: 'Live' }] : []),
  ];
  const row = (page: PageKey, tag?: ReactNode) => (
    <ListRow key={page} id={`you-${page}`} lead={PAGES[page].icon} label={PAGES[page].title} trail={tag} onPress={() => go.to(`/you/${page}`)} />
  );

  return (
    <Screen name="you" state={state} wash nav={<TabNav title="You" inbox={{ count: unread(w), onPress: () => go.to('/messages') }} />}>
      <PageStatus asked={asked} what="your numbers">
      {n.sold ? (
        <Glance value={n.kept_cents / 100} what={`You got from ${plural(n.sold, 'sale', 'sales')}, after fees`} stats={stats} />
      ) : (
        <EmptyState title="Nothing sold yet" line="What you get after fees shows here." action={couldEarn(w) ? undefined : { id: 'you-sell', label: 'Sell something', onPress: () => go.to('/new') }} />
      )}

      {n.sold || things.length ? (
        <List>
          {row('insights')}
          {n.sold ? row('payouts') : null}
        </List>
      ) : null}

      <List>
        {/* Line takes the row's center line; a tag alone sets itself to the start. */}
        {row('connections', signedOut ? <Line><Tag state="failed" word="Signed out" quiet /></Line> : undefined)}
        {row('rules')}
        {row('notifications')}
        {row('settings')}
      </List>
      </PageStatus>
    </Screen>
  );
}
