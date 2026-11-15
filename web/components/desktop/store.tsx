'use client';
// Your storefront and your insights, drawn from the same /v1 items and orders as the rest of the workspace.
// Both reload through useResource, so they change as the server's stream reports a change (see state.tsx).
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { amount, collection, photo, webLink, type Item, type Money } from '../../lib/desktop-api';
import { useResource } from './state';
import { Empty, ErrorNotice, Loading, Picture, Site } from './primitives';
import { PriceGuidance } from './item-edit';
import type { Order } from './sales';

const FOR_SALE = ['live', 'stale'], SOLD = ['sold', 'handed_over', 'done'], GETTING_READY = ['capturing', 'researching', 'review', 'failed'];
const label = (state: string) => state.replaceAll('_', ' ');

function useShop() {
  return useResource('shop', async signal => {
    const [items, orders] = await Promise.all([collection<Item>('/v1/items', signal), collection<Order>('/v1/orders?kind=sale', signal)]);
    return { items, orders };
  });
}
// Sums the rows that share the first row's currency; a mixed-currency total would be wrong, so the rest are left out.
function total(rows: (Money | undefined)[]): Money | undefined {
  const first = rows.find((row): row is Money => !!row);
  return first && { currency: first.currency, amount_cents: rows.reduce((sum, row) => sum + (row?.currency === first.currency ? row.amount_cents : 0), 0) };
}
function Updated({ at }: { at?: Date }) {
  return at ? <p className="desk-meta desk-updated" aria-live="off">Updated {at.toLocaleTimeString()}. This page reloads when your items or sales change.</p> : null;
}
function useUpdated(data: unknown) {
  const [at, setAt] = useState<Date>();
  useEffect(() => { if (data) setAt(new Date()); }, [data]);
  return at;
}

export function Storefront() {
  const resource = useShop(), updated = useUpdated(resource.data);
  const data = resource.data;
  const selling = data?.items.filter(item => FOR_SALE.includes(item.state)) ?? [], sold = data?.items.filter(item => SOLD.includes(item.state)) ?? [];
  const kept = total((data?.orders ?? []).filter(order => order.state === 'released').map(order => order.payout_cents));
  return <>
    <div className="desk-page-heading"><h1>Your store</h1><Link className="desk-secondary" href="/app/sell">Manage items</Link></div>
    <ErrorNotice error={resource.error} retry={resource.refresh} />{resource.loading && <Loading />}
    {data && <>
      <div className="desk-account-summary" role="list" aria-label="Store totals">
        <div role="listitem"><span className="desk-summary-number">{selling.length}</span><span className="desk-muted">For sale</span></div>
        <div role="listitem"><span className="desk-summary-number">{sold.length}</span><span className="desk-muted">Sold</span></div>
        <div role="listitem"><span className="desk-summary-number">{data.items.filter(item => GETTING_READY.includes(item.state)).length}</span><span className="desk-muted">Getting ready</span></div>
        <div role="listitem"><span className="desk-summary-number">{amount(kept) ?? '$0'}</span><span className="desk-muted">Paid out after fees</span></div>
      </div>
      <section className="desk-section"><h2>For sale</h2>
        {selling.length ? <div className="desk-item-grid">{selling.map(item => <article className="desk-item desk-store-item" key={item.id}>
          <Link className="desk-item-image" href={`/app/sell/${item.id}`}><Picture src={photo(item)} title={item.title || 'Untitled item'} />{item.state === 'stale' && <span className="desk-tag">Not selling yet</span>}</Link>
          <Link className="desk-store-title" href={`/app/sell/${item.id}`}>{item.title || 'Untitled item'}</Link>
          {item.price_cents && <p className="desk-price">{amount(item.price_cents)}</p>}
          <ul className="desk-listing-sites" aria-label="Where it is listed">{(item.listings ?? []).map(listing => { const href = webLink(listing.url); const body = <><Site site={listing.site} /><span>{label(listing.state)}</span></>; return <li key={listing.id}>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{body}</a> : <span>{body}</span>}</li>; })}</ul>
          {!item.listings?.length && <p className="desk-meta">Not on a marketplace yet. Open it to copy the listing.</p>}
        </article>)}</div> : <Empty title="Nothing for sale yet"><p>Add an item and it shows up here once it is listed.</p><Link className="desk-primary" href="/app/sell">Go to your items</Link></Empty>}
      </section>
      {sold.length > 0 && <section className="desk-section"><h2>Sold</h2><div className="desk-item-grid">{sold.slice(0, 12).map(item => <Link className="desk-item" href={`/app/sell/${item.id}`} key={item.id}><span className="desk-item-image"><Picture src={photo(item)} title={item.title || 'Untitled item'} /><span className="desk-tag">{label(item.state)}</span></span><span className="desk-store-title">{item.title || 'Untitled item'}</span></Link>)}</div></section>}
      <Updated at={updated} />
    </>}
  </>;
}

export function Insights() {
  const resource = useShop(), updated = useUpdated(resource.data);
  const [chosen, setChosen] = useState<string>();
  const data = resource.data;
  const sites = [...new Set(data?.orders.map(order => order.site))].map(site => {
    const orders = data!.orders.filter(order => order.site === site && !['cancelled', 'refunded'].includes(order.state));
    return { site, count: orders.length, sold: total(orders.map(order => order.price_cents)), fees: total(orders.map(order => order.fees_cents)), kept: total(orders.filter(order => order.state === 'released').map(order => order.payout_cents)) };
  }).filter(row => row.count).sort((a, b) => (b.sold?.amount_cents ?? 0) - (a.sold?.amount_cents ?? 0));
  const most = Math.max(1, ...sites.map(row => row.sold?.amount_cents ?? 0));
  const stages = data ? [['Getting ready', data.items.filter(item => GETTING_READY.includes(item.state)).length], ['For sale', data.items.filter(item => item.state === 'live').length], ['Not selling yet', data.items.filter(item => item.state === 'stale').length], ['Sold', data.items.filter(item => SOLD.includes(item.state)).length]] as const : [];
  const biggest = Math.max(1, ...stages.map(([, count]) => count));
  const researchable = data?.items.filter(item => item.state !== 'capturing') ?? [];
  const item = researchable.find(row => row.id === chosen) ?? researchable[0];
  return <>
    <div className="desk-page-heading"><h1>Insights</h1><button className="desk-secondary" onClick={resource.refresh}>Refresh</button></div>
    <ErrorNotice error={resource.error} retry={resource.refresh} />{resource.loading && <Loading />}
    {data && <>
      <section className="desk-section"><h2>Where your sales come from</h2>
        {sites.length ? <div className="desk-bars" role="table" aria-label="Sales by marketplace">
          <div className="desk-bar-head" role="row"><span role="columnheader">Marketplace</span><span role="columnheader">Sales</span><span role="columnheader">Sold for</span><span role="columnheader">Fees</span><span role="columnheader">Paid out</span></div>
          {sites.map(row => <div className="desk-bar-row" role="row" key={row.site}>
            <span role="cell" className="desk-bar-site"><Site site={row.site} /></span><span role="cell">{row.count}</span>
            <span role="cell" className="desk-bar-cell"><span className="desk-bar" style={{ width: `${(row.sold?.amount_cents ?? 0) / most * 100}%` }} />{amount(row.sold)}</span>
            <span role="cell">{amount(row.fees) ?? '—'}</span><span role="cell">{amount(row.kept) ?? 'Not paid yet'}</span>
          </div>)}
        </div> : <p className="desk-muted">No sales yet. Totals appear here after your first one.</p>}
      </section>
      <section className="desk-section"><h2>From photo to sold</h2>
        <div className="desk-bars" role="list" aria-label="Items by stage">{stages.map(([name, count]) => <div className="desk-bar-row desk-stage-row" role="listitem" key={name}><span>{name}</span><span className="desk-bar-cell"><span className="desk-bar" style={{ width: `${count / biggest * 100}%` }} />{count}</span></div>)}</div>
        <p className="desk-meta">Items that have not sold within the usual time for their kind are counted as not selling yet.</p>
      </section>
      <section className="desk-section"><h2>Market research</h2>
        {item ? <>
          <label className="desk-field-label" htmlFor="research-item">Check what it is worth</label>
          <select id="research-item" className="desk-input desk-research-select" value={item.id} onChange={event => setChosen(event.target.value)}>{researchable.map(row => <option value={row.id} key={row.id}>{row.title || 'Untitled item'}</option>)}</select>
          <PriceGuidance key={item.id} item={item} />
        </> : <p className="desk-muted">Add an item to see what similar ones sold for.</p>}
        <div className="desk-actions"><Link className="desk-secondary" href="/app/buy/shop">Search every marketplace</Link><Link className="desk-secondary" href="/app/buy?view=appraised">Items you looked up</Link></div>
      </section>
      <Updated at={updated} />
    </>}
  </>;
}
