'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileInput, FileInputDropzone, FileInputItem, FileInputItemRemove, FileInputList, FileInputTrigger } from '@ui-sdk/react/file-input';
import { api, message } from '../../lib/desktop-api';
import { ErrorNotice, Icon, Modal } from './primitives';
import { useWorkspace } from './state';

type Capture = { id: string; item_id: string; version: number; process: { key: string }[] };
function FilePreview({ file }: { file: File }) {
  const [src, setSrc] = useState('');
  useEffect(() => { const url = URL.createObjectURL(file); setSrc(url); return () => URL.revokeObjectURL(url); }, [file]);
  return <><img className="desk-upload-photo" src={src || undefined} alt={file.name} /><span>{file.name}</span></>;
}
export function Upload({ close }: { close: () => void }) {
  const [files, setFiles] = useState<File[]>([]), [title, setTitle] = useState(''), [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState<string>();
  const { refresh } = useWorkspace(); const router = useRouter();
  async function upload(e: React.FormEvent) {
    e.preventDefault(); if (!files.length) return; setBusy(true); setError(undefined);
    try {
      setProgress('Preparing upload');
      let capture = await api<Capture>('/v1/captures', { mode: 'shots', purpose: 'sell', intent: 'sell', confirm_mode: 'tap', device: { has_lidar: false, object_capture: false } });
      const targets = await api<{ photos: { upload: { url: string; method: string } }[]; capture: Capture }>(`/v1/captures/${capture.id}/photos`, { photos: files.map((file, i) => ({ role: i === 0 ? 'front' : 'detail', step: capture.process[i]?.key ?? `upload-${i + 1}`, key: i === 0 ? 'front' : `upload-${i + 1}`, content_type: file.type, bytes: file.size })) });
      capture = targets.capture;
      for (const [index, file] of files.entries()) {
        setProgress(`Uploading photo ${index + 1} of ${files.length}`);
        const target = new URL(targets.photos[index].upload.url, window.location.origin);
        const url = target.pathname.startsWith('/v1/uploads/') ? target.pathname + target.search : target.href;
        const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!response.ok) throw new Error(`Could not upload ${file.name}. Try again.`);
      }
      setProgress('Saving your item');
      const current = await api<Capture>(`/v1/captures/${capture.id}`);
      const result = await api<{ item: { id: string } }>(`/v1/captures/${capture.id}/finish`, { version: current.version, ...(title.trim() ? { title: title.trim() } : {}) });
      refresh(); close(); router.push(`/app/sell/${result.item.id}`);
    } catch(e) { setError(message(e)); } finally { setBusy(false); setProgress(''); }
  }
  return <Modal title="Add an item" close={() => { if (!busy) close(); }}><form className="desk-form" onSubmit={upload}><p className="desk-muted">After upload, you can review the item details.</p><FileInput multiple accept="image/jpeg,image/png" value={files} onValueChange={setFiles} disabled={busy} onReject={() => setError('Choose JPG or PNG photos.')}><FileInputDropzone className="desk-dropzone"><Icon name="add-01" /><p>Drop photos here</p><FileInputTrigger className="desk-secondary">Choose photos</FileInputTrigger><p className="desk-meta">JPG or PNG</p></FileInputDropzone><FileInputList className="desk-upload-list" aria-label="Your photos"><FileInputItem>{({ file }) => <><FilePreview file={file} /><FileInputItemRemove className="desk-icon-button" aria-label={`Remove ${file.name}`}><Icon name="cancel-01" size={20} /></FileInputItemRemove></>}</FileInputItem></FileInputList></FileInput><label>Item name <span className="desk-muted">(optional)</span><input className="desk-input" value={title} disabled={busy} onChange={e => setTitle(e.target.value)} placeholder="What are you selling?" /></label><ErrorNotice error={error} /><p className="desk-meta" role="status">{progress}</p><button className="desk-primary" disabled={busy || !files.length}>{busy ? 'Uploading…' : 'Prepare item'}</button></form></Modal>;
}
