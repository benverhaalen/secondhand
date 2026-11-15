import { DataStatus } from '@/data/status';
import { useScreen } from '@/demo/screen';
import { useState, type ReactNode } from 'react';
import { SegmentedControl } from '@/ui/parts/segmented-control';
import { DashboardPager } from '@/ui/parts/dashboard-pager';
import { Trends } from '@/you/trends';
import { BySite } from '@/you/by-site';
import { Settings } from '@/you/settings';
import { insights, unread } from '@/demo';
import { EmptyState, Line, List, Screen, Tag } from '@/ui';
import { Glance, type Stat } from '@/ui/parts/glance';
import { ListRow } from '@/ui/parts/list-row';
import { TabNav } from '@/ui/parts/tab-nav';
import { byState, couldEarn } from '@/you/dashboard';
import { moneyRows } from '@/you/money-steps';
import { PageStatus } from '@/you/page-status';
import { cash, drawn, PAGES, plural, SITE_ORDER, useGo, type PageKey } from '@/you/state';

export default function You() {
  const [tab, setTab] = useState('dashboard');
  const { w, state: asked, demo, refresh, refreshing, problems } = useScreen(), go = useGo();
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
    <Screen name="you" state={state} refreshing={refreshing} onRefresh={demo ? undefined : refresh} wash nav={<TabNav title="You" inbox={{ count: unread(w), onPress: () => go.to('/messages') }} />}>
      <SegmentedControl id="you-view" value={tab} onChange={setTab} options={[{ id: 'dashboard', label: 'Dashboard' }, { id: 'settings', label: 'Settings' }]} />
      {tab === 'dashboard' ? <>
      <DashboardPager pages={[
        { id: 'things', title: 'Your things', content: <>
          <DataStatus demo={demo} resources={['account', 'orders', 'items']} />
          <PageStatus asked={asked} what="your things"><Trends w={w} go={go} section="things" /></PageStatus>
        </> },
        { id: 'performance', title: 'How they’re doing', content: <>
          <DataStatus demo={demo} resources={['orders', 'items']} />
          <PageStatus asked={asked} what="your numbers">
            <Trends w={w} go={go} section="performance" />
            {n.sold ? <Glance value={n.kept_cents / 100} what={`You got from ${plural(n.sold, 'sale', 'sales')}, after fees`} stats={stats} />
              : !demo && (problems.orders || problems.items) ? null : <EmptyState title="Nothing sold yet" line="What you get after fees shows here." action={couldEarn(w) ? undefined : { id: 'you-sell', label: 'Sell something', onPress: () => go.to('/new') }} />}
            <Trends w={w} go={go} section="sales" />
            {n.sold ? <List>{row('payouts')}</List> : null}
          </PageStatus>
        </> },
        { id: 'sites', title: 'By site', content: <><DataStatus demo={demo} resources={['orders', 'account']} /><BySite embedded section="sites" /></> },
        { id: 'worth', title: 'What your things are worth', content: <><DataStatus demo={demo} resources={['items']} /><BySite embedded section="worth" /></> },
        { id: 'goals', title: 'Goals', content: <><DataStatus demo={demo} resources={['account', 'orders']} /><BySite embedded section="goals" readOnlyGoal={!demo} /></> },
      ]} />
      </> : <>
        <List>
          {row('connections', signedOut ? <Line><Tag state="failed" word="Signed out" quiet /></Line> : undefined)}
          {row('rules')}
        </List>
        <Settings embedded />
      </>}
    </Screen>
  );
}
