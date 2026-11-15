'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, amount, collection, photo, webLink, type Item, type Money } from '../../lib/desktop-api';
import { useResource } from './state';
import { Empty, ErrorNotice, Loading, Modal, Picture, Site } from './primitives';

export type Order = { id: string; item_id: string; listing_id?: string; kind: 'sale' | 'purchase'; site: string; state: string; price_cents: Money; fees_cents?: Money; shipping_cents?: Money; payout_cents?: Money; external_order_id?: string; url?: string; created_at?: string };
const groups = [{ id: 'all', name: 'All' }, { id: 'to_ship', name: 'To ship' }, { id: 'shipped', name: 'Shipped' }, { id: 'completed', name: 'Completed' }, { id: 'cancelled', name: 'Cancelled' }, { id: 'other', name: 'Other' }];
function group(order: Order) {
  if (['cancelled', 'refunded'].includes(order.state)) return 'cancelled';
  if (['released', 'handed_over'].includes(order.state)) return 'completed';
  if (['shipped', 'delivered', 'claim_window'].includes(order.state)) return 'shipped';
  return ['paid', 'to_ship'].includes(order.state) ? 'to_ship' : 'other';
}
export function SellNavigation({ sales = false }: { sales?: boolean }) {
  return <nav className="desk-subnav" aria-label="Selling"><Link href="/app/sell" aria-current={!sales ? 'page' : undefined}>Listings</Link><Link href="/app/sell/sales" aria-current={sales ? 'page' : undefined}>Sales</Link></nav>;
}
export function Sales() {
  const resource = useResource('sales', async signal => { const [orders, items] = await Promise.all([collection<Order>('/v1/orders?kind=sale', signal), collection<Item>('/v1/items', signal)]); return { orders, items }; });
  const [filter, setFilter] = useState('all'), [selected, setSelected] = useState<string>();
  const orders = resource.data?.orders.filter(order => filter === 'all' || group(order) === filter);
  return <><div className="desk-page-heading"><h1>Your sales</h1><button className="desk-secondary" onClick={resource.refresh}>Refresh</button></div><SellNavigation sales /><div className="desk-filters" role="group" aria-label="Sale status">{groups.map(value => <button key={value.id} aria-pressed={filter === value.id} onClick={() => setFilter(value.id)}>{value.name}</button>)}</div><ErrorNotice error={resource.error} retry={resource.refresh} />{resource.loading && <Loading />}{orders && (orders.length ? <div className="desk-sales">{orders.map(order => { const item = resource.data!.items.find(item => item.id === order.item_id); return <button key={order.id} className="desk-sale" onClick={() => setSelected(order.id)}><Picture src={item && photo(item)} title={item?.title || 'Sold item'} /><span className="desk-sale-copy"><span>{item?.title || 'Sold item'}</span><span className="desk-meta">{order.state.replaceAll('_', ' ')}</span></span><Site site={order.site} /><span className="desk-sale-money"><span className="desk-amount">{amount(order.payout_cents ?? order.price_cents)}</span><span className="desk-meta">{order.payout_cents ? order.state === 'released' ? 'You got' : 'You get' : 'Sold for'}</span></span></button>; })}</div> : <Empty title="No sales here yet" />)}{selected && resource.data?.orders.find(order => order.id === selected) && <SaleDetail order={resource.data.orders.find(order => order.id === selected)!} close={() => setSelected(undefined)} />}</>;
}
function SaleDetail({ order, close }: { order: Order; close: () => void }) {
  const resource = useResource('order-item:' + order.item_id, signal => api<Item>(`/v1/items/${order.item_id}`, undefined, 'GET', signal));
  const listing = resource.data?.listings?.find(listing => listing.id === order.listing_id) ?? resource.data?.listings?.find(listing => listing.site === order.site);
  const url = webLink(order.url) ?? webLink(listing?.url);
  return <Modal title="Sale details" close={close}><div className="desk-sale-heading"><Site site={order.site} /><span>{order.state.replaceAll('_', ' ')}</span></div>{resource.data && <h3>{resource.data.title}</h3>}<dl className="desk-facts">{[['Sold for', order.price_cents], ['Marketplace fees', order.fees_cents], ['Shipping', order.shipping_cents], [order.state === 'released' ? 'You got' : 'You get', order.payout_cents]].map(([label, value]) => value && <div key={String(label)}><dt>{String(label)}</dt><dd>{amount(value as Money)}</dd></div>)}</dl>{order.external_order_id && <p className="desk-meta">Order {order.external_order_id}</p>}<ErrorNotice error={resource.error} retry={resource.refresh} />{url && <a className="desk-primary" href={url} target="_blank" rel="noopener noreferrer">{webLink(order.url) ? 'Open sale' : 'Open listing'} on {order.site}</a>}<Link className="desk-secondary" href={`/app/sell/${order.item_id}`} onClick={close}>View item</Link></Modal>;
}
