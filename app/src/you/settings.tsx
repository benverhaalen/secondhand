// Settings (spec/pages.md §6.16 Notifications, Account; spec/ways-out.md "I'm away for two weeks", "Not at night",
// "Don't edit my photos", "Inches, not centimetres", "Get me out"). Each row is one switch or one choice, and says what it changes.
//   Pause selling uses each site's own away mode; where a site has none the listing ends and a card asks to bring it back on
//   the date, never on Poshmark, whose own hold is used. Sold things still ship, and the row says so.
//   Delete account is refused while a sale is open (a claim, a return, a dispute), the same rule as deleting an item.
import { useState } from 'react';
import { inDays, day } from '@/demo';
import { Approve, Guess, Line, List, Nav, Pill, Screen, Section, Sheet, Txt } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { Switch } from '@/ui/parts/switch';
import { changed, drawn, PAGES, plural, useGo, useWorld } from './state';

type Channel = 'push' | 'batch' | 'off';
const CHANNEL: Record<Channel, string> = { push: 'Right away', batch: 'In a batch', off: 'Off' };
// The kinds that can interrupt, in the order of what they cost to miss (spec/features/insights.md, Notification cadence).
const KINDS = [
  { kind: 'offer', label: 'Offers' }, { kind: 'sale', label: 'Sales' }, { kind: 'deadline', label: 'Deadlines' },
  { kind: 'message', label: 'Messages' }, { kind: 'digest', label: 'Daily summary' },
];
const UNITS = { in: 'Inches', cm: 'Centimeters' } as const;
const OPEN_SALE = ['paid', 'pickup_booked', 'to_ship', 'shipped', 'delivered', 'claim_window', 'return_open', 'dispute_open'];
const PROVIDER = { apple: 'Apple', google: 'Google', email: 'Email' } as const;

export function Settings() {
  const w = useWorld(), go = useGo();
  const [paused, setPaused] = useState(false);
  const [until, setUntil] = useState(day(inDays(14, w.now), w.now));
  const [quiet, setQuiet] = useState(false);
  const [hours, setHours] = useState({ from: '10 pm', to: '8 am' });
  const [noEdits, setNoEdits] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, Channel>>(() => Object.fromEntries(KINDS.map(k => [k.kind, (w.user.notification_pref.find(p => p.event_kind === k.kind)?.channel ?? (k.kind === 'digest' ? 'off' : 'push')) as Channel])));
  const [units, setUnits] = useState<keyof typeof UNITS>('in');
  const [sheet, setSheet] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [deleting, setDeleting] = useState<'ready' | 'working'>('ready');
  const openSales = w.orders.filter(o => o.kind === 'sale' && OPEN_SALE.includes(o.state)).length;
  const liveListings = w.items.flatMap(i => i.listings).filter(l => l.state === 'live').length;
  const toggle = (id: string, set: (v: boolean) => void) => (next: boolean) => { set(next); changed('setting', id, next ? 'on' : 'off'); };
  const pick = (kind: string, ch: Channel) => { setPrefs(p => ({ ...p, [kind]: ch })); changed('notification_pref', kind, ch); setSheet(null); };
  const kind = KINDS.find(k => k.kind === sheet);

  return (
    <Screen name="you-settings" state={drawn(w, w.items.length)} nav={<Nav back={() => go.back()} />}>
      <Txt role="heading">{PAGES.settings.title}</Txt>

      <List>
        <ListRow id="pause-row" label="Pause selling"
          detail={paused ? `Back on ${until}. Sold things still need to ship` : 'Sites use their own away mode. The rest end and come back on your date'}
          trail={<Switch id="pause-selling" label="Pause selling" on={paused} onChange={toggle('pause_selling', setPaused)} />} />
        {paused ? <ListRow id="pause-until-row" label="Back on" trail={<Line><Guess id="pause-until" name="Back on" value={until} look="body" onChange={v => { setUntil(v); changed('setting', 'paused_until', v); }} /></Line>} /> : null}
        <ListRow id="quiet-row" label="Quiet hours"
          detail={quiet ? `No alerts from ${hours.from} to ${hours.to}. A deadline inside them comes before` : 'Alerts can come at any hour'}
          trail={<Switch id="quiet-hours" label="Quiet hours" on={quiet} onChange={toggle('quiet_hours', setQuiet)} />} />
        {quiet ? (
          <ListRow id="quiet-hours-row" label="From and to" trail={
            <Line>
              <Guess id="quiet-from" name="Quiet from" value={hours.from} look="body" onChange={v => { setHours(h => ({ ...h, from: v })); changed('setting', 'quiet_from', v); }} />
              <Txt role="body" tone="ink-2">to</Txt>
              <Guess id="quiet-to" name="Quiet to" value={hours.to} look="body" onChange={v => { setHours(h => ({ ...h, to: v })); changed('setting', 'quiet_to', v); }} />
            </Line>} />
        ) : null}
        <ListRow id="edits-row" label="Never suggest photo edits"
          detail={noEdits ? 'Your photos go up as you took them' : 'Edits are offered, never made without you'}
          trail={<Switch id="never-edit" label="Never suggest photo edits" on={noEdits} onChange={toggle('never_suggest_edits', setNoEdits)} />} />
      </List>

      <Section title="Notifications">
        <List>
          {KINDS.map(k => <ListRow key={k.kind} id={`notify-${k.kind}`} label={k.label} value={CHANNEL[prefs[k.kind]]} onPress={() => setSheet(k.kind)} />)}
        </List>
      </Section>

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

      <Sheet open={!!kind} title={kind?.label} onClose={() => setSheet(null)}>
        <Line>
          {(Object.keys(CHANNEL) as Channel[]).map(ch => <Pill key={ch} id={`channel-${ch}`} label={CHANNEL[ch]} kind={kind && prefs[kind.kind] === ch ? 'primary' : 'second'} onPress={() => kind && pick(kind.kind, ch)} />)}
        </Line>
      </Sheet>

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
