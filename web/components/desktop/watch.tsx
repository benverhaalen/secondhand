'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, amount, collection, message, type Offer, type Want } from '../../lib/desktop-api';
import { Empty, ErrorNotice, Loading, Modal, Offers, Site } from './primitives';
import { useResource, useWorkspace } from './state';

type WatchDetails = Want & { fit?: { size?: string; cut?: string; color?: string; min_total_cents?: number; description?: string; dimensions?: string; handover?: string }; alert?: 'under' | 'available' };
const sites = ['ebay', 'mercari', 'depop', 'facebook', 'poshmark'];
const cents = (value: string) => /^\d+(\.\d{1,2})?$/.test(value.trim()) && Number.isSafeInteger(Math.round(Number(value) * 100)) ? Math.round(Number(value) * 100) : null;

export function WatchForm({ initial = '', want, close }: { initial?: string; want?: WatchDetails; close: () => void }) {
  const { refresh } = useWorkspace();
  const [original] = useState(want);
  const changedElsewhere = want?.version !== original?.version;
  const [text, setText] = useState(want?.text ?? initial), [low, setLow] = useState(want?.fit?.min_total_cents == null ? '' : String(want.fit.min_total_cents / 100)), [high, setHigh] = useState(want?.max_total_cents ? String(want.max_total_cents.amount_cents / 100) : '');
  const [selectedSites, setSites] = useState(want?.sites ?? sites), [fit, setFit] = useState(want?.fit ?? {});
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  const update = (key: keyof NonNullable<WatchDetails['fit']>, value: string) => setFit(old => ({ ...old, [key]: value }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (changedElsewhere) { setError('This watch changed on another device. Reload it before saving.'); return; }
    const min = low.trim() ? cents(low) : 0, max = cents(high);
    if (!text.trim() || min === null || max === null || max < min || !selectedSites.length) { setError('Enter a price range and choose at least one marketplace.'); return; }
    setBusy(true); setError(undefined);
    try {
      const savedFit = { ...fit, min_total_cents: min };
      if (savedFit.cut === 'any') delete savedFit.cut;
      const body = { text: text.trim(), fit: savedFit, max_total_cents: { amount_cents: max, currency: want?.max_total_cents?.currency ?? 'USD' }, sites: selectedSites, alert: want?.alert ?? 'under' };
      if (want) await api(`/v1/wants/${encodeURIComponent(want.id)}`, { ...body, version: original!.version }, 'PATCH');
      else await api('/v1/wants', body);
      refresh(); close();
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  return <Modal title={want ? 'Edit watch' : 'Create a watch'} close={() => { if (!busy) close(); }}><form className="desk-form" onSubmit={save}>
    <label>What are you looking for?<input className="desk-input" value={text} onChange={event => setText(event.target.value)} required disabled={busy} /></label>
    <div className="desk-form-three">
      <label>Maximum total ({want?.max_total_cents?.currency ?? 'USD'})<input className="desk-input" type="number" min="0" step="0.01" value={high} onChange={event => setHigh(event.target.value)} required disabled={busy} /></label>
      <label>Size<input className="desk-input" value={fit.size ?? ''} onChange={event => update('size', event.target.value)} disabled={busy} /></label>
      <label>Fit<select className="desk-input" value={fit.cut ?? 'any'} onChange={event => update('cut', event.target.value)} disabled={busy}>{['any', 'mens', 'womens', 'youth'].map(value => <option value={value} key={value}>{value === 'any' ? 'Any fit' : value === 'mens' ? "Men’s" : value === 'womens' ? "Women’s" : 'Youth'}</option>)}</select></label>
    </div>
    <details className="desk-form-details"><summary>Saved preferences</summary><div className="desk-form">
      <p className="desk-meta">These details are saved for reference and don’t filter matches yet.</p>
      <div className="desk-form-pair"><label>Preferred minimum ({want?.max_total_cents?.currency ?? 'USD'})<input className="desk-input" type="number" min="0" step="0.01" placeholder="Optional" value={low} onChange={event => setLow(event.target.value)} disabled={busy} /></label><label>Color<input className="desk-input" placeholder="Any color" value={fit.color ?? ''} onChange={event => update('color', event.target.value)} disabled={busy} /></label></div>
      <div className="desk-form-pair"><label>Dimensions<input className="desk-input" placeholder="Dimensions or space available" value={fit.dimensions ?? ''} onChange={event => update('dimensions', event.target.value)} disabled={busy} /></label><label>How it gets to you<select className="desk-input" value={fit.handover ?? 'either'} onChange={event => update('handover', event.target.value)} disabled={busy}><option value="either">Shipping or pickup</option><option value="delivery">Shipping</option><option value="pickup">Pickup</option></select></label></div>
      <label>Anything else?<textarea className="desk-input" placeholder="Style, condition and other details" value={fit.description ?? ''} onChange={event => update('description', event.target.value)} disabled={busy} /></label>
    </div></details>
    <fieldset className="desk-sites-select" disabled={busy}><legend>Marketplaces</legend>{sites.map(site => <label key={site}><input type="checkbox" aria-label={site} checked={selectedSites.includes(site)} onChange={event => setSites(old => event.target.checked ? [...old, site] : old.filter(value => value !== site))} /><Site site={site} /></label>)}</fieldset>
    <ErrorNotice error={error ?? (changedElsewhere ? 'This watch changed on another device. Reload it before saving.' : undefined)} />{(error || changedElsewhere) && want && <button type="button" className="desk-secondary" onClick={() => { refresh(); close(); }}>Reload watch</button>}<button className="desk-primary" disabled={busy || changedElsewhere || !selectedSites.length}>{busy ? 'Saving…' : want ? 'Save changes' : 'Save watch'}</button>
  </form></Modal>;
}

export function Watch({ want, close }: { want: Want; close: () => void }) {
  const resource = useResource('want:' + want.id, async signal => { const [detail, matches] = await Promise.all([api<WatchDetails>(`/v1/wants/${encodeURIComponent(want.id)}`, undefined, 'GET', signal), collection<Offer>(`/v1/wants/${encodeURIComponent(want.id)}/matches`, signal)]); return { detail, matches }; });
  const [error, setError] = useState<string>(), [busy, setBusy] = useState(false), [editing, setEditing] = useState(false);
  async function change() {
    if (!resource.data) return;
    setBusy(true); setError(undefined);
    try { await api(`/v1/wants/${encodeURIComponent(want.id)}`, { version: resource.data.detail.version, state: resource.data.detail.state === 'active' ? 'paused' : 'active' }, 'PATCH'); resource.refresh(); }
    catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  if (editing && resource.data) return <WatchForm want={resource.data.detail} close={() => setEditing(false)} />;
  return <Modal title="Your watch" close={close}><h3>{resource.data?.detail.text ?? want.text}</h3><ErrorNotice error={error ?? resource.error} retry={resource.refresh} />{resource.loading && <Loading />}{resource.data && <>
    <p className="desk-muted">Up to {amount(resource.data.detail.max_total_cents)} · {resource.data.detail.state}</p>
    <div className="desk-actions"><button className="desk-primary" onClick={() => setEditing(true)}>Edit watch</button><button className="desk-secondary" disabled={busy} onClick={change}>{resource.data.detail.state === 'active' ? 'Pause watch' : 'Resume watch'}</button><Link className="desk-secondary" href="/app/messages" onClick={close}>Open messages</Link></div>
    {resource.data.matches.length ? <Offers offers={resource.data.matches} /> : <Empty title="No matches yet" />}
  </>}</Modal>;
}
