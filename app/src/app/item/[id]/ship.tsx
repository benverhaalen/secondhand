// Ship: get a sold thing out the door before its ship-by time (spec/pages.md §6.9, spec/features/sold.md "Shipping").
// The label the site issues, or one bought for the box the measurements give; every label due printed in one go, with
// each one's progress and failure on its own row (the Shopify batch, sold.md "Batch print"); where to drop it off; and the
// ways out (spec/ways-out.md §6.9): ship it myself, with tracking or without and what that costs, and Cancel sale.
// Behavior: app/behavior/item/[id]/ship.json.
// one at a time: ship-box (alternatives of one state each; .agents/checks/screens.mjs S2)
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import {
  Approve, Blank, EmptyState, FootButton, Guess, Icon, ItemCard, Line, List, Meta, Nav, Notice, Photo, Pill, Press, Row, Screen, Section, Sheet, SiteCopy, SiteLink, Skeleton, Stack, Tag, Txt, UndoToast,
} from '@/ui';
import { Chip } from '@/ui/parts/chip';
import { itemById, ms, usd, when, world, type Decision, type Item, type Order, type World } from '@/demo';
import { CANCEL_REASONS, DROP_OFFS, NO_TRACKING, byDay, cancelCost, moneyPath, shippable, twoSold, withDoubleSale } from '@/demo/handover';
import { photo } from '@/demo/photos';
import { useScreen } from '@/demo/screen';
import { log } from '@/ui/log';

// The state Ship cannot be in, with why (B35, app/src/demo/screen.ts).
const SKIP = 'new: Ship opens only from a sale, and a person who has done nothing has sold nothing';
const pic = (key: Parameters<typeof photo>[0]) => photo(key) as number;
// The demo's clock is fixed; a countdown runs on the real one. A deadline keeps its distance from the demo's now, and
// counts down only inside a day, where it changes what the person does next (frontend-standard §5, Honesty).
const dueOf = (w: World, iso?: string) => { if (!iso) return undefined; const left = ms(iso) - ms(w.now); return left > 0 && left < 864e5 ? Date.now() + left : undefined; };

type Due = { order: Order; item: Item; label: Decision | undefined; cost: number };
type Run = 'waiting' | 'working' | 'done' | 'failed';

// Every sale waiting for its label, soonest ship-by first: the batch one approval prints (sold.md, "Print 4 labels").
function dueToShip(w: World): Due[] {
  return shippable(w)
    .map(o => {
      const label = w.decisions.find(d => d.kind === 'buy_label' && d.order_id === o.id && d.state === 'open');
      return { order: o, item: itemById(w, o.item_id)!, label, cost: label?.money?.label_cents ?? 0 };
    })
    .filter(d => d.item)
    .sort((a, b) => ms(a.order.clocks.ship_by ?? '9999') - ms(b.order.clocks.ship_by ?? '9999'));
}
// What the label is, read from what the decision says it buys: "a USPS Ground Advantage label for a 9 by 6 by 1 inch padded mailer".
function labelOf(d?: Decision) {
  const does = d?.options.find(o => o.id === 'buy')?.does ?? '';
  return { service: /a (USPS [\w ]+?) label/.exec(does)?.[1] ?? null, box: /for an? (.+?)\.$/.exec(does)?.[1] ?? null };
}
// The one row in a batch that fails in the demo: a sale on a site whose sign-in is running out (connections, health expiring).
const failsHere = (w: World, d: Due) => w.connections.some(c => c.site === d.order.site && c.account?.health === 'expiring');

export default function Ship() {
  const p = useLocalSearchParams<{ id: string; world?: string; all?: string; case?: string }>();
  // ?state= draws over the clearing world, or the flipper's six sales for dense (app/src/demo/screen.ts): one is this sale's
  // label alone, typical and dense the batch, empty a sale with nothing left to ship, and offline holds the print.
  const s = useScreen();
  const asked = s.state;
  const base = p.world ? s.w : world(asked === 'dense' ? 'flipper' : 'clearing');
  // A state named in the URL wins over the double-sale case and over ?all, so every state opens from any of the page's links.
  const w = p.case === 'double' && !asked ? withDoubleSale(base, p.id) : base;
  const due = dueToShip(w);
  const mine = due.find(d => d.item.id === p.id) ?? (asked ? due[0] : undefined);
  const nav = <Nav back={() => back(p.id)} />;
  if (asked === 'loading') {
    return (
      <Screen name="ship" state="loading" skip={SKIP} nav={nav}>
        <Stack gap="cards"><Txt role="heading">Ship</Txt><Skeleton of="card-item" /></Stack>
      </Screen>
    );
  }
  if (asked === 'failed') {
    return (
      <Screen name="ship" state="failed" skip={SKIP} nav={nav}>
        <EmptyState title="This sale didn’t load" action={{ id: 'ship-retry', label: 'Try again', onPress: () => router.replace(`/item/${p.id}/ship` as Href) }} />
      </Screen>
    );
  }
  // Sold on two sites: no label for either until the person picks a buyer on the double sale card (spec/edge-cases.md §1).
  if (!mine && twoSold(w, p.id)) {
    return (
      <Screen name="ship" state="empty" skip={SKIP} nav={nav}>
        <EmptyState title="Sold on two sites" line="Pick which buyer gets it first. Its label comes after." action={{ id: 'ship-double', label: 'Open Today', onPress: () => router.replace('/' as Href) }} />
      </Screen>
    );
  }
  if (!mine || asked === 'empty') {
    return (
      <Screen name="ship" state="empty" skip={SKIP} nav={nav}>
        <EmptyState title="Nothing to ship" line="This item has no sale waiting for a label." action={{ id: 'ship-gone', label: 'Open the item', onPress: () => router.replace(`/item/${p.id}` as Href) }} />
      </Screen>
    );
  }
  return <ShipSheet w={w} due={due} mine={mine} startAll={asked ? asked === 'typical' || asked === 'dense' : p.all === '1'} offline={asked === 'offline'} />;
}
const back = (id: string) => (router.canGoBack() ? router.back() : router.replace(`/item/${id}` as Href));

function ShipSheet({ w, due, mine, startAll, offline }: { w: World; due: Due[]; mine: Due; startAll: boolean; offline: boolean }) {
  const [scope, setScope] = useState<'one' | 'all'>(startAll && due.length > 1 ? 'all' : 'one');
  const rows = scope === 'all' ? due : [mine];
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [status, setStatus] = useState<'ready' | 'working' | 'done' | 'shipped' | 'cancelled'>('ready');
  const [open, setOpen] = useState<null | 'self' | 'cancel'>(null);
  const [copy, setCopy] = useState(false);
  const saleUrl = mine.item.listings.find(l => l.id === mine.order.listing_id)?.url;
  const [tracked, setTracked] = useState<'with' | 'without'>('with');
  const [carrier, setCarrier] = useState(mine.order.label?.carrier ?? 'USPS');
  const [tracking, setTracking] = useState('');
  const [reason, setReason] = useState<(typeof CANCEL_REASONS)[number]['id']>('broke');
  const [saving, setSaving] = useState(false);
  const [speed, setSpeed] = useState<'free' | 'today'>('free');
  const money = moneyPath(mine.order, w.now);
  const instant = money[3].instant_cents;
  const [toast, setToast] = useState<null | { id: string; text: string; undo: () => void }>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // offline: a tap holds on its pill as "Waiting for signal" until the signal returns, as on Today.
  const later = (f: () => void, wait = 700) => { if (!offline) timers.current.push(setTimeout(f, wait)); };

  const total = rows.reduce((a, d) => a + d.cost, 0);
  const prepaid = rows.every(d => d.cost === 0);
  const count = rows.length;
  const does = count === 1 ? (prepaid ? 'Get the prepaid label' : `Buy label ${usd(total)}`) : `Print ${count} labels${total ? ` for ${usd(total)}` : ''}`;
  const printed = rows.filter(d => runs[d.order.id] === 'done').length;
  const failed = rows.filter(d => runs[d.order.id] === 'failed');

  // Each label runs in turn, so the step counts up and a failure lands on its own row while the rest carry on.
  const print = (list: Due[]) => {
    setStatus('working');
    list.forEach((d, i) => {
      later(() => setRuns(r => ({ ...r, [d.order.id]: 'working' })), i * 700);
      later(() => setRuns(r => ({ ...r, [d.order.id]: failsHere(w, d) ? 'failed' : 'done' })), i * 700 + 650);
    });
    later(() => setStatus('done'), list.length * 700 + 100);
  };
  const retry = (d: Due) => {
    setRuns(r => ({ ...r, [d.order.id]: 'working' }));
    later(() => setRuns(r => ({ ...r, [d.order.id]: 'done' })));
  };
  const undoLabels = () => { setRuns({}); setStatus('ready'); };
  const markShipped = () => {
    setSaving(true);
    later(() => { setSaving(false); setOpen(null); setStatus('shipped'); });
  };
  const cancel = () => {
    setSaving(true);
    later(() => { setSaving(false); setOpen(null); setStatus('cancelled'); });
  };

  const label = labelOf(mine.label);
  const state = offline ? 'offline' : status === 'cancelled' ? 'empty' : count > 1 ? (count > 4 ? 'dense' : 'typical') : 'one';
  const foot = status === 'cancelled' ? null : status === 'shipped'
    ? <Approve id="ship-done" does="" status="done" done={tracked === 'with' && tracking ? `Shipped, tracking ${tracking}` : 'Marked shipped'} onUndo={() => setStatus('ready')} />
    : (
      <Approve id="ship-print" does={does} status={status === 'ready' ? 'ready' : status === 'working' ? 'working' : 'done'}
        step={offline ? 'Waiting for signal' : count > 1 ? `${Math.min(count, printed + failed.length + 1)} of ${count}` : 'Printing'}
        done={failed.length ? `${printed} of ${count} printed` : count > 1 ? `${count} labels printed` : 'Label printed'}
        onApprove={() => print(rows)} onUndo={undoLabels} />
    );

  return (
    <Screen name="ship" state={state} skip={SKIP} foot={foot} nav={<Nav back={() => back(mine.item.id)} />}>
      <Stack gap="cards">
        <Stack gap="tight">
          <Txt role="heading">Ship</Txt>
          {offline ? <Meta icon="hourglass" text="Waiting for signal" /> : null}
        </Stack>
        <ItemCard id="ship-item" title={mine.item.title} photo={pic(mine.item.photos[0].key)} site={mine.order.site} state="ship" word={mine.order.clocks.ship_by ? `Ship by ${byDay(mine.order.clocks.ship_by, w.now)}` : 'Ship'}
          fact={{ label: 'You get', amount: usd(mine.order.price_cents - mine.order.fees_cents - mine.cost) }} due={dueOf(w, mine.order.clocks.ship_by)}
          onPress={() => router.push(`/item/${mine.item.id}` as Href)} />
        {/* The way back to the sale on its site, and the site's own picture of the order to check the ship-by date against (Ben, 06:19). */}
        <Line>
          {saleUrl ? <SiteLink id="ship-site" site={mine.order.site} onPress={() => { Linking.openURL(saleUrl).catch(e => log.error('ship.open', e)); }} /> : null}
          <Pill id="ship-snapshot" kind="second" icon="image-01" label="See the site’s copy" onPress={() => setCopy(true)} />
        </Line>
      </Stack>

      {status === 'cancelled' ? (
        <EmptyState title="Sale cancelled" line={`${mine.order.buyer} gets ${usd(mine.order.price_cents)} back.`} action={{ id: 'ship-close', label: 'Done', onPress: () => back(mine.item.id) }} />
      ) : (
        <>
          <Section title="Label">
            {due.length > 1 && status === 'ready' ? (
              <Line>
                <Chip id="ship-scope-one" label="This one" picked={scope === 'one'} onPress={() => setScope('one')} />
                <Chip id="ship-scope-all" label={`All ${due.length}`} picked={scope === 'all'} onPress={() => setScope('all')} />
              </Line>
            ) : null}
            {scope === 'one' ? (
              <List>
                {prepaid ? <Row lead={<Icon name="printer" />}><Txt role="body">The site’s own label. The buyer paid for it.</Txt></Row> : null}
                {label.service ? <Row lead={<Icon name="delivery-truck-01" />}><Guess id="ship-service" name="Service" value={label.service} look="body" /></Row> : null}
                {label.box ? <Row lead={<Icon name="package" />}><Guess id="ship-box" name="Box" value={label.box} look="body" /></Row> : null}
                {!prepaid && !label.box ? <Row lead={<Icon name="package" />}><Blank id="ship-box" name="Box size" look="body" /></Row> : null}
              </List>
            ) : (
              <List>
                {rows.map(d => {
                  const run = runs[d.order.id] ?? 'waiting';
                  return (
                    <Row key={d.order.id} lead={<Photo src={pic(d.item.photos[0].key)} label={d.item.title} />}
                      trail={run === 'failed' ? <Pill id={`retry-${d.order.id}`} kind="second" icon="refresh" label="Retry" onPress={() => retry(d)} />
                        : run === 'done' ? <Tag state="ship" word="Printed" />
                        : run === 'working' ? <Tag state="working" word="Printing" />
                        : <Txt role="body" tabular>{d.cost ? usd(d.cost) : 'Prepaid'}</Txt>}>
                      <Txt role="body" lines={1}>{d.item.title}</Txt>
                      <Txt role="caption" lines={1}>{run === 'failed' ? 'The site asked you to sign in again' : `Ship by ${when(d.order.clocks.ship_by!, w.now)}`}</Txt>
                    </Row>
                  );
                })}
              </List>
            )}
          </Section>

          <Section title="Drop it off">
            <List>
              {DROP_OFFS.map(s => (
                <Press key={s.id} id={`dropoff-${s.id}`} label={s.name} round={false}
                  onPress={() => (s.kind === 'door'
                    ? setToast({ id: 'pickup-undo', text: `Pickup set for ${when(s.next_open, w.now)}`, undo: () => setToast(null) })
                    : Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(s.name)}`).catch(e => log.error('ship.open', e)))}>
                  <Row lead={<Icon name={s.kind === 'door' ? 'delivery-truck-01' : 'location-01'} />} trail={<Icon name="arrow-right-01" size={20} tone="ink-2" />}>
                    <Txt role="body" lines={1}>{s.name}</Txt>
                    <Txt role="caption" lines={1}>{s.kind === 'door' ? `Free, ${when(s.next_open, w.now)}` : `${s.distance_mi} mi, opens ${when(s.next_open, w.now)}`}</Txt>
                  </Row>
                </Press>
              ))}
            </List>
          </Section>

          {scope === 'one' ? (
            <Section title="Your money">
              <List>
                {money.map((s, i) => (
                  <Row key={s.word} lead={<Icon name={s.done || (i === 1 && status === 'shipped') ? 'tick-02' : 'clock-01'} tone={s.done ? 'ink' : 'ink-2'} />}>
                    <Txt role="body" lines={1}>{s.word}</Txt>
                    <Txt role="caption" lines={2}>{i === 3 && speed === 'today' && instant ? `The day it’s ready, for ${usd(instant)}` : s.line}</Txt>
                  </Row>
                ))}
              </List>
              {instant ? (
                <Line>
                  <Chip id="payout-speed-free" label="Standard, free" picked={speed === 'free'} onPress={() => setSpeed('free')} />
                  <Chip id="payout-speed-today" label={`Same day, ${usd(instant)}`} picked={speed === 'today'} onPress={() => setSpeed('today')} />
                </Line>
              ) : null}
            </Section>
          ) : null}

          {status !== 'shipped' ? (
            <Section>
              <Notice id="ship-myself" icon="package" text="I’ll ship it myself" onPress={() => setOpen('self')} />
              <Notice id="ship-cancel" icon="cancel-01" text="Cancel sale" onPress={() => setOpen('cancel')} />
            </Section>
          ) : null}
        </>
      )}

      <SiteCopy id="ship-copy" open={copy} site={mine.order.site} onClose={() => setCopy(false)}
        onOpen={() => { setCopy(false); if (saleUrl) Linking.openURL(saleUrl).catch(e => log.error('ship.open', e)); }} />

      <Sheet open={open === 'self'} title="Ship it myself" onClose={() => setOpen(null)}>
        <Line>
          <Chip id="self-tracking-with" label="With tracking" picked={tracked === 'with'} onPress={() => setTracked('with')} />
          <Chip id="self-tracking-without" label="Without" picked={tracked === 'without'} onPress={() => setTracked('without')} />
        </Line>
        {tracked === 'with' ? (
          <Stack>
            <Guess id="self-carrier" name="Carrier" value={carrier} onChange={setCarrier} />
            <Blank id="self-number" name="Tracking number" value={tracking} onChange={setTracking} />
          </Stack>
        ) : <Txt role="body">{NO_TRACKING}</Txt>}
        <Approve id="self-save" does={tracked === 'with' ? 'Mark shipped' : 'Mark shipped without tracking'} status={saving ? 'working' : 'ready'} step="Saving" onApprove={markShipped} />
      </Sheet>

      <Sheet open={open === 'cancel'} title="Cancel sale" onClose={() => setOpen(null)}>
        <Line>
          {CANCEL_REASONS.map(r => <Chip key={r.id} id={`cancel-reason-${r.id}`} label={r.label} picked={reason === r.id} onPress={() => setReason(r.id)} />)}
        </Line>
        <Stack gap="tight">
          <Txt role="body">{`${mine.order.buyer} gets ${usd(mine.order.price_cents)} back.`}</Txt>
          <Txt role="body" tone="ink-2">{cancelCost(mine.order.site, mine.order.price_cents)}</Txt>
        </Stack>
        <FootButton id="cancel-confirm" kind="second" label="Cancel sale" state={saving ? 'working' : 'idle'} step="Cancelling" onPress={cancel} />
      </Sheet>

      {toast ? <UndoToast id={toast.id} text={toast.text} onUndo={toast.undo} onGone={() => setToast(null)} /> : null}
    </Screen>
  );
}
