import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { EmptyState, Grid, IconButton, List, Screen, Sheet, Stack, Txt, type PhotoSrc } from '@/ui';
import { TabNav } from '@/ui/parts/tab-nav';
import { Chip, Choice, FilterRow } from '@/ui/parts/chip';
import { SegmentedControl } from '@/ui/parts/segmented-control';
import { Tile, TileSkeleton, type TileFact } from '@/ui/parts/tile';
import { unread, usd, type Item, type Order, type World } from '@/demo';
import { useScreen } from '@/demo/screen';
import { shortName } from '@/demo/short-name';

type Page = 'listings' | 'sales';
type Sort = 'latest' | 'price_high' | 'price_low';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'latest', label: 'Latest first' },
  { id: 'price_high', label: 'Price, high to low' },
  { id: 'price_low', label: 'Price, low to high' },
];
const LISTINGS = [{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'drafts', label: 'Drafts' }];
const SALES = [{ value: 'all', label: 'All' }, { value: 'to_ship', label: 'To ship' }, { value: 'shipped', label: 'Shipped' }, { value: 'canceled', label: 'Canceled' }, { value: 'completed', label: 'Completed' }];
const saleGroup = (order: Order) => {
  if (['cancelled', 'refunded'].includes(order.state)) return 'canceled';
  if (['released', 'handed_over'].includes(order.state)) return 'completed';
  if (['shipped', 'delivered', 'claim_window'].includes(order.state)) return 'shipped';
  return 'to_ship';
};
const active = (item: Item) => item.listings.some(listing => listing.state === 'live');
const draft = (item: Item) => ['capturing', 'researching', 'review', 'failed'].includes(item.state);

function money(item: Item, order?: Order): TileFact {
  if (order) {
    if (['cancelled', 'refunded'].includes(order.state) && order.payout_cents == null) return { label: order.state === 'refunded' ? 'Refunded' : 'Canceled' };
    return { label: 'You get', amount: usd(order.payout_cents ?? order.price_cents - order.fees_cents - order.shipping_cents) };
  }
  const mode = item.limits?.plan_choice;
  const point = item.valuation?.state === 'shown' && item.valuation.modes
    ? item.valuation.modes[mode === 'fast' || mode === 'best' ? mode : 'sell'] : null;
  if (point) return { label: 'You get', amount: usd(point.keep_cents) };
  const prices = item.listings.filter(listing => listing.state === 'live').map(listing => listing.price_cents);
  return prices.length ? { label: 'Listed at', amount: usd(Math.min(...prices)) } : { label: 'Pricing' };
}

function rows(world: World, page: Page, filter: string, sort: Sort) {
  const entries = page === 'sales'
    ? world.orders.filter(order => order.kind === 'sale' && (filter === 'all' || saleGroup(order) === filter)).flatMap(order => {
      const item = world.items.find(item => item.id === order.item_id);
      return item ? [{ id: order.id, item, order, at: order.created_at }] : [];
    })
    : world.items.filter(item => filter === 'active' ? active(item) : filter === 'drafts' ? draft(item) : active(item) || draft(item))
      .map(item => ({ id: item.id, item, order: undefined as Order | undefined, at: item.updated_at }));
  return entries.sort((a, b) => {
    if (sort === 'latest') return b.at.localeCompare(a.at);
    const price = (row: typeof a) => row.order?.price_cents ?? row.item.listings[0]?.price_cents ?? row.item.valuation?.range.low;
    const left = price(a), right = price(b);
    if (left == null) return right == null ? 0 : 1;
    if (right == null) return -1;
    return sort === 'price_high' ? right - left : left - right;
  });
}

export default function Sell() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const { w, state, name } = useScreen();
  const [page, setPage] = useState<Page>('listings');
  const [filter, setFilter] = useState(params.filter === 'drafts' ? 'drafts' : 'all');
  const [sort, setSort] = useState<Sort>('latest');
  const [sorting, setSorting] = useState(false);
  const filters = page === 'sales' ? SALES : LISTINGS;
  const entries = state === 'empty' ? [] : rows(w, page, filter, sort);
  const nav = <TabNav title="Sell" inbox={{ count: unread(w) }} />;
  return (
    <Screen name="sell" state={state ?? (entries.length ? 'typical' : name === 'new' ? 'new' : 'empty')} wash nav={nav}>
      <Stack gap="tight">
        <SegmentedControl id="sell-page" options={[{ id: 'listings', label: 'Listings' }, { id: 'sales', label: 'Sales' }]} value={page}
          onChange={value => { setPage(value as Page); setFilter('all'); }} />
        <FilterRow>
          {filters.map(option => <Chip key={option.value} id={`filter-${option.value}`} label={option.label} picked={filter === option.value} onPress={() => setFilter(option.value)} />)}
          <IconButton id="filter-sort" icon="sorting-01" label="Sort listings" onPress={() => setSorting(true)} />
        </FilterRow>
      </Stack>
      {state === 'offline' ? <Txt role="body" tone="ink-2">Waiting for signal</Txt> : null}
      {state === 'failed' ? <EmptyState title="Your things didn’t load" action={{ id: 'sell-retry', label: 'Retry', onPress: () => router.setParams({ state: '' }) }} />
        : state === 'loading' ? <Grid columns={2}>{[0, 1, 2, 3].map(i => <TileSkeleton key={i} />)}</Grid>
        : entries.length ? <Grid columns={2}>{entries.map(({ id, item, order }) => (
          <Tile key={id} id={`tile-${id}`} title={shortName(item)} photo={item.photos[0] ? item.photos[0].key as PhotoSrc : null}
            fact={money(item, order)} onPress={() => router.push(`/item/${item.id}` as Href)} />
        ))}</Grid>
          : <EmptyState title={page === 'sales' ? 'No sales here yet' : filter === 'drafts' ? 'No drafts' : filter === 'active' ? 'No active listings' : 'Nothing for sale'}
            action={page === 'listings' ? { id: 'sell-empty-camera', label: 'Sell an item', onPress: () => router.push('/camera?mode=sell' as Href) } : undefined} />}
      <Sheet open={sorting} title="Sort" onClose={() => setSorting(false)}>
        <List>{SORTS.map(option => <Choice key={option.id} id={`sort-${option.id}`} label={option.label} picked={sort === option.id} onPress={() => { setSort(option.id); setSorting(false); }} />)}</List>
      </Sheet>
    </Screen>
  );
}
