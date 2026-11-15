// Notifications (spec/notifications.md; Ben 05:23). Every kind that can interrupt, with a switch and one example of what it
// would say, under the level it is sent at: Right away, or In the next summary. What never pushes is listed with no switch, so
// the line is visible. Grouping by item, quiet hours, and what the lock screen may do: Accept, Approve and Counter commit the
// person to a sale or a meeting, so they always need Face ID, and that row has no switch either.
import { useState } from 'react';
import { Guess, Line, List, Nav, Screen, Section, Txt } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { Switch } from '@/ui/parts/switch';
import { cash, changed, PAGES, skips, useGo, useWorld } from './state';

type Kind = { kind: string; pref?: string; label: string; says: string };
// The events table of spec/notifications.md, by level. `pref` names the kind stored on the person (user.notification_pref).
const NOW: Kind[] = [
  { kind: 'sale', pref: 'sale', label: 'It sold', says: `Sold: the Carhartt jacket. You keep ${cash(3140)}` },
  { kind: 'offer', pref: 'offer', label: 'An offer you’d take', says: `${cash(4200)} offer on the Carhartt jacket. You keep ${cash(3670)}` },
  { kind: 'deadline', pref: 'deadline', label: 'Ship by today', says: 'Ship the lamp today. The site cancels it Fri 9 am' },
  { kind: 'pickup', label: 'A pickup within the hour', says: 'Sam is coming at 6:30. Library parking lot' },
  { kind: 'claim', label: 'A return or claim', says: 'Return request: the Nike hoodie. Answer by Wed 5 pm' },
  { kind: 'delist', label: 'Still up after a sale', says: 'The lamp is still up on another site. Try again' },
  { kind: 'watch_under', label: 'A watched thing under your price', says: `Brewers jersey, size L, ${cash(4800)} delivered` },
];
const LATER: Kind[] = [
  { kind: 'message', pref: 'message', label: 'A buyer’s question', says: '“Are these real leather?” about the boots' },
  { kind: 'drafts', label: 'Replies to approve', says: '3 replies to send' },
  { kind: 'money', label: 'Money in your bank', says: `${cash(3140)} is in your bank, from the Carhartt jacket` },
  { kind: 'signin', label: 'A site signed you out', says: 'Sign in again. Your 6 listings there are paused' },
  { kind: 'watch_over', label: 'Watched things over your price', says: `4 new matches for the Brewers jersey, cheapest ${cash(6200)}` },
];
const NEVER = ['Offers under your lowest, answered for you', 'Likes, views and followers', 'What we did inside your limits'];

export function Notifications() {
  const w = useWorld(), go = useGo();
  const stored = (k: Kind) => w.user.notification_pref.find(p => p.event_kind === k.pref)?.channel;
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries([...NOW, ...LATER].map(k => [k.kind, stored(k) !== 'off'])));
  const [byItem, setByItem] = useState(true);
  const [quiet, setQuiet] = useState(true);
  const [hours, setHours] = useState({ from: '10 pm', to: '8 am' });
  const [previews, setPreviews] = useState(false);
  const flip = (k: Kind, level: 'push' | 'batch') => (next: boolean) => { setOn(o => ({ ...o, [k.kind]: next })); changed('notification_pref', k.kind, next ? level : 'off'); };
  const setting = (id: string, set: (v: boolean) => void) => (next: boolean) => { set(next); changed('setting', id, next ? 'on' : 'off'); };
  const row = (level: 'push' | 'batch') => (k: Kind) => (
    <ListRow key={k.kind} id={`notify-row-${k.kind}`} label={k.label} detail={k.says}
      trail={<Switch id={`notify-${k.kind}`} label={k.label} on={on[k.kind]} onChange={flip(k, level)} />} />
  );
  return (
    <Screen name="you-notifications" state="typical" nav={<Nav back={() => go.back()} />}
      skip={skips('typical', { new: 'every kind is listed from the first launch, with its default', empty: 'every kind is always listed', one: 'every kind is always listed', dense: 'the list is the same for every person', failed: 'a switch is saved on the phone first, so it cannot fail here', offline: 'a switch is saved on the phone and sent when it is back' })}>
      <Txt role="heading">{PAGES.notifications.title}</Txt>

      <Section title="Right away">
        <List>{NOW.map(row('push'))}</List>
      </Section>

      <Section title="In the next summary">
        <List>
          {LATER.map(row('batch'))}
          <ListRow id="notify-summary" label="Summary times" detail="At most 3 a day, moved toward when you open the app" value="9 am, 1 pm, 7 pm" />
        </List>
      </Section>

      <Section title="Never sent">
        <List>{NEVER.map((n, i) => <ListRow key={n} id={`notify-never-${i}`} label={n} />)}</List>
        <Txt role="caption">A kind you never open 3 times in a row moves to the summary, and the summary says so.</Txt>
      </Section>

      <Section title="Grouping">
        <List>
          <ListRow id="group-row" label="Group by item"
            detail={byItem ? `3 offers on the jacket come as one: 3 offers, best ${cash(4500)}` : 'Each offer and message comes on its own'}
            trail={<Switch id="group-by-item" label="Group by item" on={byItem} onChange={setting('group_by_item', setByItem)} />} />
        </List>
      </Section>

      <Section title="Quiet hours">
        <List>
          <ListRow id="quiet-row" label="Quiet hours"
            detail={quiet ? 'Only a pickup you approved gets through. A deadline inside them comes first' : 'Alerts can come at any hour'}
            trail={<Switch id="quiet-hours" label="Quiet hours" on={quiet} onChange={setting('quiet_hours', setQuiet)} />} />
          {quiet ? (
            <ListRow id="quiet-hours-row" label="From and to" trail={
              <Line>
                <Guess id="quiet-from" name="Quiet from" value={hours.from} look="body" onChange={v => { setHours(h => ({ ...h, from: v })); changed('setting', 'quiet_from', v); }} />
                <Txt role="body" tone="ink-2">to</Txt>
                <Guess id="quiet-to" name="Quiet to" value={hours.to} look="body" onChange={v => { setHours(h => ({ ...h, to: v })); changed('setting', 'quiet_to', v); }} />
              </Line>} />
          ) : null}
        </List>
      </Section>

      <Section title="On the lock screen">
        <List>
          <ListRow id="lock-commit" label="Accept, Approve and Counter" detail="They commit you to a sale or a meeting" value="Face ID" />
          <ListRow id="lock-tell" label="On my way and Running late" detail="They only tell the buyer" value="No unlock" />
          <ListRow id="lock-open" label="Print label, Reply and Open" value="Opens the app" />
          <ListRow id="previews-row" label="Show messages and addresses"
            detail={previews ? 'Anyone who sees your phone can read them' : 'The lock screen shows the item and the amount only'}
            trail={<Switch id="lock-previews" label="Show messages and addresses" on={previews} onChange={setting('lock_previews', setPreviews)} />} />
        </List>
      </Section>
    </Screen>
  );
}
