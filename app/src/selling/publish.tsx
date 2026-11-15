import { PhotoPager } from '@/ui/parts/photo-pager';
import { router, type Href } from 'expo-router';
import { Linking, Platform, Share } from 'react-native';
import { useState } from 'react';
import { EmptyState, FootButton, List, Photo, Press, Row, Section, Sheet, Txt, log } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { RouteSheet } from '@/ui/parts/route-sheet';
import { useSellerItem } from './use-item';
import { destinations } from './sites';
import { showMoney } from './item';

export function SellerPublish({ id }: { id: string }) {
  const state = useSellerItem(id), [error, setError] = useState<string | null>(null), [copied, setCopied] = useState(false), [photos, setPhotos] = useState(false);
  const data = state.data, item = data?.item;
  const details = item ? [item.title, item.description, `Quantity: ${item.quantity}`, ...item.attributes.filter(a => a.value !== null).map(a => `${a.name.replaceAll('_', ' ')}: ${a.value}`), data?.price ? `Asking price: ${showMoney(data?.price ?? null)}` : null].filter(Boolean).join('\n\n') : '';
  const share = async () => {
    setError(null); setCopied(false);
    try {
      if (Platform.OS === 'web') { await navigator.clipboard.writeText(details); setCopied(true); }
      else await Share.share({ message: details });
    } catch (failure) { log.error('selling.share', failure); setError('The details could not be copied or shared. Retry.'); }
  };
  const open = async (url: string) => { setError(null); try { await Linking.openURL(url); } catch (failure) { log.error('selling.open', failure); setError('The site did not open. Retry.'); } };
  return <RouteSheet name="seller-publish" title="Listing preview" state={state.loading ? 'loading' : state.error ? 'failed' : 'typical'} onClosed={() => router.back()}
    foot={item?.title && data?.price ? <FootButton id="seller-copy" label={Platform.OS === 'web' ? copied ? 'Copied' : 'Copy listing details' : 'Share listing details'} onPress={share} /> : undefined}>
    {state.loading || !item ? <EmptyState title={state.error ? 'Could not open your item' : 'Opening your item'} line={state.error ?? undefined}
      action={state.error ? { id: 'seller-post-retry', label: 'Retry', onPress: state.reload } : undefined} /> : <>
      <Row lead={<Press id="seller-preview-photos" label="View item photos" disabled={!item.photos.length} onPress={() => setPhotos(true)}><Photo src={item.photos[0]?.key} label={item.title || 'Your item'} /></Press>}>
        <Txt role="headline">{item.title || 'Untitled item'}</Txt><Txt role="headline">{data?.price ? showMoney(data.price) : 'Choose an asking price'}</Txt>
      </Row>
      {!item.photos.length ? <Txt role="caption" tone="ink-2">Add your photos on the selling site.</Txt> : null}
      <Txt role="caption" tone="ink-2">{`Quantity: ${item.quantity}`}</Txt>
      {item.description ? <Txt role="body">{item.description}</Txt> : null}
      {item.attributes.length ? <List>{item.attributes.filter(a => a.value !== null).map(a => <Row key={a.id}><Txt role="caption">{a.name.replaceAll('_', ' ')}</Txt><Txt role="body">{String(a.value)}</Txt></Row>)}</List> : null}
      <FootButton id="seller-post-details" kind="second" label="Edit item details" onPress={() => router.replace(`/item/${id}/edit` as Href)} />
      <FootButton id="seller-post-edit" kind="second" label="Change price" onPress={() => router.replace(`/item/${id}/plan` as Href)} />
      {item.title && data?.price ? <>
        <Section title="Finish on a site"><Txt role="body">Add your photos, check the details, then publish there.</Txt>
          <List>{destinations.map(destination => <ListRow key={destination.site} id={`seller-open-${destination.site}`} site={destination.site} label="Create listing" detail="Opens the selling site" onPress={() => void open(destination.url)} />)}</List>
        </Section>
      </> : <FootButton id="seller-complete-details" label="Complete item details" onPress={() => router.replace(`/item/${id}/edit` as Href)} />}
      <Txt role="caption" tone="ink-2">Opening a site does not publish this item.</Txt>
      {error ? <Txt role="body">{error}</Txt> : null}
      <FootButton id="seller-post-done" kind="second" label="Back to Sell" onPress={() => router.replace('/sell' as Href)} />
      <Sheet open={photos} title="Item photos" onClose={() => setPhotos(false)}><PhotoPager photos={item.photos.map(photo => photo.key)} label={item.title || 'Your item'} /></Sheet>
    </>}
  </RouteSheet>;
}
