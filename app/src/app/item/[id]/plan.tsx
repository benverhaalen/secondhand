// The Plan sheet, over the item (spec/pages.md §6.7; price.md, Selling intents). What the person wants first, then the
// price, the lowest they take, the sites and the price drops, each saying what the agent will do. Every value the agent
// filled in is a Guess until the person types over it; a price under the lowest always waits for the Approve tap
// (decision 2026-11-14, a price below your floor always asks). Ways out (ways-out §6.7): type my own price, skip a site,
// price drops off, ask me before every offer, every adjustment open under any choice. Typing slips (edge-cases §3, agent
// proposal): a typed price far outside what similar ones sold for asks once with the range; a lowest over the price is
// refused in place.
// Prices across sites (Ben, 06:51 and 06:53, product/words.md "cross-listing prices are a choice, the reason in words
// first"; decisions.md 2026-11-15, Same take-home for a new seller): the rule this item uses, the account's unless the
// person picks another for this item, in its name and one plain reason; each site's numbers a tap under it.
// Under the choice, the three ways to price side by side, each with its price, what you get and how fast it sells
// when that is known (Ben, 09:09: "shouldnt it end up showing what each of these toggles is meant to show?";
// M.priceModes), so the trade is seen before picking, not after. The picked one is in ink with a tick.
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Approve, Blank, EmptyState, FootButton, Guess, Icon, IconButton, Line, List, Pill, Row, SiteBadge, Skeleton, Stack, Txt, log } from '@/ui';
import { Chips } from '@/ui/parts/chips';
import { GuessPick } from '@/ui/parts/pick';
import { PriceTrack } from '@/ui/parts/price-track';
import { RouteSheet, useCloseSheet } from '@/ui/parts/route-sheet';
import { Switch } from '@/ui/parts/switch';
import { WhySheet } from '@/ui/parts/why';
import { KeepRow } from '@/ui/parts/worth';
import { SITE_LABEL, range, usd, type Item, type Site, type World } from '@/demo';
import { useScreen } from '@/demo/screen';
import { SPREADS, type Spread } from '@/engines/listing/spreads';
import * as M from '@/item/model';

// How many sites the plan posts to decides one, typical or dense, so each route says where the other two are drawn.
// Loading, failed and offline are drawn from ?state= (useScreen); new and empty can't happen, a plan is of an item.
const ELSEWHERE: Record<string, string> = {
  one: 'an item on one site, /item/it_chair/plan', typical: 'two sites, /item/it_jacket/plan', dense: 'three sites, /item/it_jacket/plan?flip=facebook',
};
const skip = (drawn: string) => [
  'new: a plan is set on an item that exists', 'empty: a plan is set on an item that exists',
  ...Object.entries(ELSEWHERE).filter(([s]) => s !== drawn).map(([s, why]) => `${s}: ${why}`),
].join('; ');

// "$98", "98", "98.50" to cents; null when it is not an amount.
const cents = (s: string) => { const n = parseFloat(s.replace(/[^\d.]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) : null; };
const count = (n: number) => `${n} ${n === 1 ? 'site' : 'sites'}`;

export default function ItemPlan() {
  const { id, world, flip } = useLocalSearchParams<{ id: string; world?: string; flip?: string }>();
  const { state } = useScreen();
  const found = state === 'failed' ? null : M.find(String(id), world);
  const next = useRef<Href | null>(null);
  const onClosed = () => { if (next.current) router.replace(next.current); else router.back(); };
  if (state === 'loading') {
    return (
      <RouteSheet name="item-plan" state="loading" skip={skip('loading')} title="Plan" onClosed={onClosed}>
        <Stack gap="cards"><Skeleton of="notice" /><Skeleton of="card-item" /></Stack>
      </RouteSheet>
    );
  }
  if (!found) {
    // Didn't load: the one fix is to load it again (frontend-standard §4, Error). Gone: nothing to try.
    return (
      <RouteSheet name="item-plan" state="failed" skip={skip('failed')} title="Plan" onClosed={onClosed}>
        <EmptyState title="Can’t open this item" line="It was deleted, or it didn’t load."
          action={state === 'failed' ? { id: 'plan-retry', label: 'Try again', onPress: () => router.replace(`/item/${id}/plan${world ? `?world=${world}` : ''}` as Href) } : undefined} />
      </RouteSheet>
    );
  }
  return <Plan w={found.w} item={found.item} onClosed={onClosed} flip={(flip ?? '').split(',').filter(Boolean) as Site[]} offline={state === 'offline'}
    toPost={(price, flipped, spread) => {
      const q = [`price=${price}`, flipped.length ? `flip=${flipped.join(',')}` : '', spread !== M.spreadOf(found.item) ? `spread=${spread}` : '', world ? `world=${world}` : ''];
      next.current = `/item/${found.item.id}/post?${q.filter(Boolean).join('&')}` as Href;
    }} />;
}

function Plan({ w, item, flip, offline, onClosed, toPost }: {
  w: World; item: Item; flip: Site[]; offline: boolean; onClosed: () => void; toPost: (price: number, flipped: Site[], spread: Spread) => void;
}) {
  const m = M.momentOf(w, item);
  const draft = m === 'review' || m === 'researching' || m === 'kept' || m === 'unsold';
  const live = M.liveListings(item).filter(l => l.state === 'live');
  const start = (item.limits?.plan_choice ?? 'sell') as M.Choice;
  const startHandover = w.limits.handover.length > 1 ? 'both' : w.limits.handover[0] ?? 'ship';
  const startFallback = item.limits?.fallback ?? 'ask';
  const startAsk = item.limits?.accept_mode === 'ask';
  const [choice, setChoice] = useState<M.Choice>(start);
  const [typed, setTyped] = useState<string | null>(null);
  const [floorTyped, setFloorTyped] = useState<string | null>(null);
  const [always, setAlways] = useState(item.limits?.always_accept_cents ? usd(item.limits.always_accept_cents) : '');
  // The sites the person switched from the agent's pick (planSites): a picked one skipped, a linked one added.
  const [flipped, setFlipped] = useState<Site[]>(flip);
  const [dropsOn, setDropsOn] = useState(item.limits?.markdown_on ?? true);
  const [fallback, setFallback] = useState<string>(startFallback);
  const [handover, setHandover] = useState<string>(startHandover);
  const [askEvery, setAskEvery] = useState(startAsk);
  const [spread, setSpread] = useState<Spread>(M.spreadOf(item));
  const goneBys = M.goneByChoices(w.now);
  const [goneBy, setGoneBy] = useState(goneBys[1].id);
  const [saved, setSaved] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [farOk, setFarOk] = useState<number | null>(null);
  const [numbers, setNumbers] = useState(false);
  // Any pick the person makes brings up Save, even one back to where it started: they made a choice (pages.md §6.7).
  const [touched, setTouched] = useState(false);
  const edit = () => { setSaved(false); setWaiting(false); setTouched(true); };

  // The price the agent suggests: what it is listed at now, or what the choice starts at. Typing over it makes it the person's.
  const current = live.length ? Math.min(...live.map(l => l.price_cents)) : item.listings[0]?.price_cents ?? null;
  const suggested = choice === start && current !== null ? current : M.priceFor(item, choice) ?? current;
  const price = (typed !== null ? cents(typed) : null) ?? suggested;
  const floorSuggested = item.limits?.floor_cents ?? M.priceFor(item, 'fast');
  const floorWanted = floorTyped !== null ? cents(floorTyped) : null;
  // A lowest over the asking price can't be: refused in place, and the one it had stays.
  const floorRefused = floorWanted !== null && price !== null && floorWanted > price;
  const floor = (floorRefused ? null : floorWanted) ?? floorSuggested ?? 0;
  const under = price !== null && price < floor;
  const sites = price !== null ? M.planSites(w, item, price, flipped, spread) : [];
  const on = sites.filter(s => s.on);
  const steps = dropsOn && price !== null ? M.drops(item, price, choice, w.now) : [];
  const outlook = item.listings.map(l => l.market_standing?.outlook).find(o => o);
  const changed = touched || choice !== start || typed !== null || floorTyped !== null || flipped.length > 0 || dropsOn !== (item.limits?.markdown_on ?? true)
    || fallback !== startFallback || handover !== startHandover || askEvery !== startAsk || spread !== M.spreadOf(item);
  const poshOnly = on.length > 0 && on.every(s => s.site === 'poshmark');
  const v = item.valuation?.state === 'shown' ? item.valuation.range : null;
  // An extra zero, or one missing: over 3 times the top of the range or under a third of the bottom asks once.
  const far = typed !== null && price !== null && v !== null && (price > v.high * 3 || price < v.low / 3) && farOk !== price;
  const one = on.every(s => s.price === price);
  const at = price !== null ? (one ? usd(price) : `from ${usd(price)}`) : '';

  const consequence = choice === 'check' ? 'Lists only where an offer doesn’t bind you. Every offer asks you.'
    : choice === 'reserve' ? 'Waits for your price. No drops, never marked slow.'
    : choice === start && outlook && price !== null ? `At ${usd(price)}, about ${outlook.days_lo} to ${outlook.days_hi} days` : '';
  const modes = M.priceModes(w, item, flipped);

  // Offline, Save waits for signal and says so; nothing claims it is saved (ways-out Everywhere, "I'm on bad signal").
  const save = () => {
    if (offline) { log.event('ui.show', { screen: 'item-plan', state: 'waiting-for-signal', item: item.id, what: 'save-plan' }); setWaiting(true); return; }
    setSaved(true);
  };
  const foot = draft
    ? <PreviewButton disabled={!on.length || price === null || far} under={under} price={price} toPost={() => price !== null && toPost(price, flipped, spread)} />
    : changed && !far ? (
      <Approve id="save-plan" does={under ? `Set ${usd(price!)}, under your lowest` : `Save: ${at} on ${count(on.length)}`}
        status={saved ? 'done' : 'ready'} done={`Saved. ${at} on ${count(on.length)}.`}
        onApprove={save} onUndo={() => setSaved(false)} />
    ) : null;

  const drawn = on.length >= 3 ? 'dense' : on.length <= 1 ? 'one' : 'typical';
  const rule = SPREADS[spread];
  const track = v ? { min: Math.floor(Math.min(floor, v.low * 0.7) / 100), max: Math.ceil((v.high * 1.3) / 100) } : null;
  return (
    <RouteSheet name="item-plan" state={offline ? 'offline' : drawn} skip={skip(drawn)} title="Plan" foot={foot} onClosed={onClosed}>
      {offline ? (
        <Line><Icon name="refresh" size={12} tone="ink-2" />
          <Txt role="caption">{waiting ? 'Waiting for signal. Your plan saves when you’re back.' : 'Offline. Changes send when you’re back.'}</Txt></Line>
      ) : null}
      <Stack>
        <Txt role="caption">What do you want?</Txt>
        <Chips id="choice" name="What do you want" value={choice} options={M.CHOICES} onChange={c => { setChoice(c as M.Choice); setTyped(null); edit(); }} />
        {modes.length ? (
          <List>
            {modes.map(r => (
              <Row key={r.choice} lead={r.choice === choice ? <Icon name="tick-02" size={12} /> : <View style={{ width: 12 }} />}
                trail={<Txt role="body" tabular tone={r.choice === choice ? 'ink' : 'ink-2'}>{usd(r.price)}</Txt>}>
                <Txt role="body" tone={r.choice === choice ? 'ink' : 'ink-2'}>{r.label}</Txt>
                {r.line ? <Txt role="caption">{r.line}</Txt> : null}
              </Row>
            ))}
          </List>
        ) : null}
        {consequence ? <Txt role="body">{consequence}</Txt> : null}
        {/* Gone fast asks by when (pages.md §6.7 row 4): the date is a guess the person can change. */}
        {choice === 'fast' ? (
          <Line><GuessPick id="gone-by" name="Gone by" value={goneBy} choices={goneBys.map(g => ({ id: g.id, label: g.label }))} onPick={g => { setGoneBy(g); edit(); }} /></Line>
        ) : null}
      </Stack>

      <List>
        <Row>
          <Txt role="caption">Price</Txt>
          {price !== null
            ? <Line><Guess key={`price-${choice}-${typed ?? ''}`} id="plan-price" name="Price" value={usd(price)} changed={typed !== null} numeric look="body" onChange={t => { setTyped(t); edit(); }} /></Line>
            : <Line><Blank id="plan-price" name="Price" numeric look="body" onChange={t => setTyped(t)} /></Line>}
          {v ? <Txt role="caption">{`Similar ones sold for ${range(v)}`}</Txt> : null}
          {far && v ? (
            <Stack gap="tight">
              <Line><Icon name="alert-02" size={12} tone="brick" /><Txt role="caption">{`Similar ones sold for ${range(v)}. List at ${usd(price!)}?`}</Txt></Line>
              <Line><Pill id="far-yes" label={`Yes, ${usd(price!)}`} kind="second" onPress={() => setFarOk(price)} /></Line>
            </Stack>
          ) : under ? (
            <Line><Icon name="alert-02" size={12} tone="brick" /><Txt role="caption">{`Under your lowest, ${usd(floor)}. It waits for your tap.`}</Txt></Line>
          ) : null}
        </Row>
        {/* The price dragged along what similar ones sold for (pages.md §6.7 row 2, the posture slider). */}
        {track && price !== null ? (
          <PriceTrack id="price-track" label="Price" min={track.min} max={track.max} value={Math.round(price / 100)} ticks={M.soldTicks(item)}
            caption="Each tick is a sale like it" onChange={d => { setTyped(String(d)); edit(); }} />
        ) : null}
        <Row>
          <Txt role="caption">Lowest you take</Txt>
          <Line><Guess id="plan-floor" name="Lowest you take" value={usd(floor)} changed={floorTyped !== null} numeric look="body" onChange={t => { setFloorTyped(t); edit(); }} /></Line>
          {floorRefused
            ? <Line><Icon name="alert-02" size={12} tone="brick" /><Txt role="caption">{`Can’t be over the price, ${usd(price!)}. Kept at ${usd(floor)}.`}</Txt></Line>
            : <Txt role="caption">Offers under it always ask you</Txt>}
        </Row>
        <Row>
          <Txt role="caption">Always accept</Txt>
          <Line><Blank id="plan-always" name="Always accept at" value={always} numeric look="body" onChange={t => { setAlways(t); edit(); }} /></Line>
          <Txt role="caption">{askEvery ? 'Off while every offer asks you' : 'Offers at or over it sell without asking'}</Txt>
        </Row>
        <Row trail={<Switch id="accept-mode" label="Ask me before every offer" on={askEvery} onChange={o => { setAskEvery(o); edit(); }} />}>
          <Txt role="body">Ask me before every offer</Txt>
        </Row>
      </List>

      <Stack>
        <Txt role="caption">Sites</Txt>
        <List>
          {sites.map(s => (
            <Row key={s.site} lead={<SiteBadge site={s.site} />}
              trail={<Switch id={`site-${s.site}`} label={`Post on ${SITE_LABEL[s.site]}`} on={s.on} disabled={!s.can}
                onChange={() => { setFlipped(k => (k.includes(s.site) ? k.filter(x => x !== s.site) : [...k, s.site])); edit(); }} />}>
              <Txt role="body" tone={s.on ? 'ink' : 'ink-2'} lines={3}>{s.why}</Txt>
              {s.can ? <Txt role="caption" lines={1}>{s.returns}</Txt> : null}
            </Row>
          ))}
        </List>
      </Stack>

      {/* Prices across sites: the rule's name, then its reason in words; the numbers wait for a tap (Ben, 06:53). */}
      {on.length > 1 ? (
        <Row trail={<IconButton id="spread-why" icon="information-circle" label="See the numbers" look="plain" onPress={() => setNumbers(true)} />}>
          <Txt role="caption">Prices across sites</Txt>
          <Line><GuessPick id="plan-spread" name="Prices across sites" value={spread} choices={M.rules(item)} changed={spread !== M.spreadOf(item)}
            onPick={k => { setSpread(k as Spread); edit(); }} /></Line>
          <Txt role="caption">{rule.says}</Txt>
        </Row>
      ) : null}

      {choice !== 'reserve' && choice !== 'check' ? (
        <Row trail={<Switch id="drops" label="Price drops" on={dropsOn} onChange={o => { setDropsOn(o); edit(); }} />}>
          <Txt role="body">Price drops</Txt>
          {steps.length
            ? steps.map(s => <Txt key={s.at + s.label} role="caption">{`${s.at}: ${s.label.toLowerCase()}`}</Txt>)
            : <Txt role="caption">Stays at its price until you change it</Txt>}
        </Row>
      ) : null}

      <Stack>
        <Txt role="caption">If it doesn’t sell</Txt>
        <Chips id="fallback" name="If it doesn’t sell" value={fallback} onChange={f => { setFallback(f); edit(); }}
          options={[{ id: 'ask', label: 'Ask me' }, { id: 'donate', label: 'Donate' }, { id: 'keep', label: 'Keep it' }, ...(poshOnly ? [] : [{ id: 'relist', label: 'Relist' }])]} />
      </Stack>

      <Stack>
        <Txt role="caption">Ship or pickup</Txt>
        <Chips id="handover" name="Ship or pickup" value={handover} onChange={h => { setHandover(h); edit(); }}
          options={[{ id: 'ship', label: 'Ship' }, { id: 'pickup', label: 'Pickup' }, { id: 'both', label: 'Either' }]} />
      </Stack>

      <WhySheet id="spread" open={numbers} title={rule.name} says={rule.says} onClose={() => setNumbers(false)}
        basis="From each site’s fees today, with sales tax where the site charges on it"
        numbers={
          <List>
            {on.map(s => { const f = M.feeLine(s.site, s.price); return (
              <KeepRow key={s.site} site={s.site} line={`Lists at ${usd(f.price)}`} note={`${usd(f.fee)} in fees, on ${f.on}`} keep={`You get ${usd(f.get)}`} />
            ); })}
          </List>
        } />
    </RouteSheet>
  );
}

// A draft's act: on to the Post preview. Nothing goes public from here; a price under the lowest still waits there.
function PreviewButton({ disabled, under, price, toPost }: { disabled: boolean; under: boolean; price: number | null; toPost: () => void }) {
  const close = useCloseSheet();
  return <FootButton id="preview" label={under && price !== null ? `Preview at ${usd(price)}` : 'Preview listings'} state={disabled ? 'disabled' : 'idle'} onPress={() => { toPost(); close(); }} />;
}
