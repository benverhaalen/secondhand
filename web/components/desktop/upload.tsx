'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileInput, FileInputDropzone, FileInputItem, FileInputItemRemove, FileInputList, FileInputTrigger } from '@ui-sdk/react/file-input';
import { api, message } from '../../lib/desktop-api';
import { ErrorNotice, Icon, Modal } from './primitives';
import { useWorkspace } from './state';

type Capture = { id: string; item_id: string; version: number; state: string; process: { key: string }[] };
function FilePreview({ file }: { file: File }) {
  const [src, setSrc] = useState('');
  useEffect(() => { const url = URL.createObjectURL(file); setSrc(url); return () => URL.revokeObjectURL(url); }, [file]);
  return <><img className="desk-upload-photo" src={src || undefined} alt={file.name} /><span>{file.name}</span></>;
}
export function Upload({ close, intent = 'sell' }: { close: () => void; intent?: 'sell' | 'worth' }) {
  const [files, setFiles] = useState<File[]>([]), [title, setTitle] = useState(''), [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState<string>();
  const attempt = useRef<{ capture: Capture; uploaded: Set<number> } | undefined>(undefined);
  const { refresh } = useWorkspace(); const router = useRouter();
  async function upload(e: React.FormEvent) {
    e.preventDefault(); if (!files.length) return; setBusy(true); setError(undefined);
    try {
      setProgress('Preparing upload');
      if (!attempt.current) attempt.current = { capture: await api<Capture>('/v1/captures', { mode: 'shots', purpose: intent === 'worth' ? 'appraise' : 'sell', intent, confirm_mode: 'tap', device: { has_lidar: false, object_capture: false } }), uploaded: new Set() };
      const pending = attempt.current;
      const capture = await api<Capture>(`/v1/captures/${pending.capture.id}`);
      if (capture.state === 'judged') { refresh(); close(); router.push(`/app/sell/${capture.item_id}${intent === 'worth' ? '?purpose=worth' : ''}`); return; }
      const remaining = files.map((file, index) => ({ file, index })).filter(({ index }) => !pending.uploaded.has(index));
      if (remaining.length) {
        const targets = await api<{ photos: { upload: { url: string; method: string } }[]; capture: Capture }>(`/v1/captures/${capture.id}/photos`, { photos: remaining.map(({ file, index }) => ({ role: index === 0 ? 'front' : 'detail', step: pending.capture.process[index]?.key ?? `upload-${index + 1}`, key: index === 0 ? 'front' : `upload-${index + 1}`, content_type: file.type, bytes: file.size })) });
        for (const [targetIndex, { file, index }] of remaining.entries()) {
          setProgress(`Uploading photo ${index + 1} of ${files.length}`);
          const target = new URL(targets.photos[targetIndex].upload.url, window.location.origin);
          const url = target.pathname.startsWith('/v1/uploads/') ? target.pathname + target.search : target.href;
          const response = await fetch(url, { method: targets.photos[targetIndex].upload.method, headers: { 'Content-Type': file.type }, body: file });
          if (!response.ok) throw new Error(`Could not upload ${file.name}. Retry to continue this item.`);
          pending.uploaded.add(index);
        }
      }
      setProgress('Saving your item');
      const current = await api<Capture>(`/v1/captures/${capture.id}`);
      const result = await api<{ item: { id: string } }>(`/v1/captures/${capture.id}/finish`, { version: current.version, ...(title.trim() ? { title: title.trim() } : {}) });
      refresh(); close(); router.push(`/app/sell/${result.item.id}${intent === 'worth' ? '?purpose=worth' : ''}`);
    } catch(e) { setError(message(e)); } finally { setBusy(false); setProgress(''); }
  }
  return <Modal title={intent === 'worth' ? 'Appraise an item' : 'Add an item'} close={() => { if (!busy) close(); }}><form className="desk-form" onSubmit={upload}><FileInput multiple accept="image/jpeg,image/png" value={files} onValueChange={setFiles} disabled={busy || !!attempt.current} onReject={() => setError('Choose JPG or PNG photos.')}><FileInputDropzone className="desk-dropzone"><Icon name="add-01" /><p>Drop photos here</p><FileInputTrigger className="desk-secondary">Choose photos</FileInputTrigger><p className="desk-meta">JPG or PNG</p></FileInputDropzone><FileInputList className="desk-upload-list" aria-label="Your photos"><FileInputItem>{({ file }) => <><FilePreview file={file} /><FileInputItemRemove className="desk-icon-button" aria-label={`Remove ${file.name}`}><Icon name="cancel-01" size={20} /></FileInputItemRemove></>}</FileInputItem></FileInputList></FileInput><label>Item name <span className="desk-muted">(optional)</span><input className="desk-input" value={title} disabled={busy} onChange={e => setTitle(e.target.value)} /></label><ErrorNotice error={error} /><p className="desk-meta" role="status">{progress}</p><button className="desk-primary" disabled={busy || !files.length}>{busy ? 'Uploading…' : attempt.current ? 'Retry upload' : 'Prepare item'}</button></form></Modal>;
}
