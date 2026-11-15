import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { cardLine } from '@/buy/read';
import { Failed, Loading, OfflineLine } from '@/buy/states';
import { href, usePage } from '@/buy/world';
import { ago, usd, unread, type Lookup, type Match, type Want } from '@/demo';
import { TabNav } from '@/ui/parts/tab-nav';
import { SegmentedControl } from '@/ui/parts/segmented-control';
import { shortName } from '@/demo/short-name';
import { CardGroup } from '@/ui/parts/card-group';
import { ListRow } from '@/ui/parts/list-row';
import { Card, EmptyState, List, MatchCard, Photo, Screen, SearchField, Stack, Txt } from '@/ui';

type Page = 'tracked' | 'appraised' | 'found';
type TrackedWant = Want & { low_cents?: number | null; colours?: string[] };
export type AppraisalSnapshot = Lookup & {
  photo_url?: string | null;
  appraisal?: { low_cents: number; high_cents: number; why: string } | null;
};
const pages = [{ id: 'tracked', label: 'Tracked' }, { id: 'appraised', label: 'Appraised' }, { id: 'found', label: 'Found' }];
const trackedName = (want: Want) => shortName({ title: want.text.replace(/\s*\b(under|below) \$[\d,.]+/i, '').replace(/\s*\bwithin \d+ (mi|miles?)\b/i, '') });
const priceRange = (want: TrackedWant) => want.max_total_cents == null ? 'Any price'
  : want.low_cents == null ? `Up to ${usd(want.max_total_cents)}` : `${usd(want.low_cents)} to ${usd(want.max_total_cents)}`;
const description = (want: TrackedWant) => [want.text, want.fit.size ? `Size ${want.fit.size}` : null, want.colours?.join(', '), want.fit.condition_floor].filter(Boolean).join(' · ');
const fits = (match: Match, want: TrackedWant) => {
  if (match.state === 'gone' || match.state === 'dismissed' || match.state === 'bought') return false;
  if (match.label !== 'exact' && match.label !== 'likely_same_model') return false;
  if (want.max_total_cents != null && match.delivered_cents > want.max_total_cents) return false;
  if (want.low_cents != null && match.delivered_cents < want.low_cents) return false;
  return !want.fit.size || match.size?.toLowerCase() === want.fit.size.toLowerCase();
};

export default function Buy() {
  const { w, state } = usePage();
  const params = useLocalSearchParams<{ view?: string; world?: string; state?: string }>();
  const link = (path: string): Href => params.world ? `${path}${path.includes('?') ? '&' : '?'}world=${encodeURIComponent(params.world)}` as Href : href(w, path);
  const [page, setPage] = useState<Page>(pages.some(option => option.id === params.view) ? params.view as Page : 'tracked');
  const wants: TrackedWant[] = state === 'empty' ? [] : w.wants.filter(want => want.state !== 'ended');
  const appraisals: AppraisalSnapshot[] = state === 'empty' ? [] : w.lookups.filter(lookup => lookup.kind === 'worth').sort((a, b) => b.at.localeCompare(a.at));
  const found = wants.flatMap(want => {
    const matches = w.matches.filter(match => match.want_id === want.id && fits(match, want)).sort((a, b) => b.seen_at.localeCompare(a.seen_at));
    return matches.length ? [{ want, matches }] : [];
  });
  const nav = <TabNav title="Buy" inbox={{ count: unread(w), onPress: () => router.push(link('/messages')) }} />;
  if (state === 'loading') return <Loading name="buy" nav={nav} />;
  if (state === 'failed') return <Failed name="buy" nav={nav} what="your list" again={link('/buy')} />;
  return (
    <Screen name="buy" state={state ?? 'typical'} wash nav={nav}>
      <SegmentedControl id="buy-page" options={pages} value={page} onChange={value => setPage(value as Page)} />
      <SearchField id="buy-search" placeholder="Find an item or paste a link" onOpen={() => router.push(link('/shop'))}
        onCamera={() => router.push(link('/camera?mode=find'))} onSubmit={query => router.push(link(`/shop?q=${encodeURIComponent(query)}`))} />
      {state === 'offline' ? <OfflineLine /> : null}
      {page === 'tracked' ? wants.length ? (
        <List>{wants.map(want => (
          <ListRow key={want.id} id={`want-${want.id}`} label={trackedName(want)} detail={description(want)} value={priceRange(want)}
            onPress={() => router.push(link(`/want?id=${want.id}`))} />
        ))}</List>
      ) : <EmptyState title="Nothing tracked yet" action={{ id: 'buy-track', label: 'Track an item', onPress: () => router.push(link('/want')) }} /> : null}
      {page === 'appraised' ? appraisals.length ? (
        <CardGroup>{appraisals.map(appraisal => (
          <Card key={appraisal.capture_id}>
            <Stack gap="tight">
              <Photo src={appraisal.photo_url ?? null} label={appraisal.short_name} fit="fill" />
              <Txt role="headline">{appraisal.short_name}</Txt>
              <Txt role="headline">{appraisal.appraisal ? `${usd(appraisal.appraisal.low_cents)} to ${usd(appraisal.appraisal.high_cents)}` : 'Appraisal unavailable'}</Txt>
              <Txt role="body">Why</Txt>
              <Txt role="body" tone="ink-2">{appraisal.appraisal?.why ?? 'The original appraisal was not saved.'}</Txt>
            </Stack>
          </Card>
        ))}</CardGroup>
      ) : <EmptyState title="No appraisals yet" action={{ id: 'buy-appraise', label: 'Appraise an item', onPress: () => router.push(link('/camera?mode=worth')) }} /> : null}
      {page === 'found' ? found.length ? found.map(({ want, matches }) => (
        <CardGroup key={want.id} label={`${trackedName(want)} · ${priceRange(want)}`}>
          <Txt role="body" tone="ink-2">{description(want)}</Txt>
          {matches.map(match => <MatchCard key={match.id} id={`match-${match.id}`} title={shortName(match)} photo={match.key} site={match.site}
            verdict={match.verdict} likeness={match.label} {...cardLine(match)} when={ago(match.seen_at)}
            onPress={() => router.push(link(`/listing/${match.id}`))} />)}
        </CardGroup>
      )) : <EmptyState title="No matches yet" line="Matches in your price range will appear here and in Messages." /> : null}
    </Screen>
  );
}
