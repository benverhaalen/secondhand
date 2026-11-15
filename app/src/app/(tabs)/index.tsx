// Today (spec/pages.md §6.2): what needs me, and how am I doing. The money kept since the last look at the top, only when
// there is some; then one feed of decisions in three tiers, ordered by what ignoring a card costs; the notices; and one
// quiet line for what the agent did on its own, which opens its log with Undo. The words and order come from
// app/src/today/cards.ts; every decision about this page is in app/behavior/(tabs)/index.json.
// The person and the state come from useScreen() (app/src/demo/screen.ts): ?state=new|empty|one|typical|dense|loading|
// failed|offline and ?world=<name>. Two extras are Today's own: ?world=stops, the clearing day things went wrong (edge cases
// §1 and §7), and ?fail=<decision id>,..., which makes those acts fail once so a failed card can be reached.
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Linking } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ms, usd, when, world } from '@/demo';
import { useScreen } from '@/demo/screen';
import { photo } from '@/demo/photos';
import {
  DecisionCard, EmptyState, Feed, FootButton, Icon, Line, List, MoneyNews, Nav, Notice, Pile, Pill, Photo, QueueView, Row, Screen, Section, Sheet, SiteBadge, Skeleton,
  Stack, TopSlot, Txt, UndoToast, Approve, Guess, type PhotoSrc, type QueueEntry,
} from '@/ui';
import { Shelf } from '@/ui/parts/tile';
import { oneCardWorld, quietWorld, stopsWorld } from '@/today/stops';
import { JOB_MS, TIER_LABEL, tiers as deriveTiers, backAt, cards as derive, entries as queueEntries, group, handledLine, log as autoLog, notices as deriveNotices, top as deriveTop, inbox, fit, sales as twoSales, single, type Action, type Card } from '@/today/cards';

type Status = { s: 'working' | 'failed'; step?: string; option?: string };
type Toast = { id: string; text: string; undo: () => void };
const go = (to: string) => router.push(to as Href);
// The demo photo for a key, as the Photo part takes it.
const pic = (key: Parameters<typeof photo>[0] | null) => (key ? (photo(key) as PhotoSrc) : null);
const cents = (s: string) => Math.round(Number(s.replace(/[^0-9.]/g, '')) * 100);

export default function Today() {
  const { state: asked, name: picked } = useScreen();
  const params = useLocalSearchParams<{ world?: string; fail?: string }>();
  const offline = asked === 'offline', loading = asked === 'loading';
  // empty draws this page with nothing on it; failed (asked for in the URL) is the page that did not load, with Try again.
  const bare = asked === 'empty' || asked === 'failed' || loading;
  // stops: the clearing world on a day things went wrong (app/src/today/stops.ts, spec/edge-cases.md §1 and §7). one: one
  // card, since the demo's one world has nothing to decide (stops.ts, oneCardWorld). empty: a quiet month with things live
  // (stops.ts, quietWorld), so new, one and empty each show a different rung of the top's ladder (cards.ts, top).
  const name = params.world === 'stops' ? 'stops' : params.world ? picked : asked === 'one' ? 'one-card' : asked === 'empty' ? 'quiet' : picked;
  const w = useMemo(() => (name === 'stops' ? stopsWorld : name === 'one-card' ? oneCardWorld : name === 'quiet' ? quietWorld : world(name)), [name]);
  // Deadlines are in the world's time; the countdown runs on the real clock from the moment the page opened.
  const [shift] = useState(() => Date.now() - ms(w.now));
  const failOnce = useRef(new Set((params.fail ?? '').split(',').filter(Boolean)));

  const [gone, setGone] = useState<Set<string>>(new Set());
  const [left, setLeft] = useState<Record<string, string[]>>({});
  const [split, setSplit] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [more, setMore] = useState<Card | null>(null);
  const [amount, setAmount] = useState<{ card: Card; action: Extract<Action, { do: 'amount' }>; value: string; changed: boolean; warned?: boolean } | null>(null);
  const [queue, setQueue] = useState<{ card: Card; total: number } | null>(null);
  const [queueStatus, setQueueStatus] = useState<{ s: 'ready' | 'working' | 'failed'; failed?: string }>({ s: 'ready' });
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [logOpen, setLogOpen] = useState(false);
  const [compare, setCompare] = useState<Card | null>(null);
  // The lower tiers fanned out by the person (Ben 07:12); every tier starts piled.
  const [fanned, setFanned] = useState<Set<string>>(new Set());
  const fan = (tier: string, on: boolean) => setFanned(f => { const n = new Set(f); if (on) n.add(tier); else n.delete(tier); return n; });
  const [undone, setUndone] = useState<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, n = 1) => { timers.current.push(setTimeout(fn, JOB_MS * n)); };

  // The feed as it stands: what the data holds, less what was answered here, with batches shown one by one when asked.
  const feed = useMemo(() => derive(w).flatMap(c => {
    if (split.has(c.key)) return w.decisions.filter(d => c.ids.includes(d.id)).map(d => fit(single(w, d)));
    const ids = left[c.key];
    return ids ? (ids.length ? [{ ...group(w, ids, c.form), key: c.key }] : []) : [c];
  }).filter(c => !gone.has(c.key) && !bare), [w, gone, left, split, bare]);
  // The top holds on an empty page too: it is the number, not a row. Loading and a page that did not load have none.
  const top = loading || asked === 'failed' ? null : deriveTop(w), line = handledLine(w), notices = deriveNotices(w), events = autoLog(w);
  // The tiers, with the notices and the handled line at the end of Good to know: they ask nothing, so they are its rows (pages §6.2).
  const quiet = (notices.length > 0 || !!line) && !bare;
  const tiers = useMemo(() => {
    // Every tier under its header, as Sell's shelves (cards.ts, TIER_LABEL).
    const out = deriveTiers(feed);
    if (quiet && out.at(-1)?.tier !== 'good_to_know') out.push({ tier: 'good_to_know', label: TIER_LABEL.good_to_know, cards: [] });
    return out;
  }, [feed, quiet]);
  // The one card nearest its deadline takes its state's gradient (Art. 5, State gradients rule 2).
  const lead = feed.find(c => c.due != null && (status[c.key]?.s ?? c.status) !== 'failed')?.key;

  const unread = inbox(w);

  const leave = useCallback((c: Card, text: string, restore: () => void) => {
    setGone(g => new Set(g).add(c.key));
    setToast({ id: `${c.key}-undo`, text, undo: () => { restore(); setGone(g => { const n = new Set(g); n.delete(c.key); return n; }); setToast(null); } });
  }, []);

  // One tap acts: the pressed pill shows the step, then the card leaves with Undo, or stays and says what failed.
  function act(c: Card, a: Action, value?: number) {
    if (a.do === 'open') return go(a.to);
    if (a.do === 'site') { Linking.openURL(a.url).catch(() => setToast({ id: `${c.key}-site-failed`, text: 'The site did not open', undo: () => setToast(null) })); return; }
    if (a.do === 'queue') { setQueue({ card: c, total: c.ids.length }); setQueueStatus({ s: 'ready' }); return; }
    if (a.do === 'compare') { setCompare(c); return; }
    if (a.do === 'split') { setSplit(s => new Set(s).add(c.key)); return; }
    if (a.do === 'later') { leave(c, backAt(w, c.due), () => {}); return; }
    if (a.do === 'amount' && value == null) { setAmount({ card: c, action: a, value: usd(a.cents), changed: false }); return; }
    const done = a.do === 'amount' ? `${a.done} ${usd(value!)}` : a.done;
    // No signal: the tap is taken and held, and the card says so; it goes when the signal returns (operation_id makes a late send safe).
    if (offline) { setStatus(s => ({ ...s, [c.key]: { s: 'working', step: 'Waiting for signal', option: a.id } })); return; }
    if (c.form === 'batch' && c.ids.length > 1) {
      // A batch counts its items and fails per item: the ones that went leave, the ones that failed stay on the card.
      const n = c.ids.length;
      c.ids.forEach((_, i) => later(() => setStatus(s => ({ ...s, [c.key]: { s: 'working', step: `${i + 1} of ${n}` } })), i));
      setStatus(s => ({ ...s, [c.key]: { s: 'working', step: `1 of ${n}` } }));
      later(() => {
        const bad = c.ids.filter(id => failOnce.current.has(id)); bad.forEach(id => failOnce.current.delete(id));
        if (bad.length) {
          setLeft(l => ({ ...l, [c.key]: bad }));
          const what = bad.length === 1 ? (w.items.find(i => i.id === w.decisions.find(d => d.id === bad[0])?.item_id)?.title ?? 'One') : `${bad.length} of ${n}`;
          setStatus(s => ({ ...s, [c.key]: { s: 'failed', step: `${what} did not go through` } }));
        } else { setStatus(s => { const x = { ...s }; delete x[c.key]; return x; }); leave(c, done, () => {}); }
      }, n);
      return;
    }
    setStatus(s => ({ ...s, [c.key]: { s: 'working', step: a.do === 'act' ? a.step : 'Sending', option: a.id } }));
    later(() => {
      if (failOnce.current.has(c.ids[0])) {
        failOnce.current.delete(c.ids[0]);
        setStatus(s => ({ ...s, [c.key]: { s: 'failed', step: 'The site did not answer', option: a.id } }));
        return;
      }
      setStatus(s => { const x = { ...s }; delete x[c.key]; return x; });
      leave(c, done, () => {});
    });
  }

  // The queue, one item at a time: each Post leaves the stack, and the last one closes it and takes the card away.
  const qEntries: QueueEntry[] = useMemo(() => {
    if (!queue) return [];
    const ids = left[queue.card.key] ?? queue.card.ids;
    return queueEntries(w, { ...queue.card, ids }).map(e => ({ id: e.id, title: e.title, photo: pic(e.photo), price: prices[e.id] ?? usd(e.cents), sites: e.sites }));
  }, [queue, left, prices, w]);
  function queueStep(e: QueueEntry, how: 'post' | 'skip') {
    if (!queue) return;
    const key = queue.card.key, before = left[key] ?? queue.card.ids;
    const next = () => {
      const rest = before.filter(id => id !== e.id);
      setLeft(l => ({ ...l, [key]: rest }));
      setQueueStatus({ s: 'ready' });
      setToast({ id: `${key}-undo`, text: how === 'post' ? `Posted at ${e.price}` : 'Kept as a draft', undo: () => { setLeft(l => ({ ...l, [key]: before })); setToast(null); } });
      if (!rest.length) setQueue(null);
    };
    if (how === 'skip') return next();
    setQueueStatus({ s: 'working' });
    later(() => {
      if (failOnce.current.has(e.id)) { failOnce.current.delete(e.id); setQueueStatus({ s: 'failed', failed: 'A site did not answer. Nothing was posted.' }); return; }
      next();
    });
  }

  // The state, in the names every screen is checked in (.agents/ui-states.json): a world is a state of the page.
  const failing = Object.values(status).some(s => s.s === 'failed') || feed.some(c => c.status === 'failed');
  const state = asked ?? (name === 'new' ? 'new' : !feed.length ? 'empty' : failing || name === 'stops' ? 'failed' : name === 'flipper' ? 'dense' : 'typical');
  const toastEl = toast ? <UndoToast key={toast.id} id={toast.id} text={toast.text} onUndo={toast.undo} onGone={() => setToast(null)} /> : null;

  return (
    // The wash sits on every main tab, whatever the top holds (Ben 06:21: "sometimes the gradient at the top of the screen is
    // there or isnt there").
    <Screen name="today" state={state} wash nav={<Nav inbox={{ count: unread }} />} foot={queue ? undefined : toastEl}>
      {/* The most flattering true number, by the ladder in cards.ts (Ben 07:12); with nothing listed, one way forward. */}
      {top && top.rung !== 'start' ? (
        <MoneyNews caption={top.caption} figure={top.figure} line={top.line} onPress={() => go(top.to)}
          things={top.things.map(x => ({ id: x.id, title: x.title, photo: pic(x.photo), site: x.site }))} />
      ) : null}
      {top?.rung === 'start' ? <TopSlot setup={{ id: 'top-setup', line: top.line, step: top.step, onPress: () => go(top.to) }} /> : null}

      {/* Nothing to decide. A new person has the setup step above and one way to start; anyone else is told it is clear. */}
      {offline ? <Txt role="caption" tone="ink-2">Waiting for signal</Txt> : null}
      {top?.rung === 'start' && !feed.length ? null
        : asked === 'failed' ? <EmptyState title="Today didn’t load" action={{ id: 'retry', label: 'Try again', onPress: () => router.setParams({ state: '' }) }} />
        : !feed.length && !loading ? <EmptyState title="Nothing needs you" /> : null}

      {loading ? (
        <Stack gap="cards"><Skeleton of="card-decision" /><Skeleton of="card-decision" /><Skeleton of="notice" /></Stack>
      ) : tiers.map(t => {
        // Needs you now stays spread: hiding a deadline there breaks Today's promise. The lower tiers pile, the top card the
        // soonest or the most money (the feed's own order), a queue never on top since it is its own stack.
        const piles = t.tier !== 'now' && t.cards.length > 1, open = fanned.has(t.tier);
        const list = piles && t.cards[0].form === 'queue' ? [...t.cards.slice(1), t.cards[0]] : t.cards;
        const leadCard = list.find(c => c.key === lead);
        // The lead card's color says why it leads, in words over it (Ben 06:19: "I don't really know why the first entry is
        // like colored"): it is the one due first.
        const why = leadCard?.due != null ? (
          <Line>
            <Icon name="clock-01" size={12} tone="ink-2" />
            <Txt role="caption">{`Due first, ${when(new Date(leadCard.due).toISOString(), w.now)}`}</Txt>
          </Line>
        ) : null;
        const drawn = list.map(c => {
              const st = status[c.key], s = st?.s ?? c.status;
              const { primary, second } = c;
              return (
                <DecisionCard
                  key={c.key} id={c.key} kind={c.tag} word={c.word} title={c.title} photo={pic(c.photo)} site={c.site ?? undefined}
                  fact={{ label: c.fact.label, amount: c.fact.cents != null ? c.fact.cents / 100 : undefined }}
                  due={c.due != null ? c.due + shift : undefined} lead={c.key === lead} form={c.form} waiting={c.waiting}
                  status={s} step={st?.step ?? (s === 'working' && c.primary.do === 'act' ? c.primary.step : c.failed)}
                  primary={{ id: primary.id, label: primary.label, onPress: () => act(c, primary) }}
                  second={second ? { id: second.id, label: second.label, onPress: () => act(c, second) } : undefined}
                  more={c.more.length ? { id: `${c.key}-more`, label: 'More', onPress: () => setMore(c) } : undefined}
                  onOpen={() => (c.form === 'queue' ? act(c, c.primary) : go(c.open))}
                />
              );
        });
        return (
        <Shelf key={t.tier} id={t.tier} title={t.label ?? TIER_LABEL[t.tier]}
          count={t.cards.length + (t.tier === 'good_to_know' && quiet ? notices.length + (line ? 1 : 0) : 0)}
          onAll={piles && !open ? () => fan(t.tier, true) : undefined} onLess={piles && open ? () => fan(t.tier, false) : undefined}>
          {why}
          {!t.cards.length ? null : piles ? <Pile id={t.tier} open={open} onOpen={() => fan(t.tier, true)}>{drawn}</Pile> : <Feed>{drawn}</Feed>}
          {t.tier === 'good_to_know' && quiet ? (
            <>
              {notices.map(n => <Notice key={n.id} id={n.id} icon={n.icon} text={n.text} onPress={() => go(n.to)} />)}
              {line ? <Notice id="handled" icon="tick-02" text={line} onPress={() => setLogOpen(true)} /> : null}
            </>
          ) : null}
        </Shelf>
        );
      })}

      <Sheet open={!!more} title={more?.title} onClose={() => setMore(null)}>
        {more ? (
          <Stack gap="tight">
            {more.more.map(a => <FootButton key={a.id} id={a.id} kind="second" icon={a.icon} label={a.label} onPress={() => { const c = more; setMore(null); act(c, a); }} />)}
          </Stack>
        ) : null}
      </Sheet>

      <Sheet open={!!amount} title={amount?.card.title} onClose={() => setAmount(null)}>
        {amount ? (
          <Stack>
            <Txt role="caption" tone="ink-2">{amount.action.name}</Txt>
            <Guess id="amount-value" name={amount.action.name} value={amount.value} numeric changed={amount.changed}
              onChange={v => setAmount({ ...amount, value: usd(cents(v)), changed: true, warned: false })} />
            {/* Under the lowest the person set, it asks once (edge-cases §3): the line says so and a second tap sends it. */}
            {amount.warned && amount.action.floor ? <Txt role="caption" tone="ink-2">{`Under your lowest, ${usd(amount.action.floor)}. Tap again to send it.`}</Txt> : null}
            <Approve id="amount-send" does={`${amount.action.verb} ${amount.value}`} onApprove={() => {
              const a = amount, v = cents(a.value);
              if (a.action.floor && v < a.action.floor && !a.warned) { setAmount({ ...a, warned: true }); return; }
              setAmount(null); act(a.card, a.action, v);
            }} />
          </Stack>
        ) : null}
      </Sheet>

      {/* A double sale, side by side: each site, the buyer's price, what it keeps and what cancelling it costs (edge-cases §1). */}
      <Sheet open={!!compare} title="Sold twice" onClose={() => setCompare(null)}>
        {compare ? (() => {
          const d = w.decisions.find(x => x.id === compare.ids[0]), two = d ? twoSales(w, d) : [];
          return (
            <Stack>
              <List>
                {two.map((o, i) => (
                  <Row key={o.id} lead={<SiteBadge site={o.site} />}
                    trail={i ? <Pill id={`${compare.key}-keep-second`} kind="second" label="Keep this" onPress={() => { const c = compare; setCompare(null); const a = c.more.find(m => m.id.endsWith('-second')); if (a) act(c, a); }} /> : null}>
                    <Txt role="body" lines={1}>{`${o.buyer} paid ${usd(o.price)}${i ? '' : ', first'}`}</Txt>
                    <Txt role="caption" tone="ink-2">{`You get ${usd(o.keep)}. ${o.cancel}.`}</Txt>
                  </Row>
                ))}
              </List>
              <Approve id={`${compare.key}-keep-first`} does={two[0] && two[1] ? `Keep ${two[0].buyer}’s, cancel ${two[1].buyer}’s` : 'Keep the first'}
                onApprove={() => { const c = compare; setCompare(null); act(c, c.primary); }} />
            </Stack>
          );
        })() : null}
      </Sheet>

      <Sheet open={logOpen} title="Done for you" onClose={() => setLogOpen(false)}>
        <List>
          {events.slice(0, 5).map(e => (
            <Row key={e.event_id} lead={<Photo src={pic(e.photo)} label={e.why} />}
              trail={e.can_undo ? (undone.has(e.event_id) ? <Txt role="caption" tone="ink-2">Undone</Txt>
                : <Pill id={`log-undo-${e.event_id}`} kind="second" label="Undo" onPress={() => setUndone(u => new Set(u).add(e.event_id))} />) : null}>
              <Txt role="body" lines={2}>{e.why}</Txt>
              {e.site ? <SiteBadge site={e.site} /> : null}
            </Row>
          ))}
        </List>
        <Notice id="log-all" icon="clock-01" text="Everything it did" onPress={() => { setLogOpen(false); go('/you/automation'); }} />
      </Sheet>

      <QueueView
        id="queue" open={!!queue} title="Ready to post" entries={qEntries} total={queue?.total ?? 0}
        does={qEntries[0] ? `Post at ${qEntries[0].price} on ${qEntries[0].sites.length === 1 ? 'one site' : `${qEntries[0].sites.length} sites`}` : ''}
        status={queueStatus.s} step="Posting" failed={queueStatus.failed} toast={queue ? toastEl : null}
        onPrice={v => qEntries[0] && setPrices(p => ({ ...p, [qEntries[0].id]: usd(cents(v)) }))}
        onApprove={e => queueStep(e, 'post')} onSkip={e => queueStep(e, 'skip')}
        onEdit={e => { const it = w.decisions.find(d => d.id === e.id)?.item_id; setQueue(null); if (it) go(`/item/${it}`); }}
        onClose={() => setQueue(null)}
      />
    </Screen>
  );
}
