'use client';
import { useId, useRef, useState } from 'react';
import { amount, type Item } from '../../lib/desktop-api';
import { ErrorNotice, Icon, Site } from './primitives';
import styles from './publish.module.css';

export type ReviewItem = Item & { description?: string };

const destinations = [
  { site: 'ebay', name: 'eBay', url: 'https://www.ebay.com/sl/sell' },
  { site: 'depop', name: 'Depop', url: 'https://www.depop.com/products/create/' },
  { site: 'poshmark', name: 'Poshmark', url: 'https://poshmark.com/create-listing' },
  { site: 'mercari', name: 'Mercari', url: 'https://www.mercari.com/sell/' },
  { site: 'facebook', name: 'Facebook Marketplace', url: 'https://www.facebook.com/marketplace/create/item' },
];

export function PublishItem({ item, edit }: { item: ReviewItem; edit: () => void }) {
  const fieldId = useId(), field = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState<string>(), [busy, setBusy] = useState(false), [error, setError] = useState<string>(), [selected, setSelected] = useState(false);
  const ready = !!item.title.trim() && !!item.price_cents;
  const details = [
    item.title, item.description, `Quantity: ${item.quantity}`,
    ...(item.attributes ?? []).filter(attribute => attribute.value != null).map(attribute => `${attribute.name.replaceAll('_', ' ')}: ${typeof attribute.value === 'object' ? JSON.stringify(attribute.value) : String(attribute.value)}`),
    item.price_cents ? `Asking price: ${amount(item.price_cents)}` : undefined,
  ].filter(Boolean).join('\n\n');
  const select = () => { field.current?.focus(); field.current?.select(); setSelected(true); };
  async function copy() {
    setBusy(true); setError(undefined); setSelected(false); setCopied(undefined);
    try { await navigator.clipboard.writeText(details); setCopied(details); }
    catch { setError('Couldn’t access the clipboard.'); select(); }
    finally { setBusy(false); }
  }
  return <section className={styles.handoff} aria-labelledby={`${fieldId}-heading`}>
    <div className={styles.intro}>
      <h2 id={`${fieldId}-heading`}>Finish on a site</h2>
      <p className="desk-muted">Listing forms open in a new tab.</p>
    </div>
    {!ready ? <div className={styles.intro}>
      <p>Add {item.title.trim() ? 'an asking price' : item.price_cents ? 'a title' : 'a title and asking price'} before preparing your listing.</p>
      <button className="desk-primary" onClick={edit}>Complete item details</button>
    </div> : <>
      <div className={styles.step}>
        <label htmlFor={fieldId}>1. Copy your listing details</label>
        <textarea ref={field} id={fieldId} className={`desk-input ${styles.details}`} value={details} readOnly rows={8} aria-describedby={`${fieldId}-help`} />
        <div className="desk-actions">
          <button className="desk-primary" onClick={copy} disabled={busy}>{busy ? 'Copying…' : copied === details ? 'Copied' : 'Copy listing details'}</button>
          <button className="desk-secondary" onClick={() => { setError(undefined); select(); }}>Select details</button>
        </div>
        <p id={`${fieldId}-help`} className="desk-meta" role="status">{selected ? 'Press ⌘C on Mac or Ctrl+C on Windows to copy the selected details.' : copied === details ? 'Paste into the listing form.' : ''}</p>
        <ErrorNotice error={error} />
      </div>
      <div className={styles.step}>
        <h3>2. Add photos and publish on your chosen site</h3>
        <div className={styles.sites}>{destinations.map(destination => <a key={destination.site} href={destination.url} target="_blank" rel="noopener noreferrer" className={styles.destination} aria-label={`Open ${destination.name} listing form in a new tab`}>
          <Site site={destination.site} /><span><span>{destination.name}</span><span className={`desk-meta ${styles.linkLabel}`}>Open listing form <Icon name="link-01" size={16} /></span></span>
        </a>)}</div>

      </div>
    </>}
  </section>;
}
