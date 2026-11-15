import { Linking } from 'react-native';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useLiveData } from '@/data/live';
import { EmptyState, FootButton, Photo, Row, Section, Sheet, Stack, Txt, log } from '@/ui';
import { RouteSheet } from '@/ui/parts/route-sheet';
import type { CaptureJob } from '@/capture/results';
import { amountOf, moneyOf, saveItem, sellerError, showMoney, type SellerItem } from './item';
import { useSellerItem } from './use-item';
import { SellerField } from './field';

export function SellerPrice({ id }: { id: string }) {
  const state = useSellerItem(id);
  const [linkError, setLinkError] = useState<string | null>(null);
  if (state.loading || !state.data) return <RouteSheet flow name="seller-price" title="Choose a price" state={state.error ? 'failed' : 'loading'} onClosed={() => router.back()}>
    <EmptyState title={state.error ? 'Could not open your item' : 'Opening your item'} line={state.error ?? undefined} action={state.error ? { id: 'seller-price-retry', label: 'Retry', onPress: state.reload } : undefined} />
  </RouteSheet>;
  if (state.data.item.listings.some(listing => listing.state === 'live')) return <RouteSheet flow name="seller-price" title="Your listing price" state="typical" onClosed={() => router.back()}>
    <Txt role="body">Change live prices on the selling site.</Txt>
    {linkError ? <Txt role="body">{linkError}</Txt> : null}
    {state.data.item.listings.filter(listing => listing.state === 'live' && listing.url.startsWith('https://')).map(listing => <FootButton key={listing.id} id={`seller-live-price-${listing.id}`} kind="second" label={`Open ${listing.site} listing`} onPress={() => { void Linking.openURL(listing.url).catch(failure => { log.error('selling.live_price', failure); setLinkError('The listing did not open. Retry.'); }); }} />)}
  </RouteSheet>;
  return <PriceForm key={state.data.version} data={state.data} reload={state.reload} />;
}
function PriceForm({ data, reload }: { data: SellerItem; reload(): Promise<void> }) {
  const { item } = data, currency = data.price?.currency ?? 'USD';
  const { refresh } = useLiveData();
  const [price, setPrice] = useState(data.price ? String(data.price.amount_cents / 100) : '');
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false), [pricing, setPricing] = useState(false);
  const [error, setError] = useState<string | null>(null), [valuationError, setValuationError] = useState<string | null>(null);
  const [job, setJob] = useState<CaptureJob | null>(null);
  const request = useRef<AbortController | null>(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  const appraise = async () => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setPricing(true); setValuationError(null); setJob(null);
    try {
      const started = await api.call<CaptureJob>('POST /v1/valuations', { body: { item_id: item.id, purpose: 'sell' }, signal: controller.signal });
      const read = async () => {
        const next = await api.call<CaptureJob>(`GET /v1/jobs/${encodeURIComponent(started.id)}`, { signal: controller.signal });
        if (next.item_id && next.item_id !== item.id) throw new Error('The service returned a price for a different item.');
        if (!controller.signal.aborted) setJob(next);
        return next;
      };
      const next = await read();
      if (next.state === 'running' || next.state === 'queued') {
        await api.jobFrames(next.id, { signal: controller.signal, onFrame: () => {} });
        await read();
      }
    } catch (failure) { if (!controller.signal.aborted) { log.error('selling.valuate', failure, { item: item.id }); setValuationError(sellerError(failure)); } }
    finally { if (!controller.signal.aborted) { setPricing(false); request.current = null; } }
  };
  const save = async () => {
    if (saving) return;
    const amount = amountOf(price);
    if (amount === null || amount <= 0) { setError('Enter a price greater than zero with no more than two decimal places.'); return; }
    setSaving(true); setError(null);
    try { await saveItem(data, { price_cents: { amount_cents: amount, currency } }); void refresh(); if (mounted.current) router.replace(`/item/${item.id}/post` as Href); }
    catch (failure) { log.error('selling.price', failure, { item: item.id }); if (mounted.current) setError(sellerError(failure)); }
    finally { if (mounted.current) setSaving(false); }
  };
  const result = job?.result as { range?: { q10?: number | null; q90?: number | null; state?: string } } | undefined;
  const low = moneyOf({ amount_cents: result?.range?.q10, currency: 'USD' }), high = moneyOf({ amount_cents: result?.range?.q90, currency: 'USD' });
  const hasRange = low && high && low.amount_cents >= 0 && high.amount_cents >= low.amount_cents && result?.range?.state !== 'hidden';
  const back = () => router.canGoBack() ? router.back() : router.replace(`/item/${item.id}` as Href);
  const dirty = price !== (data.price ? String(data.price.amount_cents / 100) : '');
  return <RouteSheet flow keyboard name="seller-price" title="Choose a price" state={saving || pricing ? 'loading' : 'typical'} onClosed={back} beforeClose={() => { if (saving) return false; if (dirty) { setLeaving(true); return false; } return true; }}
    foot={<FootButton id="seller-price-save" label="Save and preview" state={saving ? 'working' : 'idle'} onPress={save} />}>
    <Row lead={<Photo src={item.photos[0]?.key} label={item.title || 'Your item'} />}><Txt role="headline">{item.title || 'Your item'}</Txt></Row>
    <Stack gap="tight">
      <SellerField id="seller-price" label={`Asking price (${currency})`} value={price} onChange={setPrice} numeric amount disabled={saving} />
      <Txt role="caption">Fees and shipping are set on the selling site.</Txt>
    </Stack>
    <Section title="Price guidance">
      {job?.state === 'done' ? hasRange ? <Stack gap="tight">
        <Txt role="headline">{`${showMoney(low)} to ${showMoney(high)}`}</Txt>
        <Txt role="caption" tone="ink-2">{result?.range?.state !== 'checked' ? 'Rough estimate from comparable items.' : 'Based on comparable sales.'}</Txt>
      </Stack> : <Txt role="body">There is not enough evidence to suggest a price.</Txt> : null}
      {job?.state === 'failed' ? <Txt role="body">{job.error?.message ?? 'Price guidance could not be loaded.'}</Txt> : null}
      {job?.state === 'cancelled' ? <Txt role="body">Price search cancelled.</Txt> : null}
      {valuationError ? <Txt role="body">{valuationError}</Txt> : null}
      <FootButton id="seller-appraise" kind="second" label={pricing ? 'Checking prices' : 'Check comparable prices'} state={pricing ? 'working' : 'idle'} onPress={appraise} />
    </Section>
    {error ? <Stack gap="tight"><Txt role="body">{error}</Txt><FootButton id="seller-price-reload" kind="second" label="Reload saved item" onPress={reload} /></Stack> : null}
    <Sheet open={leaving} title="Leave without saving?" onClose={() => setLeaving(false)}><FootButton id="seller-price-keep" label="Keep editing" onPress={() => setLeaving(false)} /><FootButton id="seller-price-discard" kind="second" label="Discard changes" onPress={back} /></Sheet>
  </RouteSheet>;
}
