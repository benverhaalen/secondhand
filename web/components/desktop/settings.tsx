'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, message, type Me } from '../../lib/desktop-api';
import { ErrorNotice, Loading, Modal } from './primitives';
import { useResource, useWorkspace } from './state';
import { jobFinished, useJob, type WorkspaceJob } from './job';

export function Settings({ close }: { close: () => void }) {
  const resource = useResource('me', signal => api<Me>('/v1/me', undefined, 'GET', signal));
  const [exporting, setExporting] = useState(false);
  if (exporting) return <AccountExport close={() => setExporting(false)} />;
  return <Modal title="Settings" close={close}><ErrorNotice error={resource.error} retry={resource.refresh} />{resource.loading && <Loading />}{resource.data && <SettingsForm me={resource.data} close={close} exportData={() => setExporting(true)} reload={resource.refresh} />}</Modal>;
}
function SettingsForm({ me, close, exportData, reload }: { me: Me; close: () => void; exportData: () => void; reload: () => void }) {
  const { refresh } = useWorkspace();
  const [original, setOriginal] = useState(me), [locale, setLocale] = useState(me.locale), [currency, setCurrency] = useState(me.currency), [timezone, setTimezone] = useState(me.timezone), [error, setError] = useState<string>(), [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(undefined);
    try { new Intl.DateTimeFormat(locale, { timeZone: timezone }); new Intl.NumberFormat(locale, { style: 'currency', currency }); await api('/v1/me', { version: original.version, locale: locale.trim(), currency: currency.trim(), timezone: timezone.trim() }, 'PATCH'); refresh(); close(); }
    catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  function reset() { setOriginal(me); setLocale(me.locale); setCurrency(me.currency); setTimezone(me.timezone); setError(undefined); reload(); }
  return <><nav className="desk-settings-links" aria-label="Account settings"><Link className="desk-list-row" href="/app/you" onClick={close}><span>Connected services</span><span aria-hidden="true">→</span></Link><Link className="desk-list-row" href="/app/messages" onClick={close}><span>Messages and updates</span><span aria-hidden="true">→</span></Link></nav><form className="desk-form" onSubmit={save}>
    <label>Language and region<input className="desk-input" value={locale} onChange={event => setLocale(event.target.value)} required disabled={busy} /></label>
    <div className="desk-form-pair"><label>Currency<input className="desk-input" value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} required disabled={busy} /></label><label>Time zone<input className="desk-input" value={timezone} onChange={event => setTimezone(event.target.value)} required disabled={busy} /></label></div>
    {me.version !== original.version && <p className="desk-muted">Settings changed on another device. Reload them before saving.</p>}<ErrorNotice error={error} />{(error || me.version !== original.version) && <button className="desk-secondary" type="button" onClick={reset}>Reload saved settings</button>}
    <button className="desk-primary" disabled={busy || me.version !== original.version}>{busy ? 'Saving…' : 'Save settings'}</button><button className="desk-secondary" type="button" disabled={busy} onClick={exportData}>Download my data</button>
  </form><section><h3>Delete account</h3><p className="desk-meta">Account deletion is unavailable until the service can remove all account data.</p></section></>;
}
function AccountExport({ close }: { close: () => void }) {
  const [id, setId] = useState<string>(), [starting, setStarting] = useState(false), [error, setError] = useState<string>();
  const tracked = useJob(id), job = tracked.job;
  async function start() {
    setStarting(true); setError(undefined);
    try { const result = await api<WorkspaceJob>('/v1/me/export', {}); setId(result.id); }
    catch (failure) { setError(message(failure)); } finally { setStarting(false); }
  }
  function download() {
    if (job?.state !== 'done' || job.result === undefined) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(job.result, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'secondhand-account.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <Modal title="Your data" close={close}><ErrorNotice error={error ?? tracked.error ?? (job?.state === 'failed' ? job.error?.message ?? 'Could not prepare your export.' : undefined)} retry={tracked.error ? tracked.retry : undefined} />
    {!id ? <button className="desk-primary" disabled={starting} onClick={start}>{starting ? 'Preparing…' : 'Prepare download'}</button> : job?.state === 'done' && job.result !== undefined ? <button className="desk-primary" onClick={download}>Download data</button> : job?.reason ? <p className="desk-muted">The export service is not ready yet.</p> : jobFinished(job?.state) ? <button className="desk-secondary" onClick={start}>Prepare new export</button> : <p role="status" className="desk-muted">Preparing your export…</p>}
  </Modal>;
}
