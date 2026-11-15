import { Linking } from 'react-native';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { EmptyState, FootButton, List, Nav, Photo, Row, Screen, Section, SiteBadge, Txt, log } from '@/ui';
import { useSales, saleStatus } from './sales';
import { useSellerItem } from './use-item';
import { destinations } from './sites';
import { moneyOf, showMoney } from './item';

export function SellerFulfillment({ id, order, pickup = false }: { id: string; order?: string; pickup?: boolean }) {
  const items = useSellerItem(id), orders = useSales(), [error, setError] = useState<string | null>(null);
  const sale = orders.sales.find(sale => sale.item_id === id && (!order || sale.id === order));
  const item = items.data?.item, loading = items.loading || orders.loading;
  const failure = items.error ?? orders.error;
  const listing = item?.listings.find(listing => listing.id === sale?.listing_id) ?? item?.listings.find(listing => listing.site === sale?.site);
  const orderUrl = sale?.url && /^https?:\/\//.test(sale.url) ? sale.url : null;
  const destination = destinations.find(destination => destination.site === sale?.site);
  const url = orderUrl ?? (listing?.url.startsWith('https://') ? listing.url : destination ? new URL(destination.url).origin : null);
  const open = async () => { if (!url) return; setError(null); try { await Linking.openURL(url); } catch (failure) { log.error('selling.fulfill.open', failure); setError('The site did not open. Retry.'); } };
  const reload = () => { void items.reload(); void orders.reload(); };
  return <Screen name="seller-fulfillment" state={loading ? 'loading' : failure ? 'failed' : sale ? 'typical' : 'empty'}
    nav={<Nav back={() => router.canGoBack() ? router.back() : router.replace('/sell' as Href)} />} onRefresh={reload} refreshing={loading}>
    <Txt role="heading">{pickup ? 'pickup' : 'your sale'}</Txt>
    {loading ? <Txt role="body">Loading sale</Txt> : failure ? <EmptyState title="This sale did not load" line={failure} action={{ id: 'sale-retry', label: 'Retry', onPress: reload }} />
      : !sale ? <EmptyState title="No sale yet" action={{ id: 'sale-back', label: 'Back to Sell', onPress: () => router.replace('/sell' as Href) }} /> : <>
        <Row lead={<Photo src={item?.photos[0]?.key} label={item?.title || 'Sold item'} />}><Txt role="headline">{item?.title || 'Sold item'}</Txt><Txt role="body">{saleStatus(sale)}</Txt>{destination ? <SiteBadge site={destination.site} /> : <Txt role="caption" tone="ink-2">{sale.site}</Txt>}</Row>
        <Section title="Sale details"><List>
          <Row><Txt role="caption">Sale price</Txt><Txt role="body">{showMoney(moneyOf(sale.price_cents))}</Txt></Row>
          <Row><Txt role="caption">Fees</Txt><Txt role="body">{showMoney(moneyOf(sale.fees_cents))}</Txt></Row>
          <Row><Txt role="caption">Shipping</Txt><Txt role="body">{showMoney(moneyOf(sale.shipping_cents))}</Txt></Row>
          <Row><Txt role="caption">You get</Txt><Txt role="body">{moneyOf(sale.payout_cents) ? showMoney(moneyOf(sale.payout_cents)) : 'Net pending'}</Txt></Row>
          {sale.external_order_id ? <Row><Txt role="caption">Order</Txt><Txt role="body">{sale.external_order_id}</Txt></Row> : null}
        </List></Section>
        <Txt role="body">{pickup ? 'Arrange pickup and confirm the handover on the selling site.' : 'Manage delivery, labels and tracking on the selling site.'}</Txt>
        {url ? <FootButton id="sale-open-site" label={orderUrl ? 'Open sale on site' : listing?.url.startsWith('https://') ? 'Open listing on site' : 'Open selling site'} onPress={open} /> : <Txt role="caption" tone="ink-2">A link for this sale is not available yet. Open the marketplace app to manage it.</Txt>}
        {error ? <Txt role="body">{error}</Txt> : null}
        <FootButton id="sale-refresh" kind="second" label="Refresh sale" onPress={reload} />
      </>}
  </Screen>;
}
