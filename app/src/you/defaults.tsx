// App defaults (Ben 05:47: "the settings should have app defaults"): what a new listing starts from, each changed in one tap
// and changed again on the listing itself. How it sells is the five choices of spec/features/price.md (Selling intents; Sell
// it is the default); the lowest price is suggested from sold prices and set by the person, never by us; Clean up is on and
// Enhance with AI is off (spec/edge-cases.md §6: two kinds of photo help); replies are drafted in the person's own voice
// (spec/features/messages.md); the pickup spot is the only pickup default, with no hours (spec/edge-cases.md §16).
import { useState } from 'react';
import { connectionState, type Site } from '@/demo';
import { Blank, Guess, Line, List, Nav, Pill, Screen, Section, Sheet, Txt } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { Switch } from '@/ui/parts/switch';
import { PageStatus } from './page-status';
import { changed, drawn, PAGES, SITE_ORDER, useGo, usePage } from './state';

const PLAN = { sell: 'Sell it', fast: 'Gone fast', best: 'Best price', reserve: 'Only at my price', check: 'Just checking' } as const;
const HAND = { ship: 'Ship', pickup: 'Pickup', both: 'Ship or pickup' } as const;
const FLOOR = { suggest: 'Suggested from sold prices', ask: 'Ask me each time' } as const;
const VOICE = { you: 'Like you', plain: 'Short and plain' } as const;
const UNITS = { in: 'Inches', cm: 'Centimeters' } as const;
type Pick = 'plan' | 'sites' | 'hand' | 'floor' | 'voice' | 'units';

export function Defaults() {
  const { w, asked } = usePage(), go = useGo();
  const linked = SITE_ORDER.filter(s => { const c = w.connections.find(x => x.site === s); return c && connectionState(c) === 'connected'; });
  const [plan, setPlan] = useState<keyof typeof PLAN>('sell');
  const [sites, setSites] = useState<Record<string, boolean>>(() => Object.fromEntries(linked.map(s => [s, true])));
  const [hand, setHand] = useState<keyof typeof HAND>(w.limits.handover.length === 2 ? 'both' : w.limits.handover[0] ?? 'both');
  const [spot, setSpot] = useState(w.limits.saved_spot?.label ?? '');
  const [floor, setFloor] = useState<keyof typeof FLOOR>('suggest');
  const [clean, setClean] = useState(true);
  const [enhance, setEnhance] = useState(false);
  const [noEdits, setNoEdits] = useState(false);
  const [voice, setVoice] = useState<keyof typeof VOICE>('you');
  const [units, setUnits] = useState<keyof typeof UNITS>('in');
  const [open, setOpen] = useState<Pick | null>(null);
  const toggle = (id: string, set: (v: boolean) => void) => (next: boolean) => { set(next); changed('setting', id, next ? 'on' : 'off'); };
  // One choice from a sheet: set it, log it, close the sheet. The keys come from the words the sheet shows, so they are the state's own.
  const choose = (id: string, set: (v: never) => void) => (v: string) => { (set as (x: string) => void)(v); changed('setting', id, v); setOpen(null); };
  const pills = <K extends string>(prefix: string, words: Record<K, string>, now: K, on: (v: K) => void) => (
    <Line>{(Object.keys(words) as K[]).map(k => <Pill key={k} id={`${prefix}-${k}`} label={words[k]} kind={now === k ? 'primary' : 'second'} onPress={() => on(k)} />)}</Line>
  );
  const onSites = linked.filter(s => sites[s]).length;
  const state = drawn(w, 1, asked) === 'empty' || drawn(w, 1, asked) === 'one' ? 'typical' : drawn(w, 1, asked);

  return (
    <Screen name="you-defaults" state={state} skip="empty: every default is there from the start; one: every default is listed, never one"
      nav={<Nav back={() => go.back('/you/settings')} />}>
      <Txt role="heading">{PAGES.defaults.title}</Txt>
      <PageStatus asked={asked} what="your defaults">
        <Section title="A new listing">
          <List>
            <ListRow id="default-plan" label="How it sells" value={PLAN[plan]} onPress={() => setOpen('plan')} />
            <ListRow id="default-sites" label="Sites" value={linked.length ? `${onSites} of ${linked.length} linked` : 'None linked yet'} onPress={linked.length ? () => setOpen('sites') : () => go.to('/you/connections')} />
            <ListRow id="default-hand" label="Ship or pickup" value={HAND[hand]} onPress={() => setOpen('hand')} />
            <ListRow id="default-spot-row" label="Pickup spot" trail={<Line>{spot
              ? <Guess id="default-spot" name="Pickup spot" value={spot} look="body" onChange={v => { setSpot(v); changed('limits', 'saved_spot', 'set'); }} />
              : <Blank id="default-spot" name="A public place" look="body" onChange={v => { setSpot(v); changed('limits', 'saved_spot', 'set'); }} />}</Line>} />
            <ListRow id="default-floor" label="Lowest price" detail="You set it on each listing. Under it, it always asks" value={floor === 'suggest' ? 'Suggested' : 'Ask me'} onPress={() => setOpen('floor')} />
          </List>
        </Section>

        <Section title="Photos">
          <List>
            <ListRow id="clean-row" label="Clean up" detail={clean ? 'Straightens, crops and evens the light. The thing is never changed' : 'Photos go up as you took them'}
              trail={<Switch id="clean-up" label="Clean up" on={clean} onChange={toggle('clean_up', setClean)} />} />
            <ListRow id="enhance-row" label="Enhance with AI" detail={enhance ? 'Each enhanced photo is marked, next to the real one' : 'Off: photos are never redrawn'}
              trail={<Switch id="enhance-ai" label="Enhance with AI" on={enhance} onChange={toggle('enhance_ai', setEnhance)} />} />
            <ListRow id="edits-row" label="Never suggest photo edits" detail={noEdits ? 'Your photos go up as you took them' : 'Edits are offered, never made without you'}
              trail={<Switch id="never-edit" label="Never suggest photo edits" on={noEdits} onChange={toggle('never_suggest_edits', setNoEdits)} />} />
          </List>
        </Section>

        <Section title="Words and units">
          <List>
            <ListRow id="default-voice" label="Replies sound" value={VOICE[voice]} detail="Learned from messages you sent" onPress={() => setOpen('voice')} />
            <ListRow id="units-row" label="Measurements" value={UNITS[units]} onPress={() => setOpen('units')} />
            <ListRow id="currency-row" label="Money" value={w.user.currency === 'USD' ? 'US dollars' : w.user.currency} />
          </List>
        </Section>
      </PageStatus>

      <Sheet open={open === 'plan'} title="How it sells" onClose={() => setOpen(null)}>{pills('plan', PLAN, plan, choose('default_plan', setPlan))}</Sheet>
      <Sheet open={open === 'hand'} title="Ship or pickup" onClose={() => setOpen(null)}>{pills('hand', HAND, hand, choose('handover', setHand))}</Sheet>
      <Sheet open={open === 'floor'} title="Lowest price" onClose={() => setOpen(null)}>{pills('floor', FLOOR, floor, choose('floor_default', setFloor))}</Sheet>
      <Sheet open={open === 'voice'} title="Replies sound" onClose={() => setOpen(null)}>{pills('voice', VOICE, voice, choose('voice', setVoice))}</Sheet>
      <Sheet open={open === 'units'} title="Measurements" onClose={() => setOpen(null)}>{pills('units', UNITS, units, choose('units', setUnits))}</Sheet>
      <Sheet open={open === 'sites'} title="Sites" onClose={() => setOpen(null)}>
        <List>
          {linked.map((s: Site) => <ListRow key={s} id={`default-site-row-${s}`} site={s} label={sites[s] ? 'On' : 'Off'}
            trail={<Switch id={`default-site-${s}`} label="Post here by default" on={!!sites[s]} onChange={v => { setSites(x => ({ ...x, [s]: v })); changed('default_site', s, v ? 'on' : 'off'); }} />} />)}
        </List>
        <Txt role="caption">Only linked sites can be defaults. Each listing can still skip one.</Txt>
      </Sheet>
    </Screen>
  );
}
