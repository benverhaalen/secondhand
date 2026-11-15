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

type Stage = 'glance' | 'check' | 'unsure';
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
  const [stage, setStage] = useState<Stage>(params.stage === 'glance' || params.stage === 'unsure' ? params.stage : 'check');
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

  if (stage === 'unsure') {
    return (
      <Screen name="worth" state="unsure" nav={nav}>
        <Row lead={<Photo src={pic} label="Your photo" />}>
          <Txt role="title">Which one is it?</Txt>
          <Guess id="worth-guess" name="What it looks like" value={UNSURE_GUESS} look="body" />
        </Row>
        <Stack gap="tight">
          <Blank id="worth-model-field" name="Model number" onChange={named} />
          <Txt role="caption">It’s on a label or the box.</Txt>
        </Stack>
      </Screen>
    );
  }

  const linked = w.connections.filter(c => connectionState(c) === 'connected').map(c => c.site);
  const rows = s.sites
    .map(r => ({ ...r, keepLow: r.low == null ? null : youKeep(r.site, r.low), keepHigh: r.high == null ? null : youKeep(r.site, r.high) }))
    .sort((a, b) => (b.keepHigh ?? -1) - (a.keepHigh ?? -1));
  const glance = stage === 'glance';
  const state = kept ? 'kept' : stage;

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
      ) : (
        <Line gap="tight">
          <Pill id="worth-sell" label="Sell this" onPress={() => router.push((s.itemId ? `/item/${s.itemId}` : '/camera') as Href)} />
          <Pill id="worth-keep" kind="second" label="Keep it" onPress={() => setKept(true)} />
        </Line>
      )}

      {glance ? null : (
        <Stack gap="tight">
          <List>
            <Choice id="worth-model" icon="edit-02" label="Not this one? Type the model number" onPress={() => setTyping(true)} />
            <Choice id="worth-deep" icon="search-01" label={deep ? 'Looking deeper' : 'Look deeper'} line={deep ? 'It lands on Today when it’s done.' : 'More sites and older sales. Takes a few minutes.'} disabled={deep} onPress={() => setDeep(true)} />
          </List>
          {typing ? <Blank id="worth-model-field" name="Model number" onChange={named} /> : null}
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
