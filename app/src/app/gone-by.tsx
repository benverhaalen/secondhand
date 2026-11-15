// Gone by Friday: everything in one room sold or given away by the day the person moves.
// The brief: "I'm moving out Friday. Get everything in this room sold or given away by then." The frame, the states and
// every decision with its reason are in app/behavior/gone-by.json. The plan is price.md "Gone fast" for a whole room;
// the data is app/src/demo/rooms.ts. The agent fills in every guess and the person approves once (ui-build README,
// the hand-off rule): posting is public in their name and sets prices, so it waits for the tap.
// Open a moment with ?at= (sweeping, plan, failed, offline, started, wednesday, done) and a world with ?world=.
// one at a time: approve (alternatives of one state each; .agents/checks/screens.mjs S2)
import { openMarketplace } from '@/navigation/open-marketplace';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Amount, Approve, DecisionCard, EmptyState, FootButton, Grid, Icon, Line, List, log, Nav, Pill, Row, Screen, Section, Sheet, SiteBadge, Stack, Txt, UndoToast,
} from '@/ui';
import type { PhotoSrc, TagState } from '@/ui';
import { Choices, GuessPick } from '@/ui/parts/pick';
import { Tile } from '@/ui/parts/tile';
import { clock, connectionState, day, ms, usd, when, youKeep } from '@/demo';
import { useScreen } from '@/demo/screen';
import { photo } from '@/demo/photos';
import { MOMENTS, SHIFTS, room, type Fate, type Moment, type Room, type Thing } from '@/demo/rooms';

type Phase = Moment | 'posting' | 'failed' | 'offline' | 'empty';
type Ending = 'free' | 'donate' | 'pack';
// A fate the person can pick on a thing: the agent's three, and "not mine" (a roommate's lamp), which leaves the plan.
// On the thing the plan expects to miss, one more: below the person's own lowest, which only they can set (price.md, the floor rule).
type Pick = Fate | 'out' | 'lower';
const OPENABLE: Phase[] = [...MOMENTS, 'failed', 'offline'];

const ENDINGS = (spot: string) => [
  { id: 'free', label: 'What’s left goes up free', does: `Free for pickup at ${spot} until the last pickup.` },
  { id: 'donate', label: 'What’s left goes to donation', does: 'Comes off every site. You drop it off before you move.' },
  { id: 'pack', label: 'What’s left gets packed', does: 'Comes with you and stays for sale, shipped from your new place.' },
];

// The weekday's short name in the person's zone, whatever day() would call it ("Tomorrow" is still "Mon").
const weekday = (t: string) => new Date(ms(t)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' });
// The day's whole name, for a deadline said as a day: "Friday", never "Today" once the day has come.
const dayName = (t: string) => new Date(ms(t)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
const date = (t: string) => new Date(ms(t)).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
// demo/photos gives an image source and the Photo part takes a PhotoSrc; a require() is both.
const pic = (t: Thing) => photo(t.item.photos[0].key) as PhotoSrc;
// An estimate is said in whole dollars ("about $498"), never to the cent.
const about = (cents: number) => usd(Math.round(cents / 100) * 100);
const keepAt = (t: Thing, cents: number) => youKeep(t.site ?? 'ebay', cents, t.site === 'facebook');
// The prices a person can pick for a thing: the agent's, one step under it (never under their lowest) and one step over.
// A step is about a tenth of the price, in round dollars, so each choice is a real difference in time to sell.
function prices(t: Thing, agent: number) {
  const step = agent >= 10000 ? 2500 : agent >= 4000 ? 1000 : 500;
  const low = Math.max(t.lowest ?? 0, agent - step);
  const row = (c: number, what: string) => ({ id: String(c), label: usd(c), does: `You get ${usd(keepAt(t, c))}.${what}` });
  return [...(low < agent ? [row(low, ' Likelier to sell before you move.')] : []), row(agent, ''), row(agent + step, ' Less likely to sell before you move.')];
}
// Under the person's lowest, for the thing that will miss: about a fifth off, in round dollars. Only their tap sets it.
const under = (lowest: number) => Math.floor((lowest * 0.8) / 500) * 500;
// Back goes where the person came from, or home when the page was opened straight from a link.
const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function GoneBy() {
  // ?at= opens a moment of the week; ?state= (useScreen, every page's states) opens the gallery's: loading is the sweep,
  // failed and offline the tap's two ways to go wrong, empty this room with nothing found; new, one and dense are worlds.
  const q = useLocalSearchParams<{ at?: string }>();
  const { w, state } = useScreen();
  const fromState: Phase = state === 'loading' ? 'sweeping' : state === 'failed' ? 'failed' : state === 'offline' ? 'offline' : 'plan';
  // A gallery state replaces the moment, so app-check's <route>?state=<s> draws that state on every moment's page (B35).
  const [phase, setPhase] = useState<Phase>(state || !(OPENABLE as string[]).includes(q.at ?? '') ? fromState : (q.at as Phase));
  const moment: Moment = (MOMENTS as string[]).includes(phase) ? (phase as Moment) : 'plan';
  const [shift, setShift] = useState(0);
  const r = useMemo(() => room(w, moment, shift), [w, moment, shift]);
  const [picks, setPicks] = useState<Record<string, Fate | 'out'>>({});
  const [asks, setAsks] = useState<Record<string, number>>({});
  const [ending, setEnding] = useState<Ending>('free');
  const [open, setOpen] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState<{ text: string; undo: () => void } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // The plan as the person left it: their fates and their prices over the agent's.
  const apply = (ts: Thing[]) => ts.filter(t => picks[t.item.id] !== 'out').map(t => {
    const p = picks[t.item.id], a = asks[t.item.id];
    const fated = p && p !== 'out' ? { ...t, fate: p } : t;
    return a != null && fated.fate === 'sell' ? { ...fated, ask: a, keep: keepAt(fated, a) } : fated;
  });
  const things = apply(r.things);
  const guessed: Record<string, number | null> = Object.fromEntries(r.things.map(t => [t.item.id, t.ask]));
  // What the one tap does, counted on the plan as the person left it: new posts (free ones too) and prices lowered.
  const plan = useMemo(() => apply(room(w, 'plan', shift).things), [w, picks, asks, shift]); // eslint-disable-line react-hooks/exhaustive-deps
  const isLive = (t: Thing) => t.item.listings.some(l => l.state === 'live');
  const posts = plan.filter(t => (t.fate === 'sell' && t.now === 'draft') || (t.fate === 'give' && !isLive(t))).length;
  const lowers = plan.filter(t => (t.fate === 'sell' && t.was != null && t.ask != null && t.ask < t.was) || (t.fate === 'give' && isLive(t))).length;
  const does = [posts ? `Post ${posts}` : '', lowers ? `lower ${lowers}` : ''].filter(Boolean).join(' and ').replace(/^l/, 'L') || 'Start the plan';
  const linked = w.connections.some(c => connectionState(c) === 'connected');
  const spot = w.limits.saved_spot?.label ?? 'your spot';
  const moving = dayName(r.moving);
  const shown: Phase = things.length === 0 || state === 'empty' ? 'empty' : phase;
  // The gallery's names for a screen's states (.agents/ui-states.json); the page's own moments are in its behavior table.
  const named = shown === 'empty' ? (w.name === 'new' ? 'new' : 'empty') : shown === 'sweeping' ? 'loading' : shown === 'failed' ? 'failed' : shown === 'offline' ? 'offline'
    : w.name === 'one' ? 'one' : w.name === 'flipper' ? 'dense' : 'typical';

  function go(to: Phase, was: Phase) { log.event('state.change', { entity: 'room_plan', id: r.label, to, was }); setPhase(to); }
  function approve() {
    log.event('user.input', { screen: 'gone-by', control: 'approve', value: does });
    go('posting', phase); setStep(1);
    timers.current.push(setTimeout(() => setStep(Math.min(2, posts || 1)), 700), setTimeout(() => go('started', 'posting'), 1400));
  }
  function choose(id: string, p: Pick) {
    const t = things.find(x => x.item.id === id);
    const below = p === 'lower' && t?.lowest != null ? under(t.lowest) : null;
    log.event('user.input', { screen: 'gone-by', control: 'fate', item: id, value: below != null ? below : p });
    const before = picks[id], askBefore = asks[id];
    setPicks(f => ({ ...f, [id]: p === 'lower' ? 'sell' : p })); setOpen(null);
    if (below != null) setAsks(a => ({ ...a, [id]: below }));
    // After the tap the plan runs, so a change then is done at once and can be undone (the hand-off rule, auto side).
    if (['started', 'wednesday', 'done'].includes(phase)) {
      const title = t?.item.title ?? '';
      const text = p === 'keep' ? `Packed: ${title}` : p === 'give' ? `Free now: ${title}` : p === 'out' ? `Left out: ${title}` : below != null ? `Now ${usd(below)}: ${title}` : `Back on sale: ${title}`;
      setToast({ text, undo: () => {
        log.event('user.input', { screen: 'gone-by', control: 'undo', item: id });
        setPicks(f => { const n = { ...f }; if (before) n[id] = before; else delete n[id]; return n; });
        setAsks(a => { const n = { ...a }; if (askBefore != null) n[id] = askBefore; else delete n[id]; return n; });
        setToast(null);
      } });
    }
  }
  function price(id: string, cents: number) {
    log.event('user.input', { screen: 'gone-by', control: 'price', item: id, value: cents });
    setAsks(a => ({ ...a, [id]: cents }));
  }
  // The moving days the person can name instead, each with what it moves: the last pickup is the evening before.
  // A day that comes before a sold thing's ship-by says so: shipping after the truck is the costliest mistake but one (frame).
  const days = SHIFTS.map(n => {
    const m = room(w, 'plan', n);
    const late = m.things.filter(t => t.fate === 'sold' && t.due && ms(t.due) > ms(m.last_handover)).length;
    return { n, id: dayName(m.moving).slice(0, 3).toLowerCase(), label: date(m.moving),
      does: `Last pickup ${dayName(m.last_handover)} at ${clock(m.last_handover)}.${late ? ` ${late} sold ${late === 1 ? 'thing has' : 'things have'} to ship before then.` : ''}` };
  });

  if (shown === 'empty') {
    return (
      <Screen name="gone-by" state={named} nav={<Nav back={back} />}>
        <EmptyState title="Nothing to clear here" action={{ id: 'scan', label: 'Scan the room', onPress: () => router.push('/camera' as Href) }} />
      </Screen>
    );
  }

  const later = shown === 'wednesday' || shown === 'done';
  const editing = shown === 'plan' || shown === 'failed';
  const group = (f: Fate) => things.filter(t => t.fate === f);
  const missThing = r.miss && !picks[r.miss.item_id] ? things.find(t => t.item.id === r.miss!.item_id) ?? null : null;
  const still = things.filter(t => t.fate !== 'keep' && t !== missThing && !['gone', 'given', 'packed'].includes(t.now));
  const gone = things.filter(t => ['gone', 'given'].includes(t.now));
  const withYou = things.filter(t => t.fate === 'keep' || t.now === 'packed');
  const forSale = group('sell');
  const sheetThing = things.find(t => t.item.id === open) ?? null;

  const foot = toast ? <UndoToast id="undo" text={toast.text} onUndo={toast.undo} onGone={() => setToast(null)} />
    : shown === 'sweeping' ? <FootButton id="approve" label={does} state="working" step={`Looking, ${r.found} found`} />
    : !linked ? <FootButton id="link" label="Link a site to post" onPress={() => router.push('/onboarding' as Href)} />
    : shown === 'plan' ? <Approve id="approve" does={does} onApprove={approve} />
    : shown === 'posting' ? <Approve id="approve" does={does} status="working" step={`Posting ${step} of ${Math.max(posts, 1)}`} />
    : shown === 'offline' ? <Approve id="approve" does={does} status="working" step="Waiting for signal" />
    : shown === 'failed' ? <Approve id="approve" does={does} status="failed" failed="The site didn’t answer, so nothing went up." onApprove={approve} />
    : shown === 'started' ? <Approve id="approve" does={does} status="done" done={[posts ? `Posted ${posts}` : '', lowers ? `lowered ${lowers}` : ''].filter(Boolean).join(', ').replace(/^l/, 'L') || 'Started'} onUndo={() => go('plan', 'started')} />
    : undefined;

  return (
    <Screen name="gone-by" state={named} nav={<Nav back={back} />} foot={foot}>
      <Stack gap="tight">
        <Txt role="heading">{`Gone by ${moving}`}</Txt>
        {later ? (
          <Txt role="body" tone="ink-2">{shown === 'done' ? `${r.gone} of ${r.to_clear} gone. ${withYou.length} coming with you.` : `${r.gone} of ${r.to_clear} gone. Last pickup ${when(r.last_handover, r.now)}.`}</Txt>
        ) : (
          <Line>
            <Txt role="body" tone="ink-2">Moving</Txt>
            {editing ? (
              <GuessPick id="moving" name="Moving day" value={days.find(d => d.n === shift)?.id ?? 'fri'} choices={days} changed={shift !== 0}
                onPick={id => { const n = days.find(d => d.id === id)?.n ?? 0; log.event('user.input', { screen: 'gone-by', control: 'moving', value: id }); setShift(n); }} />
            ) : <Txt role="body">{date(r.moving)}</Txt>}
          </Line>
        )}
      </Stack>

      {shown === 'done' ? <Amount value={r.kept / 100} what="You kept, after fees" /> : null}

      {missThing ? (
        <DecisionCard id="miss" kind="need" word={moving} lead title={missThing.item.title} photo={pic(missThing)} site={missThing.site ?? undefined}
          fact={{ label: `Unlikely by ${dayName(r.last_handover)} at`, amount: usd(missThing.ask ?? 0) }}
          primary={{ id: 'miss-pack', label: 'Pack it', onPress: () => choose(missThing.item.id, 'keep') }}
          second={{ id: 'miss-free', label: 'Give it away', onPress: () => choose(missThing.item.id, 'give') }}
          more={{ id: 'miss-more', label: 'More', onPress: () => setOpen(missThing.item.id) }}
          onOpen={() => setOpen(missThing.item.id)} />
      ) : null}

      {later ? (
        <>
          {shown === 'wednesday' ? <Group title="Still here" things={still} onOpen={setOpen} asks={asks} guessed={guessed} onAsk={price} fixed /> : null}
          <Group title="Gone" things={gone} onOpen={setOpen} asks={asks} guessed={guessed} onAsk={price} fixed />
          <Group title="Coming with you" things={withYou} onOpen={setOpen} asks={asks} guessed={guessed} onAsk={price} fixed />
        </>
      ) : (
        <>
          <Group title="Sell" note={forSale.length ? `You get about ${about(forSale.reduce((a, t) => a + (t.keep ?? 0), 0))} ${forSale.length === 1 ? 'if it sells' : `if all ${forSale.length} sell`}` : undefined} things={forSale} onOpen={setOpen} asks={asks} guessed={guessed} onAsk={price} fixed={!editing} />
          <Group title="Give away" things={group('give')} onOpen={setOpen} asks={asks} guessed={guessed} onAsk={price} fixed={!editing} />
          <Group title="Already sold" things={group('sold')} onOpen={setOpen} asks={asks} guessed={guessed} onAsk={price} fixed />
          <Group title="Keeping" things={group('keep')} onOpen={setOpen} asks={asks} guessed={guessed} onAsk={price} fixed={!editing} />
        </>
      )}

      {shown !== 'done' ? <Until r={r} today={editing || shown === 'sweeping' || shown === 'posting' || shown === 'offline'} spot={spot} ending={ending} setEnding={setEnding} posts={posts} lowers={lowers} /> : null}

      <Sheet open={!!sheetThing} title={sheetThing?.item.title} onClose={() => setOpen(null)}>
        {sheetThing ? (
          <ThingSheet t={sheetThing} spot={spot} drop={dayName(r.drop_at)} miss={sheetThing === missThing}
            editable={editing || shown === 'sweeping' || sheetThing === missThing} onPick={p => choose(sheetThing.item.id, p)} />
        ) : null}
      </Sheet>
    </Screen>
  );
}

// A group of things, as tiles three across: a room reads at a glance by its photos (C3, L12).
function Group({ title, note, things, onOpen, asks, guessed, onAsk, fixed }: {
  title: string; note?: string; things: Thing[]; onOpen: (id: string) => void;
  asks: Record<string, number>; guessed: Record<string, number | null>; onAsk: (id: string, cents: number) => void; fixed: boolean;
}) {
  if (!things.length) return null;
  return (
    <Section>
      <Stack gap="tight">
        <Txt role="headline">{title}</Txt>
        {note ? <Txt role="caption">{note}</Txt> : null}
      </Stack>
      <Grid columns={3}>
        {things.map(t => (
          <Tile key={t.item.id} id={`thing-${t.item.id}`} title={t.item.title} photo={pic(t)} {...tag(t)}
            faded={t.now === 'given' || t.now === 'gone'} onPress={() => onOpen(t.item.id)}>
            <Caption t={t} fixed={fixed} agent={guessed[t.item.id] ?? t.ask} changed={asks[t.item.id] != null} onAsk={c => onAsk(t.item.id, c)} />
          </Tile>
        ))}
      </Grid>
    </Section>
  );
}

// The tag on a tile says where the thing stands. Nothing is news when it is simply kept.
function tag(t: Thing): { state?: TagState; word?: string } {
  if (t.fate === 'give' && !['given', 'gone'].includes(t.now)) return t.now === 'draft' ? { state: 'draft', word: 'Free' } : { state: 'live', word: 'Free' };
  if (t.fate === 'keep' && t.now !== 'packed') return {};
  switch (t.now) {
    case 'draft': return { state: 'draft', word: 'New' };
    // The kit's word, "Researching", is wider than a tile; the sweep's own word is shorter and says the same.
    case 'found': return { state: 'working', word: 'Looking' };
    case 'hot': return { state: 'hot' };
    case 'offer': return { state: 'need', word: `Offer ${usd(t.offer ?? 0)}` };
    case 'live': case 'free': return { state: 'live' };
    case 'ship': return { state: 'ship', word: `Ship by ${t.due ? weekday(t.due) : ''}`.trim() };
    case 'pickup': return { state: 'ship', word: `Pickup ${t.due ? clock(t.due) : ''}`.trim() };
    case 'given': return { state: 'ended', word: 'Given away' };
    case 'gone': return { state: 'sold' };
    default: return {};
  }
}

// The one line under a tile. A price the agent set and the person has not approved is a Guess: it waits for them.
function Caption({ t, fixed, agent, changed, onAsk }: { t: Thing; fixed: boolean; agent: number | null; changed: boolean; onAsk: (cents: number) => void }) {
  const line = (s: string) => <Txt role="caption" lines={1}>{s}</Txt>;
  if (t.now === 'packed') return line('Still for sale');
  if (t.fate === 'keep') return line(t.item.kept_reason ?? 'Keeping');
  if (t.now === 'given') return line('Picked up');
  if (t.fate === 'give') return line('Pickup only');
  if (t.now === 'found' || t.ask == null) return line(t.fate === 'sold' && t.keep != null ? `You get ${usd(t.keep)}` : 'Pricing');
  if (t.fate === 'sold' || t.now === 'gone' || t.now === 'ship' || t.now === 'pickup') return line(`You get ${usd(t.keep ?? 0)}`);
  // Still for sale once the plan runs: its price, with the word that says what the amount is (C6).
  if (fixed) return line(`For ${usd(t.ask)}`);
  // A price is one of a few steps, not a number to type: each step says what the person keeps.
  return (
    <GuessPick id={`price-${t.item.id}`} name={t.item.title} lead="For" value={String(t.ask)} choices={prices(t, agent ?? t.ask)} changed={changed}
      onPick={c => onAsk(Number(c))} />
  );
}

// What comes next, in order, each guess underlined: the drop day and the ending. Pickup times are not set here: when a
// buyer asks, the person taps the days and times that work (decision "no fixed pickup windows", 2026-11-15); the plan
// only sets the last one, the evening before the move.
function Until({ r, today, spot, ending, setEnding, posts, lowers }: {
  r: Room; today: boolean; spot: string; ending: Ending; setEnding: (e: Ending) => void; posts: number; lowers: number;
}) {
  const ahead = (t: string) => ms(t) > ms(r.now);
  return (
    <Section>
      <Txt role="headline">{`Until ${dayName(r.moving)}`}</Txt>
      <List>
        {today ? (
          <Row lead={<Icon name="calendar-03" />}>
            <Txt role="body">Today</Txt>
            <Txt role="caption">{[posts ? `${posts} ${posts === 1 ? 'goes' : 'go'} up` : '', lowers ? `${lowers} ${lowers === 1 ? 'gets' : 'get'} cheaper` : ''].filter(Boolean).join(', ') || 'Nothing changes yet'}</Txt>
          </Row>
        ) : null}
        {ahead(r.drop_at) ? (
          <Row lead={<Icon name="calendar-03" />}>
            <Txt role="body">{`${day(r.drop_at, r.now)} at ${clock(r.drop_at)}`}</Txt>
            <Txt role="caption">{`What’s left drops to your lowest. Shipping stops at ${clock(r.ship_stops)}.`}</Txt>
          </Row>
        ) : null}
        {ahead(r.free_at) ? (
          <Row lead={<Icon name="calendar-03" />}>
            <Txt role="body">{`${day(r.free_at, r.now)} at ${clock(r.free_at)}`}</Txt>
            <GuessPick id="ending" name={`What’s left ${day(r.free_at, r.now)}`} value={ending} choices={ENDINGS(spot)} onPick={e => { log.event('user.input', { screen: 'gone-by', control: 'ending', value: e }); setEnding(e as Ending); }} />
          </Row>
        ) : null}
        <Row lead={<Icon name="location-01" />}>
          <Txt role="body">{`Pickups until ${when(r.last_handover, r.now)}`}</Txt>
          <Txt role="caption">{`When a buyer asks, you pick the days and times. At ${spot}.`}</Txt>
        </Row>
      </List>
    </Section>
  );
}

// Tapping a thing: why the agent put it where it is, its fates while the plan is open, and the way to its page.
// The rows carry the opener's id: the tile's, or the miss card's "More", whose sheet adds the one choice only the person can make.
function ThingSheet({ t, spot, drop, miss, editable, onPick }: { t: Thing; spot: string; drop: string; miss: boolean; editable: boolean; onPick: (p: Pick) => void }) {
  const live = t.item.listings.some(l => l.state === 'live');
  const sold = t.fate === 'sold' || ['gone', 'ship', 'pickup'].includes(t.now);
  // In order of what the person ends up with: money, the thing, nothing, and last, not theirs to decide.
  const choices = [
    ...(miss && t.lowest != null ? [{ id: 'lower', label: `Lower it to ${usd(under(t.lowest))}`, does: `Under your lowest of ${usd(t.lowest)}. You get ${usd(keepAt(t, under(t.lowest)))}.` }] : []),
    { id: 'sell', label: miss ? `Leave it at ${usd(t.ask ?? 0)}` : 'Sell it', does: miss ? 'It stays up until the last pickup.' : t.ask && t.lowest ? `At ${usd(t.ask)}, down to ${usd(t.lowest)} by ${drop}.` : 'At the price similar ones sell for.' },
    { id: 'keep', label: 'Keep it', does: live ? 'Comes with you. Comes off every site.' : 'Comes with you.' },
    { id: 'give', label: 'Give it away', does: `Free for pickup at ${spot}.${live ? ' Comes off the other sites.' : ''}` },
    { id: 'out', label: 'Not mine', does: 'Leaves it out of this plan. Nothing changes on it.' },
  ];
  return (
    <Stack>
      <Txt role="body" tone="ink-2">{t.why}</Txt>
      {sold && t.keep != null ? <Txt role="body">{`You get ${usd(t.keep)}`}</Txt> : null}
      {editable && !sold ? <Choices id={miss ? 'miss-more' : `thing-${t.item.id}`} choices={choices} value={t.fate} onPick={f => onPick(f as Pick)} /> : null}
      {/* A way back to each site it is live on, by the site's logo, never its name in words (Ben, 06:19: "always have a way to go back to the site"). */}
      {t.item.listings.filter(l => l.state === 'live').map(l => (
        <Line key={l.id}>
          <SiteBadge site={l.site} />
          <Pill id={`open-site-${l.site}`} kind="second" icon="link-01" label="Open on the site" onPress={() => { log.event('user.input', { screen: 'gone-by', control: 'open-site', item: t.item.id, value: l.site }); openMarketplace(l.url).catch(e => log.error('gone-by.open-site', e, { item: t.item.id, site: l.site })); }} />
        </Line>
      ))}
      <FootButton id="open-item" kind="second" label="Open the item" onPress={() => router.push(`/item/${t.item.id}` as Href)} />
    </Stack>
  );
}
