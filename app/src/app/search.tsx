// Search results (pages §6.13): what it is and what it sells for, where the search looked and what each site said, then
// one list across the sites, ranked so the same thing at the lowest delivered total comes first (spec buy.md, Ranking).
// Each row is the listing's photo, its site's logo, the read of its price against the fair range, and what it costs
// delivered. Visitors can search; watching asks them to sign in at that moment (ways-out §6.17).
// The page's reasons and states are in app/behavior/search.json.
import { router, useLocalSearchParams } from 'expo-router';
import { cardLine, rank, searchFor } from '@/buy/read';
import { Failed, OfflineLine } from '@/buy/states';
import { href, usePage } from '@/buy/world';
import { product, usd, type Site } from '@/demo';
import { EmptyState, MatchCard, Nav, Notice, Screen, SearchField, Section, SiteStrip, Stack, Txt, type SiteSlot } from '@/ui';

const ALL: Site[] = ['ebay', 'mercari', 'depop', 'facebook', 'poshmark'];
// What a state searches for when the address names no query (app/src/demo/screen.ts): the demo's Dunks, or nothing found.
const DUNKS = 'nike dunk low grey 10', NOTHING = 'left-handed banjo case';
const SKIP = 'dense: a search lists what the sites answer, and the longest answer the demo has is typical’s six rows';

export default function Search() {
  const { w, state } = usePage();
  const params = useLocalSearchParams<{ q?: string; at?: string; visitor?: string }>();
  const visitor = params.visitor;
  const q = params.q || (state === 'empty' ? NOTHING : state && state !== 'new' ? DUNKS : '');
  const at = params.at ?? (state === 'loading' ? 'slow' : undefined);
  const r = searchFor(q, at);
  const p = r.product_id ? product(r.product_id) : null;
  const rows = rank(r.rows).filter((_, i) => state !== 'one' || i === 0);
  const nav = <Nav back={() => router.back()} action={q ? { id: 'search-watch', icon: 'notification-01', label: 'Watch this search', onPress: () => watch() } : undefined} />;
  if (state === 'failed') return <Failed name="search" nav={nav} what="this search" again={href(w, `/search?q=${encodeURIComponent(q)}`)} skip={SKIP} />;
  // Nothing typed yet: the box, and what it takes.
  if (!q) {
    return (
      <Screen name="search" state="new" skip={SKIP} nav={nav}>
        <SearchField id="search-box" placeholder="Find an item or paste a link" onSubmit={next => router.setParams({ q: next, at: undefined })} onCamera={() => router.push(href(w, '/camera'))} />
        <Txt role="body" tone="ink-2">Type what you want, paste a link, or take a photo. It looks on five sites at once.</Txt>
      </Screen>
    );
  }
  const waiting = r.sites_waiting.length > 0;
  const slots: SiteSlot[] = ALL.map(site => r.sites_waiting.includes(site) ? { site, state: 'waiting' }
    : r.counts[site] ? { site, state: 'in', note: String(r.counts[site]) } : { site, state: 'none' });
  function watch() { router.push(href(w, visitor ? '/onboarding' : `/want?q=${encodeURIComponent(r.query)}`)); }
  const retail = r.retail[0];
  return (
    <Screen name="search" state={state ?? (waiting ? 'loading' : rows.length ? 'typical' : 'empty')} skip={SKIP} nav={nav}>
      <SearchField id="search-box" value={r.query} placeholder="Find an item or paste a link" working={waiting}
        onSubmit={next => router.setParams({ q: next, at: undefined })} onCamera={() => router.push(href(w, '/camera'))} />
      {state === 'offline' ? <OfflineLine /> : null}

      <Stack>
        {p ? (
          <Stack gap="tight">
            <Txt role="headline">{`${p.brand} ${p.model}, ${p.variant}`}</Txt>
            <Txt role="body" tone="ink-2">
              Sold used for <Txt role="body" tone="ink">{`${usd(p.used_price.range.low)} to ${usd(p.used_price.range.high)}`}</Txt>
              {p.retail_price_cents ? `. New, ${usd(p.retail_price_cents)}${retail ? ` or ${usd(retail.delivered_cents)} delivered` : ''}.` : '.'}
            </Txt>
          </Stack>
        ) : null}
        <SiteStrip id="search-sites" slots={slots} />
      </Stack>

      {p ? <Notice id="search-product" icon="clock-01" text="Price history and recent sales" onPress={() => router.push(href(w, `/product/${p.id}${visitor ? '?visitor=1' : ''}`))} /> : null}

      {rows.length ? (
        <Section>
          {rows.map(m => <MatchCard key={m.id} id={`result-${m.id}`} title={m.title} photo={m.key} site={m.site} verdict={m.verdict} likeness={m.label}
            {...cardLine(m)} onPress={() => router.push(href(w, `/listing/${m.id}${visitor ? '?visitor=1' : ''}`))} />)}
        </Section>
      ) : waiting ? null : (
        <EmptyState title="Nothing for sale right now" line="Watch this search to hear when one turns up." action={{ id: 'search-empty-watch', label: 'Watch this search', onPress: watch }} />
      )}
    </Screen>
  );
}
