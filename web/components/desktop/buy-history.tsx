'use client';
import { useState } from 'react';
import { api, amount, collection, message, type Offer, type Want } from '../../lib/desktop-api';
import { Empty, ErrorNotice, Loading, Modal, Offers, Picture } from './primitives';
import { useResource } from './state';
import { Upload } from './upload';

type Lookup = { capture_id: string; kind: 'worth' | 'find'; short_name: string; at: string; photo_url?: string; appraisal?: { low_cents: number; high_cents: number; why: string } };
type Match = Offer & { label?: string; size?: string; seen_at?: string };
type TrackedWant = Want & { fit?: { size?: string } };
export function Appraisals() {
  const resource = useResource('appraisals', signal => collection<Lookup>('/v1/lookups', signal));
  const [upload, setUpload] = useState(false), [hide, setHide] = useState<Lookup>(), [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  async function remove() {
    if (!hide) return; setBusy(true); setError(undefined);
    try { await api(`/v1/lookups/${encodeURIComponent(hide.capture_id)}`, {}, 'DELETE'); setHide(undefined); resource.refresh(); }
    catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  const rows = resource.data?.filter(row => row.kind === 'worth');
  return <section className="desk-section"><div className="desk-section-heading"><h2>Appraised items</h2><button className="desk-secondary" onClick={() => setUpload(true)}>Appraise an item</button></div><ErrorNotice error={resource.error} retry={resource.refresh} />{resource.loading && <Loading />}{rows && (rows.length ? <div className="desk-item-grid">{rows.map(row => <article className="desk-item" key={row.capture_id}><Picture src={row.photo_url} title={row.short_name} /><div className="desk-item-copy"><h3>{row.short_name}</h3>{row.appraisal ? <><p className="desk-amount">{amount({ amount_cents: row.appraisal.low_cents, currency: 'USD' })} to {amount({ amount_cents: row.appraisal.high_cents, currency: 'USD' })}</p><p className="desk-muted">{row.appraisal.why}</p></> : <p className="desk-muted">The original appraisal was not saved.</p>}<time className="desk-meta" dateTime={row.at}>{new Date(row.at).toLocaleDateString()}</time><button className="desk-secondary" onClick={() => setHide(row)}>Remove from history</button></div></article>)}</div> : <Empty title="No appraisals yet" />)}{upload && <Upload intent="worth" close={() => setUpload(false)} />}{hide && <Modal title="Remove from history?" close={() => { if (!busy) setHide(undefined); }}><p>{hide.short_name} will no longer appear in your appraisal history.</p><ErrorNotice error={error} /><button className="desk-secondary" disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Remove appraisal'}</button></Modal>}</section>;
}
export function Found() {
  const resource = useResource('found-matches', async signal => {
    const wants = await collection<Want>('/v1/wants', signal);
    return Promise.all(wants.filter(want => want.state !== 'ended').map(async want => {
      const [detail, matches] = await Promise.all([api<TrackedWant>(`/v1/wants/${encodeURIComponent(want.id)}`, undefined, 'GET', signal), collection<Match>(`/v1/wants/${encodeURIComponent(want.id)}/matches`, signal)]);
      return { want: detail, matches: matches.filter(match => !['gone', 'dismissed', 'bought'].includes(match.state ?? '')).map(match => ({ ...match, title: match.title || detail.text })).sort((a, b) => (b.seen_at ?? '').localeCompare(a.seen_at ?? '')) };
    }));
  });
  return <section className="desk-section"><h2>Found for you</h2><ErrorNotice error={resource.error} retry={resource.refresh} />{resource.loading && <Loading />}{resource.data && (resource.data.some(group => group.matches.length) ? resource.data.filter(group => group.matches.length).map(group => <section className="desk-section" key={group.want.id}><h2>{group.want.text}{group.want.max_total_cents ? ` · Up to ${amount(group.want.max_total_cents)}` : ''}</h2><Offers offers={group.matches} /></section>) : <Empty title="No matches yet"><p>Matches for your watches will appear here and in Messages.</p></Empty>)}</section>;
}
