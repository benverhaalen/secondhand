// One conversation with one buyer about one listing, read as iMessage reads one: the listing on top, the messages in order,
// and the next message at the foot (spec/pages.md §6.3). What the agent sent says "Sent for you" and why; what it holds
// for a tap sits in place as a draft with its guessed words dotted (spec/features/assist.md) and the facts it states with
// their sources; an offer is its own card with the actions Today gives it; a possible scam is said calmly, with why, before
// anything else. Each message of the person's side says who wrote it: You, Sent for you, or Drafted and sent by you; Take
// over stops drafts in the thread until the person hands it back (spec/ways-out.md §6.3, Ben 05:18 to 05:24).
// Behavior: app/behavior/messages/[id].json.
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking } from 'react-native';
import {
  Approve, Message, Composer, DecisionCard, Draft, EmptyState, Guess, Icon, ItemCard, Line, Meta, Nav, Notice, Pill, Row, Screen, Sheet, SiteCopy, SiteLink, Skeleton, Stack, Txt,
  UndoToast, type DecisionStatus, type Span, type TagState,
} from '@/ui';
import { ago, itemById, ms, thread, usd, when, world, youKeep, type Conversation, type Item, type Message as Msg, type Offer, type World } from '@/demo';
import { draftFor, waitingOn } from '@/demo/inbox';
import { photo } from '@/demo/photos';
import { useScreen, type ScreenState } from '@/demo/screen';

// The states a thread cannot be in, each with why (B35, app/src/demo/screen.ts).
const SKIP = 'new: a thread exists only once a buyer writes, so a person who has done nothing has none to open; '
  + 'empty: a thread with no messages is never listed; dense: no world holds a thread longer than six messages';
const pic = (key: Parameters<typeof photo>[0]) => photo(key) as number;
const back = () => (router.canGoBack() ? router.back() : router.replace('/messages' as Href));
// The demo's clock is fixed; a countdown runs on the real one. A deadline keeps its distance from the demo's now.
const dueOf = (w: World, iso: string | null) => (iso ? Date.now() + ms(iso) - ms(w.now) : undefined);
const TAG: Partial<Record<Item['state'], TagState>> = { live: 'live', stale: 'stuck', sold: 'sold', handed_over: 'sold', done: 'sold', unsold: 'ended', kept: 'ended' };
// A name inside a button is cut to fit the 1 to 3 words a button holds (copy.md).
const short = (name: string) => (name.length <= 12 ? name : 'them');
// Opens the thing on its site, in the site's app when it is installed.
const openSite = (url: string) => { Linking.openURL(url).catch(() => {}); };

type Said = { id: string; kind: 'mine' | 'drafted' | 'note'; text: string };
type Open = null | { kind: 'more' } | { kind: 'snapshot' } | { kind: 'why'; msg: Msg } | { kind: 'counter'; offer: Offer } | { kind: 'offer-more'; offer: Offer };

export default function MessageThread() {
  const p = useLocalSearchParams<{ id: string; world?: string; take?: string }>();
  // A thread belongs to the world it was opened from, so ?state= draws over clearing unless ?world= names another.
  const s = useScreen();
  const w = p.world ? s.w : world('clearing');
  const conv = w.conversations.find(c => c.id === p.id);
  const q = p.world ? `?world=${p.world}` : '';
  if (s.state === 'loading' && conv) {
    return (
      <Screen name="message" state="loading" skip={SKIP} nav={<Nav back={back} />}>
        <Stack gap="cards"><Txt role="headline" lines={1}>{conv.buyer}</Txt><Skeleton of="card-item" /></Stack>
      </Screen>
    );
  }
  if (s.state === 'failed' && conv) {
    return (
      <Screen name="message" state="failed" skip={SKIP} nav={<Nav back={back} />}>
        <EmptyState title={`Messages with ${conv.buyer} didn’t load`}
          action={{ id: 'thread-retry', label: 'Try again', onPress: () => router.replace(`/messages/${conv.id}${q}` as Href) }} />
      </Screen>
    );
  }
  if (!conv) {
    return (
      <Screen name="message" state="failed" skip={SKIP} nav={<Nav back={back} />}>
        <EmptyState title="This conversation is gone" line="The site no longer shows it." action={{ id: 'gone-back', label: 'Back to messages', onPress: () => router.replace('/messages' as Href) }} />
      </Screen>
    );
  }
  return <Thread w={w} conv={conv} worldParam={p.world} takeOver={p.take === '1'} asked={s.state} />;
}

function Thread({ w, conv, worldParam, takeOver, asked }: { w: World; conv: Conversation; worldParam?: string; takeOver: boolean; asked: ScreenState | null }) {
  const q = worldParam ? `?world=${worldParam}` : '';
  // offline: the last copy, and every send waits on its pill until the signal returns, as on Today.
  const offline = asked === 'offline';
  const item = itemById(w, conv.item_id);
  const listing = item?.listings.find(l => l.id === conv.listing_id) ?? null;
  // one: the buyer's first message alone, as a thread looks the moment it starts.
  const msgs = asked === 'one' ? thread(w, conv.id).slice(0, 1) : thread(w, conv.id);
  const waiting = waitingOn(w, conv);
  const scam = waiting?.kind === 'scam_warning' ? waiting : null;
  const order = item ? w.orders.find(o => o.item_id === item.id && o.kind === 'sale') : undefined;
  const pickup = order ? w.appointments.find(a => a.order_id === order.id && a.kind === 'pickup' && a.state !== 'cancelled') : undefined;
  const firstDraft = draftFor(w, conv.id);

  const [lines, setLines] = useState<Said[]>([]);
  const [spans, setSpans] = useState<Span[] | null>(takeOver ? null : firstDraft?.spans ?? null);
  const [facts, setFacts] = useState(firstDraft?.facts ?? []);
  const [draftKey, setDraftKey] = useState(0);
  const [draftStatus, setDraftStatus] = useState<'ready' | 'sending' | 'editing'>('ready');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [taken, setTaken] = useState(takeOver);
  const [blocked, setBlocked] = useState(conv.state === 'blocked');
  const [offers, setOffers] = useState<Record<string, DecisionStatus>>({});
  const [open, setOpen] = useState<Open>(null);
  const [counter, setCounter] = useState('');
  const [counterStatus, setCounterStatus] = useState<'ready' | 'working'>('ready');
  const [toast, setToast] = useState<null | { id: string; text: string; undo: () => void }>(null);
  const n = useRef(0);
  const add = (kind: Said['kind'], text: string) => setLines(l => [...l, { id: `l${n.current++}`, kind, text }]);
  const later = (f: () => void) => { if (!offline) setTimeout(f, 900); };

  const openOffers = w.offers.filter(o => o.conversation_id === conv.id && o.state === 'open' && offers[o.id] !== 'done');
  // The first decision in the view takes the black pill (C4 rule 2): the scam's own act, then the soonest offer, then the draft.
  const leadOffer = !scam ? openOffers.slice().sort((a, b) => ms(a.expires_at ?? '9999') - ms(b.expires_at ?? '9999'))[0]?.id : undefined;
  const draftLeads = !scam && !leadOffer;

  const block = () => {
    setBlocked(true); setOpen(null);
    setToast({ id: 'block-undo', text: `Blocked ${conv.buyer}`, undo: () => { setBlocked(false); setToast(null); } });
  };
  const sendDraft = () => {
    if (!spans) return;
    const words = spans.map(s => s.text).join('');
    setDraftStatus('sending');
    later(() => { add('drafted', words); setSpans(null); setDraftStatus('ready'); });
  };
  const sendMine = () => {
    const words = text.trim(); if (!words) return;
    setSending(true);
    later(() => { add('mine', words); setText(''); setSending(false); });
  };
  const accept = (o: Offer) => {
    setOffers(s => ({ ...s, [o.id]: 'working' }));
    later(() => { setOffers(s => ({ ...s, [o.id]: 'done' })); add('note', `You accepted ${usd(o.amount_cents)}`); });
  };
  const decline = (o: Offer) => { setOpen(null); setOffers(s => ({ ...s, [o.id]: 'done' })); add('note', `You declined ${usd(o.amount_cents)}`); };
  const sendCounter = (o: Offer) => {
    const cents = Math.round(Number(counter.replace(/[^0-9.]/g, '')) * 100);
    if (!cents) return;
    setCounterStatus('working');
    later(() => { setCounterStatus('ready'); setOpen(null); setOffers(s => ({ ...s, [o.id]: 'done' })); add('note', `You countered at ${usd(cents)}`); });
  };
  const offerLabels = (o: Offer) => {
    const dec = w.decisions.find(d => d.offer_ids?.includes(o.id) && d.state === 'open');
    const own = dec && dec.conversation_id === conv.id;
    const ctr = own ? dec.options.find(x => x.id === 'ctr') : undefined;
    return { accept: own ? dec.options.find(x => x.id === 'acc')?.label ?? `Accept ${usd(o.amount_cents)}` : `Accept ${usd(o.amount_cents)}`, counter: ctr?.label ?? 'Counter', suggest: ctr ? ctr.label.replace(/[^0-9.]/g, '') : '' };
  };

  const why = open?.kind === 'why' ? explain(w, conv, open.msg) : null;
  const foot = blocked ? null : spans ? null : (
    <Stack gap="tight">
      {taken ? <Meta text="You answer here. Offers still follow your Plan" icon="information-circle" /> : null}
      <Composer id="composer" to={conv.buyer} value={text} onChange={setText} onSend={sendMine} sending={sending} />
    </Stack>
  );

  return (
    <Screen name="message" state={asked === 'one' || offline ? asked : 'typical'} skip={SKIP} foot={foot}
      nav={<Nav back={back} action={{ id: 'thread-more', icon: 'more-horizontal', label: 'More', onPress: () => setOpen({ kind: 'more' }) }} />}>
      <Stack gap="cards">
        <Stack gap="tight">
          <Txt role="headline" lines={1}>{conv.buyer}</Txt>
          {offline ? <Meta icon="hourglass" text="Waiting for signal" /> : null}
        </Stack>
        {item ? (
          <ItemCard id="thread-item" title={item.title} photo={pic(item.photos[0].key)} site={conv.site} state={TAG[item.state] ?? 'live'}
            fact={{ label: item.state === 'live' || item.state === 'stale' ? 'Asking' : 'Sold for', amount: usd(order?.price_cents ?? listing?.price_cents ?? 0) }}
            onPress={() => router.push(`/item/${item.id}${q}` as Href)} />
        ) : null}
        {/* The way back to the site, and its own picture of the thread to check our copy against (Ben, 06:19). */}
        <Line>
          {listing ? <SiteLink id="thread-site" site={conv.site} onPress={() => openSite(listing.url)} /> : null}
          <Pill id="thread-snapshot" kind="second" icon="image-01" label="See the site’s copy" onPress={() => setOpen({ kind: 'snapshot' })} />
        </Line>
      </Stack>

      {scam && !blocked ? (
        <Stack>
          <Stack gap="tight">
            <Line><Icon name="alert-02" size={20} tone="brick" /><Txt role="headline">Possible scam</Txt></Line>
            <Txt role="body" tone="ink-2">{scam.why}</Txt>
          </Stack>
          <Line><Pill id="thread-block" label={`Block ${short(conv.buyer)}`} onPress={block} /></Line>
        </Stack>
      ) : null}

      <Stack>
        {msgs.map((m, i) => {
          const offer = m.offer_id ? openOffers.find(o => o.id === m.offer_id) : undefined;
          const l = offer ? offerLabels(offer) : null;
          // A time shows where the talk pauses, as iMessage stamps a gap: not under a message answered within half an hour.
          const next = msgs[i + 1];
          const stamp = !next || next.actor === 'counterpart' && m.actor !== 'counterpart' || ms(next.sent_at) - ms(m.sent_at) > 30 * 60e3;
          return (
            <Stack key={m.id}>
              <Message side={m.actor === 'counterpart' ? 'theirs' : 'mine'}
                {...(m.actor === 'auto' ? { id: `why-${m.id}`, label: 'Sent for you, why', onPress: () => setOpen({ kind: 'why', msg: m }) } : {})}
                meta={m.actor === 'auto' ? <Meta text={`Sent for you, ${ago(m.sent_at, w.now)}`} info /> : m.actor === 'user' ? <Meta text={`You, ${ago(m.sent_at, w.now)}`} /> : stamp ? <Meta text={ago(m.sent_at, w.now)} /> : undefined}>
                {m.text}
              </Message>
              {offer && l && item && !blocked ? (
                <DecisionCard id={`offer-${offer.id}`} kind="need" word="Offer" title={item.title} photo={pic(item.photos[0].key)} site={offer.site}
                  fact={{ label: 'You get', amount: usd(offer.you_keep_cents) }} due={dueOf(w, offer.expires_at)} lead={leadOffer === offer.id}
                  status={offers[offer.id] ?? 'open'} step="Accepting"
                  primary={{ id: 'offer-accept', label: l.accept, onPress: () => accept(offer) }}
                  second={{ id: 'offer-counter', label: 'Counter', onPress: () => { setCounter(l.suggest); setOpen({ kind: 'counter', offer }); } }}
                  more={{ id: 'offer-more', label: 'More', onPress: () => setOpen({ kind: 'offer-more', offer }) }}
                  onOpen={() => router.push(`/item/${item.id}${q}` as Href)} />
              ) : null}
            </Stack>
          );
        })}
        {lines.map(l => (l.kind === 'note'
          ? <Meta key={l.id} text={l.text} icon="tick-02" />
          : <Message key={l.id} side="mine" meta={<Meta text={l.kind === 'drafted' ? 'Drafted and sent by you, now' : 'You, now'} />}>{l.text}</Message>))}
        {blocked ? <Meta text={`You blocked ${conv.buyer}`} icon="cancel-01" /> : null}
      </Stack>

      {pickup && !blocked ? (
        <Notice id="thread-pickup" icon="location-01" text={`Pickup ${when(pickup.window.start, w.now)}`} onPress={() => router.push(`/item/${item!.id}/pickup${q}` as Href)} />
      ) : null}

      {spans && !blocked ? (
        <Draft key={draftKey} id="draft" who={conv.buyer} spans={spans} facts={facts} lead={draftLeads} status={draftStatus === 'editing' ? 'editing' : draftStatus}
          onSend={sendDraft} onChange={setSpans} onMine={() => { setSpans(null); setTaken(true); }} />
      ) : null}

      <Sheet open={open?.kind === 'more'} title={conv.buyer} onClose={() => setOpen(null)}>
        <Line>
          {taken ? <Pill id="more-handback" kind="second" label="Hand it back" onPress={() => { setOpen(null); setTaken(false); add('note', 'Drafts are back on here'); }} /> : null}
          {item ? <Pill id="more-item" kind="second" label="Open the item" onPress={() => { setOpen(null); router.push(`/item/${item.id}${q}` as Href); }} /> : null}
          {!blocked ? <Pill id="more-block" kind="second" label={`Block ${short(conv.buyer)}`} onPress={block} /> : null}
        </Line>
      </Sheet>

      {/* The site's own picture of the thread, saved when the agent last read or sent on it (evidence.snapshot_ref; spec/
          edge-cases.md §16, "Proof the agent got it right"). The demo holds no screenshots, so it says so rather than drawing one. */}
      <SiteCopy id="snapshot" open={open?.kind === 'snapshot'} site={conv.site} onClose={() => setOpen(null)}
        onOpen={() => { setOpen(null); if (listing) openSite(listing.url); }} />

      <Sheet open={open?.kind === 'why'} title="Sent for you" onClose={() => setOpen(null)}>
        {why ? (
          <Stack>
            <Txt role="body">{why.what}</Txt>
            {why.rule ? <Txt role="body" tone="ink-2">{why.rule}</Txt> : null}
            <Line>
              <Pill id="why-correct" kind="second" label="Correct it" onPress={() => {
                setOpen(null); setTaken(false); setFacts([]);
                setSpans([{ text: 'A correction to my last message: ', mine: true }]); setDraftStatus('editing'); setDraftKey(k => k + 1);
              }} />
              <Pill id="why-ask-first" kind="second" label="Ask me first" onPress={() => {
                setOpen(null); setToast({ id: 'ask-undo', text: 'It asks you first next time', undo: () => setToast(null) });
              }} />
            </Line>
          </Stack>
        ) : null}
      </Sheet>

      <Sheet open={open?.kind === 'counter'} title="Counter" onClose={() => setOpen(null)}>
        {open?.kind === 'counter' ? (
          <Stack>
            <Guess id="counter-amount" name="Your counter" value={counter ? `$${counter}` : ''} numeric onChange={v => setCounter(v.replace(/[^0-9.]/g, ''))} />
            {Number(counter) > 0 ? <Txt role="body" tone="ink-2">{`You’d get ${usd(youKeep(open.offer.site, Math.round(Number(counter) * 100)))}`}</Txt> : null}
            <Approve id="counter-send" does={`Send ${counter ? `$${counter}` : 'counter'}`} status={counterStatus === 'working' ? 'working' : 'ready'} step="Sending" onApprove={() => sendCounter(open.offer)} />
          </Stack>
        ) : null}
      </Sheet>

      <Sheet open={open?.kind === 'offer-more'} title="Offer" onClose={() => setOpen(null)}>
        {open?.kind === 'offer-more' ? (
          <Stack>
            <Txt role="body" tone="ink-2">{`If you don’t answer, it ends ${open.offer.expires_at ? when(open.offer.expires_at, w.now) : 'when the buyer takes it back'}.`}</Txt>
            <Line>
              <Pill id="offer-decline" kind="second" label={`Decline ${usd(open.offer.amount_cents)}`} onPress={() => decline(open.offer)} />
              {item ? <Pill id="offer-item" kind="second" label="Open the item" onPress={() => { setOpen(null); router.push(`/item/${item.id}${q}` as Href); }} /> : null}
            </Line>
          </Stack>
        ) : null}
      </Sheet>

      {toast ? <UndoToast id={toast.id} text={toast.text} onUndo={toast.undo} onGone={() => setToast(null)} /> : null}
    </Screen>
  );
}

// Why an automatic message went: the log row it came from and the rule it followed, said back in plain words.
function explain(w: World, conv: Conversation, m: Msg) {
  const ev = w.events.find(e => e.actor === 'auto' && e.item_id === conv.item_id && Math.abs(ms(e.at) - ms(m.sent_at)) < 5 * 60e3);
  const rule = ev ? w.rules.find(r => r.kind === ev.action) : undefined;
  return {
    what: ev?.why ?? 'It answered from what the listing says.',
    rule: rule ? `You told it: when ${rule.when}, if ${rule.if}, ${rule.then}.` : null,
  };
}
