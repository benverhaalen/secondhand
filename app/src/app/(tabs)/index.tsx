import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Linking } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ms, usd, world } from '@/demo';
import { useScreen } from '@/demo/screen';
import { photo } from '@/demo/photos';
import {
  DecisionCard, EmptyState, FootButton, List, Notice, Pill, QueueView, Row, Screen, Section, Sheet, SiteBadge, Skeleton,
  Stack, Txt, UndoToast, Approve, Guess, type PhotoSrc, type QueueEntry,
} from '@/ui';
import { TodayRail } from '@/ui/parts/today-rail';
import { TabNav } from '@/ui/parts/tab-nav';
import { oneCardWorld, quietWorld, stopsWorld } from '@/today/stops';
import { JOB_MS, backAt, cards as derive, entries as queueEntries, group, handledLine, notices as deriveNotices, inbox, fit, sales as twoSales, single, type Action, type Card } from '@/today/cards';
import { log } from '@/ui/log';

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
  const [compare, setCompare] = useState<Card | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, n = 1) => { timers.current.push(setTimeout(fn, JOB_MS * n)); };

  // The feed as it stands: what the data holds, less what was answered here, with batches shown one by one when asked.
  const feed = useMemo(() => derive(w).flatMap(c => {
    if (split.has(c.key)) return w.decisions.filter(d => c.ids.includes(d.id)).map(d => fit(single(w, d)));
    const ids = left[c.key];
    return ids ? (ids.length ? [{ ...group(w, ids, c.form), key: c.key }] : []) : [c];
  }).filter(c => !gone.has(c.key) && !bare), [w, gone, left, split, bare]);
  const line = handledLine(w), notices = deriveNotices(w);
  const quiet = notices.length > 0 && !bare;
  const tiers = [
    { tier: 'now', label: 'Needs You' },
    { tier: 'when_you_can', label: 'Can Wait' },
    { tier: 'good_to_know', label: 'Good to Know' },
  ].map(t => ({ ...t, cards: feed.filter(c => c.tier === t.tier) }));
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
    if (a.do === 'site') { Linking.openURL(a.url).catch(e => { log.error('today.open_site', e, { card: c.key }); setToast({ id: `${c.key}-site-failed`, text: 'The site did not open', undo: () => setToast(null) }); }); return; }
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
    <Screen name="today" state={state} wash nav={<TabNav title="Today" inbox={{ count: unread }} />} foot={queue ? undefined : toastEl}>
      {offline ? <Txt role="caption" tone="ink-2">Waiting for signal</Txt> : null}
      {asked === 'failed' ? <EmptyState title="Today didn’t load" action={{ id: 'retry', label: 'Try again', onPress: () => router.setParams({ state: '' }) }} /> : null}

      {loading ? (
        <Stack gap="cards"><Skeleton of="card-decision" /><Skeleton of="card-decision" /><Skeleton of="notice" /></Stack>
      ) : tiers.map(t => {
        const sameTag = t.cards.length > 1 && t.cards.every(c => c.tag === t.cards[0].tag);
        const drawn = t.cards.map(c => {
              const st = status[c.key], s = st?.s ?? c.status;
              // The lead keeps its second act on the card; on every other card it opens from More, first (U12).
              const { primary } = c, second = c.key === lead ? c.second : undefined, under = c.key !== lead && c.second ? [c.second, ...c.more] : c.more;
              return (
                <DecisionCard
                  key={c.key} id={c.key} kind={c.tag} word={c.word} title={c.title} photo={pic(c.photo)} site={c.site ?? undefined}
                  fact={{ label: c.fact.label, amount: c.fact.cents != null ? c.fact.cents / 100 : undefined }}
                  due={c.due != null ? c.due + shift : undefined} lead={c.key === lead} form={c.form} waiting={c.waiting}
                  status={s} step={st?.step ?? (s === 'working' && c.primary.do === 'act' ? c.primary.step : c.failed)}
                  primary={{ id: primary.id, label: primary.label, onPress: () => act(c, primary) }}
                  second={second ? { id: second.id, label: second.label, onPress: () => act(c, second) } : undefined}
                  more={under.length ? { id: `${c.key}-more`, label: 'More', onPress: () => setMore({ ...c, more: under }) } : undefined} quiet={sameTag}
                  onOpen={() => (c.form === 'queue' ? act(c, c.primary) : go(c.open))}
                />
              );
        });
        return (
          <Section key={t.tier} title={t.label}>
            <TodayRail id={t.tier}>
              {drawn}
              {t.tier === 'good_to_know' && quiet ? notices.map(n => <Notice key={n.id} id={n.id} icon={n.icon} text={n.text} onPress={() => go(n.to)} />) : null}
              {!drawn.length && !(t.tier === 'good_to_know' && quiet) ? <Txt key="empty" role="body" tone="ink-2">Nothing here</Txt> : null}
            </TodayRail>
          </Section>
        );
      })}

      {!loading && asked !== 'failed' ? (
        <Section title="Other">
          <TodayRail id="other">
            <Notice key="activity" id="activity" icon="clock-01" text={line ?? 'Activity'} onPress={() => go('/you/log')} />
          </TodayRail>
        </Section>
      ) : null}

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
            <Guess id="amount-value" name={amount.action.name} value={amount.value} numeric changed={amount.changed}
              onChange={v => setAmount({ ...amount, value: usd(cents(v)), changed: true, warned: false })} />
            {/* Under the lowest the person set, it asks once (edge-cases §3): the line says so and a second tap sends it. */}
            {amount.warned && amount.action.floor ? <Txt role="caption" tone="ink-2">{`Below your minimum of ${usd(amount.action.floor)}.`}</Txt> : null}
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
