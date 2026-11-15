// A conversation with a buyer, as people already read one in Messages and every marketplace inbox (copy.md: a message
// thread borrows iMessage). Four parts, because nothing in the kit holds words that someone else wrote:
//   ThreadRow  one conversation in the list: 350 by 96, the card's 72 row so a thread reads like every other thing.
//   Message    one message. Theirs on the left in gray, yours on the right on the card's white; its height follows its words.
//   Draft      the reply the agent wrote and holds for a tap, with every guessed word dotted until the person changes it.
//   Composer   the person's own words: every thread is fully writable (spec/ways-out.md §6.3).
import { useState, type ReactNode } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { FACE } from '../fonts';
import { Icon, type IconName } from '../icon';
import { Photo, type PhotoSrc } from '../photo';
import { Press } from '../press';
import { Txt } from '../text';
import { OnGround, useColors } from '../theme';
import { radius, size, space, type, weight } from '../tokens.generated';
import { Pill } from './buttons';
import { FLAT, mark, type Site } from './mark';
import { Count, SiteBadge } from './small';
import { Tag } from './tag';
import type { TagState } from '../states';

// A row is the 72 row plus 12 above and below: the List's hairline sits 12 from the photo, as a card's edge sits 16.
const ROW_H = size.photoCard + space.s3 * 2;

// One conversation. Line one says what the agent needs or did (a tag when it needs the person, a quiet caption when it
// answered for them) with the time at the right; line two is who; line three is their last words. The whole row opens it.
export function ThreadRow({ id, who, photo, title, site, need, did, last, mine, time, unread, onPress }: {
  id: string;
  // The buyer's name on the site.
  who: string;
  photo?: PhotoSrc | null;
  // The item's title, for the photo's label.
  title: string;
  site: Site;
  // What waits for the person: the tag's state and word ("Offer", "Possible scam"). Nothing waits: leave it out.
  need?: { state: TagState; word: string };
  // What the agent did last, when nothing waits: "Sent for you".
  did?: string;
  last: string;
  // The last words are the person's (or sent for them): they read as already seen.
  mine?: boolean;
  // When the last message came: "3h ago".
  time: string;
  unread: number;
  onPress?: () => void;
}) {
  const fresh = unread > 0 && !mine;
  return (
    <Press id={id} label={`${who}, ${title}`} onPress={onPress} round={false}>
      <View {...mark('thread-row')} style={{ height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
        <View>
          <Photo src={photo} label={title} />
          <View style={{ position: 'absolute', right: -4, bottom: -4 }}><SiteBadge site={site} /></View>
        </View>
        <View style={{ flex: 1, height: size.photoCard, justifyContent: 'space-between' }}>
          <View style={{ height: size.tagH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s2 }}>
            {need ? <Tag state={need.state} word={need.word} /> : <Txt role="caption" lines={1}>{did ?? ''}</Txt>}
            <View style={FLAT}><Txt role="caption" tabular>{time}</Txt></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
            <View style={{ flex: 1 }}><Txt role="headline" lines={1}>{who}</Txt></View>
            <Count n={unread} />
          </View>
          <Txt role="body" tone={fresh ? 'ink' : 'ink-2'} lines={1}>{last}</Txt>
        </View>
      </View>
    </Press>
  );
}

// One message. Theirs sits left on gray, as every chat app draws the other person; yours sits right on the card's white
// with its 1 px edge, since black is kept for the act (C4) and color for states. Both carry a 1 px edge (theirs a clear one),
// so the words of every message, and of the draft, start on one line (B36). The corner is the 20 of photos and
// sheets; a one-line bubble is 38 tall, so it reads as a capsule. `meta` is the line under it: the time, or "Sent for you".
// With onPress the whole message opens what is behind it (an automatic message's why), as tapping a message in iMessage
// shows its details. Only the filled bubble is pressed, so the fill covers what is pressable (U1) and the caption under it
// stays a caption.
// Not marked as a part: a message is as tall as its words, so B31's one-size rule does not apply to it.
export function Message({ side, children, meta, id, label, onPress }: {
  side: 'theirs' | 'mine'; children: ReactNode; meta?: ReactNode; id?: string; label?: string; onPress?: () => void;
}) {
  const c = useColors();
  const theirs = side === 'theirs';
  const fill = (
    <OnGround ground={theirs ? 'page' : 'card'}>
      <View style={{ borderRadius: radius.photo, borderCurve: 'continuous', paddingHorizontal: space.s4, paddingVertical: space.s2, backgroundColor: theirs ? c.gray : c.surface,
        borderWidth: 1, borderColor: theirs ? 'transparent' : c.cardEdge }}>
        <Txt role="body">{children}</Txt>
      </View>
    </OnGround>
  );
  return (
    <View style={{ alignSelf: theirs ? 'flex-start' : 'flex-end', maxWidth: '84%', alignItems: theirs ? 'flex-start' : 'flex-end', gap: space.s1 }}>
      {onPress && id ? <Press id={id} label={label} onPress={onPress} round={false}>{fill}</Press> : fill}
      {meta}
    </View>
  );
}

// The line under a message: when it came, or that it was sent for you. `info` adds the icon that says the message opens why.
export function Meta({ text, icon, info }: { text: string; icon?: IconName; info?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1, ...FLAT }}>
      {icon ? <Icon name={icon} size={12} tone="ink-2" /> : null}
      <Txt role="caption">{text}</Txt>
      {info ? <Icon name="information-circle" size={12} tone="ink-2" /> : null}
    </View>
  );
}

export type Span = { text: string; guess?: boolean; mine?: boolean };

// Rewrites the marks after the person edits the words: the run they changed is theirs (solid), a guess they did not touch
// stays dotted, and a guess they edited is theirs. One edit is one run, found from the common start and end.
export function remark(spans: Span[], next: string): Span[] {
  const before = spans.map(s => s.text).join('');
  if (next === before) return spans;
  let a = 0; while (a < before.length && a < next.length && before[a] === next[a]) a++;
  let b = 0; while (b < before.length - a && b < next.length - a && before[before.length - 1 - b] === next[next.length - 1 - b]) b++;
  // A guess the edit touches becomes the person's whole: widen the run to take it in.
  let lo = a, hi = before.length - b, at = 0;
  for (const s of spans) {
    const from = at, to = at + s.text.length; at = to;
    if (s.guess && ((from < hi && to > lo) || (lo === hi && from < lo && lo < to))) { lo = Math.min(lo, from); hi = Math.max(hi, to); }
  }
  const cut = (x: number, y: number): Span[] => {
    const out: Span[] = []; let p = 0;
    for (const s of spans) { const from = p, to = p + s.text.length; p = to; const f = Math.max(from, x), t = Math.min(to, y); if (t > f) out.push({ ...s, text: s.text.slice(f - from, t - from) }); }
    return out;
  };
  const run = next.slice(lo, next.length - (before.length - hi));
  return [...cut(0, lo), ...(run ? [{ text: run, mine: true }] : []), ...cut(hi, before.length)];
}

// A dotted underline on a guessed word, solid on a word the person changed (assist.md, Guess). React Native draws only a
// solid text underline on iOS, so the line is the text's own decoration where the platform draws dots (web, iOS), and the
// word keeps its ink everywhere. The words are not each a button: the whole draft is (one big target, as Guess's 44 asks).
function Words({ spans }: { spans: Span[] }) {
  const c = useColors();
  const base = { fontFamily: `${FACE.text}`, fontWeight: Platform.OS === 'web' || !FACE.text ? weight.text : undefined, fontSize: type.t18.fontSize, lineHeight: type.t18.lineHeight, color: c.ink } as const;
  return (
    <Text style={base}>
      {spans.map((s, i) => s.guess || s.mine
        ? <Text key={i} {...({ dataSet: { mark: s.mine ? 'person' : 'agent' } } as object)}
            style={{ textDecorationLine: 'underline', textDecorationStyle: s.mine ? 'solid' : 'dotted', textDecorationColor: s.mine ? c.ink : c.ink2 } as object}>{s.text}</Text>
        : <Text key={i}>{s.text}</Text>)}
    </Text>
  );
}

export type DraftStatus = 'ready' | 'editing' | 'sending' | 'sent' | 'failed';

// The reply the agent wrote, in place where the person's next message would go, with the three ways to answer it:
// Send it, Edit it, or Take over, which puts it away and opens an empty composer (ways-out §6.3: replies start as drafts,
// and Take over stops automatic replies in the thread until the person hands it back). Under the words, a chip for each
// fact the reply states, with where it came from, so the person checks the source and not only the sentence (Ben, 05:18).
// `hold` keeps Send off while something above asks first (a meetup after dark). `lead` gives Send the black pill
// when this is the one decision in the view (C4 rule 2); otherwise Send takes the light fill (rule 3).
// Not marked as a part, as a Message is not: a draft is as tall as its words (B31).
export function Draft({ id, who, spans, facts = [], status = 'ready', lead = true, hold = false, failed, onSend, onChange, onMine }: {
  id: string;
  // Who it goes to, for the label above it: "Draft to canvasfan".
  who: string;
  spans: Span[];
  // The facts the reply states and their sources: { text: '35 in measured', from: 'your tape' }.
  facts?: readonly { text: string; from: string }[];
  hold?: boolean;
  status?: DraftStatus;
  lead?: boolean;
  // What failed, when status is failed: "The site did not answer".
  failed?: string;
  onSend?: () => void;
  onChange?: (spans: Span[]) => void;
  onMine?: () => void;
}) {
  const c = useColors();
  const [editing, setEditing] = useState(status === 'editing');
  const [text, setText] = useState(spans.map(s => s.text).join(''));
  const edit = () => { setText(spans.map(s => s.text).join('')); setEditing(true); };
  const done = () => { setEditing(false); onChange?.(remark(spans, text)); };
  const sending = status === 'sending';
  // Not sent yet: the dashed edge of a thing still being written, the card's white inside, the bubble's corner.
  const box = { borderRadius: radius.photo, borderCurve: 'continuous', paddingHorizontal: space.s4, paddingVertical: space.s3, gap: space.s2, backgroundColor: c.surface, borderWidth: 1, borderStyle: 'dashed' } as const;
  // Who it goes to, inside the box, with the pencil that says it is still being written and can be changed.
  const label = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1 }}>
      <Icon name="pencil-edit-02" size={12} tone="ink-2" />
      <Txt role="caption" lines={1}>{`Draft to ${who}`}</Txt>
    </View>
  );
  return (
    <View accessibilityState={{ busy: status === 'sending' }} style={{ gap: space.s3 }}>
      <OnGround ground="card">
        {editing ? (
          <View style={[box, { borderColor: c.ink }]}>
            {label}
            <TextInput testID={`${id}-input`} accessibilityLabel="Your reply" autoFocus multiline value={text} onChangeText={setText}
              style={{ fontFamily: `${FACE.text}`, fontWeight: weight.text, fontSize: type.t18.fontSize, lineHeight: type.t18.lineHeight, color: c.ink, padding: 0, minHeight: type.t18.lineHeight * 2, outlineStyle: 'none' } as object} />
          </View>
        ) : (
          <Press id={`${id}-text`} label="Edit the draft" onPress={edit} disabled={sending} round={false}>
            <View style={[box, { borderColor: c.ink2 }]}>{label}<Words spans={spans} /></View>
          </Press>
        )}
      </OnGround>
      {facts.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}>
          {facts.map(f => <Fact key={f.text} text={f.text} from={f.from} />)}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}>
        <Pill id={`${id}-send`} label={status === 'failed' ? 'Retry' : 'Send'} icon={status === 'failed' ? 'refresh' : undefined} kind={lead ? 'primary' : 'second'}
          state={sending ? 'working' : hold || (editing && !text.trim()) ? 'disabled' : 'idle'} step="Sending" onPress={() => { if (editing) done(); onSend?.(); }} />
        {editing
          ? <Pill id={`${id}-done`} kind="second" label="Done" onPress={done} />
          : <Pill id={`${id}-edit`} kind="second" label="Edit" state={sending ? 'disabled' : 'idle'} onPress={edit} />}
        <Pill id={`${id}-take`} kind="second" label="Take over" state={sending ? 'disabled' : 'idle'} onPress={onMine} />
      </View>
      {status === 'failed' && failed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1 }}>
          <Icon name="alert-02" size={12} tone="brick" />
          <Txt role="caption">{failed}</Txt>
        </View>
      ) : null}
    </View>
  );
}

// One fact a reply states and where it came from: "35 in measured, your tape". Flat, never a button: it is there to be read.
function Fact({ text, from }: { text: string; from: string }) {
  const c = useColors();
  return (
    <View {...mark('fact', { fit: 'content' })} accessibilityLabel={`${text}, from ${from}`}
      style={{ height: size.tagH, borderRadius: radius.pill, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: space.s1, paddingHorizontal: space.s2, backgroundColor: c.gray, ...FLAT }}>
      <Icon name="tick-02" size={12} tone="ink-2" />
      <Txt role="caption" tone="ink" lines={1}>{text}</Txt>
      <Txt role="caption" lines={1}>{`from ${from}`}</Txt>
    </View>
  );
}

// The person's own message. The field is the gray of a control, 40 tall like a pill, and grows with the words; the text you
// type is 18 (Art. 6), so iOS never zooms. Send waits until there are words.
export function Composer({ id, to, value, onChange, onSend, sending = false }: {
  id: string;
  // Who it goes to, for the empty field: "Message canvasfan".
  to: string;
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  sending?: boolean;
}) {
  const c = useColors();
  return (
    <View {...mark('composer')} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.s2 }}>
      <View style={{ flex: 1, minHeight: size.pillCardH, borderRadius: radius.photo, borderCurve: 'continuous', backgroundColor: c.gray, paddingHorizontal: space.s4, justifyContent: 'center' }}>
        <TextInput testID={`${id}-input`} accessibilityLabel={`Message ${to}`} placeholder={`Message ${to}`} placeholderTextColor={c.ink2} multiline numberOfLines={1} value={value} onChangeText={onChange}
          style={{ fontFamily: `${FACE.text}`, fontWeight: weight.text, fontSize: type.t18.fontSize, lineHeight: type.t18.lineHeight, color: c.ink, paddingVertical: space.s2, outlineStyle: 'none' } as object} />
      </View>
      <Pill id={`${id}-send`} label="Send" state={sending ? 'working' : value.trim() ? 'idle' : 'disabled'} step="Sending" onPress={onSend} />
    </View>
  );
}
