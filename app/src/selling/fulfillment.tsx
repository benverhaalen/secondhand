import { Linking } from 'react-native';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { EmptyState, FootButton, Line, List, Nav, Photo, Pill, Row, Screen, SiteBadge, Stack, Tag, Txt, log, type TagState } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { useSales, saleStatus } from './sales';
import { useSellerItem } from './use-item';
import { destinations } from './sites';
import { moneyOf, showMoney } from './item';

const saleTag = (state: string): TagState => ({ paid: 'sold', to_ship: 'ship', pickup_booked: 'ship', shipped: 'ship', delivered: 'sold', handed_over: 'sold', claim_window: 'sold', released: 'paid', cancelled: 'ended', refunded: 'ended', return_open: 'need', dispute_open: 'need' } as Record<string, TagState>)[state] ?? 'draft';
function nextStep(state: string, pickup: boolean) {
  if (state === 'pickup_booked' || (pickup && ['paid', 'to_ship'].includes(state))) return 'Arrange pickup and confirm the handover on the selling site.';
  if (['paid', 'to_ship'].includes(state)) return 'Manage delivery, labels and tracking on the selling site.';
  if (state === 'shipped') return 'Follow delivery progress on the selling site.';
  if (state === 'return_open') return 'Check the return and your next steps on the selling site.';
  if (state === 'dispute_open') return 'Review the dispute and respond on the selling site.';
  if (['delivered', 'handed_over', 'claim_window'].includes(state)) return 'Check the payment status on the selling site.';
  return 'View the sale record on the selling site.';
}

export function SellerFulfillment({ id, order, pickup = false }: { id: string; order?: string; pickup?: boolean }) {
  const items = useSellerItem(id), orders = useSales(), [error, setError] = useState<string | null>(null);
  const matches = orders.sales.filter(sale => sale.item_id === id);
  const sale = order ? matches.find(sale => sale.id === order) : matches.length === 1 ? matches[0] : undefined;
  const item = items.data?.item, loading = items.loading || orders.loading;
  const failure = items.error ?? orders.error;
  const listing = item?.listings.find(listing => listing.id === sale?.listing_id) ?? item?.listings.find(listing => listing.site === sale?.site);
  const orderUrl = sale?.url && /^https?:\/\//.test(sale.url) ? sale.url : null;
  const destination = destinations.find(destination => destination.site === sale?.site);
  const url = orderUrl ?? (listing?.url.startsWith('https://') ? listing.url : destination ? new URL(destination.url).origin : null);
  const open = async () => { if (!url) return; setError(null); try { await Linking.openURL(url); } catch (failure) { log.error('selling.fulfill.open', failure); setError('The site did not open. Retry.'); } };
  const reload = () => { void items.reload(); void orders.reload(); };
  const payout = moneyOf(sale?.payout_cents), price = moneyOf(sale?.price_cents);
  return <Screen name="seller-fulfillment" state={loading ? 'loading' : failure ? 'failed' : sale || matches.length ? 'typical' : 'empty'}
    nav={<Nav back={() => router.canGoBack() ? router.back() : router.replace('/sell' as Href)} />} onRefresh={reload} refreshing={loading}
    foot={!loading && !failure && sale && url ? <Stack gap="group">
      <Txt role="caption">{nextStep(sale.state, pickup)}</Txt>
      {error ? <Txt role="body">{error}</Txt> : null}
      <FootButton id="sale-open-site" label={orderUrl ? 'Open sale on site' : listing?.url.startsWith('https://') ? 'Open listing on site' : 'Open selling site'} onPress={open} />
    </Stack> : undefined}>
    <Txt role="heading">{pickup ? 'pickup' : 'your sale'}</Txt>
    {loading ? <Txt role="body">Loading sale</Txt> : failure ? <EmptyState title="This sale did not load" line={failure} action={{ id: 'sale-retry', label: 'Retry', onPress: reload }} />
      : !order && matches.length > 1 ? <Stack>
        <Row lead={<Photo src={item?.photos[0]?.key} label={item?.title || 'Sold item'} />}><Txt role="headline">{item?.title || 'Sold item'}</Txt></Row>
        <Txt role="headline">Choose a sale</Txt>
        <List>{matches.map(entry => <ListRow key={entry.id} id={`sale-choose-${entry.id}`} label={saleStatus(entry)} detail={entry.external_order_id ? `Order ${entry.external_order_id}` : entry.created_at ? new Date(entry.created_at).toLocaleDateString() : entry.id}
          site={destinations.find(site => site.site === entry.site)?.site} value={showMoney(moneyOf(entry.price_cents))}
          onPress={() => router.replace(`/item/${id}/${entry.state === 'pickup_booked' ? 'pickup' : 'ship'}?order=${encodeURIComponent(entry.id)}` as Href)} />)}</List>
      </Stack>
      : !sale ? <EmptyState title="No sale yet" action={{ id: 'sale-back', label: 'Back to Sell', onPress: () => router.replace('/sell' as Href) }} /> : <>
        <Stack gap="cards">
          <Row lead={<Photo src={item?.photos[0]?.key} label={item?.title || 'Sold item'} />} trail={destination ? <SiteBadge site={destination.site} prominent /> : undefined}>
            <Txt role="headline">{item?.title || 'Sold item'}</Txt>
            <Line><Tag state={saleTag(sale.state)} word={saleStatus(sale)} /></Line>
            {!destination ? <Txt role="caption">{sale.site}</Txt> : null}
          </Row>
          <Stack gap="tight">
            <Txt role="caption">{payout ? 'You get' : 'Sold for'}</Txt>
            <Txt role={payout || price ? 'amount' : 'headline'}>{showMoney(payout ?? price)}</Txt>
          </Stack>
        </Stack>
        <Stack gap="tight">
          <Row trail={<Pill id="sale-refresh" kind="second" label="Refresh sale" onPress={reload} />}><Txt role="headline">Sale details</Txt></Row>
          <List>
            <Row trail={<Txt role="body" tabular>{showMoney(price)}</Txt>}><Txt role="body" tone="ink-2">Sale price</Txt></Row>
            <Row trail={<Txt role="body" tabular>{showMoney(moneyOf(sale.fees_cents))}</Txt>}><Txt role="body" tone="ink-2">Fees</Txt></Row>
            <Row trail={<Txt role="body" tabular>{showMoney(moneyOf(sale.shipping_cents))}</Txt>}><Txt role="body" tone="ink-2">Shipping</Txt></Row>
            <Row trail={<Txt role="body" tabular>{payout ? showMoney(payout) : 'Pending'}</Txt>}><Txt role="body" tone="ink-2">Payout</Txt></Row>
          </List>
          {sale.external_order_id ? <Stack gap="tight"><Txt role="caption">Order</Txt><Txt role="body">{sale.external_order_id}</Txt></Stack> : null}
        </Stack>
        {!url ? <Txt role="caption">A link for this sale is not available yet. Open the marketplace app to manage it.</Txt> : null}
      </>}
  </Screen>;
}
