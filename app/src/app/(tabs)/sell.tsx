// Sell: everything the person sells, as photo tiles in shelves by state (pages §6.10; decision: the Sell tab is a photo
// grid with state pills), filtered by one row (Ben, round 11). Every number and word about a thing comes from the demo
// world; the page only chooses what to show. Why each element is here is in app/behavior/(tabs)/sell.json, "decisions".
// one at a time: bulk-approve (alternatives of one state each; .agents/checks/screens.mjs S2)
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Approve, EmptyState, FootButton, Grid, List, log, Pill, Screen, Sheet, Stack, Txt, UndoToast, type PhotoSrc, type TagState } from '@/ui';
import { TabNav } from '@/ui/parts/tab-nav';
import { Chip, Choice, FilterRow } from '@/ui/parts/chip';
import { Shelf, Tile, TileSkeleton, type TileFact } from '@/ui/parts/tile';
import { day, feed, pill, sellItem, shelves, unread, usd, type Item, type World } from '@/demo';
import { useScreen } from '@/demo/screen';
import { photo } from '@/demo/photos';
import { shortName } from '@/demo/short-name';
import { filtersFor, viewItems, type Site, type Sort } from '@/sell/grid';

// Two rows of a shelf before See all: enough to recognise it, few enough that 64 things stay one screen per shelf.
const PER_SHELF = 4;
const COLUMNS = 2;
const SORTS: { id: Sort; label: string; chip: string }[] = [
  { id: 'latest', label: 'Latest first', chip: 'Latest' },
  { id: 'price_high', label: 'Price, high to low', chip: 'Price, high' },
  { id: 'price_low', label: 'Price, low to high', chip: 'Price, low' },
];
type Change = 'keep' | 'donated' | 'sold_elsewhere' | 'delete';
const OPEN_ORDER = ['paid', 'pickup_booked', 'to_ship', 'shipped', 'delivered', 'claim_window', 'return_open', 'dispute_open'];

// What an open decision asks, in the tag's one word (product.md §5 decision kinds). Anything else says Needs you.
const ASKS: Record<string, string> = {
  reply_other: 'Question', answer_fact: 'Question', scam_warning: 'Scam', markdown: 'Price', price_below_floor: 'Offer',
  leave_review: 'Rate buyer', share_address: 'Address', relist: 'Relist', buy_label: 'Label',
};

// Each shelf the person folds stays folded for them (Ben, 06:19: "collapsible"): in memory for the demo, and in the
// browser's storage on the web so a reload keeps it. Unsold and Kept start folded: they are not for sale (pages §6.10).
const FOLDED_FIRST = ['unsold', 'kept'];
const MEMORY: Record<string, Record<string, boolean>> = {};
const KEY = (who: string) => `sell.folds.${who}`;
function readFolds(who: string): Record<string, boolean> {
  if (MEMORY[who]) return MEMORY[who];
  let kept: Record<string, boolean> = {};
  try { const v = globalThis.localStorage?.getItem(KEY(who)); if (v) kept = JSON.parse(v); } catch (e) { log.error('sell.folds_read', e, { who }); kept = {}; }
  return (MEMORY[who] = kept);
}
function writeFolds(who: string, folds: Record<string, boolean>) {
  MEMORY[who] = folds;
  try { globalThis.localStorage?.setItem(KEY(who), JSON.stringify(folds)); } catch (e) { log.error('sell.folds_write', e, { who }); }
}

// A value is a range said the way a friend says it, in whole dollars, widened outward so it never claims more (copy.md).
const wholeRange = (r: { low: number; high: number }) => `${usd(Math.floor(r.low / 100) * 100)} to ${usd(Math.ceil(r.high / 100) * 100)}`;

// The tile's tag, word and second line, from the item's Sell pill and its listings, offers and orders.
function tileOf(w: World, it: Item): { state: TagState; word?: string; fact: TileFact; faded?: boolean } {
  const live = it.listings.filter(l => l.state === 'live');
  const listed: TileFact = live.length
    ? Math.min(...live.map(l => l.price_cents)) === 0 ? { label: 'Listed free' } : { label: 'Listed at', amount: usd(Math.min(...live.map(l => l.price_cents))) }
    : { label: 'Not listed' };
  const worth: TileFact = it.valuation?.state === 'shown' ? { label: 'Worth', amount: wholeRange(it.valuation.range) } : { label: 'Pricing' };
  const order = w.orders.find(o => o.item_id === it.id && o.kind === 'sale');
  const kept: TileFact | null = order ? { label: 'You get', amount: usd(order.price_cents - order.fees_cents - order.shipping_cents) } : null;
  if (it.state === 'kept') return { state: 'ended', word: 'Kept', fact: worth };
  if (it.state === 'unsold') return { state: 'ended', word: 'Unsold', fact: listed, faded: true };
  const p = pill(w, it);
  // On the Needs you shelf a tile whose pill only says where it is (Live, Slow, Sold) says what is asked instead, so the
  // shelf never shows a Live tag under "Needs you".
  const asks = w.decisions.find(d => d.item_id === it.id && d.state === 'open');
  if (asks && (p === 'Live' || p === 'Slow' || p === 'Sold')) return { state: 'need', word: ASKS[asks.kind] ?? 'Needs you', fact: p === 'Sold' ? kept ?? listed : listed };
  switch (p) {
    case 'Failed': return { state: 'failed', fact: live.length ? listed : { label: 'Could not post' } };
    case 'Offer': {
      const best = w.offers.filter(o => o.state === 'open' && it.listings.some(l => l.id === o.listing_id)).sort((a, b) => b.amount_cents - a.amount_cents)[0];
      return { state: 'need', word: 'Offer', fact: best ? { label: 'Offered', amount: usd(best.amount_cents) } : listed };
    }
    case 'Ship by': {
      const by = order?.clocks.ship_by;
      return { state: 'ship', word: order?.state === 'pickup_booked' ? 'Pickup' : by ? `Ship by ${day(by, w.now)}` : 'Ship', fact: kept ?? listed };
    }
    case 'Sold': {
      // After it ships, the money moves through four words (edge-cases §2): Sold, On its way, Ready on the site, In your
      // bank. The tile carries the word and what lands; the dates and instant payout sit on the order, on the item page.
      if (!order || !kept) return { state: 'sold', fact: listed };
      const ready = order.clocks.release_at && order.clocks.release_at <= w.now;
      const word = order.state === 'released' ? 'In your bank' : ready ? 'Ready on the site' : ['shipped', 'delivered', 'claim_window', 'handed_over'].includes(order.state) ? 'On its way' : 'You get';
      return { state: order.state === 'released' ? 'paid' : 'sold', word: order.state === 'released' ? 'Paid' : undefined, fact: { label: word, amount: kept.amount } };
    }
    case 'Slow': return { state: 'stuck', word: 'Slow', fact: listed };
    case 'Live': return { state: live.some(l => l.market_standing?.word === 'hot') ? 'hot' : 'live', fact: listed };
    case 'Researching': return { state: 'working', fact: { label: 'Pricing' } };
    default: return { state: 'need', word: 'Review', fact: worth };
  }
}

export default function Sell() {
  const params = useLocalSearchParams<{ filter?: string }>();
  // The person and the state, from the URL (app/src/demo/screen.ts). Empty is this person with nothing for sale; loading,
  // failed and offline are drawn over their things.
  const { w: base, state: asked, name } = useScreen();
  const [retried, setRetried] = useState(false);
  // A change approved with no signal waits for it, saying so on its button.
  const [held, setHeld] = useState(false);
  const shown = retried ? null : asked;
  const [shelf, setShelf] = useState<string>(params.filter ?? 'all');
  const [site, setSite] = useState<Site | null>(null);
  const [sort, setSort] = useState<Sort>('latest');
  const [sorting, setSorting] = useState(false);
  const [folds, setFolds] = useState<Record<string, boolean>>(() => readFolds(name));
  const isFolded = (id: string) => folds[id] ?? FOLDED_FIRST.includes(id);
  const fold = (id: string) => { const next = { ...folds, [id]: !isFolded(id) }; setFolds(next); writeFolds(name, next); };
  // Select many, then one change for all (ways-out §6.10, "200 items").
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [changing, setChanging] = useState(false);
  const [change, setChange] = useState<Change | null>(null);
  // What the person changed here, by item: kept (its reason), sold elsewhere, deleted. Undo removes the last change.
  const [moved, setMoved] = useState<Record<string, Change>>({});
  const [toast, setToast] = useState<{ text: string; ids: string[] } | null>(null);

  const w = useMemo<World>(() => {
    const items = base.items.filter(i => moved[i.id] !== 'delete').map(i => {
      const m = moved[i.id];
      if (m === 'keep' || m === 'donated') return { ...i, state: 'kept' as const, kept_reason: m === 'donated' ? 'Donated' : 'Kept', listings: i.listings.map(l => ({ ...l, state: l.state === 'live' ? 'delisted' as const : l.state })) };
      if (m === 'sold_elsewhere') return { ...i, state: 'done' as const, listings: i.listings.map(l => ({ ...l, state: l.state === 'live' ? 'delisted' as const : l.state })) };
      return i;
    });
    return { ...base, items: shown === 'empty' ? [] : items, decisions: base.decisions.filter(d => !d.item_id || !moved[d.item_id]) };
  }, [base, moved, shown]);

  const all = shelves(w);
  const selling = all.flatMap(s => s.items);
  const sell = selling.map(i => sellItem(w, i));
  const offered = filtersFor(sell);
  // Needs you, unsorted, is in Today's order (what ignoring it costs, then the deadline: pages §5), so an offer that
  // expires tonight leads 40 drafts. Every other shelf, and any picked sort, follows sell/grid.ts.
  const urgency = new Map<string, number>();
  feed(w).forEach((d, i) => { if (d.item_id && !urgency.has(d.item_id)) urgency.set(d.item_id, i); });
  const order = (items: Item[], shelfId?: string) => {
    const ids = viewItems(items.map(i => sellItem(w, i)), { sort, site: site ?? undefined }).map(s => s.id);
    if (shelfId === 'needs_you' && sort === 'latest') ids.sort((a, b) => (urgency.get(a) ?? Infinity) - (urgency.get(b) ?? Infinity));
    return ids.map(id => items.find(i => i.id === id)!);
  };
  // A shelf whose every tile would wear the same tag (the flipper's Sold, all Paid) shows none: its header already names
  // them, and a tag earns its color by telling tiles apart (Art. 7.14, U13).
  const same = (items: Item[]) => items.length > 1 && items.every(i => { const a = tileOf(w, i), b = tileOf(w, items[0]); return a.state === b.state && a.word === b.word; });
  const tile = (it: Item, bare = false) => {
    const t = tileOf(w, it), s = sellItem(w, it);
    const pickedNow = picked.includes(it.id);
    return (
      <Tile key={it.id} id={`tile-${it.id}`} title={shortName(it)} photo={photo(it.photos[0].key) as PhotoSrc} state={bare ? undefined : t.state} word={t.word} fact={t.fact} faded={t.faded}
        sites={s.sites} price={s.price_cents} select={picking ? (pickedNow ? 'picked' : 'on') : 'off'}
        onPress={() => picking ? setPicked(p => pickedNow ? p.filter(x => x !== it.id) : [...p, it.id]) : router.push(`/item/${it.id}` as Href)} />
    );
  };

  // Select sits in the title row, where Photos puts it: the one act on the whole grid. Done takes its place while picking.
  const select = picking
    ? <Pill id="select-done" kind="second" label="Done" onPress={() => { setPicking(false); setPicked([]); }} />
    : <Pill id="sell-select" kind="second" label="Select" onPress={() => setPicking(true)} />;
  const nav = <TabNav title="Sell" inbox={{ count: unread(w) }} action={selling.length > 0 && shown !== 'loading' && shown !== 'failed' ? select : undefined} />;
  if (!selling.length) {
    // A new person and someone whose things have all gone see the same page: the camera is the one thing to point to.
    return (
      <Screen name="sell" state={name === 'new' ? 'new' : 'empty'} wash nav={nav}>
        <EmptyState title="Nothing for sale" action={{ id: 'sell-empty-camera', label: 'Sell something', onPress: () => router.push('/camera' as Href) }} />
      </Screen>
    );
  }
  if (shown === 'failed') {
    // The list did not come back. Nothing is guessed: what failed, and one tap to try again (ways-out, Everywhere).
    return (
      <Screen name="sell" state="failed" wash nav={nav}>
        <EmptyState title="Your things didn’t load" action={{ id: 'sell-retry', label: 'Try again', onPress: () => setRetried(true) }} />
      </Screen>
    );
  }

  const pickedItems = selling.filter(i => picked.includes(i.id));
  // Delete is refused while an order is open; the sale stays in Records (ways-out §6.6, "Delete it").
  const blocked = change === 'delete' ? pickedItems.filter(i => w.orders.some(o => o.item_id === i.id && OPEN_ORDER.includes(o.state))) : [];
  const doing = pickedItems.filter(i => !blocked.includes(i));
  const ending = doing.flatMap(i => i.listings.filter(l => l.state === 'live')).length;
  const ends = ending ? ` and end ${ending} listing${ending === 1 ? '' : 's'}` : '';
  const DOES: Record<Change, string> = {
    keep: `Keep ${doing.length}${ends}`,
    donated: `Mark ${doing.length} donated${ends}`,
    sold_elsewhere: `Mark ${doing.length} sold${ends}`,
    delete: `Delete ${doing.length}${ends}`,
  };
  const DONE: Record<Change, string> = { keep: 'Kept', donated: 'Marked donated', sold_elsewhere: 'Marked sold', delete: 'Deleted' };
  const apply = () => {
    if (!change) return;
    const ids = doing.map(i => i.id);
    setMoved(m => ({ ...m, ...Object.fromEntries(ids.map(id => [id, change])) }));
    setChanging(false); setPicking(false); setPicked([]); setChange(null);
    // A delete cannot be undone, so it has no Undo; it waited for the tap that said exactly what it does.
    setToast(change === 'delete' ? null : { text: ids.length === 1 ? DONE[change] : `${DONE[change]} ${ids.length}`, ids });
  };
  const undo = () => { if (toast) setMoved(m => Object.fromEntries(Object.entries(m).filter(([id]) => !toast.ids.includes(id)))); setToast(null); };

  const showing = all.filter(s => s.items.length && (!site || s.items.some(i => sellItem(w, i).sites.includes(site))));
  const filtered = shelf !== 'all' || !!site;
  // The edge states the UI system asks every screen about (.agents/ui-states.json): one thing, a typical person, dense.
  const loading = shown === 'loading', offline = shown === 'offline';
  const state = loading ? 'loading' : offline ? 'offline' : picking ? 'select' : filtered ? 'filtered' : selling.length === 1 ? 'one' : selling.length > 20 ? 'dense' : 'typical';
  const sortChip = SORTS.find(s => s.id === sort)!.chip;

  const foot = toast
    ? <UndoToast id="bulk-undo" text={toast.text} onUndo={undo} onGone={() => setToast(null)} />
    : picking
      ? <FootButton id="select-act" label={picked.length ? `Change ${picked.length}` : 'Select items'} state={picked.length ? 'idle' : 'disabled'} onPress={() => setChanging(true)} />
      : undefined;

  return (
    <Screen name="sell" state={state} wash nav={nav} foot={foot}>
      <Stack>
        {loading ? null : <FilterRow>
          <Chip id="filter-sort" icon="sorting-01" label={sortChip} onPress={() => setSorting(true)} />
          <Chip id="filter-all" label="All" picked={shelf === 'all'} onPress={() => setShelf('all')} />
          {all.filter(s => s.items.length).map(s => (
            <Chip key={s.id} id={`filter-${s.id}`} label={s.title} count={s.items.length} picked={shelf === s.id} onPress={() => setShelf(s.id)} />
          ))}
          {offered.sites.map(s => (
            <Chip key={s} id={`filter-site-${s}`} site={s} picked={site === s} onPress={() => setSite(site === s ? null : s)} />
          ))}
        </FilterRow>}
        {/* Offline: the last copy stays, and a change waits for the signal (ways-out, Everywhere). */}
        {offline ? <Txt role="body" tone="ink-2">Waiting for signal</Txt> : null}
      </Stack>

      {loading ? <Grid columns={COLUMNS}>{[0, 1, 2, 3].map(i => <TileSkeleton key={i} />)}</Grid> : null}

      {loading ? null : shelf === 'all' ? showing.map(s => {
        const items = order(s.items, s.id);
        return (
          <Shelf key={s.id} id={s.id} title={s.title} count={items.length} folded={isFolded(s.id)} onFold={() => fold(s.id)}
            onAll={items.length > PER_SHELF ? () => setShelf(s.id) : undefined}>
            <Grid columns={COLUMNS}>{items.slice(0, PER_SHELF).map(i => tile(i, same(items)))}</Grid>
          </Shelf>
        );
      }) : (
        <Grid columns={COLUMNS}>{order(all.find(s => s.id === shelf)?.items ?? [], shelf).map(i => tile(i))}</Grid>
      )}

      {picking ? null : (
        <List>
          <Choice id="sell-pause" icon="calendar-03" label="Pause selling" line="Away for a while" leads onPress={() => router.push('/you/pause' as Href)} />
        </List>
      )}

      <Sheet open={sorting} title="Sort" onClose={() => setSorting(false)}>
        <List>
          {SORTS.map(s => <Choice key={s.id} id={`sort-${s.id}`} label={s.label} picked={sort === s.id} onPress={() => { setSort(s.id); setSorting(false); }} />)}
        </List>
      </Sheet>

      <Sheet open={changing} title={`${picked.length} selected`} onClose={() => { setChanging(false); setChange(null); }}>
        <List>
          <Choice id="bulk-keep" icon="tick-02" label="Keep" line="Ends listings. Sell again any time." picked={change === 'keep'} onPress={() => setChange('keep')} />
          <Choice id="bulk-donated" icon="package" label="Donated" line="Ends listings, keeps the value" picked={change === 'donated'} onPress={() => setChange('donated')} />
          <Choice id="bulk-sold_elsewhere" icon="money-03" label="Sold elsewhere" line="Ends listings, counts the sale" picked={change === 'sold_elsewhere'} onPress={() => setChange('sold_elsewhere')} />
          <Choice id="bulk-delete" icon="cancel-01" label="Delete" line={blocked.length ? `${blocked.length} ${blocked.length === 1 ? 'has an open order and stays' : 'have open orders and stay'}` : 'Removes them and their photos. No undo.'} picked={change === 'delete'} onPress={() => setChange('delete')} />
        </List>
        {change ? (doing.length
          ? <Approve id="bulk-approve" does={DOES[change]} status={held ? 'working' : 'ready'} step="Waiting for signal" onApprove={() => (offline ? setHeld(true) : apply())} />
          : <FootButton id="bulk-approve" label={`Nothing to ${change === 'delete' ? 'delete' : 'change'}`} state="disabled" />) : null}
      </Sheet>
    </Screen>
  );
}
