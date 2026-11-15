// Settings (spec/pages.md §6.16 Account; spec/ways-out.md "I'm away for two weeks", "Don't edit my photos", "Inches, not
// centimetres", "Get me out"). Each row is one switch or one choice, and says what it changes. Quiet hours and every kind of
// alert live on Notifications (spec/notifications.md), one row away.
//   Pause selling uses each site's own away mode; where a site has none the listing ends and a card asks to bring it back on
//   the date, never on Poshmark, whose own hold is used. Sold things still ship, and the row says so.
//   Delete account is refused while a sale is open (a claim, a return, a dispute), the same rule as deleting an item.
import { useState } from 'react';
import { inDays, day } from '@/demo';
import { Approve, Guess, Line, List, Nav, Pill, Screen, Section, Sheet, Txt } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { Switch } from '@/ui/parts/switch';
import { changed, drawn, PAGES, plural, skips, useGo, useWorld } from './state';

const UNITS = { in: 'Inches', cm: 'Centimeters' } as const;
const OPEN_SALE = ['paid', 'pickup_booked', 'to_ship', 'shipped', 'delivered', 'claim_window', 'return_open', 'dispute_open'];
const PROVIDER = { apple: 'Apple', google: 'Google', email: 'Email' } as const;

export function Settings() {
  const w = useWorld(), go = useGo();
  const [paused, setPaused] = useState(false);
  const [until, setUntil] = useState(day(inDays(14, w.now), w.now));
  const [noEdits, setNoEdits] = useState(false);
  const [units, setUnits] = useState<keyof typeof UNITS>('in');
  const [sheet, setSheet] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [deleting, setDeleting] = useState<'ready' | 'working'>('ready');
  const openSales = w.orders.filter(o => o.kind === 'sale' && OPEN_SALE.includes(o.state)).length;
  const liveListings = w.items.flatMap(i => i.listings).filter(l => l.state === 'live').length;
  const toggle = (id: string, set: (v: boolean) => void) => (next: boolean) => { set(next); changed('setting', id, next ? 'on' : 'off'); };
  const d = drawn(w, w.items.length), state = d === 'empty' || d === 'one' ? 'typical' : d;

  return (
    <Screen name="you-settings" state={state} nav={<Nav back={() => go.back()} />}
      skip={skips(state, { empty: 'every setting is there from the start, so the page is never empty', one: 'the page lists every setting, never one', failed: 'a switch is saved on the phone first, so it cannot fail here', offline: 'a switch is saved on the phone and sent when it is back' })}>
      <Txt role="heading">{PAGES.settings.title}</Txt>

      <List>
        <ListRow id="pause-row" label="Pause selling"
          detail={paused ? `Back on ${until}. Sold things still need to ship` : 'Sites use their own away mode. The rest end and come back on your date'}
          trail={<Switch id="pause-selling" label="Pause selling" on={paused} onChange={toggle('pause_selling', setPaused)} />} />
        {paused ? <ListRow id="pause-until-row" label="Back on" trail={<Line><Guess id="pause-until" name="Back on" value={until} look="body" onChange={v => { setUntil(v); changed('setting', 'paused_until', v); }} /></Line>} /> : null}
        <ListRow id="edits-row" label="Never suggest photo edits"
          detail={noEdits ? 'Your photos go up as you took them' : 'Edits are offered, never made without you'}
          trail={<Switch id="never-edit" label="Never suggest photo edits" on={noEdits} onChange={toggle('never_suggest_edits', setNoEdits)} />} />
      </List>

      <List>
        <ListRow id="settings-notifications" lead={PAGES.notifications.icon} label={PAGES.notifications.title} onPress={() => go.to('/you/notifications')} />
      </List>

      <Section title="Units">
        <List>
          <ListRow id="units-row" label="Measurements" value={UNITS[units]} onPress={() => setSheet('units')} />
          <ListRow id="currency-row" label="Money" value={w.user.currency === 'USD' ? 'US dollars' : w.user.currency} />
        </List>
      </Section>

      <Section title="Account">
        <List>
          <ListRow id="signin-row" label="Signed in with" value={w.user.auth_methods.map(a => PROVIDER[a.provider]).join(', ')} />
          <ListRow id="export-row" label="Export your data" value={exported ? 'Preparing' : undefined} onPress={() => { setExported(true); changed('account_data', w.user.id, 'export_requested'); }} />
          <ListRow id="signout-row" label="Sign out" onPress={() => setSheet('signout')} />
          <ListRow id="delete-row" label="Delete account" tone="brick" lead="alert-02" onPress={() => setSheet('delete')} />
        </List>
      </Section>

      <Sheet open={sheet === 'units'} title="Measurements" onClose={() => setSheet(null)}>
        <Line>
          {(Object.keys(UNITS) as (keyof typeof UNITS)[]).map(u => <Pill key={u} id={`units-${u}`} label={UNITS[u]} kind={units === u ? 'primary' : 'second'} onPress={() => { setUnits(u); changed('setting', 'units', u); setSheet(null); }} />)}
        </Line>
      </Sheet>

      <Sheet open={sheet === 'signout'} title="Sign out" onClose={() => setSheet(null)}>
        <Txt role="body" tone="ink-2">Your listings stay up and the agent keeps to your rules.</Txt>
        <Approve id="signout-confirm" does="Sign out" onApprove={() => { changed('session', w.user.id, 'signed_out'); setSheet(null); go.to('/onboarding'); }} />
      </Sheet>

      <Sheet open={sheet === 'delete'} title="Delete account" onClose={() => setSheet(null)}>
        {openSales ? (
          <Txt role="body">{`${plural(openSales, 'sale is', 'sales are')} still open. You can delete once ${openSales === 1 ? 'it is' : 'they are'} done.`}</Txt>
        ) : (
          <>
            <Txt role="body" tone="ink-2">Ends your listings first, then deletes your things, photos and history. Each site keeps its own record of past sales.</Txt>
            <Approve id="delete-confirm" does={liveListings ? `Delete and end ${plural(liveListings, 'listing', 'listings')}` : 'Delete account'} status={deleting} step="Deleting"
              onApprove={() => { setDeleting('working'); changed('account', w.user.id, 'delete_requested'); }} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
