// One item, one page, five moments (spec/pages.md §6.6): its top changes with where the item is in its life, and the
// rest stays where the person left it. What every number is comes from app/src/item/model.ts; this file only composes.
// Ben, round 11 (product/words.md): the photos slide; "different sites might have different listings written different
// ways with different images", so each site's row says where its listing differs; "things are either unnecessarily big
// or small", so every part here is a kit part at its one size, and no field or box is drawn that is not a decision.
import { router, useIsFocused, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import {
  Amount, Approve, Blank, DecisionCard, EmptyState, FootButton, Grid, Guess, Icon, IconButton, Line, List, Nav, Photo, Pill, Row, Screen,
  MOTIONS, Section, Sheet, SiteBadge, Skeleton, Stack, Tag, Txt, UndoToast, log, type PhotoSrc, type TagState,
} from '@/ui';
import { ActionRow } from '@/ui/parts/action-row';
import { Chips } from '@/ui/parts/chips';
import { PhotoPager } from '@/ui/parts/photo-pager';
import { QuestionCard } from '@/ui/parts/question-card';
import { Switch } from '@/ui/parts/switch';
import { Tile } from '@/ui/parts/tile';
import { WhySheet } from '@/ui/parts/why';
import { KeepRow } from '@/ui/parts/worth';
import { PRODUCTS, day, ms, range, usd, youKeep, type Item, type World } from '@/demo';
import { correct } from '@/demo/capture-edges';
import { morePhotos } from '@/demo/item-photos';
import { photo as demoPhoto } from '@/demo/photos';
import { useScreen } from '@/demo/screen';
import { describe, descriptionWhy, fieldWhy, titleWhy, type FieldWhy } from '@/item/field-why';
import * as M from '@/item/model';

// An item's own data decides whether it is new, one, typical or dense, so a page says where the other three are drawn.
// Loading, failed and offline are drawn from ?state= (useScreen); empty can't happen, since an item page always has one.
const ELSEWHERE: Record<string, string> = {
  new: 'an item still being researched, /item/it_hoodie',
  one: 'one site and one photo, /item/it_chair',
  typical: 'two sites and one photo, /item/it_jacket',
  dense: 'many photos or sites, /item/it_tee',
};
// Under the Plan or Post sheet the page is only the ground the sheet came from: the sheet's address draws its own loading,
// failed and offline, and the page's are drawn at its own address.
const UNDER = (id: string) => ['loading', 'failed', 'offline'].map(s => `${s}: under a sheet the page is its ground, /item/${id}?state=${s}`).join('; ');
const skipFor = (drawn: string) => [
  'empty: an item page always has an item, and with nothing known yet it is new',
  ...Object.entries(ELSEWHERE).filter(([s]) => s !== drawn).map(([s, why]) => `${s}: ${why}`),
].join('; ');

// A count and its noun, singular at one (E21).
const many = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`;

const back = () => (router.canGoBack() ? router.back() : router.replace('/sell' as Href));

export default function ItemPage() {
  const { id, world } = useLocalSearchParams<{ id: string; world?: string }>();
  const { state } = useScreen();
  const found = state === 'failed' ? null : M.find(String(id), world);
  if (state === 'loading') return <Loading />;
  if (!found) {
    // Didn't load: the one fix is to load it again (frontend-standard §4, Error). Gone: the way back to the list.
    const action = state === 'failed'
      ? { id: 'retry', label: 'Try again', onPress: () => router.replace(`/item/${id}${world ? `?world=${world}` : ''}` as Href) }
      : { id: 'failed-sell', label: 'Go to Sell', onPress: () => router.replace('/sell' as Href) };
    return (
      <Screen name="item" state="failed" skip={skipFor('failed')} nav={<Nav back={back} />}>
        <EmptyState title="Can’t open this item" line="It was deleted, or it didn’t load." action={action} />
      </Screen>
    );
  }
  return <Page w={found.w} item={found.item} offline={state === 'offline'} />;
}

// Loading: the page's own shape in gray, so nothing moves when the item arrives (Art. 5, Loading).
function Loading() {
  return (
    <Screen name="item" state="loading" skip={skipFor('loading')} nav={<Nav back={back} />}>
      <Stack gap="cards">
        <Photo src={null} label="Loading" fit="fill" />
        <Skeleton of="card-item" />
        <Skeleton of="notice" />
      </Stack>
    </Screen>
  );
}

// The screen state this item draws: new while it is researched, one or dense by how much it carries, typical otherwise.
function screenState(m: M.Moment, it: Item): string {
  if (m === 'researching') return 'new';
  const sites = it.listings.filter(l => l.state !== 'none').length, photos = M.photoCount(it);
  if (sites >= 3 || photos >= 6) return 'dense';
  if (sites <= 1 && photos <= 1) return 'one';
  return 'typical';
}

// The tag beside the title: the item's stage in one word and icon (Art. 5, States; pages.md §3, Stage).
function stageTag(w: World, it: Item, m: M.Moment): { state: TagState; word?: string } {
  const sale = M.saleOf(w, it);
  const standing = it.listings.map(l => l.market_standing?.word);
  switch (m) {
    case 'researching': return { state: 'working' };
    case 'review': return { state: 'need', word: 'Review' };
    case 'offer': return { state: 'need', word: 'Offer' };
    case 'sold': {
      const pickup = sale && w.appointments.find(a => a.order_id === sale.id && a.kind === 'pickup');
      if (pickup) return { state: 'sold', word: `Pickup ${day(pickup.window.start, w.now).toLowerCase()}` };
      return { state: 'ship', word: sale?.clocks.ship_by ? `Ship by ${day(sale.clocks.ship_by, w.now)}` : 'Ship' };
    }
    case 'done': return { state: 'paid' };
    case 'kept': return { state: 'ended', word: 'Kept' };
    case 'unsold': return { state: 'ended', word: 'Unsold' };
    default:
      if (it.state === 'stale') return { state: 'stuck', word: 'Slow' };
      return standing.includes('hot') ? { state: 'hot' } : { state: 'live' };
  }
}

type Toast = { id: string; text: string; undo: () => void };

function Page({ w, item, offline }: { w: World; item: Item; offline: boolean }) {
  const m = M.momentOf(w, item);
  const [title, setTitle] = useState(item.title);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState<string[]>([]);
  const [field, setField] = useState<M.Field | null>(null);
  // Review: the guesses the person opened and left as they were. Each turns to ink like an edit (pages §6.6 Review).
  const [checked, setChecked] = useState<string[]>([]);
  const [description, setDescription] = useState(() => describe(item));
  const [whyField, setWhyField] = useState<FieldWhy | null>(null);
  const [sum, setSum] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'sold-elsewhere' | 'delete' | 'offers' | 'photos' | 'why' | 'split' | null>(null);
  // Handed over is the page's, not the foot's: its Undo must outlive the foot, which the toast replaces (U: Undo works).
  const [handed, setHanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [paid, setPaid] = useState(item.cost ? usd(item.cost.amount_cents) : '');
  // Offline, a tap that would reach a site waits for signal and says so; nothing claims it is done (ways-out Everywhere,
  // "I'm on bad signal"). `waiting` is what is queued, shown in place of the offline line.
  const [waiting, setWaiting] = useState<string | null>(null);
  const online = (what: string, act: () => void) => () => {
    if (!offline) return act();
    log.event('ui.show', { screen: 'item', state: 'waiting-for-signal', item: item.id, what });
    setWaiting(what);
  };
  // How the photos are shown: as taken, cleaned up (no model), or enhanced with AI, which is labeled (edge-cases §6).
  const [look, setLook] = useState<Look>('original');

  const key = item.photos[0]?.key;
  const photos: PhotoSrc[] = key ? [demoPhoto(key) as PhotoSrc, ...morePhotos(key).map(s => s.src as PhotoSrc)] : [];
  const tag = stageTag(w, item, m);
  const head = M.headline(w, item, m);
  const rows = M.siteRows(w, item, title);
  const fields = M.fields(item);
  const live = rows.filter(r => r.listing.state === 'live').length;
  const endsLine = live ? `Ends ${live === 1 ? 'the listing' : `${live} listings`}` : undefined;
  const plan = () => router.push(`/item/${item.id}/plan` as Href);

  // An ending the person can undo: shown as done, with Undo (the hand-off rule: undoable steps go ahead).
  const end = (id: string, done: string) => { setEnded(done); setToast({ id: `${id}-undo`, text: done, undo: () => { setEnded(null); setToast(null); } }); };
  // A change that leaves the item as it is, with Undo: Pause, Sell one like this, Split.
  const did = (id: string, done: string, undo: () => void = () => {}) => setToast({ id: `${id}-undo`, text: done, undo: () => { undo(); setToast(null); } });
  const many2 = (n: number) => (n === 1 ? 'the listing' : `${n} listings`);
  const product = PRODUCTS.find(p => item.product_id ? p.id === item.product_id : p.used_price.citation_id === item.valuation?.citation_id);
  const whyOf = M.why(w, item);
  const review = m === 'review';
  const input = (control: string, value: string, same: boolean) => log.event('user.input', { screen: 'item', control, value: same ? 'confirmed' : value });
  const setFieldValue = (f: M.Field, v: string) => {
    const now = edits[f.id] ?? f.value, same = v === now;
    input(`field-${f.attr.name}`, v, same);
    if (same) setChecked(c => (c.includes(f.id) ? c : [...c, f.id]));
    else setEdits(e => ({ ...e, [f.id]: spelled(f, v) }));
  };

  // Under the Plan or Post sheet the page's act is out of reach behind the scrim, so it is not drawn: one act on screen (C4).
  const focused = useIsFocused();
  const foot = !focused ? null : toast ? <UndoToast id={toast.id} text={toast.text} onUndo={toast.undo} onGone={() => setToast(null)} />
    : ended || handed ? null : <Foot w={w} item={item} m={m} plan={plan} online={online}
      onHanded={() => { setHanded(true); setToast({ id: 'foot-undo', text: 'Handed over. Marked sold.', undo: () => { setHanded(false); setToast(null); } }); }} />;

  return (
    <Screen name="item" state={offline ? 'offline' : screenState(m, item)} nav={<Nav back={back} />} foot={foot}
      skip={focused ? skipFor(screenState(m, item)) : `${skipFor(screenState(m, item))}; ${UNDER(item.id)}`}>
        <Stack gap="cards">
          {offline ? (
            <Line><Icon name="refresh" size={12} tone="ink-2" /><Txt role="caption">{waiting ? `Waiting for signal. ${waiting} goes when you’re back.` : 'Offline. Changes send when you’re back.'}</Txt></Line>
          ) : null}
          <Stack gap="tight">
            <PhotoPager photos={photos} label={title} faded={!!ended || m === 'kept' || m === 'unsold'} />
            {look !== 'original' ? <Txt role="caption">{look === 'ai' ? 'Enhanced with AI. Marked as AI where it posts.' : 'Cleaned up. Nothing redrawn.'}</Txt> : null}
          </Stack>
          <Stack gap="tight">
            <Line><Tag state={ended ? 'ended' : tag.state} word={ended ? 'Ended' : tag.word} /></Line>
            {review ? (
              <Row trail={<IconButton id="why-title" icon="information-circle" label="Why?" look="plain" onPress={() => setWhyField(titleWhy(item))} />}>
                <Line><Guess id="title" name="What it is" value={title} look="body" onChange={v => { input('title', v, v === title); setTitle(v); }} /></Line>
              </Row>
            ) : <Txt role="headline">{title}</Txt>}
          </Stack>
        </Stack>

        <Top w={w} item={item} m={m} head={head} openSum={() => setSum(true)} openOffers={() => setSheet('offers')} online={online}
          openWhy={whyOf && (m === 'sold' || m === 'done') ? () => setSheet('why') : undefined}
          onFill={(fid, v) => setEdits(e => ({ ...e, [fid]: v }))} />

        {rows.length ? (
          <Section title={m === 'review' ? 'Where it will post' : 'Sites'}>
            <List>
              {rows.map(r => <SiteLine key={r.site} r={r} m={m} />)}
            </List>
          </Section>
        ) : null}

        {(m === 'live' || m === 'offer') && item.limits ? <PlanSection w={w} item={item} plan={plan} /> : null}
        {item.valuation?.state === 'shown' && m !== 'sold' && m !== 'done' ? (
          <Section title="Market">
            {/* Why? sits on the number it explains (pages.md §6.6, Actions on any moment). */}
            <Row trail={whyOf ? <IconButton id="why" icon="information-circle" label="Why?" look="plain" onPress={() => setSheet('why')} /> : null}>
              <Txt role="body">{`Similar ones sold for ${range(item.valuation.range)} lately`}</Txt>
            </Row>
            {product ? <List><ActionRow id="market-open" label="See the sales" line="Sold and for sale, on every site" onPress={() => router.push(`/product/${product.id}` as Href)} /></List> : null}
          </Section>
        ) : null}

        {fields.length || item.location ? (
          <Section title="Details">
            <List>
              {/* Review: the listing's description is a guess too, written from the fields below (pages §6.6 Review). */}
              {review ? (
                <Row trail={<IconButton id="why-description" icon="information-circle" label="Why?" look="plain" onPress={() => setWhyField(descriptionWhy(item))} />}>
                  <Txt role="caption">Description</Txt>
                  <Line><Guess id="description" name="Description" value={description} look="body" onChange={v => { input('description', v, v === description); setDescription(v); }} /></Line>
                </Row>
              ) : null}
              {fields.map(f => (
                <FieldLine key={f.id} f={f} value={edits[f.id] ?? f.value} locked={locked.includes(f.id)} checked={checked.includes(f.id)}
                  onChange={v => setFieldValue(f, v)} onMore={() => setField(f)}
                  onWhy={review ? () => setWhyField(fieldWhy(item, f, edits[f.id] ?? f.value)) : undefined} />
              ))}
              <Row>
                <Txt role="caption">Where it is</Txt>
                <Line><Guess id="field-where" name="Where it is" value={item.location.label} changed look="body" /></Line>
              </Row>
              {/* What you paid: optional and never asked (pages.md §6.6); it only feeds Records. */}
              <Row>
                <Txt role="caption">What you paid</Txt>
                {paid
                  ? <Line><Guess id="paid" name="What you paid" value={paid} changed numeric look="body" onChange={setPaid} /></Line>
                  : <Line><Blank id="paid" name="What you paid" numeric look="body" onChange={setPaid} /></Line>}
                <Txt role="caption">Only you see it, in your records</Txt>
              </Row>
            </List>
          </Section>
        ) : null}

        <Section>
          <List>
            <ActionRow id="photos" label="Photos" line="Clean up, add or change the cover" onPress={() => setSheet('photos')} />
            {photos.length > 1 ? <ActionRow id="split" label="Split" line="Move photos to a new item" onPress={() => setSheet('split')} /> : null}
            <ActionRow id="copy" label="Sell one like this" line="A copy without the photos"
              onPress={() => did('copy', 'Made a copy. Add its photos from Sell.')} />
            {m !== 'sold' && m !== 'done' && !ended ? (
              <>
                {live && !paused ? <ActionRow id="pause" label="Pause" line={`Hides ${many2(live)} until you resume`}
                  onPress={online('Pause', () => { setPaused(true); did('pause', `Paused ${many2(live)}.`, () => setPaused(false)); })} /> : null}
                <ActionRow id="sold-elsewhere" label="Sold elsewhere" line={endsLine} onPress={() => setSheet('sold-elsewhere')} />
                {m !== 'kept' ? <ActionRow id="keep" label="Keep it" line={endsLine} onPress={online('Keep it', () => end('keep', live ? `Kept. Took down ${many2(live)}.` : 'Kept.'))} /> : null}
                <ActionRow id="donated" label="Donated" line={endsLine} onPress={online('Donated', () => end('donated', live ? `Donated. Took down ${many2(live)}.` : 'Marked donated.'))} />
                {live ? <ActionRow id="end-all" label="End everywhere" line="Keeps the item as a draft" onPress={online('End everywhere', () => end('end-all', `Ended ${many2(live)}.`))} /> : null}
              </>
            ) : null}
            <ActionRow id="delete" label="Delete" refused={M.deleteBlocked(w, item) ?? undefined} line={endsLine ? `${endsLine} first` : 'Removes it and its photos'} onPress={() => setSheet('delete')} />
          </List>
        </Section>

        <FieldSheet f={field} value={field ? edits[field.id] ?? field.value : null} locked={!!field && locked.includes(field.id)}
          onChange={v => field && setEdits(e => ({ ...e, [field.id]: spelled(field, v) }))}
          onLock={on => field && setLocked(l => (on ? [...l, field.id] : l.filter(x => x !== field.id)))}
          onClose={() => setField(null)} />
        <SumSheet open={sum} head={head} rows={rows} onClose={() => setSum(false)} />
        {/* Why? on a field: the reason first, then where it was read, a tap under it. */}
        <WhySheet id="field-why" open={!!whyField} title={whyField?.title ?? ''} says={whyField?.says ?? ''} more="See the source"
          numbers={<Txt role="body">{whyField?.source}</Txt>} onClose={() => setWhyField(null)} />
        <OffersSheet open={sheet === 'offers'} w={w} item={item} onClose={() => setSheet(null)} />
        <SoldElsewhere open={sheet === 'sold-elsewhere'} live={live} onClose={() => setSheet(null)}
          onDone={text => { setSheet(null); online('Sold elsewhere', () => end('sold-elsewhere', text))(); }} />
        {whyOf ? <WhyItem open={sheet === 'why'} why={whyOf} onClose={() => setSheet(null)} /> : null}
        <SplitSheet open={sheet === 'split'} photos={photos} title={title} onClose={() => setSheet(null)}
          onSplit={n => { setSheet(null); did('split', `Moved ${many(n, 'photo', 'photos')} to a new item.`); }} />
        <DeleteSheet open={sheet === 'delete'} live={live} onClose={() => setSheet(null)} />
        <PhotosSheet open={sheet === 'photos'} photos={photos} title={title} live={live} look={look} onLook={setLook} onClose={() => setSheet(null)} />
    </Screen>
  );
}

// The top of the page, by moment (pages.md §6.6). One number first, and one line that opens the sum (Art. 7.10).
function Top({ w, item, m, head, openSum, openOffers, openWhy, online, onFill }: {
  w: World; item: Item; m: M.Moment; head: M.Headline | null; openSum: () => void; openOffers: () => void; openWhy?: () => void;
  online: (what: string, act: () => void) => () => void; onFill: (field: string, value: string) => void;
}) {
  if (m === 'researching') {
    return (
      <Section title="Finding out what it is">
        <List>
          {M.stages(item).map(s => (
            <Row key={s.id} lead={<Icon name={s.state === 'done' ? 'tick-02' : s.state === 'working' ? 'search-01' : 'clock-01'} tone={s.state === 'waiting' ? 'ink-2' : 'ink'} />}
              trail={s.count ? <Txt role="body" tabular>{s.count}</Txt> : s.state === 'working' ? <Tag state="working" word="Working" /> : null}>
              <Txt role="body" tone={s.state === 'waiting' ? 'ink-2' : 'ink'}>{s.label}</Txt>
            </Row>
          ))}
        </List>
      </Section>
    );
  }
  if (m === 'review') return <TreeTop w={w} item={item} onFill={onFill} />;
  if (m === 'offer') return <OfferTop w={w} item={item} openOffers={openOffers} online={online} />;
  if (m === 'kept' || m === 'unsold') {
    const v = item.valuation?.state === 'shown' ? item.valuation.range : null;
    if (!v) return null;
    return (
      <Stack gap="tight">
        <Txt role="amount">{range(v)}</Txt>
        <Txt role="body" tone="ink-2">{m === 'kept' ? 'What it’s worth now' : 'What similar ones sell for now'}</Txt>
      </Stack>
    );
  }
  if (!head) return null;
  const sale = M.saleOf(w, item);
  const days = M.daysToSell(w, item);
  // Slow: the one change worth the most says what it does for the sale (pages.md §3 Standing: "sells about 6 days sooner").
  const slow = m === 'live' ? w.decisions.find(x => x.item_id === item.id && x.kind === 'markdown' && x.state === 'open') : undefined;
  return (
    <Stack gap="cards">
      {openWhy
        ? <Row trail={<IconButton id="why" icon="information-circle" label="Why?" look="plain" onPress={openWhy} />}><Amount value={head.amount / 100} what={head.what} /></Row>
        : <Amount value={head.amount / 100} what={head.what} />}
      {slow ? <Txt role="body">{slow.why}</Txt> : null}
      {m === 'done' && sale && days ? <Txt role="body">{`Sold for ${usd(sale.price_cents)} in ${days} ${days === 1 ? 'day' : 'days'}`}</Txt> : null}
      <List><ActionRow id="open-sum" label={m === 'live' ? 'What you get on each site' : 'How it adds up'} onPress={openSum} /></List>
      {m === 'sold' || m === 'done' ? <Clocks w={w} item={item} /> : null}
    </Stack>
  );
}

// Review: where the auto-list tree stopped (edge-cases §7, agent proposal). Every step it was sure of moved on by itself;
// each thing it could not settle is one question on one card, asked one at a time. An answer fills the item's field and
// the next stop takes the card's place, so nothing starts over. The title above, the price and the sites in the Plan
// sheet stay dotted guesses the person can type over.
function TreeTop({ w, item, onFill }: { w: World; item: Item; onFill: (field: string, value: string) => void }) {
  const t = M.autoList(w, item);
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const stop = t.stops[at];
  const done = t.steps.filter(s => s.state === 'done').length;
  const answer = (value: string, typed: boolean) => {
    if (!stop) return;
    const label = typed ? value : stop.options.find(o => o.id === value)?.label ?? value;
    setPicked(value);
    if (stop.field) onFill(stop.field, label);
    // The pick is seen in its chip for a beat, then the next stop takes the card (the hand-off is the tap itself).
    setTimeout(() => { setPicked(null); setAt(i => i + 1); }, typeof MOTIONS.select.ms === 'number' ? MOTIONS.select.ms * 2 : 0);
  };
  return (
    <QuestionCard key={stop?.id ?? 'none'} id={stop ? `ask-${stop.id}` : 'ask'}
      where={stop ? `Step ${stop.step} of ${t.steps.length}: ${t.steps[stop.step - 1].label}` : at ? 'Every question answered. Ready to plan' : `Steps 1 to ${done} of ${t.steps.length} done. Ready to plan`}
      question={stop?.question ?? null} options={stop?.options} pick={picked ?? stop?.pick} typed={stop?.typed} onAnswer={answer} />
  );
}

// Offer: the card that asks, on the state's gradient because it is the one thing that needs the person here (C2, C4).
// Counter opens the picker under it: three amounts, the middle one the agent's pick, then Something else. The send waits
// for Approve, which says exactly what it sends.
function OfferTop({ w, item, openOffers, online }: { w: World; item: Item; openOffers: () => void; online: (what: string, act: () => void) => () => void }) {
  const o = M.offerOf(w, item)!;
  const best = o.offers[0];
  const listing = item.listings.find(l => l.id === best?.listing_id);
  const floor = item.limits?.floor_cents ?? 0;
  const amounts = best && listing ? M.counters(best.amount_cents, listing.price_cents, floor) : [];
  const pick = amounts[Math.floor(amounts.length / 2)];
  const [status, setStatus] = useState<'open' | 'accepted' | 'countering' | 'sent'>('open');
  const [chosen, setChosen] = useState<string | null>(pick ? String(pick) : null);
  const [typed, setTyped] = useState<string | undefined>();
  const now = ms(w.now);
  if (!best || !listing) return null;
  const counterCents = chosen && /^\d+$/.test(chosen) && amounts.includes(Number(chosen)) ? Number(chosen) : typed ? Math.round(parseFloat(typed.replace(/[^\d.]/g, '')) * 100) : null;
  const under = counterCents !== null && counterCents < floor;
  if (status === 'accepted') return <Approve id="accept-done" does="" status="done" done={`Accepted ${usd(best.amount_cents)}. The other listings are coming down.`} />;
  return (
    <Stack gap="cards">
      <Stack gap="tight">
        {/* The card opens the buyer's thread, where the offer came from (pages.md §6.6, Splits off: a thread). */}
        <DecisionCard id="offer" kind="need" word="Offer" title={o.offers.length > 1 ? many(o.offers.length, 'offer', 'offers') : item.title} photo={demoPhoto(item.photos[0].key) as PhotoSrc} site={best.site}
          fact={{ label: 'You get', amount: best.you_keep_cents / 100 }} due={best.expires_at ? ms(best.expires_at) - now + Date.now() : undefined} lead
          onOpen={o.decision.conversation_id ? () => router.push(`/messages/${o.decision.conversation_id}` as Href) : undefined}
          primary={{ id: 'accept', label: `Accept ${usd(best.amount_cents)}`, onPress: online(`Accept ${usd(best.amount_cents)}`, () => setStatus('accepted')) }}
          second={{ id: 'counter', label: 'Counter', onPress: () => setStatus('countering') }}
          more={{ id: 'offer-more', label: 'All offers and Decline', onPress: openOffers }} />
        {/* A sale on the site can't be taken back, so the card says so before the tap (ways-out Everywhere, "That wasn't what I wanted"). */}
        <Txt role="caption">Accepting sells it. It can’t be undone.</Txt>
      </Stack>
      {status === 'countering' || status === 'sent' ? (
        <Stack>
          <Txt role="caption">{`Counter. Your lowest is ${usd(floor)}.`}</Txt>
          <Chips id="counter-amount" name="Counter" value={chosen} other={{ numeric: true, typed }}
            options={amounts.map(a => ({ id: String(a), label: usd(a) }))}
            onChange={(v, t) => { setChosen(v); if (t) setTyped(v); if (status === 'sent') setStatus('countering'); }} />
          {counterCents !== null ? (
            <Approve id="send-counter" does={under ? `Send ${usd(counterCents)}, under your lowest` : `Send ${usd(counterCents)} counter`}
              status={status === 'sent' ? 'done' : 'ready'} done={`Sent ${usd(counterCents)}. You’d get ${usd(youKeep(best.site, counterCents))}.`}
              onApprove={online(`Send ${usd(counterCents)}`, () => setStatus('sent'))} />
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}

// The order's clocks for Sold and Done: listed, sold, ship by or pickup, paid.
function Clocks({ w, item }: { w: World; item: Item }) {
  return (
    <List>
      {M.clocks(w, item).map(c => c.id === 'pickup' && !c.done ? (
        // The pickup opens its sheet: the time, the spot and the buyer (pages.md §6.6, Splits off: Pickup).
        <ActionRow key={c.id} id="open-pickup" label={c.label} line={c.at} onPress={() => router.push(`/item/${item.id}/pickup` as Href)} />
      ) : (
        <Row key={c.id} lead={<Icon name={c.done ? 'tick-02' : 'clock-01'} tone={c.done ? 'ink' : 'ink-2'} />} trail={<Txt role="body" tone="ink-2">{c.at}</Txt>}>
          <Txt role="body">{c.label}</Txt>
        </Row>
      ))}
    </List>
  );
}

// One site's listing: its logo, what it is doing, its price, how it is doing, and where it differs from the others.
function SiteLine({ r, m }: { r: M.SiteRow; m: M.Moment }) {
  const [retry, setRetry] = useState<'ready' | 'working' | 'skipped'>('ready');
  const caption = [r.listing.error, r.line, r.interest].filter(Boolean).map(x => x!.replace(/\.$/, '')).join('. ');
  return (
    <Row lead={<SiteBadge site={r.site} />} trail={<Txt role="body" tone={r.tag === 'ended' || retry === 'skipped' ? 'ink-2' : 'ink'} tabular>{usd(r.price)}</Txt>}>
      <Line><Tag state={retry === 'skipped' ? 'ended' : r.tag} word={retry === 'skipped' ? 'Skipped' : r.word ?? (r.tag === 'draft' ? 'Not posted' : undefined)} /></Line>
      {caption && m !== 'review' ? <Txt role="caption" lines={2}>{caption}</Txt> : null}
      {r.differs.length ? <Txt role="caption" lines={2}>{r.differs.join('. ')}</Txt> : null}
      {r.tag === 'failed' && retry !== 'skipped' ? (
        <Line>
          <Pill id={`retry-${r.site}`} label="Retry" icon="refresh" state={retry === 'working' ? 'working' : 'idle'} step="Posting" onPress={() => setRetry('working')} />
          <Pill id={`skip-${r.site}`} label="Skip this site" kind="second" onPress={() => setRetry('skipped')} />
        </Line>
      ) : null}
    </Row>
  );
}

// The plan's next step and the way into the Plan sheet (pages.md §6.6, Live: "drops to $42 on day 10").
function PlanSection({ w, item, plan }: { w: World; item: Item; plan: () => void }) {
  const ls = M.liveListings(item);
  const price = ls.length ? Math.min(...ls.map(l => l.price_cents)) : item.listings[0]?.price_cents ?? 0;
  const posted = ls.map(l => l.posted_at).filter((t): t is string => !!t).sort()[0] ?? w.now;
  const choice = (item.limits?.plan_choice ?? 'sell') as M.Choice;
  const steps = item.limits?.markdown_on === false ? [] : M.drops(item, price, choice, posted);
  const next = steps.find(s => s.label.startsWith('Drops'));
  return (
    <Section title="Plan">
      <Stack gap="tight">
        <Txt role="body">{next ? `${next.label} on ${next.at}` : item.limits?.plan_choice === 'reserve' ? 'Waits for your price' : 'No price drops'}</Txt>
        <Txt role="caption">{`Never under ${usd(item.limits!.floor_cents)}, your lowest`}</Txt>
      </Stack>
      <List><ActionRow id="open-plan" label="Change the plan" onPress={plan} /></List>
    </Section>
  );
}

// A field: its name, the value (a guess until the person touches it, or a blank), and where it came from. More opens
// the field's sheet, where it can be locked so the agent never proposes a change (ways-out §6.6).
// In Review each field also has Why?: the reason it reads so, then its source (pages.md §6.6: "Why? on any field").
// A guess the person opens and leaves as it is counts as checked: it turns to ink like one they changed.
function FieldLine({ f, value, locked, checked, onChange, onMore, onWhy }: {
  f: M.Field; value: string | null; locked: boolean; checked: boolean; onChange: (v: string) => void; onMore: () => void; onWhy?: () => void;
}) {
  const mine = value !== f.value;
  const more = <IconButton id={`more-${f.attr.name}`} icon="more-horizontal" label={`More about ${f.name}`} look="plain" onPress={onMore} />;
  return (
    <Row trail={onWhy ? <Line><IconButton id={`why-${f.attr.name}`} icon="information-circle" label={`Why ${f.name}?`} look="plain" onPress={onWhy} />{more}</Line> : more}>
      <Txt role="caption">{f.name}</Txt>
      {value === null
        ? <Line><Blank id={`field-${f.attr.name}`} name={f.name} look="body" onChange={onChange} /></Line>
        : <Line><Guess id={`field-${f.attr.name}`} name={f.name} value={value} changed={!f.guessed || mine || checked} look="body" onChange={onChange} /></Line>}
      <Txt role="caption">{[mine ? 'You changed it' : checked ? 'You checked it' : f.from, locked ? 'Locked' : null].filter(Boolean).join('. ')}</Txt>
    </Row>
  );
}

function FieldSheet({ f, value, locked, onChange, onLock, onClose }: {
  f: M.Field | null; value: string | null; locked: boolean; onChange: (v: string) => void; onLock: (on: boolean) => void; onClose: () => void;
}) {
  return (
    <Sheet open={!!f} title={f?.name} onClose={onClose}>
      {f ? (
        <Stack>
          {value === null
            ? <Line><Blank id="sheet-field" name={f.name} onChange={onChange} /></Line>
            : <Line><Guess id="sheet-field" name={f.name} value={value} changed={!f.guessed || value !== f.value} onChange={onChange} /></Line>}
          <Txt role="caption">{f.from}</Txt>
          <Row trail={<Switch id="lock-field" label={`Lock ${f.name}`} on={locked} onChange={onLock} />}>
            <Txt role="body">Lock it</Txt>
            <Txt role="caption">The agent won’t change it or suggest a change</Txt>
          </Row>
          <FootButton id="field-done" kind="second" label="Done" onPress={onClose} />
        </Stack>
      ) : null}
    </Sheet>
  );
}

// The sum behind the one number, closed until asked for (Art. 7.10).
function SumSheet({ open, head, rows, onClose }: { open: boolean; head: M.Headline | null; rows: M.SiteRow[]; onClose: () => void }) {
  const live = rows.filter(r => r.listing.state === 'live');
  return (
    <Sheet open={open} title={live.length && !head?.sum.some(s => s.label === 'Sold for') ? 'What you get on each site' : 'How it adds up'} onClose={onClose}>
      <List>
        {head?.sum.some(s => s.label === 'Sold for')
          ? head.sum.map(s => (
            <Row key={s.label} trail={<Txt role="body" tabular>{usd(s.amount)}</Txt>}><Txt role="body" tone={s.label.startsWith('You') ? 'ink' : 'ink-2'}>{s.label}</Txt></Row>
          ))
          : live.map(r => (
            <Row key={r.site} lead={<SiteBadge site={r.site} />} trail={<Txt role="body" tabular>{usd(r.keep)}</Txt>}>
              <Txt role="body">{`${usd(r.price)} less ${usd(r.price - r.keep)} fee`}</Txt>
            </Row>
          ))}
      </List>
      <FootButton id="sum-done" kind="second" label="Done" onPress={onClose} />
    </Sheet>
  );
}

function OffersSheet({ open, w, item, onClose }: { open: boolean; w: World; item: Item; onClose: () => void }) {
  const o = M.offerOf(w, item);
  const [declined, setDeclined] = useState(false);
  return (
    <Sheet open={open} title="Offers" onClose={onClose}>
      <List>
        {(o?.offers ?? []).map(x => (
          <Row key={x.id} lead={<SiteBadge site={x.site} />} trail={<Txt role="body" tabular>{usd(x.amount_cents)}</Txt>}>
            <Txt role="body">{`You’d get ${usd(x.you_keep_cents)}`}</Txt>
          </Row>
        ))}
      </List>
      <Approve id="decline-all" does={o && o.offers.length > 1 ? 'Decline both' : 'Decline'} status={declined ? 'done' : 'ready'}
        done="Declined. The listings stay up." onApprove={() => setDeclined(true)} onUndo={() => setDeclined(false)} />
    </Sheet>
  );
}

// Sold elsewhere, with an optional price, so it counts in Records (ways-out §6.6).
function SoldElsewhere({ open, live, onClose, onDone }: { open: boolean; live: number; onClose: () => void; onDone: (text: string) => void }) {
  const [price, setPrice] = useState('');
  return (
    <Sheet open={open} title="Sold elsewhere" onClose={onClose}>
      <Stack gap="tight">
        <Txt role="caption">What it sold for, if you want it in your records</Txt>
        <Line><Blank id="elsewhere-price" name="Price" value={price} onChange={setPrice} numeric /></Line>
      </Stack>
      <Approve id="elsewhere-done" does={live ? `Mark sold and end ${live === 1 ? 'the listing' : `${live} listings`}` : 'Mark sold'}
        onApprove={() => onDone(live ? `Marked sold. Took down ${live === 1 ? 'the listing' : `${live} listings`}.` : 'Marked sold.')} />
    </Sheet>
  );
}

// Delete can't be undone, so it waits for an Approve that says what it removes (the hand-off rule).
function DeleteSheet({ open, live, onClose }: { open: boolean; live: number; onClose: () => void }) {
  return (
    <Sheet open={open} title="Delete this item?" onClose={onClose}>
      <Txt role="body" tone="ink-2">Its photos go too. This can’t be undone.</Txt>
      <Approve id="delete-confirm" does={live ? `Delete and end ${live === 1 ? 'the listing' : `${live} listings`}` : 'Delete it'}
        onApprove={() => { onClose(); router.replace('/sell' as Href); }} />
    </Sheet>
  );
}

type Look = 'original' | 'clean' | 'ai';

// Photos (ways-out §6.6 and §6.5; edge-cases §6). Two named ways to improve them, never applied without a pick: Clean up
// adjusts the photo and never redraws the item (crop, straighten, light, white balance, background blur, no model); Enhance
// with AI redraws light and background, stays off until picked, and is marked as AI. Use original undoes either. On a live
// item the change goes to every listing, which is public, so it waits for an Approve that says so.
function PhotosSheet({ open, photos, title, live, look, onLook, onClose }: {
  open: boolean; photos: PhotoSrc[]; title: string; live: number; look: Look; onLook: (l: Look) => void; onClose: () => void;
}) {
  const [want, setWant] = useState<Look>(look);
  const [sent, setSent] = useState(false);
  const [before, setBefore] = useState<Look>(look);
  const changed = want !== look;
  const pick = (l: Look) => (on: boolean) => { setWant(on ? l : 'original'); setSent(false); };
  const sites = `${live} ${live === 1 ? 'listing' : 'listings'}`;
  return (
    <Sheet open={open} title="Photos" onClose={onClose}>
      <Stack gap="tight">
        <Line>{photos.slice(0, 4).map((p, i) => <Photo key={i} src={p} label={i ? `${title}, photo ${i + 1}` : `${title}, cover`} />)}</Line>
        <Txt role="caption">{photos.length > 1 ? `${many(photos.length, 'photo', 'photos')}. The first is the cover.` : photos.length ? 'One photo' : 'No photos yet'}</Txt>
      </Stack>
      <List>
        <Row trail={<Switch id="clean-up" label="Clean up" on={want === 'clean'} onChange={pick('clean')} />}>
          <Txt role="body">Clean up</Txt>
          <Txt role="caption">Crop, straighten, light, white balance, a softer background. Never redraws it.</Txt>
        </Row>
        <Row trail={<Switch id="enhance-ai" label="Enhance with AI" on={want === 'ai'} onChange={pick('ai')} />}>
          <Txt role="body">Enhance with AI</Txt>
          <Txt role="caption">Redraws light and background, then checks it against yours. Marked as AI.</Txt>
        </Row>
      </List>
      <Line>
        <Pill id="use-original" label="Use original" kind="second" state={want === 'original' ? 'disabled' : 'idle'} onPress={() => { setWant('original'); setSent(false); }} />
      </Line>
      <List>
        <ActionRow id="add-photos" label="Add or retake" line={live ? 'Goes to every listing' : undefined} onPress={() => { onClose(); router.push('/camera' as Href); }} />
      </List>
      {live && (changed || sent) ? (
        <Approve id="photos-apply" does={want === 'original' ? `Put the originals back on ${sites}` : `Update the photos on ${sites}`}
          status={sent ? 'done' : 'ready'} done={`Updated on ${sites}`}
          onApprove={() => { setBefore(look); onLook(want); setSent(true); }} onUndo={() => { onLook(before); setWant(before); setSent(false); }} />
      ) : (
        <FootButton id="photos-done" kind={changed ? 'primary' : 'second'} label={changed ? 'Use these' : 'Done'} onPress={() => { onLook(want); onClose(); }} />
      )}
    </Sheet>
  );
}

// The page's one act at its foot, by moment: Plan it for a draft, the one change for a slow item, Ship it or Handed
// over once sold, Sell again once kept (pages.md §6.6, the black pill column).
function Foot({ w, item, m, plan, online, onHanded }: {
  w: World; item: Item; m: M.Moment; plan: () => void; online: (what: string, act: () => void) => () => void; onHanded: () => void;
}) {
  const [status, setStatus] = useState<'ready' | 'done'>('ready');
  if (m === 'review') return <FootButton id="plan-it" label="Plan it" onPress={plan} />;
  if (m === 'kept' || m === 'unsold') return <FootButton id="sell-again" label="Sell again" onPress={plan} />;
  if (m === 'sold') {
    const sale = M.saleOf(w, item);
    const pickup = sale && w.appointments.find(a => a.order_id === sale.id && a.kind === 'pickup');
    if (pickup) {
      return <Approve id="handed-over" does="Handed over" onApprove={online('Handed over', onHanded)} />;
    }
    return <FootButton id="ship-it" label="Ship it" onPress={() => router.push(`/item/${item.id}/ship` as Href)} />;
  }
  if (m === 'live') {
    // Slow: the one change worth the most, written on the button. A price change waits for this tap.
    const d = w.decisions.find(x => x.item_id === item.id && x.kind === 'markdown' && x.state === 'open');
    const opt = d?.options.find(o => o.id === d.suggested);
    if (d && opt && d.money?.price_cents) {
      const n = M.liveListings(item).length;
      return <Approve id="lower" does={`${opt.label} on ${n} ${n === 1 ? 'site' : 'sites'}`} status={status}
        done={`Lowered to ${usd(d.money.price_cents)} on ${n} ${n === 1 ? 'site' : 'sites'}`} onApprove={online(opt.label, () => setStatus('done'))} onUndo={() => setStatus('ready')} />;
    }
  }
  return null;
}

// A brand or a model typed with a slip is matched to the catalog before it is shown (edge-cases §3: "Carhart" is Carhartt).
const spelled = (f: M.Field, v: string) => (f.attr.name === 'brand' || f.attr.name === 'model' ? correct(v) : v);

// Why? on the item's numbers (pages.md §6.6): the reason in words, then the sales the range goes by and each site's fee, then
// what the agent did on this item, each with its source and Undo where the site allows it.
function WhyItem({ open, why, onClose }: { open: boolean; why: M.Why; onClose: () => void }) {
  const [undone, setUndone] = useState<string[]>([]);
  return (
    <WhySheet id="why" open={open} title={why.title} says={why.says} basis={why.basis} onClose={onClose}
      numbers={
        <List>
          {why.sales.map(x => <KeepRow key={`s-${x.site}`} site={x.site} line={`Sold for ${usd(x.low)} to ${usd(x.high)}`} note={many(x.count, 'sale', 'sales')} />)}
          {why.fees.map(x => <KeepRow key={`f-${x.site}`} site={x.site} line={`${usd(x.price)} less ${usd(x.fee)} fee`} note={`Fee on ${x.on}`} keep={`You get ${usd(x.get)}`} />)}
        </List>
      }>
      {why.events.length ? (
        <Stack gap="tight">
          <Txt role="caption">What happened</Txt>
          <List>
            {why.events.map(e => (
              <Row key={e.id} lead={e.site ? <SiteBadge site={e.site} /> : undefined}
                trail={e.undo && !undone.includes(e.id) ? <Pill id={`why-undo-${e.id}`} label="Undo" kind="second" onPress={() => setUndone(u => [...u, e.id])} /> : null}>
                <Txt role="body" tone={undone.includes(e.id) ? 'ink-2' : 'ink'}>{undone.includes(e.id) ? `Undone. ${e.why}` : e.why}</Txt>
                <Txt role="caption">{e.at}</Txt>
              </Row>
            ))}
          </List>
        </Stack>
      ) : null}
    </WhySheet>
  );
}

// Split (ways-out §6.6, "These are two things"): the photos of the other thing move to a new item; nothing else changes.
function SplitSheet({ open, photos, title, onClose, onSplit }: { open: boolean; photos: PhotoSrc[]; title: string; onClose: () => void; onSplit: (n: number) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const n = picked.length;
  return (
    <Sheet open={open} title="Split" onClose={() => { setPicked([]); onClose(); }}>
      <Txt role="caption">Pick the photos of the other thing</Txt>
      <Grid columns={3}>
        {photos.map((p, i) => (
          <Tile key={i} id={`split-photo-${i + 1}`} title={`Photo ${i + 1}`} photo={p} select={picked.includes(i) ? 'picked' : 'on'}
            onPress={() => setPicked(x => (x.includes(i) ? x.filter(y => y !== i) : [...x, i]))} />
        ))}
      </Grid>
      <FootButton id="split-move" label={n ? `Move ${many(n, 'photo', 'photos')} to a new item` : 'Pick a photo'} state={n && n < photos.length ? 'idle' : 'disabled'}
        onPress={() => { setPicked([]); onSplit(n); }} />
    </Sheet>
  );
}
