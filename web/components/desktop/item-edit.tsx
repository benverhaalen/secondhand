'use client';
import { useState } from 'react';
import { api, amount, message, webLink, type Item, type Money } from '../../lib/desktop-api';
import { ErrorNotice, Modal } from './primitives';
import { useWorkspace } from './state';
import { jobFinished, useJob, type WorkspaceJob } from './job';

export type EditableItem = Item & { location?: { label: string }; cost?: Money };
type Valuation = { range?: { q10?: number | null; q90?: number | null; state?: string }; comps?: { comp_id: string; title?: string; citation: string; price_cents: number }[] };
const cents = (value: string) => /^\d+(\.\d{1,2})?$/.test(value.trim()) && Number.isSafeInteger(Math.round(Number(value) * 100)) ? Math.round(Number(value) * 100) : null;

export function EditItem({ item, close, reload }: { item: EditableItem; close: () => void; reload: () => void }) {
  const { refresh } = useWorkspace();
  const [original] = useState(item);
  const changedElsewhere = item.version !== original.version;
  const [title, setTitle] = useState(item.title), [quantity, setQuantity] = useState(String(item.quantity)), [location, setLocation] = useState(item.location?.label ?? ''), [cost, setCost] = useState(item.cost ? String(item.cost.amount_cents / 100) : '');
  const [price, setPrice] = useState(item.price_cents ? String(item.price_cents.amount_cents / 100) : ''), [busy, setBusy] = useState(false), [error, setError] = useState<string>(), [discard, setDiscard] = useState(false);
  const live = item.listings?.some(listing => listing.state === 'live');
  const dirty = title !== item.title || quantity !== String(item.quantity) || location !== (item.location?.label ?? '') || cost !== (item.cost ? String(item.cost.amount_cents / 100) : '') || price !== (item.price_cents ? String(item.price_cents.amount_cents / 100) : '');
  function leave() { if (!busy) { if (dirty) setDiscard(true); else close(); } }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (changedElsewhere) { setError('This item changed on another device. Reload it before saving.'); return; }
    const count = Number(quantity), paid = cost.trim() ? cents(cost) : null, asking = price.trim() ? cents(price) : null;
    if (!title.trim() || !Number.isSafeInteger(count) || count < 1) { setError('Add a title and a whole-number quantity of at least 1.'); return; }
    if (cost.trim() && paid === null || !live && price.trim() && (asking === null || asking <= 0)) { setError('Enter money with no more than two decimal places. Asking prices must be greater than zero.'); return; }
    if (item.location?.label && !location.trim() || item.cost && !cost.trim() || !live && item.price_cents && !price.trim()) { setError('Keep a value for the saved location, cost and asking price.'); return; }
    setBusy(true); setError(undefined);
    try {
      await api(`/v1/items/${encodeURIComponent(item.id)}`, { version: original.version, title: title.trim(), quantity: count, ...(location.trim() ? { location: { label: location.trim() } } : {}), ...(paid !== null ? { cost: { amount_cents: paid, currency: item.cost?.currency ?? 'USD' } } : {}), ...(!live && asking !== null ? { price_cents: { amount_cents: asking, currency: item.price_cents?.currency ?? 'USD' } } : {}) }, 'PATCH');
      refresh(); close();
    } catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  if (discard) return <Modal title="Leave without saving?" close={() => setDiscard(false)}><button className="desk-primary" onClick={() => setDiscard(false)}>Keep editing</button><button className="desk-secondary" onClick={close}>Discard changes</button></Modal>;
  return <Modal title="Edit item" close={leave}><form className="desk-form" onSubmit={save}>
    {live && <p className="desk-muted">These details stay in secondhand. Edit live listings on the selling site.</p>}
    <label>Title<input className="desk-input" required value={title} disabled={busy} onChange={event => setTitle(event.target.value)} /></label>
    <div className="desk-form-pair"><label>Quantity<input className="desk-input" type="number" min="1" step="1" required value={quantity} disabled={busy} onChange={event => setQuantity(event.target.value)} /></label><label>What you paid ({item.cost?.currency ?? 'USD'})<input className="desk-input" type="number" min="0" step="0.01" value={cost} disabled={busy} onChange={event => setCost(event.target.value)} /></label></div>
    <label>Where it is<input className="desk-input" value={location} disabled={busy} onChange={event => setLocation(event.target.value)} /></label>
    {!live && <label>Asking price ({item.price_cents?.currency ?? 'USD'})<input className="desk-input" type="number" min="0.01" step="0.01" value={price} disabled={busy} onChange={event => setPrice(event.target.value)} /></label>}
    <ErrorNotice error={error ?? (changedElsewhere ? 'This item changed on another device. Reload it before saving.' : undefined)} />{(error || changedElsewhere) && <button type="button" className="desk-secondary" onClick={() => { reload(); close(); }}>Reload saved item</button>}<button className="desk-primary" disabled={busy || changedElsewhere}>{busy ? 'Saving…' : 'Save changes'}</button>
  </form></Modal>;
}

export function PriceGuidance({ item }: { item: Item }) {
  const [jobId, setJobId] = useState<string>(), [starting, setStarting] = useState(false), [error, setError] = useState<string>();
  const tracked = useJob<Valuation>(jobId), job = tracked.job;
  const pricing = starting || !!jobId && !jobFinished(job?.state);
  async function appraise() {
    setStarting(true); setError(undefined);
    try { const result = await api<WorkspaceJob>('/v1/valuations', { item_id: item.id, purpose: 'sell' }); setJobId(result.id); }
    catch (failure) { setError(message(failure)); } finally { setStarting(false); }
  }
  const range = job?.result?.range;
  const hasRange = typeof range?.q10 === 'number' && typeof range.q90 === 'number' && range.q10 >= 0 && range.q90 >= range.q10 && range.state !== 'hidden';
  return <section className="desk-section"><h2>Price guidance</h2>
    {job?.state === 'done' && (hasRange ? <><p className="desk-amount">{amount({ amount_cents: range!.q10!, currency: 'USD' })} to {amount({ amount_cents: range!.q90!, currency: 'USD' })}</p><p className="desk-meta">{range?.state === 'checked' ? 'Based on comparable sales.' : 'Rough estimate from comparable items.'}</p>{job.result?.comps?.some(comp => webLink(comp.citation)) && <details className="desk-form-details"><summary>See comparable sales</summary>{job.result.comps.filter(comp => webLink(comp.citation)).map(comp => <a className="desk-list-row" href={webLink(comp.citation)} target="_blank" rel="noopener noreferrer" key={comp.comp_id}><span>{comp.title || 'Comparable item'}</span><span>{amount({ amount_cents: comp.price_cents, currency: 'USD' })}</span></a>)}</details>}</> : <p className="desk-muted">There is not enough evidence to suggest a price.</p>)}
    {job?.state === 'cancelled' && <p className="desk-muted">Price search cancelled.</p>}<ErrorNotice error={error ?? tracked.error ?? (job?.state === 'failed' ? job.error?.message ?? 'Price guidance could not be loaded.' : undefined)} retry={tracked.error ? tracked.retry : undefined} />
    <button className="desk-secondary" disabled={pricing} onClick={appraise}>{pricing ? 'Checking prices…' : 'Check comparable prices'}</button>
  </section>;
}
