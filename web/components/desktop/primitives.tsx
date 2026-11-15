'use client';
import { useEffect, useState } from 'react';
import { requestAsUser } from '../../lib/browser-session';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle } from '@ui-sdk/react/dialog';
import { Icon } from '../icon';
import { webLink } from '../../lib/desktop-api';
export { Icon } from '../icon';
export function Site({ site }: { site: string }) {
  return ['ebay', 'depop', 'facebook', 'mercari', 'poshmark'].includes(site) ? <img className="desk-site" src={`/marketing/platforms/${site}.png`} alt={site} width="36" height="36" /> : <span className="desk-tag">{site.replaceAll('_', ' ')}</span>;
}
export function Picture({ src, title }: { src?: string; title: string }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const [protectedPhoto, setProtectedPhoto] = useState<{ source: string; url: string }>();
  const privatePath = src?.startsWith('/v1/photos/') ? src as `/v1/${string}` : undefined;
  useEffect(() => {
    if (!privatePath) return;
    const controller = new AbortController(); let objectUrl: string | undefined;
    requestAsUser(privatePath, { signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setProtectedPhoto({ source: privatePath, url: objectUrl });
    }).catch(() => undefined);
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [privatePath]);
  const url = privatePath ? protectedPhoto?.source === privatePath ? protectedPhoto.url : undefined : webLink(src);
  return url && url !== failedUrl ? <img className="desk-photo" src={url} alt={title} loading="lazy" onError={() => setFailedUrl(url)} /> : <div className="desk-photo desk-photo-empty" aria-label="No photo"><Icon name="tag-01" /></div>;
}
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) { return <div className="desk-empty"><Icon name="waving-hand-01" /><h2>{title}</h2>{children}</div>; }
export function ErrorNotice({ error, retry }: { error?: string; retry?: () => void }) { return error ? <div className="desk-error" role="alert"><p>{error}</p>{retry && <button className="desk-secondary" onClick={retry}>Try again</button>}</div> : null; }
export function Loading() { return <div className="desk-loading" role="status">Loading<span aria-hidden="true">…</span></div>; }
export function Modal({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  const [opener] = useState(() => typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : undefined);
  const [keyboard] = useState(() => opener?.matches(':focus-visible') ?? false);
  useEffect(() => () => {
    queueMicrotask(() => {
      if (opener?.isConnected && document.activeElement === document.body) opener.focus({ preventScroll: true });
    });
  }, [opener]);
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogBackdrop className="desk-backdrop" /><DialogContent className="desk-dialog" data-keyboard={keyboard ? '' : undefined} finalFocus={opener}><div className="desk-dialog-heading"><DialogTitle>{title}</DialogTitle><DialogClose className="desk-icon-button" aria-label="Close"><Icon name="cancel-01" size={20} /></DialogClose></div>{children}</DialogContent></Dialog>;
}
