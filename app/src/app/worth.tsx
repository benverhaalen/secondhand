// What's it worth: the appraisal result for a thing the person owns (pages §6.11; appraise). What it is, what similar ones
// sold for (a range, from sold comparables only, with the sales one tap away), what they would keep on each site after
// its fee, and the next step. Every number comes from the demo world's valuation or the market's sold data; a site with
// too few sales shows none. Why each element is here is in app/behavior/worth.json, "decisions".
// one at a time: worth-deep, worth-keep, worth-model-field, worth-sell (alternatives of one state each; .agents/checks/screens.mjs S2)
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Approve, Blank, Guess, Line, List, Nav, Photo, Pill, Row, Screen, Section, Sheet, Stack, Txt, type PhotoSrc } from '@/ui';
import { Choice } from '@/ui/parts/chip';
import { KeepRow, Range, RangeSkeleton, SaleRow } from '@/ui/parts/worth';
import { ago, connectionState, itemById, product, usd, youKeep, type Cents, type Site, type World } from '@/demo';
import { useScreen } from '@/demo/screen';
import type { PhotoKey } from '@/demo/photo-keys';
import { photo } from '@/demo/photos';

type Stage = 'glance' | 'check' | 'unsure' | 'unknown';
// Attributes that say a thing may be worth far more than it looks (edge-cases §4): the quick path stops for an appraisal.
const VALUABLE = ['hallmark', 'signature', 'maker_mark'];
// One thing being valued: an item the person has, or a product a fresh photo matched.
type Subject = {
  title: string; key: PhotoKey; low: Cents; high: Cents; asOf: string; itemId?: string;
  sites: { site: Site; low: Cents | null; high: Cents | null; days: number | null }[];
};
// What a photo matches when nothing else is named: the Dunk Low, the market's best documented product. When the photo
// was not enough, the guess is the Switch, whose model number is on its label (clearing world, it_switch).
// A range is said in whole dollars, widened outward so it never claims more than the sales show (copy.md: numbers as a friend says them).
const down = (c: Cents) => usd(Math.floor(c / 100) * 100), up = (c: Cents) => usd(Math.ceil(c / 100) * 100);
// The list states Worth cannot be in, with why (B35).
const SKIP = 'empty: Worth is of one thing, so it has no list to be empty; one: it is always one thing; dense: one thing a page, so nothing piles up';
const FRESH = 'pr_dunk', UNSURE = 'pr_switch', UNSURE_GUESS = 'Nintendo Switch';

function fromProduct(id: string): Subject | null {
  const p = product(id);
  if (!p || p.used_price.state !== 'shown') return null;
  return {
    title: `${p.brand} ${p.model}, ${p.variant}`, key: p.key, low: p.used_price.range.low, high: p.used_price.range.high, asOf: p.used_price.as_of,
    sites: p.by_site.map(s => ({ site: s.site, low: s.sold?.low ?? null, high: s.sold?.high ?? null, days: s.median_days })),
  };
}
function fromItem(w: World, id: string): Subject | null {
  const it = itemById(w, id), v = it?.valuation;
  if (!it || !v || v.state !== 'shown') return null;
  return {
    title: it.title, key: it.photos[0].key, low: v.range.low, high: v.range.high, asOf: v.as_of, itemId: it.id,
    sites: v.per_site.map(s => ({ site: s.site, low: s.low, high: s.high, days: null })),
  };
}

export default function Worth() {
  const params = useLocalSearchParams<{ item?: string; product?: string; stage?: string }>();
  // The person and the state, from the URL (app/src/demo/screen.ts). Worth is always one thing, so it has no list to be
  // empty, one or dense; loading, failed and offline are the sales check that has not answered.
  const { w, state: asked } = useScreen();
  const [retried, setRetried] = useState(false);
  const waiting = retried ? null : asked;
  const [stage, setStage] = useState<Stage>(params.stage === 'glance' || params.stage === 'unsure' || params.stage === 'unknown' ? params.stage : 'check');
  // A price the person has in mind, and whether they already said yes to one far from the sales (asked once).
  const [pricing, setPricing] = useState(false);
  const [mine, setMine] = useState<Cents | null>(null);
  const [sure, setSure] = useState(false);
  const [kept, setKept] = useState(false);
  const [typing, setTyping] = useState(false);
  const [model, setModel] = useState('');
  const [deep, setDeep] = useState(false);
  const [sources, setSources] = useState(false);
  // The sites whose sales the person left out as not the same thing (Ben, 06:19: "investigate ... human in the loop").
  const [aside, setAside] = useState<Site[]>([]);

  const s = (params.item ? fromItem(w, params.item) : null) ?? fromProduct(stage === 'unsure' || model ? UNSURE : params.product ?? FRESH) ?? fromProduct(FRESH)!;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/sell' as Href));
  const nav = <Nav back={back} />;
  const pic = photo(s.key) as PhotoSrc;
  // A new number arrives when the person types the model: the value is checked again for what they named.
  const named = (v: string) => { setModel(v); setTyping(false); if (v.trim()) setStage('check'); };

  if (waiting === 'loading' || waiting === 'failed' || waiting === 'offline') {
    // The sales have not answered yet. Loading holds the range's place; failed says so with Retry; offline waits for
    // the signal (ways-out, Everywhere). No number is shown that the sales did not give.
    return (
      <Screen name="worth" state={waiting} skip={SKIP} nav={nav}>
        <Row lead={<Photo src={pic} label={s.title} />}>
          <Txt role="headline" lines={2}>{s.title}</Txt>
        </Row>
        {waiting === 'loading' ? <RangeSkeleton /> : (
          <Stack>
            <Txt role="body">{waiting === 'failed' ? 'The sales didn’t load.' : 'Waiting for signal'}</Txt>
            {waiting === 'failed'
              ? <Line gap="tight"><Pill id="worth-retry" label="Retry" onPress={() => setRetried(true)} /></Line>
              : <Txt role="body" tone="ink-2">It checks the sales when you’re back online.</Txt>}
          </Stack>
        )}
      </Screen>
    );
  }

  if (stage === 'unsure' || stage === 'unknown') {
    // "I don't know" is an answer, not a failure (edge-cases §4): no number, since sales can't be matched to a guess,
    // and selling still works from what the photo shows. Looking deeper is the way to a number.
    const unknown = stage === 'unknown';
    return (
      <Screen name="worth" state={stage} skip={SKIP} nav={nav}>
        <Row lead={<Photo src={pic} label="Your photo" />}>
          <Txt role="title">{unknown ? 'No number yet' : 'Which one is it?'}</Txt>
          {unknown ? <Txt role="body" tone="ink-2">It’ll be listed by what the photos show.</Txt>
            : <Guess id="worth-guess" name="What it looks like" value={UNSURE_GUESS} look="body" />}
        </Row>
        {unknown ? (
          <Stack>
            <Line gap="tight">
              <Pill id="worth-sell" label="Sell this" onPress={() => router.push('/camera' as Href)} />
              <Pill id="worth-model-again" kind="second" label="Type a model" onPress={() => setStage('unsure')} />
            </Line>
            <List>
              <Choice id="worth-deep" icon="search-01" label={deep ? 'Looking deeper' : 'Look deeper'} line={deep ? 'It lands on Today when it’s done.' : 'Older sales and more sites. Takes a few minutes.'} disabled={deep} onPress={() => setDeep(true)} />
            </List>
          </Stack>
        ) : (
          <Stack>
            <Stack gap="tight">
              <Blank id="worth-model-field" name="Model number" onChange={named} />
              <Txt role="caption">It’s on a label or the box.</Txt>
            </Stack>
            <List>
              <Choice id="worth-unknown" icon="information-circle" label="I don’t know" onPress={() => setStage('unknown')} />
            </List>
          </Stack>
        )}
      </Screen>
    );
  }

  // The value goes by the sales the person kept: with some left out, the range is the lowest to the highest of the rest.
  const sold = s.sites.filter(r => r.low != null && r.high != null) as (Subject['sites'][number] & { low: Cents; high: Cents })[];
  const counted = sold.filter(r => !aside.includes(r.site));
  const by = !aside.length ? { low: s.low, high: s.high } : counted.length ? { low: Math.min(...counted.map(r => r.low)), high: Math.max(...counted.map(r => r.high)) } : null;
  const toggle = (site: Site) => setAside(a => a.includes(site) ? a.filter(x => x !== site) : [...a, site]);
  const linked = w.connections.filter(c => connectionState(c) === 'connected').map(c => c.site);
  const rows = s.sites
    .map(r => ({ ...r, keepLow: r.low == null ? null : youKeep(r.site, r.low), keepHigh: r.high == null ? null : youKeep(r.site, r.high) }))
    .sort((a, b) => (b.keepHigh ?? -1) - (a.keepHigh ?? -1));
  const glance = stage === 'glance';
  // A URL that names new or typical draws this page for that person, and says so.
  const state = kept ? 'kept' : asked === 'new' || asked === 'typical' ? asked : stage;
  const sellTo = (s.itemId ? `/item/${s.itemId}` : '/camera') as Href;
  const valuable = !!s.itemId && !!itemById(w, s.itemId)?.attributes.some(a => VALUABLE.includes(a.name) && a.value != null);
  // More than 3 times the top of the sales, or under a third of the bottom (edge-cases §3).
  const far = mine != null && !!by && (mine > 3 * by.high || mine < by.low / 3);
  const priced = (v: string) => {
    const cents = Math.round(Number(v.replace(/[^\d.]/g, '')) * 100);
    setPricing(false); setSure(false); setMine(Number.isFinite(cents) && cents > 0 ? cents : null);
  };

  return (
    <Screen name="worth" state={state} skip={SKIP} nav={nav}>
      <Row lead={<Photo src={pic} label={s.title} />}>
        <Txt role="headline" lines={2}>{s.title}</Txt>
      </Row>

      <Stack gap="cards">
        {by ? <Range low={down(by.low)} high={up(by.high)} what={glance ? 'Rough guess' : aside.length ? 'From the sales you kept' : 'What similar ones sold for lately'} />
          : <Txt role="body">No sales left to go by. Put some back, or look deeper.</Txt>}
        {glance ? null : <Choice id="worth-sources" icon="search-01" label="Check the sales" line={aside.length ? `${aside.length} left out` : 'Leave out any that aren’t the same'} leads onPress={() => setSources(true)} />}
      </Stack>

      <Section title="You get">
        <List>
          {rows.map(r => (
            <KeepRow key={r.site} site={r.site}
              keep={glance || r.keepLow == null || r.keepHigh == null || aside.includes(r.site) ? undefined : `${down(r.keepLow)} to ${up(r.keepHigh)}`}
              line={glance ? 'Checking' : r.keepLow == null ? 'Too few sales here' : aside.includes(r.site) ? 'Left out' : r.days ? `Sells in about ${r.days} days` : 'After the fee'}
              note={!glance && linked.length && !linked.includes(r.site) ? 'Not linked' : undefined} />
          ))}
        </List>
      </Section>

      {glance ? null : kept ? (
        <Approve id="worth-keep" does="Keep it" status="done" done="Kept" onUndo={() => setKept(false)} />
      ) : valuable ? (
        <Stack>
          <Txt role="body">It has a maker’s mark. Get it appraised before it’s priced.</Txt>
          <Line gap="tight">
            <Pill id="worth-appraise" label={deep ? 'Appraisal asked' : 'Get it appraised'} state={deep ? 'disabled' : 'idle'} onPress={() => setDeep(true)} />
            <Pill id="worth-keep" kind="second" label="Keep it" onPress={() => setKept(true)} />
          </Line>
        </Stack>
      ) : far && !sure ? (
        // A price far from the sales asks once, with the range (edge-cases §3, "Oops, $500, I meant $50").
        <Stack>
          <Txt role="body">{`Similar ones sold for ${down(by!.low)} to ${up(by!.high)}. Sell at ${usd(mine!)}?`}</Txt>
          <Line gap="tight">
            <Pill id="worth-price-yes" label={`Sell at ${usd(mine!)}`} onPress={() => { setSure(true); router.push(sellTo); }} />
            <Pill id="worth-price-fix" kind="second" label="Change it" onPress={() => { setMine(null); setPricing(true); }} />
          </Line>
        </Stack>
      ) : (
        <Line gap="tight">
          <Pill id="worth-sell" label={mine ? `Sell at ${usd(mine)}` : 'Sell this'} onPress={() => router.push(sellTo)} />
          <Pill id="worth-keep" kind="second" label="Keep it" onPress={() => setKept(true)} />
        </Line>
      )}

      {glance ? null : (
        <Stack gap="tight">
          <List>
            <Choice id="worth-price" icon="money-03" label="Set your price" line={mine ? `Yours: ${usd(mine)}` : undefined} onPress={() => setPricing(true)} />
            <Choice id="worth-model" icon="edit-02" label="Type the model number" onPress={() => setTyping(true)} />
            <Choice id="worth-deep" icon="search-01" label={deep ? 'Looking deeper' : 'Look deeper'} line={deep ? 'It lands on Today when it’s done.' : 'More sites and older sales. Takes a few minutes.'} disabled={deep} onPress={() => setDeep(true)} />
          </List>
          {typing ? <Blank id="worth-model-field" name="Model number" onChange={named} /> : null}
          {pricing ? <Blank id="worth-price-field" name="Your price" numeric onChange={priced} /> : null}
        </Stack>
      )}

      {/* The person checks the sales the value goes by: a tick per site, taken off when those sales aren't the same thing,
          and the range above is worked out again from what they kept. Looking deeper is the agent's next step. */}
      <Sheet open={sources} title="The sales it goes by" onClose={() => setSources(false)}>
        {by ? <Range low={down(by.low)} high={up(by.high)} what={aside.length ? 'From the sales you kept' : `Checked ${ago(s.asOf, w.now).toLowerCase()}`} />
          : <Txt role="body">No sales left to go by.</Txt>}
        <List>
          {s.sites.map(r => (
            <SaleRow key={r.site} id={`worth-sale-${r.site}`} site={r.site} counted={!aside.includes(r.site)} onToggle={() => toggle(r.site)}
              sold={r.low == null || r.high == null ? undefined : `${down(r.low)} to ${up(r.high)}`}
              line={r.low == null || r.high == null ? 'Too few sales here' : r.days ? `Sold in about ${r.days} days` : 'Sold lately'} />
          ))}
          <Choice id="worth-sheet-deep" icon="search-01" label={deep ? 'Looking deeper' : 'Look deeper'} line={deep ? 'It lands on Today when it’s done.' : 'More sites and older sales. Takes a few minutes.'} disabled={deep} onPress={() => setDeep(true)} />
        </List>
      </Sheet>
    </Screen>
  );
}
