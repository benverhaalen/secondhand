// The cards (Art. 7.8). One corner, one padding, two heights, whatever is inside:
//   DecisionCard 350 by 156: a 72 row, 12, a 40 row of actions. It asks the person to decide.
//   ItemCard     350 by 104: the 72 row alone. It shows a thing and opens it.
//   Notice       350 by 56, a capsule with a chevron: it always leads somewhere.
// The 72 row reads as every card Ben picked since round 7: the photo with its site, then the kind and the time left, the
// item, and the one amount that matters in ink beside its gray label.
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Icon, type IconName } from '../icon';
import { Photo, type PhotoSrc } from '../photo';
import { Press } from '../press';
import { TAGS, type TagState } from '../states';
import { Surface } from '../surface';
import { Txt } from '../text';
import { useColors, useScheme } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { IconButton, Pill } from './buttons';
import { FLAT, mark, money, timeLeft, type Site } from './mark';
import { SiteBadge } from './small';
import { Tag } from './tag';

// The clock, read once a minute: a deadline's words and its gradient repaint at most that often (Art. 5, State gradients rule 1).
export function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  return now;
}

// A calm countdown: a 12 clock and the time left in secondary ink, never red, never pulsing (frontend-standard §5, Honesty).
function Countdown({ due, now }: { due: number; now: number }) {
  return (
    <View {...mark('countdown', { fit: 'content' })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1, ...FLAT }}>
      <Icon name="clock-01" size={12} tone="ink-2" />
      <Txt role="caption" tone="ink-2" tabular>{timeLeft(due, now)}</Txt>
    </View>
  );
}

export type Fact = { label: string; amount?: number | string };
function FactLine({ fact }: { fact: Fact }) {
  // Only the money the person keeps is in ink; its label is secondary ink (frontend-standard §5, Show don't say).
  const amount = fact.amount == null ? null : typeof fact.amount === 'number' ? money(fact.amount) : fact.amount;
  return (
    <Txt role="body" tone="ink-2" lines={1}>
      {fact.label}{amount ? ' ' : ''}{amount ? <Txt role="body" tone="ink">{amount}</Txt> : null}
    </Txt>
  );
}

// The 72 row both cards share. The countdown ends 24 from the card's right edge, so it clears the 36 corner by 16 (--card-corner).
function Body({ photo, title, site, tag, word, fact, due, now, faded, quiet }: {
  photo?: PhotoSrc | null; title: string; site?: Site; tag: TagState; word?: string; fact: Fact; due?: number; now: number; faded?: boolean; quiet?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', height: size.photoCard, gap: space.s3 }}>
      <View>
        <Photo src={photo} label={title} faded={faded} />
        {site ? <View style={{ position: 'absolute', right: -4, bottom: -4 }}><SiteBadge site={site} /></View> : null}
      </View>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: size.tagH }}>
          <Tag state={tag} word={word} quiet={quiet} />
          {due != null ? <View style={{ marginRight: size.cardCorner - size.cardPad }}><Countdown due={due} now={now} /></View> : null}
        </View>
        <Txt role="headline" lines={1}>{title}</Txt>
        <FactLine fact={fact} />
      </View>
    </View>
  );
}

export type ItemCardProps = {
  id: string;
  title: string;
  photo?: PhotoSrc | null;
  site?: Site;
  state: TagState;
  // The tag's word when it says more than the state: "Ship by Tue".
  word?: string;
  fact: Fact;
  // When it is due, in ms since 1970. Only a deadline the data carries (frontend-standard §5, Honesty).
  due?: number;
  // Under a header that names its group: the tag in gray (Tag quiet), so the group's color is not said twice (U13).
  quiet?: boolean;
  onPress?: () => void;
};

// A thing, and the way into it. The whole card is the target.
export function ItemCard({ id, title, photo, site, state, word, fact, due, quiet, onPress }: ItemCardProps) {
  const now = useMinute();
  return (
    <Press id={id} label={title} onPress={onPress} round={false}>
      <Surface kind="card" part="card-item" box={{ height: size.cardItemH, padding: size.cardPad }}>
        <Body {...{ photo, title, site, word, fact, due, now, quiet }} tag={state} faded={state === 'ended'} />
      </Surface>
    </Press>
  );
}

// What a decision is about. Its tag takes the color of the state it names; an offer on an unsold item "needs you" (Art. 5.3).
export type DecisionKind = 'need' | 'ship' | 'live' | 'paid' | 'sold' | 'stuck';
// open: waiting for the person. working: the pressed pill shows the step. done: it leaves, and the screen shows UndoToast.
// failed: it stays, says what failed, and offers Retry.
export type DecisionStatus = 'open' | 'working' | 'done' | 'failed';
export type Action = { id: string; label: string; onPress?: () => void };


export type DecisionCardProps = {
  id: string;
  kind: DecisionKind;
  // The kind, in a word: "Offer", "Ship", "Pickup", "Price".
  word: string;
  title: string;
  photo?: PhotoSrc | null;
  site?: Site;
  // The key fact: the money kept, or the deadline in words.
  fact: Fact;
  due?: number;
  // The act, the black pill (C4), and the second most likely action, the light fill (L5).
  primary: Action;
  second?: Action;
  // Everything else, named under More.
  more?: Action;
  status?: DecisionStatus;
  // While working: what it is doing now ("Printing", "2 of 3"). When failed: what failed ("The label did not print").
  step?: string;
  // single: one thing. batch: the act covers several ("Print 3 labels") and the step counts them. queue: more of the same wait under it.
  form?: 'single' | 'batch' | 'queue';
  // In a queue, how many more wait under this one. Two layers are drawn at most.
  waiting?: number;
  lead?: boolean;
  // The tag drawn quiet, its word kept: the screen says so when a header already names the state every card in it shares (U13).
  quiet?: boolean;
  onOpen?: () => void;
};

export function DecisionCard(p: DecisionCardProps) {
  const now = useMinute();
  const status = p.status ?? 'open';
  if (status === 'done') return null;
  const failed = status === 'failed';
  const hours = p.due == null ? null : (p.due - now) / 3600000;
  const working = status === 'working';
  const fact: Fact = failed ? { label: p.step ?? `Could not ${p.primary.label.toLowerCase()}` } : p.fact;
  // C4's rule for when: the lead decision and any whose clock is under 60 minutes take the black pill; every other one,
  // failed or not, leads with the light fill, so a feed of ten offers is not ten black pills.
  const act = p.lead || (hours != null && hours < 1) ? 'primary' : 'second';
  const card = (
      <Surface kind="card" part="card-decision" box={{ height: size.cardDecisionH, padding: size.cardPad, gap: space.s3 }}>
        <Press id={`${p.id}-open`} label={p.title} onPress={p.onOpen} round={false}>
          <Body photo={p.photo} title={p.title} site={p.site} tag={failed ? 'failed' : p.kind} word={failed ? TAGS.failed.word : p.word} fact={fact} due={failed ? undefined : p.due} now={now} quiet={p.quiet && !failed} />
        </Press>
        <View style={{ flexDirection: 'row', height: size.pillCardH, gap: space.s2 }}>
          <Pill id={p.primary.id} kind={act} label={failed ? 'Retry' : p.primary.label} icon={failed ? 'refresh' : undefined} state={working ? 'working' : 'idle'} step={p.step} onPress={p.primary.onPress} />
          {p.second ? <Pill id={p.second.id} kind="second" label={p.second.label} state={working ? 'disabled' : 'idle'} onPress={p.second.onPress} /> : null}
          {p.more ? <IconButton id={p.more.id} icon="more-horizontal" label={p.more.label} onPress={p.more.onPress} /> : null}
        </View>
      </Surface>
  );
  if (p.form !== 'queue' || !p.waiting) return card;
  return <Queue layers={Math.min(2, p.waiting)}>{card}</Queue>;
}

// A queue is drawn as a stack: the layers under the card at 75% then 40%, scaled .97 and .93, each 12 lower, with the
// one blur the app allows under them, in light only (Art. 9.2, --shadow-stack; Ben: "some sort of depth with shadows").
function Queue({ layers, children }: { layers: number; children: ReactNode }) {
  const c = useColors(), scheme = useScheme();
  const layer = (i: number) => (
    <View key={i} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: space.s3 * (i + 1), height: size.cardDecisionH, borderRadius: radius.card, borderCurve: 'continuous',
      backgroundColor: c.surface, opacity: i === 0 ? 0.75 : 0.4, transform: [{ scale: i === 0 ? 0.97 : 0.93 }],
      ...(scheme === 'dark' ? { borderWidth: 1, borderColor: c.cardEdge } : { boxShadow: `0 6px 14px ${c.stackShade}` }) }} />
  );
  return (
    <View {...mark('card-stack')} style={{ paddingBottom: space.s3 * layers }}>
      {Array.from({ length: layers }, (_, i) => layer(layers - 1 - i))}
      {children}
    </View>
  );
}

// One row that leads somewhere, and the chevron says so (frontend-standard §5). need: a marigold tint, when it asks for the person.
export function Notice({ id, icon, text, tone = 'plain', onPress }: { id: string; icon: IconName; text: string; tone?: 'plain' | 'need'; onPress?: () => void }) {
  const c = useColors();
  return (
    <Press id={id} onPress={onPress}>
      {({ pressed }) => (
        <View
          {...mark('notice', { tone })}
          style={{ height: size.noticeH, borderRadius: radius.pill, borderCurve: 'continuous', paddingLeft: space.s4, paddingRight: space.s3, flexDirection: 'row', alignItems: 'center', gap: space.s3,
            backgroundColor: tone === 'need' ? c.marigoldTint : pressed ? c.gray : c.surface, borderWidth: tone === 'need' ? 0 : 1, borderColor: c.cardEdge }}>
          <Icon name={icon} tone={tone === 'need' ? 'on-color' : 'ink'} />
          <View style={{ flex: 1 }}><Txt role="body" tone={tone === 'need' ? 'on-color' : 'ink'} lines={1}>{text}</Txt></View>
          <Icon name="arrow-right-01" size={20} tone={tone === 'need' ? 'on-color' : 'ink-2'} />
        </View>
      )}
    </Press>
  );
}
