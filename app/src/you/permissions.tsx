// What the agent may do (Ben 05:47: "permission defaults"): each kind of step the agent takes, and whether it does it on its own
// with Undo, asks first, or never does it. The kinds and their modes are spec/product.md §5, Who may act; the line between them is
// the hand-off rule (.agents/ui-build/README.md, When the agent acts and when it hands off). A person can always make a kind more
// careful here. Making one run on its own is earned, 3 approvals without a change, under Rules and limits, so this page never
// offers On its own to a kind that starts by asking. Locked kinds sit under Always asks you with no control, and one kind is Never.
import { useState } from 'react';
import { List, Line, Nav, Pill, Screen, Section, Sheet, Txt } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { PageStatus } from './page-status';
import { changed, drawn, PAGES, useGo, usePage } from './state';

type Mode = 'auto' | 'ask' | 'never';
const WORD: Record<Mode, string> = { auto: 'On its own', ask: 'Asks first', never: 'Never' };
type Kind = { kind: string; label: string; start: Mode; may: Mode[] };
// Kinds the person can change, with the mode each starts in (spec/product.md §5).
const KINDS: Kind[] = [
  { kind: 'answer_fact', label: 'Answer questions from your listing', start: 'auto', may: ['auto', 'ask'] },
  { kind: 'accept_offer', label: 'Accept offers at your accept-at-once price', start: 'auto', may: ['auto', 'ask'] },
  { kind: 'counter_offer', label: 'Counter offers above your lowest', start: 'auto', may: ['auto', 'ask', 'never'] },
  { kind: 'decline_offer', label: 'Answer offers under your lowest with a counter', start: 'auto', may: ['auto', 'ask', 'never'] },
  { kind: 'offer_to_watchers', label: 'Send offers to people watching', start: 'auto', may: ['auto', 'ask', 'never'] },
  { kind: 'markdown', label: 'Lower the price on its plan, above your lowest', start: 'auto', may: ['auto', 'ask', 'never'] },
  { kind: 'reply_other', label: 'Reply to other messages', start: 'ask', may: ['ask', 'never'] },
  { kind: 'buy_label', label: 'Buy a shipping label', start: 'ask', may: ['ask', 'never'] },
  { kind: 'book_pickup', label: 'Book a pickup at your spot', start: 'ask', may: ['ask', 'never'] },
  { kind: 'relist', label: 'Relist after it ends', start: 'ask', may: ['ask', 'never'] },
  { kind: 'leave_review', label: 'Leave a review', start: 'ask', may: ['ask', 'never'] },
];
// Fixed: no control, and the row says why.
const FIXED = [
  { kind: 'delist_after_sale', label: 'Take a listing down after it sells', value: 'On its own', why: 'So it can’t sell twice' },
  { kind: 'first_post', label: 'Post a new listing', value: 'Asks first', why: 'It is public in your name' },
];
const LOCKED = [
  { kind: 'price_below_floor', label: 'A price under your lowest' },
  { kind: 'share_address', label: 'Sharing your address' },
  { kind: 'refund', label: 'Refunds and payment' },
  { kind: 'identity_claim', label: 'Saying it’s genuine, or that it works' },
];

export function Permissions() {
  const { w, asked } = usePage(), go = useGo();
  const [mode, setMode] = useState<Record<string, Mode>>(() => Object.fromEntries(KINDS.map(k => {
    const rule = w.rules.find(r => r.kind === k.kind);
    return [k.kind, rule?.state === 'auto' ? 'auto' : k.start];
  })));
  const [open, setOpen] = useState<Kind | null>(null);
  const pick = (k: Kind, m: Mode) => { setMode(x => ({ ...x, [k.kind]: m })); changed('permission', k.kind, m, mode[k.kind]); setOpen(null); };
  return (
    <Screen name="you-permissions" state={drawn(w, KINDS.length, asked) === 'empty' || drawn(w, KINDS.length, asked) === 'one' ? 'typical' : drawn(w, KINDS.length, asked)}
      skip="empty: every kind is listed from the start, so the page is never empty; one: every kind is listed, never one" nav={<Nav back={() => go.back('/you/settings')} />}>
      <Txt role="heading">{PAGES.permissions.title}</Txt>
      <PageStatus asked={asked} what="what the agent may do">
        <Section>
          <List>
            {KINDS.map(k => <ListRow wrap key={k.kind} id={`perm-${k.kind}`} label={k.label} value={WORD[mode[k.kind]]} onPress={() => setOpen(k)} />)}
            {FIXED.map(k => <ListRow wrap key={k.kind} id={`perm-${k.kind}`} label={k.label} detail={k.why} value={k.value} />)}
          </List>
          <Txt role="caption">Shown in Activity, with Undo where the site allows.</Txt>
        </Section>

        <Section title="Always asks you">
          <List>{LOCKED.map(k => <ListRow wrap key={k.kind} id={`perm-${k.kind}`} label={k.label} />)}</List>
        </Section>

        <Section title="Never">
          <List><ListRow id="perm-move_off_site" label="Taking a deal off the site" detail="Paid off the site, you lose its protection" value="Never" /></List>
        </Section>

        <List>
          <ListRow id="perm-rules" lead={PAGES.rules.icon} label={PAGES.rules.title} detail="A kind that asks can run on its own after 3 approvals without a change" onPress={() => go.to('/you/rules')} />
        </List>
      </PageStatus>

      <Sheet open={open !== null} title={open?.label} onClose={() => setOpen(null)}>
        <Line>
          {open?.may.map(m => <Pill key={m} id={`mode-${m}`} label={WORD[m]} kind={mode[open.kind] === m ? 'primary' : 'second'} onPress={() => pick(open, m)} />)}
        </Line>
        {open && !open.may.includes('auto') ? <Txt role="caption">To let it run on its own, approve it 3 times without a change.</Txt> : null}
      </Sheet>
    </Screen>
  );
}
