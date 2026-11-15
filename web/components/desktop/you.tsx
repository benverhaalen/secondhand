'use client';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { sessionSnapshot, subscribeToSession } from '../../lib/browser-session';
import { api, amount, collection, message, webLink, type Item, type Me, type Money } from '../../lib/desktop-api';
import { useResource, useWorkspace } from './state';
import type { Order } from './sales';
import { ErrorNotice, Icon, Loading, Modal, Site } from './primitives';

type Service = { site: string; available: boolean; reason?: string; account?: { id: string; state: string } };
export function You() {
  const session = useSyncExternalStore(subscribeToSession, sessionSnapshot, () => undefined);
  const resource = useResource('connections', signal => api<{ services: Service[] }>('/v1/connections', undefined, 'GET', signal));
  const [connect, setConnect] = useState<Service>(), [unlink, setUnlink] = useState<Service>(), [error, setError] = useState<string>(), [busy, setBusy] = useState(false);
  async function disconnect() { if (!unlink?.account) return; setBusy(true); try { await api(`/v1/connections/accounts/${unlink.account.id}`, {}, 'DELETE'); setUnlink(undefined); resource.refresh(); } catch(e) { setError(message(e)); } finally { setBusy(false); } }
  return <><div className="desk-page-heading"><h1>Your account</h1></div><div className="desk-profile" data-field="">{webLink(session?.profile.photo) ? <img className="desk-profile-photo" src={session?.profile.photo} alt="" /> : <span className="desk-profile-photo desk-avatar"><Icon name="user" /></span>}<div><h2>{session?.profile.name || 'Your account'}</h2></div></div><AccountSummary /><section className="desk-section"><h2>Your marketplaces</h2><ErrorNotice error={resource.error} retry={resource.refresh} />{resource.loading && <Loading />}<div className="desk-connections">{resource.data?.services.map(service => <div className="desk-connection" key={service.site}><Site site={service.site} /><div><h3>{service.site}</h3><p className="desk-muted">{service.account?.state === 'linked' ? 'Connected' : service.reason ?? (service.account ? 'Sign in again' : 'Not connected')}</p></div>{service.account?.state === 'linked' ? <button className="desk-secondary" onClick={() => { setError(undefined); setUnlink(service); }}>Disconnect</button> : service.available && <button className="desk-secondary" onClick={() => setConnect(service)}>Connect</button>}</div>)}</div></section>{connect && <Connect service={connect} close={() => setConnect(undefined)} />}{unlink && <Modal title={`Disconnect ${unlink.site}?`} close={() => { if (!busy) setUnlink(undefined); }}><p>secondhand will stop using this marketplace account. Your listings stay on the marketplace.</p><ErrorNotice error={error} /><button className="desk-primary" disabled={busy} onClick={disconnect}>{busy ? 'Disconnecting…' : 'Disconnect'}</button></Modal>}</>;
}
function Connect({ service, close }: { service: Service; close: () => void }) {
  const { refresh } = useWorkspace(); const [handle, setHandle] = useState<string>(), [url, setUrl] = useState<string>(), [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  async function start() { setBusy(true); setError(undefined); try { const connection = await api<{ handle: string }>('/v1/connections', { site: service.site }); setHandle(connection.handle); const view = await api<{ url: string }>(`/v1/connections/${connection.handle}/view`, {}); const href = webLink(view.url); if (!href) throw new Error('Could not open marketplace sign-in. Try again.'); setUrl(href); } catch(e) { setError(message(e)); } finally { setBusy(false); } }
  async function complete() { if (!handle) return; setBusy(true); setError(undefined); try { const result = await api<{ state: string; reason?: string }>(`/v1/connections/${handle}/complete`, {}); if (result.state !== 'linked') throw new Error(result.reason ?? 'Finish signing in on the marketplace, then try again.'); refresh(); close(); } catch(e) { setError(message(e)); } finally { setBusy(false); } }
  async function cancel() { if (busy) return; if (handle) { setBusy(true); try { await api(`/v1/connections/${handle}`, {}, 'DELETE'); } catch(e) { setError(message(e)); setBusy(false); return; } } close(); }
  return <Modal title={`connect ${service.site}`} close={() => void cancel()}><Site site={service.site} /><p>Sign in to {service.site} in a separate window, then come back here.</p><ErrorNotice error={error} />{url ? <><a className="desk-secondary" href={url} target="_blank" rel="noopener noreferrer">Open {service.site} sign-in</a><button className="desk-primary" disabled={busy} onClick={complete}>{busy ? 'Checking…' : 'I finished signing in'}</button></> : <button className="desk-primary" disabled={busy} onClick={start}>{busy ? 'Opening…' : 'Continue to sign-in'}</button>}</Modal>;
}
export function Settings({ close }: { close: () => void }) {
  const resource = useResource('me', signal => api<Me>('/v1/me', undefined, 'GET', signal));
  return <Modal title="Settings" close={close}><ErrorNotice error={resource.error} retry={resource.refresh} />{resource.loading && <Loading />}{resource.data && <SettingsForm key={resource.data.version} me={resource.data} close={close} />}</Modal>;
}
function SettingsForm({ me, close }: { me: Me; close: () => void }) {
  const { refresh } = useWorkspace(); const [locale, setLocale] = useState(me.locale), [currency, setCurrency] = useState(me.currency), [timezone, setTimezone] = useState(me.timezone), [error, setError] = useState<string>(), [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { new Intl.DateTimeFormat(locale, { timeZone: timezone }); new Intl.NumberFormat(locale, { style: 'currency', currency }); await api('/v1/me', { version: me.version, locale, currency, timezone }, 'PATCH'); refresh(); close(); } catch(e) { setError(message(e)); } finally { setBusy(false); } }
  async function exportAccount() { setBusy(true); try { const result = await api<{ id: string }>('/v1/me/export', {}); const job = await api<{ state: string; result?: unknown }>(`/v1/jobs/${result.id}`); if (job.state !== 'done') throw new Error('Your export is being prepared. Try again shortly.'); const url = URL.createObjectURL(new Blob([JSON.stringify(job.result, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'secondhand-account.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch(e) { setError(message(e)); } finally { setBusy(false); } }
  return <form className="desk-form" onSubmit={save}><label>Language and region<input className="desk-input" value={locale} onChange={e => setLocale(e.target.value)} required /></label><label>Currency<input className="desk-input" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} required /></label><label>Time zone<input className="desk-input" value={timezone} onChange={e => setTimezone(e.target.value)} required /></label><ErrorNotice error={error} /><button className="desk-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button><button className="desk-secondary" type="button" disabled={busy} onClick={exportAccount}>Download my data</button></form>;
}

function AccountSummary() {
  const resource = useResource('account-summary', async signal => {
    const [items, orders] = await Promise.all([collection<Item>('/v1/items', signal), collection<Order>('/v1/orders?kind=sale', signal)]);
    const paid = new Map<string, Money>();
    for (const order of orders) {
      if (order.state !== 'released' || !order.payout_cents) continue;
      const money = order.payout_cents;
      paid.set(money.currency, { ...money, amount_cents: (paid.get(money.currency)?.amount_cents ?? 0) + money.amount_cents });
    }
    return { items, paid: [...paid.values()] };
  });
  const groups = [{ label: 'Getting ready', group: 'drafts', states: ['capturing', 'researching', 'review', 'failed'] }, { label: 'Live', group: 'active', states: ['live', 'stale'] }, { label: 'Sold', group: 'sold', states: ['sold', 'handed_over', 'done'] }, { label: 'Kept', group: 'kept', states: ['kept'] }];
  return <section className="desk-section"><h2>Your things</h2><ErrorNotice error={resource.error} retry={resource.refresh} />{resource.loading && <Loading />}{resource.data && <><div className="desk-account-summary">{groups.map(group => <Link href={group.group === 'sold' ? '/app/sell/sales' : `/app/sell?group=${group.group}`} key={group.group}><span className="desk-summary-number">{resource.data!.items.filter(item => group.states.includes(item.state)).length}</span><span className="desk-muted">{group.label}</span></Link>)}</div>{resource.data.paid.length > 0 && <div className="desk-payout-summary">{resource.data.paid.map(value => <div key={value.currency}><p className="desk-price">{amount(value)}</p><p className="desk-muted">Paid out after fees</p></div>)}<Link className="desk-secondary" href="/app/sell/sales">See your sales</Link></div>}</>}</section>;
}
