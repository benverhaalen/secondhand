// Rules and limits (spec/pages.md §6.16 Automation; decisions: automation runs in tiers that learn, buyers are handled inside
// limits you set, always-accept counts unedited approvals only). Three things, each a plain switch or field that says what it changes:
//   what runs on its own: a switch per rule. A kind can be turned on once it was approved 3 times without a change.
//   what always asks: the never-alone kinds, shown so the person sees the line the agent never crosses. No switch.
//   each live thing's limits: the lowest it takes without asking (the floor) and the offer it accepts at once (the top line).
//     A price is set only on the person's tap (README, the hand-off rule), so the sheet ends in Approve.
import { useState } from 'react';
import type { Item } from '@/demo';
import { Approve, Guess, Line, List, Nav, Screen, Section, Sheet, Stack, Txt } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { Switch } from '@/ui/parts/switch';
import {cash, changed, drawn, PAGES, PROMOTE_AT, ruleName, ruleSentence, skips, useGo, useWorld } from './state';

// Never alone (decisions: tiers that learn), and a price under the floor (decisions: a price below your floor always asks).
const ALWAYS_ASKS = [
  { id: 'ask-floor', label: 'Any price under your lowest' },
  { id: 'ask-address', label: 'Sharing your address' },
  { id: 'ask-payment', label: 'Anything about payment' },
  { id: 'ask-off-site', label: 'Deals off the site' },
];
const cents = (typed: string) => { const v = Number(typed.replace(/[^0-9.]/g, '')); return typed.trim() && Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null; };

export function Rules() {
  const w = useWorld(), go = useGo();
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(w.rules.map(r => [r.id, r.state === 'auto'])));
  const [limits, setLimits] = useState<Record<string, { floor: number; top: number | null }>>(() =>
    Object.fromEntries(w.items.filter(i => i.limits).map(i => [i.id, { floor: i.limits!.floor_cents, top: i.limits!.always_accept_cents }])));
  const [editing, setEditing] = useState<Item | null>(null);
  const [draft, setDraft] = useState<{ floor: string; top: string }>({ floor: '', top: '' });
  const [saved, setSaved] = useState<'ready' | 'done'>('ready');
  const live = w.items.filter(i => (i.state === 'live' || i.state === 'stale') && limits[i.id]);

  const flip = (id: string, next: boolean) => { setOn(o => ({ ...o, [id]: next })); changed('rule', id, next ? 'auto' : 'ask', next ? 'ask' : 'auto'); };
  const open = (i: Item) => { const l = limits[i.id]; setDraft({ floor: cash(l.floor), top: l.top ? cash(l.top) : '' }); setSaved('ready'); setEditing(i); };
  const floor = cents(draft.floor), top = cents(draft.top);
  const valid = floor !== null && (top === null || top >= floor);
  const save = () => {
    if (!editing || floor === null) return;
    const was = limits[editing.id];
    setLimits(l => ({ ...l, [editing.id]: { floor, top } }));
    changed('limits', editing.id, `${floor}/${top ?? ''}`, `${was.floor}/${was.top ?? ''}`);
    setSaved('done');
  };
  const undoSave = () => { if (!editing) return; const i = editing.limits!; setLimits(l => ({ ...l, [editing.id]: { floor: i.floor_cents, top: i.always_accept_cents } })); changed('limits', editing.id, 'undone'); setSaved('ready'); };
  const line = (l: { floor: number; top: number | null }) => l.top ? `Takes ${cash(l.top)} or more at once. Asks you under ${cash(l.floor)}` : `Asks you about any offer under ${cash(l.floor)}`;

  return (
    <Screen name="you-rules" state={drawn(w, w.rules.length)} skip={skips(drawn(w, w.rules.length), { empty: 'drawn with world=new, where no rule has been approved yet', failed: 'a switch or a price is saved on the phone first; a save that fails says so on its button', offline: 'a switch is saved on the phone and sent when it is back' })} nav={<Nav back={() => go.back()} />}>
      <Txt role="heading">{PAGES.rules.title}</Txt>

      <Section title="Runs on its own">
        {w.rules.length ? (
          <List>
            {w.rules.map(r => {
              const ready = r.state === 'eligible' || r.state === 'auto' || r.unedited_approvals >= PROMOTE_AT;
              const detail = on[r.id] ? ruleSentence(r) : ready
                ? `Approved ${PROMOTE_AT} times without a change. Turn on to let it run`
                : `Asks you first. Approved ${r.unedited_approvals} of ${PROMOTE_AT} times without a change`;
              return <ListRow key={r.id} id={`rule-${r.id}`} label={ruleName(r)} detail={detail}
                trail={<Switch id={`rule-switch-${r.id}`} label={ruleName(r)} on={on[r.id]} disabled={!on[r.id] && !ready} onChange={next => flip(r.id, next)} />} />;
            })}
          </List>
        ) : (
          <Txt role="body" tone="ink-2">Approve the same kind of card {PROMOTE_AT} times without a change, and it can run on its own here.</Txt>
        )}
      </Section>

      <Section title="Always asks you">
        <List>{ALWAYS_ASKS.map(a => <ListRow key={a.id} id={a.id} label={a.label} />)}</List>
      </Section>

      {live.length ? (
        <Section title="Lowest prices">
          <List>
            {live.map(i => <ListRow key={i.id} id={`limit-${i.id}`} label={i.title} detail={line(limits[i.id])} onPress={() => open(i)} />)}
          </List>
        </Section>
      ) : null}

      <Sheet open={editing !== null} title={editing?.title} onClose={() => setEditing(null)}>
        <Stack>
          <ListRow id="limit-floor-row" label="Lowest you’d take" detail="Under this, it always asks you"
            trail={<Line><Guess id="limit-floor" name="Lowest you’d take" value={draft.floor} numeric changed={saved === 'done'} look="body" onChange={v => setDraft(d => ({ ...d, floor: v }))} /></Line>} />
          <ListRow id="limit-top-row" label="Accept at once at" detail="An offer this high is taken without asking"
            trail={<Line><Guess id="limit-top" name="Accept at once at" value={draft.top} numeric changed={saved === 'done'} look="body" onChange={v => setDraft(d => ({ ...d, top: v }))} /></Line>} />
          {!valid ? <Txt role="caption">The accept line can’t be under your lowest.</Txt> : null}
        </Stack>
        <Approve id="limit-save" does={floor !== null ? `Save ${cash(floor)}${top !== null ? ` and ${cash(top)}` : ''}` : 'Save'} status={saved}
          done="Saved" onApprove={valid ? save : undefined} onUndo={undoSave} />
      </Sheet>
    </Screen>
  );
}
