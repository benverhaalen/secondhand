// The Post preview sheet (spec/pages.md §6.8): the listing as each site will show it, a blank where a site still needs a
// field, and one Approve that says exactly what it will post ("Post at $235 on 2 sites"). Posting is the first public
// act in the person's name, so it waits for that tap (the hand-off rule); once posted, Undo takes the listings down.
// Each site's preview is the listing its own buyers want, not one copied five times (edge-cases §5, agent proposal): its
// title written for them and one line on who buys there. Each has its own switch (ways-out §6.8: "just eBay for now"); a
// site that fails says what failed and offers Retry, Skip, or Post it myself, and the others stay up.
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Approve, Blank, EmptyState, Icon, Line, List, MOTIONS, Pill, Skeleton, Stack, Txt, log, type PhotoSrc } from '@/ui';
import { ActionRow } from '@/ui/parts/action-row';
import { Chips } from '@/ui/parts/chips';
import { ListingPreview } from '@/ui/parts/listing-preview';
import { RouteSheet } from '@/ui/parts/route-sheet';
import { Switch } from '@/ui/parts/switch';
import { usd, youKeep, type Item, type Site, type World } from '@/demo';
import { AUDIENCE, LISTING_FORMS, listingTitle } from '@/demo/listing-forms';
import { photo as demoPhoto } from '@/demo/photos';
import { useScreen } from '@/demo/screen';
import * as M from '@/item/model';

// How many sites the item posts to decides one, typical or dense, so each route says where the other two are drawn.
// Loading, failed and offline are drawn from ?state= (useScreen); new and empty can't happen, a preview is of an item.
const ELSEWHERE: Record<string, string> = {
  one: 'one site, /item/it_f024/post', typical: 'two sites, /item/it_switch/post', dense: 'three sites, /item/it_jacket/post?flip=facebook',
};
const skip = (drawn: string) => [
  'new: a preview is of an item that exists', 'empty: a preview is of an item that exists',
  ...Object.entries(ELSEWHERE).filter(([s]) => s !== drawn).map(([s, why]) => `${s}: ${why}`),
].join('; ');

export default function ItemPost() {
  const { id, world, price, flip } = useLocalSearchParams<{ id: string; world?: string; price?: string; flip?: string }>();
  const { state } = useScreen();
  const found = state === 'failed' ? null : M.find(String(id), world);
  if (state === 'loading') {
    return (
      <RouteSheet name="item-post" state="loading" skip={skip('loading')} title="Preview" onClosed={() => router.back()}>
        <Stack gap="cards"><Skeleton of="card-item" /><Skeleton of="card-item" /></Stack>
      </RouteSheet>
    );
  }
  if (!found) {
    return (
      <RouteSheet name="item-post" state="failed" skip={skip('failed')} title="Preview" onClosed={() => router.back()}>
        <EmptyState title="Can’t open this item" line="It was deleted, or it didn’t load." />
      </RouteSheet>
    );
  }
  const p = price && /^\d+$/.test(price) ? Number(price) : null;
  return <Post w={found.w} item={found.item} price={p} flipped={(flip ?? '').split(',').filter(Boolean) as Site[]} offline={state === 'offline'} />;
}

type Status = 'ready' | 'working' | 'done' | 'failed';

function Post({ w, item, price, flipped, offline }: { w: World; item: Item; price: number | null; flipped: Site[]; offline: boolean }) {
  // The sites the plan posts to, with this item's price on each (the plan's price when it came from the Plan sheet).
  const planned = M.planSites(w, item, price ?? item.listings[0]?.price_cents ?? M.priceFor(item, 'sell') ?? 0, flipped).filter(s => s.can && (s.on || item.listings.some(l => l.site === s.site)));
  const [on, setOn] = useState<Site[]>(planned.filter(s => s.on).map(s => s.site));
  const [status, setStatus] = useState<Status>('ready');
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<Site[]>([]);
  const [blank, setBlank] = useState('');
  const [when, setWhen] = useState<string | null>('now');
  const [later, setLater] = useState<string | undefined>();
  const missing = M.fields(item).find(f => f.value === null);
  const priceOn = (site: Site) => price ?? item.listings.find(l => l.site === site)?.price_cents ?? M.priceFor(item, 'sell') ?? 0;
  const prices = on.map(priceOn);
  const photos = M.photoCount(item);
  const cover = item.photos[0] ? demoPhoto(item.photos[0].key) as PhotoSrc : null;
  // A site whose listing already failed once in the data fails again here, so the failed state is drawn from data.
  const willFail = (s: Site) => item.listings.some(l => l.site === s && l.state === 'postFailed');

  // Stand-in for the job's stage stream (job.stage): one site posts per beat, so "Posting 1 of 2" is seen.
  useEffect(() => {
    if (status !== 'working') return;
    if (done >= on.length) { const f = on.filter(willFail); setFailed(f); setStatus(f.length === on.length ? 'failed' : 'done'); return; }
    const t = setTimeout(() => setDone(d => d + 1), typeof MOTIONS.sheet.ms === 'number' ? MOTIONS.sheet.ms : 0);
    return () => clearTimeout(t);
  }, [status, done, on.length]);

  const posted = on.length - failed.length;
  const does = M.postWords(prices) + (when !== 'now' && later ? `, ${later}` : '');
  const state = on.length >= 3 ? 'dense' : planned.length <= 1 ? 'one' : 'typical';
  const foot = (
    <Approve id="post" does={does} status={on.length ? status : 'ready'} step={`Posting ${Math.min(done + 1, on.length)} of ${on.length}`}
      done={failed.length ? `Posted on ${posted} ${posted === 1 ? 'site' : 'sites'}. One failed.` : `Posted on ${posted} ${posted === 1 ? 'site' : 'sites'}`}
      failed="Nothing was posted. The site didn’t take it."
      onApprove={() => { if (!on.length) return; setDone(0); setFailed([]); setStatus('working'); }}
      onUndo={() => { setStatus('ready'); setDone(0); setFailed([]); }} />
  );

  return (
    <RouteSheet name="item-post" state={offline ? 'offline' : state} skip={skip(state)} title="Preview" foot={foot} onClosed={() => router.back()}>
      {offline ? <Line><Icon name="refresh" size={12} tone="ink-2" /><Txt role="caption">Offline. It posts when you’re back.</Txt></Line> : null}
      <Stack gap="cards">
        {planned.map(s => {
          const isOn = on.includes(s.site), form = LISTING_FORMS[s.site];
          const shown = Math.min(photos, form.photos_max);
          return (
            <Stack key={s.site} gap="tight">
              <ListingPreview site={s.site} photo={cover} off={!isOn}
                title={listingTitle(s.site, item.title, item.attributes)} audience={AUDIENCE[s.site]} price={priceOn(s.site)} keep={youKeep(s.site, priceOn(s.site))}
                photos={`${shown < photos ? `First ${shown} of ${photos} photos` : `${photos} ${photos === 1 ? 'photo' : 'photos'}`}, ${form.cover === '1:1' ? 'square' : 'cropped taller'}${form.title === 'description_line_1' ? '. The name opens the description' : ''}`}
                needs={missing && isOn ? <Line><Blank id={`needs-${s.site}`} name={missing.name} value={blank} onChange={setBlank} look="body" /></Line> : undefined}
                toggle={<Switch id={`post-${s.site}`} label="Post here" on={isOn} disabled={status === 'working'} onChange={o => setOn(x => (o ? [...x, s.site] : x.filter(y => y !== s.site)))} />} />
              {failed.includes(s.site) ? (
                <Stack gap="tight">
                  <Line><Icon name="alert-02" size={12} tone="brick" /><Txt role="caption">{item.listings.find(l => l.site === s.site)?.error ?? 'The site didn’t take it'}</Txt></Line>
                  <Line>
                    <Pill id={`retry-${s.site}`} label="Retry" icon="refresh" onPress={() => setFailed(f => f.filter(x => x !== s.site))} />
                    <Pill id={`skip-${s.site}`} label="Skip this site" kind="second" onPress={() => { setFailed(f => f.filter(x => x !== s.site)); setOn(x => x.filter(y => y !== s.site)); }} />
                  </Line>
                  <List><ActionRow id={`myself-${s.site}`} label="Post it myself" line="Opens the site to post it there"
                    onPress={() => { const url = item.listings.find(l => l.site === s.site)?.url; if (url) Linking.openURL(url).catch(e => log.error('item-post.myself', e)); }} /></List>
                </Stack>
              ) : null}
            </Stack>
          );
        })}
      </Stack>
      <Stack>
        <Txt role="caption">When</Txt>
        <Chips id="when" name="When" value={when} other={{ label: 'Later', typed: later }}
          options={[{ id: 'now', label: 'Now' }]} onChange={(v, t) => { setWhen(t ? 'later' : v); if (t) setLater(v); }} />
      </Stack>
    </RouteSheet>
  );
}
