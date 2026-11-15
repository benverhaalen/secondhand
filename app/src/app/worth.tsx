// What's it worth: the appraisal result for a thing the person owns (pages §6.11; appraise). What it is, what similar ones
// sold for (a range, from sold comparables only, with the sales one tap away), what they would keep on each site after
// its fee, and the next step. Every number comes from the demo world's valuation or the market's sold data; a site with
// too few sales shows none. Why each element is here is in app/behavior/worth.json, "decisions".
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Approve, Blank, Guess, Line, List, Nav, Photo, Pill, Row, Screen, Section, Sheet, Stack, Txt, type PhotoSrc } from '@/ui';
import { Choice } from '@/ui/parts/chip';
import { KeepRow, Range } from '@/ui/parts/worth';
import { ago, connectionState, itemById, product, usd, world, WORLD_NAMES, youKeep, type AnyWorld, type Cents, type Site, type World } from '@/demo';
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
  const params = useLocalSearchParams<{ world?: string; item?: string; product?: string; stage?: string }>();
  const w = world(WORLD_NAMES.includes(params.world as AnyWorld) ? (params.world as AnyWorld) : undefined);
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

  const s = (params.item ? fromItem(w, params.item) : null) ?? fromProduct(stage === 'unsure' || model ? UNSURE : params.product ?? FRESH) ?? fromProduct(FRESH)!;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/sell' as Href));
  const nav = <Nav back={back} />;
  const pic = photo(s.key) as PhotoSrc;
  // A new number arrives when the person types the model: the value is checked again for what they named.
  const named = (v: string) => { setModel(v); setTyping(false); if (v.trim()) setStage('check'); };

  if (stage === 'unsure' || stage === 'unknown') {
    // "I don't know" is an answer, not a failure (edge-cases §4): no number, since sales can't be matched to a guess,
    // and selling still works from what the photo shows. Looking deeper is the way to a number.
    const unknown = stage === 'unknown';
    return (
      <Screen name="worth" state={stage} nav={nav}>
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

  const linked = w.connections.filter(c => connectionState(c) === 'connected').map(c => c.site);
  const rows = s.sites
    .map(r => ({ ...r, keepLow: r.low == null ? null : youKeep(r.site, r.low), keepHigh: r.high == null ? null : youKeep(r.site, r.high) }))
    .sort((a, b) => (b.keepHigh ?? -1) - (a.keepHigh ?? -1));
  const glance = stage === 'glance';
  const state = kept ? 'kept' : stage;
  const sellTo = (s.itemId ? `/item/${s.itemId}` : '/camera') as Href;
  const valuable = !!s.itemId && !!itemById(w, s.itemId)?.attributes.some(a => VALUABLE.includes(a.name) && a.value != null);
  // More than 3 times the top of the sales, or under a third of the bottom (edge-cases §3).
  const far = mine != null && (mine > 3 * s.high || mine < s.low / 3);
  const priced = (v: string) => {
    const cents = Math.round(Number(v.replace(/[^\d.]/g, '')) * 100);
    setPricing(false); setSure(false); setMine(Number.isFinite(cents) && cents > 0 ? cents : null);
  };

  return (
    <Screen name="worth" state={state} nav={nav}>
      <Row lead={<Photo src={pic} label={s.title} />}>
        <Txt role="headline" lines={2}>{s.title}</Txt>
      </Row>

      <Stack gap="cards">
        <Range low={down(s.low)} high={up(s.high)} what={glance ? 'Rough guess' : 'What similar ones sold for lately'} />
        {glance ? null : <Choice id="worth-sources" icon="store-01" label="See the sales" leads onPress={() => setSources(true)} />}
      </Stack>

      <Section title="You keep">
        <List>
          {rows.map(r => (
            <KeepRow key={r.site} site={r.site}
              keep={glance || r.keepLow == null || r.keepHigh == null ? undefined : `${down(r.keepLow)} to ${up(r.keepHigh)}`}
              line={glance ? 'Checking' : r.keepLow == null ? 'Too few sales here' : r.days ? `Sells in about ${r.days} days` : 'After the fee'}
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
          <Txt role="body">{`Similar ones sold for ${down(s.low)} to ${up(s.high)}. Sell at ${usd(mine!)}?`}</Txt>
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
            <Choice id="worth-price" icon="money-03" label="Have a price in mind?" line={mine ? `Yours: ${usd(mine)}` : undefined} onPress={() => setPricing(true)} />
            <Choice id="worth-model" icon="edit-02" label="Not this one? Type the model number" onPress={() => setTyping(true)} />
            <Choice id="worth-deep" icon="search-01" label={deep ? 'Looking deeper' : 'Look deeper'} line={deep ? 'It lands on Today when it’s done.' : 'More sites and older sales. Takes a few minutes.'} disabled={deep} onPress={() => setDeep(true)} />
          </List>
          {typing ? <Blank id="worth-model-field" name="Model number" onChange={named} /> : null}
          {pricing ? <Blank id="worth-price-field" name="Your price" numeric onChange={priced} /> : null}
        </Stack>
      )}

      <Sheet open={sources} title="What similar ones sold for" onClose={() => setSources(false)}>
        <List>
          {s.sites.map(r => (
            <KeepRow key={r.site} site={r.site} line={r.low == null || r.high == null ? 'Too few sales here' : 'Sold for'}
              keep={r.low == null || r.high == null ? undefined : `${down(r.low)} to ${up(r.high)}`} />
          ))}
        </List>
        <Txt role="caption">{`Checked ${ago(s.asOf, w.now).toLowerCase()}`}</Txt>
      </Sheet>
    </Screen>
  );
}
