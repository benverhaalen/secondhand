import { SellerFulfillment } from '@/selling/fulfillment';
// Pickup: a buyer collects a sold thing in person (spec/pages.md §6.9, spec/features/sold.md, spec/edge-cases.md §16).
// Nothing is set up ahead and no calendar is read (decision "no fixed pickup windows", Ben 05:18 to 05:24). When a buyer
// wants to meet, the person taps the days this week that work, drags a span on each, and picks a place: the saved spot or a
// safe one. The agent writes it to the buyer the way a person would, and the draft waits for Send. The buyer's pick comes
// back with who is coming, to Approve, Suggest another or Decline; once planned, Add to Google or Apple Calendar writes the
// event. A home address is never sent by the agent: it waits for its own tap, with the public spot first (share_address
// is locked). The two cases no world holds are asked for: `case=ask` (a buyer wants to meet) and `case=pick` (their pick).
// Behavior: app/behavior/item/[id]/pickup.json.
// one at a time: pickup-running-late (alternatives of one state each; .agents/checks/screens.mjs S2)
import { openMarketplace } from '@/navigation/open-marketplace';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Share } from 'react-native';
import {
  Approve, Blank, Message, Draft, EmptyState, FootButton, Icon, ItemCard, Line, List, Meta, Nav, Pill, Row, Screen, Section, Sheet, SiteCopy, SiteLink, Skeleton, Stack,
  TimeSpan, Txt, UndoToast, type Span, type SpanValue,
} from '@/ui';
import { ago, itemById, ms, thread, usd, when, world, type World } from '@/demo';
import { DARK, FIRST_SPAN, MEET_ASK, MEET_PICK, PROFILES, SAFE_SPOTS, atTime, freeLine, nextDays, spanWords } from '@/demo/handover';
import { photo } from '@/demo/photos';
import { useScreen } from '@/demo/screen';
import { Chip, Choice } from '@/ui/parts/chip';
import { log } from '@/ui/log';

// The states Pickup cannot be in, each with why (B35, app/src/demo/screen.ts).
const SKIP = 'new: Pickup opens only from a sale, and a person who has done nothing has sold nothing; '
  + 'dense: a pickup is one buyer collecting one item, so there is never a long list here';
const pic = (key: Parameters<typeof photo>[0]) => photo(key) as number;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const back = (id: string) => (router.canGoBack() ? router.back() : router.replace(`/item/${id}` as Href));
// A countdown only inside a day, where it changes what the person does next (frontend-standard §5, Honesty).
const dueOf = (w: World, iso?: string) => { if (!iso) return undefined; const left = ms(iso) - ms(w.now); return left > 0 && left < 864e5 ? Date.now() + left : undefined; };
// A name inside a button is cut to fit the 1 to 3 words a button holds (copy.md).
const short = (name: string) => (name.length <= 12 ? name : 'them');
// Calendar times as the links want them: 20261116T210000Z.
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// Dark on the day of `iso`: DARK half hours after that day's local midnight.
const darkOn = (iso: string) => ms(atTime(nextDays(iso)[0], DARK));

type Mode = 'ask' | 'pick' | 'booked';

export default function Pickup() {
  const p = useLocalSearchParams<{ id: string; world?: string; case?: string }>();
  // ?state= draws over the clearing world, whose chair has the only pickup (app/src/demo/screen.ts): empty is a buyer asking
  // to meet with nothing planned yet, one is their single pick to approve, typical the planned pickup, offline holds each tap.
  const s = useScreen();
  const { order: orderId } = useLocalSearchParams<{ order?: string }>();
  if (!s.demo) return <SellerFulfillment id={String(p.id)} order={orderId} pickup />;
  const asked = s.state;
  const w = p.world ? s.w : world('clearing');
  const item = itemById(w, p.id);
  const order = item ? w.orders.find(o => o.item_id === item.id && o.kind === 'sale' && o.state !== 'cancelled') : undefined;
  const appt = order ? w.appointments.find(a => a.order_id === order.id && a.kind === 'pickup') : undefined;
  const nav = <Nav back={() => back(p.id)} />;
  if (asked === 'loading') {
    return (
      <Screen name="pickup" state="loading" skip={SKIP} nav={nav}>
        <Stack gap="cards"><Txt role="heading">Pickup</Txt><Skeleton of="card-item" /></Stack>
      </Screen>
    );
  }
  if (asked === 'failed') {
    return (
      <Screen name="pickup" state="failed" skip={SKIP} nav={nav}>
        <EmptyState title="This pickup didn’t load" action={{ id: 'pickup-retry', label: 'Retry', onPress: () => router.replace(`/item/${p.id}/pickup` as Href) }} />
      </Screen>
    );
  }
  if (!item || !order || !appt) {
    return (
      <Screen name="pickup" state="failed" skip={SKIP} nav={nav}>
        <EmptyState title="No pickup here" action={{ id: 'pickup-gone', label: 'Open the item', onPress: () => router.replace(`/item/${p.id}` as Href) }} />
      </Screen>
    );
  }
  // A state named in the URL wins over a case, so every state can be opened from any of the page's links.
  const mode: Mode = asked === 'empty' ? 'ask' : asked === 'one' ? 'pick' : asked ? 'booked' : p.case === 'ask' ? 'ask' : p.case === 'pick' ? 'pick' : 'booked';
  return <PickupSheet w={w} itemId={item.id} orderId={order.id} mode={mode} q={p.world ? `?world=${p.world}` : ''} offline={asked === 'offline'} soonCase={!asked && p.case === 'soon'} />;
}

type Open = null | 'address' | 'late' | 'another' | 'cancel' | 'copy';

function PickupSheet({ w, itemId, orderId, mode, q, offline, soonCase = false }: { w: World; itemId: string; orderId: string; mode: Mode; q: string; offline: boolean; soonCase?: boolean }) {
  const item = itemById(w, itemId)!;
  const order = w.orders.find(o => o.id === orderId)!;
  const appt = w.appointments.find(a => a.order_id === orderId && a.kind === 'pickup')!;
  const conv = w.conversations.find(c => c.item_id === itemId && c.buyer === order.buyer);
  const buyer = order.buyer;
  const spot = w.limits.saved_spot?.label ?? appt.place?.label ?? '';
  const asksHome = mode === 'booked' ? w.decisions.find(d => d.kind === 'share_address' && d.order_id === orderId && d.state === 'open') : undefined;

  const [stage, setStage] = useState<Mode | 'cancelled'>(mode);
  // `soon` is the planned pickup 40 minutes away, the case the "within the hour" notification opens (no world holds one).
  const [meetAt, setMeetAt] = useState(mode === 'pick' ? MEET_PICK.at : soonCase ? new Date(ms(w.now) + 40 * 60e3).toISOString() : appt.window.start);
  const soon = ms(meetAt) - ms(w.now) <= 60 * 60e3 && ms(meetAt) > ms(w.now) - 30 * 60e3;
  const siteUrl = item.listings.find(l => l.id === (conv?.listing_id ?? order.listing_id))?.url;
  const [place, setPlace] = useState(appt.place?.label ?? spot);
  const [approve, setApprove] = useState<'ready' | 'working' | 'done'>('ready');
  const [home, setHome] = useState<'ask' | 'kept' | 'sent'>(asksHome ? 'ask' : 'kept');
  const [address, setAddress] = useState('');
  const [open, setOpen] = useState<Open>(null);
  const [lateBy, setLateBy] = useState<'10' | '20' | '30'>('10');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string[]>([]);
  const [toast, setToast] = useState<null | { id: string; text: string; undo: () => void }>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // offline: a tap holds on its pill until the signal returns, as on Today.
  const later = (f: () => void) => { if (!offline) timers.current.push(setTimeout(f, 700)); };
  // Every change sends the buyer a message (ways-out §6.9, "I can't make it"); what was sent shows here as done.
  const tell = (line: string, after?: () => void) => { setBusy(true); later(() => { setBusy(false); setOpen(null); setSaid(s => [...s, line]); after?.(); }); };

  const planned = stage === 'booked' || (stage === 'pick' && approve === 'done');
  const end = new Date(ms(meetAt) + 30 * 60e3).toISOString();
  const calendar = (kind: 'google' | 'apple') => {
    const title = `Pickup: ${item.title}`, details = `${buyer} is collecting it.`;
    const url = kind === 'google'
      ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${stamp(meetAt)}/${stamp(end)}&location=${encodeURIComponent(place)}&details=${encodeURIComponent(details)}`
      : `data:text/calendar;charset=utf8,${encodeURIComponent(['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `DTSTART:${stamp(meetAt)}`, `DTEND:${stamp(end)}`, `SUMMARY:${title}`, `LOCATION:${place}`, `DESCRIPTION:${details}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'))}`;
    Linking.openURL(url).catch(e => log.error('pickup.open', e));
  };
  const sharePlan = () => Share.share({ message: `Meeting ${buyer} ${when(meetAt, w.now)} at ${place} to hand over ${item.title}.` })
    .then(r => { if (r.action === Share.sharedAction) setSaid(s => [...s, 'Shared your plan']); }).catch(e => log.error('pickup.open', e));

  const state = offline ? 'offline' : stage === 'cancelled' || stage === 'ask' ? 'empty' : stage === 'pick' ? 'one' : 'typical';
  const foot = stage === 'pick' && approve !== 'done' ? (
    <Approve id="meet-approve" does={`Meet ${short(buyer)} ${when(meetAt, w.now)}`} status={approve} step="Telling them"
      onApprove={() => { setApprove('working'); later(() => { setApprove('done'); setSaid(s => [...s, `Told ${buyer} you’ll meet ${when(meetAt, w.now)}`]); }); }} />
  ) : null;

  return (
    <Screen name="pickup" state={state} skip={SKIP} foot={foot} nav={<Nav back={() => back(item.id)} />}>
      <Stack gap="cards">
        <Stack gap="tight">
          <Txt role="heading">Pickup</Txt>
          {offline ? <Meta icon="hourglass" text="Waiting for signal" /> : null}
        </Stack>
        <ItemCard id="pickup-item" title={item.title} photo={pic(item.photos[0].key)} site={order.site} state="sold" word="Pickup"
          fact={{ label: `${buyer} pays`, amount: usd(order.price_cents) }} due={planned ? dueOf(w, meetAt) : undefined}
          onPress={() => router.push(`/item/${item.id}${q}` as Href)} />
      </Stack>

      {stage === 'cancelled' ? (
        <EmptyState title="Pickup cancelled" line={`${buyer} got a message. The item is back on sale.`} action={{ id: 'pickup-close', label: 'Done', onPress: () => back(item.id) }} />
      ) : stage === 'ask' ? (
        <>
          <Message side="theirs" meta={<Meta text={`${buyer}, ${ago(MEET_ASK.sent_at, w.now)}`} />}>{MEET_ASK.text}</Message>
          <MeetPicker w={w} buyer={buyer} spot={spot} convId={conv?.id} q={q} sent={said.length > 0} onSent={() => setSaid(s => [...s, `Sent. ${buyer} picks a time`])} />
          {said.map((s, i) => <Meta key={i} icon="tick-02" text={s} />)}
        </>
      ) : (
        <>
          {stage === 'pick' ? <Coming w={w} buyer={buyer} convId={conv?.id} /> : null}

          <Section title="When and where">
            <List>
              <Row lead={<Icon name="calendar-03" />}>
                <Txt role="body">{cap(when(meetAt, w.now))}</Txt>
                <Txt role="caption" lines={1}>{ms(meetAt) >= darkOn(meetAt) ? 'After dark' : 'In daylight'}</Txt>
              </Row>
              <Row lead={<Icon name="location-01" />}>
                <Txt role="body">{place}</Txt>
                {place === spot ? <Txt role="caption" lines={1}>Your saved spot, out in public</Txt> : null}
              </Row>
            </List>
            {/* Within the hour, the two things a person tells a buyer on the way come first (spec/notifications.md, "A pickup
                within the hour": On my way, Running late). */}
            {planned && soon ? (
              <Line>
                <Pill id="pickup-on-my-way" kind="second" icon="delivery-truck-01" label="On my way" state={busy ? 'working' : 'idle'} step="Telling them"
                  onPress={() => tell(`Told ${buyer} you’re on your way`)} />
                <Pill id="pickup-running-late" kind="second" label="Running late" onPress={() => setOpen('late')} />
              </Line>
            ) : null}
            {stage === 'pick' && approve !== 'done' ? (
              <Line>
                <Pill id="meet-another" kind="second" label="Suggest another" onPress={() => setOpen('another')} />
                <Pill id="meet-decline" kind="second" label="Decline" onPress={() => {
                  setStage('cancelled');
                  setToast({ id: 'decline-undo', text: `Told ${buyer} no`, undo: () => { setStage('pick'); setToast(null); } });
                }} />
              </Line>
            ) : null}
            {planned ? (
              <Line>
                <Pill id="cal-google" kind="second" icon="calendar-03" label="Add to Google Calendar" onPress={() => calendar('google')} />
                <Pill id="cal-apple" kind="second" icon="calendar-03" label="Add to Apple Calendar" onPress={() => calendar('apple')} />
              </Line>
            ) : null}
            {/* The site's own picture of the thread where the time was agreed, to check ours against, and the way back to the
                site (Ben, 06:19: "It should use screenshots from the site when you need to verify certain things like scheduling"). */}
            <Line>
              {siteUrl ? <SiteLink id="pickup-site" site={order.site} onPress={() => { openMarketplace(siteUrl).catch(e => log.error('pickup.open', e)); }} /> : null}
              <Pill id="pickup-snapshot" kind="second" icon="image-01" label="See the site’s copy" onPress={() => setOpen('copy')} />
            </Line>
          </Section>

          {home === 'ask' && asksHome ? (
            <Section title="Your address">
              <Txt role="body">{asksHome.why}</Txt>
              <Line>
                <Pill id="pickup-keep-spot" label="Keep my saved spot" onPress={() => tell(`Told ${buyer} it stays at ${place}`, () => setHome('kept'))} />
                <Pill id="pickup-share" kind="second" label="Share my address" onPress={() => setOpen('address')} />
              </Line>
            </Section>
          ) : null}

          {said.length ? (
            <Stack gap="tight">
              {said.map((s, i) => <Meta key={i} icon="tick-02" text={s} />)}
            </Stack>
          ) : null}

          {planned ? (
            <Section title="If plans change">
              <Line>
                {soon ? null : <Pill id="pickup-running-late" kind="second" label="Running late" onPress={() => setOpen('late')} />}
                <Pill id="pickup-another" kind="second" label="Suggest another time" onPress={() => setOpen('another')} />
                <Pill id="pickup-share-plan" kind="second" icon="share-08" label="Share my plan" onPress={sharePlan} />
                <Pill id="pickup-cancel" kind="second" label="Cancel pickup" onPress={() => setOpen('cancel')} />
              </Line>
            </Section>
          ) : null}
        </>
      )}

      <SiteCopy id="pickup-copy" open={open === 'copy'} site={order.site} onClose={() => setOpen(null)}
        onOpen={() => { setOpen(null); if (siteUrl) openMarketplace(siteUrl).catch(e => log.error('pickup.open', e)); }} />

      <Sheet open={open === 'another'} title="Suggest another time" onClose={() => setOpen(null)}>
        {open === 'another' ? (
          <MeetPicker w={w} buyer={buyer} spot={spot} convId={conv?.id} q={q} sent={false}
            onSent={() => { setOpen(null); setStage('ask'); setSaid([`Sent. ${buyer} picks a time`]); setPlace(spot); setMeetAt(appt.window.start); }} />
        ) : null}
      </Sheet>

      <Sheet open={open === 'address'} title="Share your address" onClose={() => setOpen(null)}>
        <Txt role="body" tone="ink-2">{`${buyer} gets your address in the chat on the site`}</Txt>
        <Blank id="pickup-address" live name="Your address" value={address} onChange={setAddress} />
        <Approve id="pickup-send-address" does={`Send my address to ${short(buyer)}`} status={busy ? 'working' : 'ready'} step="Sending"
          onApprove={() => { if (address.trim()) tell(`Sent your address to ${buyer}`, () => setHome('sent')); }} />
      </Sheet>

      <Sheet open={open === 'late'} title="Running late" onClose={() => setOpen(null)}>
        <Line>
          {(['10', '20', '30'] as const).map(m => <Chip key={m} id={`late-by-${m}`} label={`${m} min`} picked={lateBy === m} onPress={() => setLateBy(m)} />)}
        </Line>
        <Approve id="late-send" does={`Tell ${short(buyer)}`} status={busy ? 'working' : 'ready'} step="Sending" onApprove={() => tell(`Told ${buyer} you’re ${lateBy} minutes late`)} />
      </Sheet>

      <Sheet open={open === 'cancel'} title="Cancel pickup" onClose={() => setOpen(null)}>
        <Txt role="body">{`${buyer} gets a message, and the item goes back on sale.`}</Txt>
        <FootButton id="cancel-pickup-confirm" kind="second" label="Cancel pickup" state={busy ? 'working' : 'idle'} step="Cancelling"
          onPress={() => { setBusy(true); later(() => { setBusy(false); setOpen(null); setStage('cancelled'); setToast({ id: 'cancel-undo', text: 'Pickup cancelled', undo: () => { setStage(mode); setToast(null); } }); }); }} />
      </Sheet>

      {toast ? <UndoToast id={toast.id} text={toast.text} onUndo={toast.undo} onGone={() => setToast(null)} /> : null}
    </Screen>
  );
}

// The days, the spans and the place, and the message the agent writes from them (edge-cases §16, steps 1 and 2). No day is
// picked for the person: the agent never guesses when they are free. A span that ends after dark asks before Send.
function MeetPicker({ w, buyer, spot, convId, q, onSent, sent }: { w: World; buyer: string; spot: string; convId?: string; q: string; onSent: () => void; sent: boolean }) {
  const days = nextDays(w.now);
  const [picked, setPicked] = useState<string[]>([]);
  const [spans, setSpans] = useState<Record<string, SpanValue>>({});
  const [where, setWhere] = useState<string>(spot ? 'saved' : SAFE_SPOTS[0].id);
  const [darkOk, setDarkOk] = useState(false);
  const [edited, setEdited] = useState<Span[] | null>(null);
  const [status, setStatus] = useState<'ready' | 'sending' | 'sent'>(sent ? 'sent' : 'ready');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const picks = picked.map(k => ({ day: days.find(d => d.key === k)!, ...(spans[k] ?? FIRST_SPAN) }));
  const places = [...(spot ? [{ id: 'saved', label: spot, line: 'Your saved spot, out in public' }] : []), ...SAFE_SPOTS];
  const placeLabel = places.find(s => s.id === where)?.label ?? spot;
  const dark = picks.some(p => p.end > DARK);
  const text: Span[] = edited ?? [{ text: freeLine(picks, placeLabel) }];
  // A change to the days, spans or place rewrites the message, so an earlier edit never says a time no longer offered.
  const change = (f: () => void) => { f(); setEdited(null); };

  return (
    <>
      <Section title="Days that work">
        <Line>
          {days.map(d => (
            <Chip key={d.key} id={`meet-day-${d.key}`} label={d.label} picked={picked.includes(d.key)}
              onPress={() => change(() => { setPicked(p => (p.includes(d.key) ? p.filter(k => k !== d.key) : days.map(x => x.key).filter(k => k === d.key || p.includes(k)))); setSpans(s => ({ [d.key]: FIRST_SPAN, ...s })); })} />
          ))}
        </Line>
        {picks.map(p => (
          <TimeSpan key={p.day.key} id={`span-${p.day.key}`} day={p.day.label} words={spanWords(p.start, p.end)} value={{ start: p.start, end: p.end }}
            onChange={v => change(() => setSpans(s => ({ ...s, [p.day.key]: v })))} note={p.end > DARK ? 'Ends after dark' : undefined} />
        ))}
      </Section>

      <Section title="Where">
        <List>
          {places.map(s => (
            <Choice key={s.id} id={`place-${s.id}`} icon="location-01" label={s.label} line={s.line} picked={where === s.id} onPress={() => change(() => setWhere(s.id))} />
          ))}
        </List>
      </Section>

      {status !== 'sent' && picks.length ? (
        <Stack>
          {dark && !darkOk ? (
            <Line>
              <Txt role="body" tone="ink-2">A time after dark is harder to meet safely.</Txt>
              <Pill id="meet-dark-ok" kind="second" label="After dark is fine" onPress={() => setDarkOk(true)} />
            </Line>
          ) : null}
          <Draft key={edited ? 'edited' : text[0].text} id="meet-draft" who={buyer} spans={text} hold={dark && !darkOk} status={status === 'sending' ? 'sending' : 'ready'}
            onChange={setEdited}
            onSend={() => { setStatus('sending'); timer.current = setTimeout(() => { setStatus('sent'); onSent(); }, 700); }}
            onMine={() => router.push((`/messages/${convId ?? ''}` + q + `${q ? '&' : '?'}take=1`) as Href)} />
        </Stack>
      ) : null}
    </>
  );
}

// Who is coming (edge-cases §16, step 3): the buyer's name on the site, their rating and reviews, how long they have been
// on the site, and their messages so far. The worlds hold no buyer photos, so none is drawn.
function Coming({ w, buyer, convId }: { w: World; buyer: string; convId?: string }) {
  const prof = PROFILES[buyer];
  // The demo's thread already holds a booked pickup, so the pick case keeps only the buyer's first message before their pick.
  const theirs = convId ? thread(w, convId).filter(m => m.actor === 'counterpart').slice(0, 1) : [];
  return (
    <Section title="Who’s coming">
      <Row lead={<Icon name="user" />}>
        <Txt role="headline" lines={1}>{buyer}</Txt>
        <Txt role="caption" lines={1}>{prof ? `${prof.rating} stars from ${prof.reviews} reviews, on the site since ${prof.since}` : 'No reviews on the site yet'}</Txt>
      </Row>
      <Stack>
        {theirs.map(m => <Message key={m.id} side="theirs" meta={<Meta text={ago(m.sent_at, w.now)} />}>{m.text}</Message>)}
        <Message side="theirs" meta={<Meta text={ago(MEET_PICK.sent_at, w.now)} />}>{MEET_PICK.text}</Message>
      </Stack>
    </Section>
  );
}
