// Activity: everything the agent did on its own, newest first, by day, each with why, and Undo while it can still be undone
// where it happened (README, the hand-off rule: a step the agent took shows in the log with Undo). An answer already sent
// cannot be taken back, so it shows no Undo rather than one that fails.
import { useState } from 'react';
import { day, ms } from '@/demo';
import { EmptyState, List, Nav, Pill, Screen, Section, Txt } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import {changed, drawn, PAGES, skips, useGo, useWorld } from './state';

export function Activity() {
  const w = useWorld(), go = useGo();
  const [undone, setUndone] = useState<Record<string, boolean>>({});
  const events = [...w.events].sort((a, b) => ms(b.at) - ms(a.at));
  const days = [...new Set(events.map(e => day(e.at, w.now)))];
  const title = (id: string | null) => (id && w.items.find(i => i.id === id)?.title) || 'Everything';
  const canUndo = (e: (typeof events)[number]) => e.undo.allowed && (!e.undo.until || ms(e.undo.until) > ms(w.now));
  const undo = (id: string) => { setUndone(u => ({ ...u, [id]: true })); changed('event', id, 'undone'); };

  return (
    <Screen name="you-log" state={drawn(w, events.length)} skip={skips(drawn(w, events.length), { empty: 'drawn with world=new, Nothing done for you yet', failed: 'an Undo that fails says so on its row', offline: 'Undo waits for the network and says so on its row' })} nav={<Nav back={() => go.back()} />}>
      <Txt role="heading">{PAGES.log.title}</Txt>
      {events.length ? days.map(d => (
        <Section key={d} title={d}>
          <List>
            {events.filter(e => day(e.at, w.now) === d).map(e => (
              <ListRow key={e.event_id} id={`event-${e.event_id}`} site={e.site ?? undefined} lead={e.site ? undefined : 'clock-01'} label={title(e.item_id)} detail={e.why}
                value={undone[e.event_id] ? 'Undone' : undefined}
                trail={canUndo(e) && !undone[e.event_id] ? <Pill id={`undo-${e.event_id}`} kind="second" label="Undo" onPress={() => undo(e.event_id)} /> : undefined} />
            ))}
          </List>
        </Section>
      )) : (
        <EmptyState title="Nothing done for you yet" line="What runs on its own shows here, with Undo while it can be undone." />
      )}
    </Screen>
  );
}
