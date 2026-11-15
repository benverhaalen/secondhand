import { PhotoPager } from '@/ui/parts/photo-pager';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useLiveData } from '@/data/live';
import { EmptyState, FootButton, List, Nav, Row, Screen, Section, Sheet, Stack, Txt, log } from '@/ui';
import { amountOf, saveItem, sellerError, type SellerItem } from './item';
import { SellerField } from './field';
import { useSellerItem } from './use-item';

export function SellerReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useSellerItem(id);
  if (state.loading || !state.data) return <Screen name="seller-review" state={state.error ? 'failed' : 'loading'} nav={<Nav back={() => router.back()} />}>
    <EmptyState title={state.error ? 'Could not open your item' : 'Opening your item'} line={state.error ?? undefined}
      action={state.error ? { id: 'seller-load-retry', label: 'Retry', onPress: state.reload } : undefined} />
  </Screen>;
  return <ReviewForm key={state.data.version} data={state.data} reload={state.reload} />;
}
function ReviewForm({ data, reload }: { data: SellerItem; reload(): Promise<void> }) {
  const { item } = data, live = item.listings.some(listing => listing.state === 'live');
  const { refresh } = useLiveData();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [title, setTitle] = useState(item.title), [location, setLocation] = useState(item.location.label);
  const [quantity, setQuantity] = useState(String(item.quantity)), [cost, setCost] = useState(data.cost ? String(data.cost.amount_cents / 100) : '');
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [leaving, setLeaving] = useState(false);
  const dirty = title !== item.title || location !== item.location.label || quantity !== String(item.quantity) || cost !== (data.cost ? String(data.cost.amount_cents / 100) : '');
  const back = () => router.canGoBack() ? router.back() : router.replace(`/item/${item.id}` as Href);
  const save = async () => {
    if (busy) return;
    const count = Number(quantity), cents = cost.trim() ? amountOf(cost) : null;
    if (!title.trim()) { setError('Add a title for this item.'); return; }
    if (!/^\d+$/.test(quantity) || !Number.isSafeInteger(count) || count < 1) { setError('Quantity must be a whole number of at least 1.'); return; }
    if (cost.trim() && cents === null) { setError('Enter what you paid with no more than two decimal places.'); return; }
    if (item.location.label && !location.trim()) { setError('Enter a location.'); return; }
    if (data.cost && !cost.trim()) { setError('Enter what you paid, or keep the saved amount.'); return; }
    setBusy(true); setError(null);
    try {
      await saveItem(data, { title: title.trim(), quantity: count, ...(location.trim() ? { location: { label: location.trim() } } : {}), ...(cents !== null ? { cost: { amount_cents: cents, currency: data.cost?.currency ?? 'USD' } } : {}) });
      void refresh(); if (mounted.current) router.replace(`/item/${item.id}${live ? '' : '/plan'}` as Href);
    } catch (failure) { log.error('selling.save', failure, { item: item.id }); if (mounted.current) setError(sellerError(failure)); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <Screen name="seller-review" state="typical" nav={<Nav back={() => !busy && (dirty ? setLeaving(true) : back())} />}
    foot={<Stack gap="tight">{error ? <Stack gap="tight"><Txt role="body">{error}</Txt><FootButton id="seller-reload" kind="second" label="Reload saved item" onPress={reload} /></Stack> : null}<FootButton id="seller-save" label={live ? 'Save changes' : 'Save and choose price'} state={busy ? 'working' : 'idle'} onPress={save} /></Stack>}>
    <Txt role="heading">review your item</Txt>
    {item.photos.length ? <PhotoPager photos={item.photos.map(photo => photo.key)} label={title || 'Your item'} /> : <Txt role="caption" tone="ink-2">Photos are not available yet.</Txt>}
    {live ? <Txt role="caption" tone="ink-2">These details stay in secondhand. Edit live listings on the selling site.</Txt> : null}
    <Stack>
      <SellerField id="seller-title" label="Title" value={title} onChange={setTitle} multiline disabled={busy} />
      <SellerField id="seller-quantity" label="Quantity" value={quantity} onChange={setQuantity} numeric disabled={busy} />
      <SellerField id="seller-location" label="Where it is" value={location} onChange={setLocation} disabled={busy} />
      <SellerField id="seller-cost" label={`What you paid (${data.cost?.currency ?? 'USD'}, optional)`} value={cost} onChange={setCost} numeric disabled={busy} />
    </Stack>
    {item.attributes.length ? <Section title="Item details"><List>{item.attributes.map(attribute => <Row key={attribute.id}><Txt role="caption">{attribute.name.replaceAll('_', ' ')}</Txt><Txt role="body">{String(attribute.value ?? 'Not known')}</Txt></Row>)}</List><Txt role="caption" tone="ink-2">Check these details when you finish on the selling site.</Txt></Section> : null}
    <Sheet open={leaving} title="Leave without saving?" onClose={() => setLeaving(false)}>
      <FootButton id="seller-keep-editing" label="Keep editing" onPress={() => setLeaving(false)} />
      <FootButton id="seller-discard" kind="second" label="Discard changes" onPress={back} />
    </Sheet>
  </Screen>;
}
