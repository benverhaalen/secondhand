// The Post preview sheet (spec/pages.md §6.8): the listing as each site will show it, a blank where a site still needs a
// field, and one Approve that says exactly what it will post ("Post at $235 on 2 sites"). Posting is the first public
// act in the person's name, so it waits for that tap (the hand-off rule); once posted, Undo takes the listings down.
// Each site's preview is the listing its own buyers want, not one copied five times (edge-cases §5, agent proposal): its
// title written for them and one line on who buys there. Each has its own switch (ways-out §6.8: "just eBay for now"); a
// site that fails says what failed and offers Retry, Skip, or Post it myself, and the others stay up.
//
// When the studio has already run on the photos, the cover sits on top with its two switches, Clean up and Enhance with
// AI, and every site's preview changes with them as they are flipped, so the difference is seen live before anything
// posts (Ben, 08:12: "photos before after done already ... quickly toggle on off the beautification (both the non ai and
// the ai one) and showing that live before going into a posting"). Enhance with AI waits for the LiDAR scan's
// measurement, since a redraw is only held to its real size by it (Ben, 08:09; 09:09: "only allow this from lidar flow
// too"; jobs/studio/check.py).
import { openMarketplace } from '@/navigation/open-marketplace';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Approve, Blank, EmptyState, Guess, Icon, Line, List, MOTIONS, Photo, Pill, Row, Skeleton, Stack, Txt, log, type PhotoSrc } from '@/ui';
import { ActionRow } from '@/ui/parts/action-row';
import { Chips } from '@/ui/parts/chips';
import { ListingPreview } from '@/ui/parts/listing-preview';
import { RouteSheet } from '@/ui/parts/route-sheet';
import { Switch } from '@/ui/parts/switch';
import { usd, youKeep, type Item, type Site, type World } from '@/demo';
import { LISTING_FORMS, listingTitle } from '@/demo/listing-forms';
import { hasStudio, photo as demoPhoto, studio, type Look } from '@/demo/photos';
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
  // ?fail=ebay makes that site fail when it posts; ?case=recall draws an item whose recall check failed.
  const { id, world, price, flip, fail, case: kase } = useLocalSearchParams<{ id: string; world?: string; price?: string; flip?: string; fail?: string; case?: string }>();
  const { state } = useScreen();
  const found = state === 'failed' ? null : M.find(String(id), world);
  if (state === 'loading') {
    return (
      <RouteSheet flow name="item-post" state="loading" skip={skip('loading')} title="review your listings" onClosed={() => router.back()}>
        <Stack gap="cards"><Skeleton of="card-item" /><Skeleton of="card-item" /></Stack>
      </RouteSheet>
    );
  }
  if (!found) {
    return (
      <RouteSheet flow name="item-post" state="failed" skip={skip('failed')} title="review your listings" onClosed={() => router.back()}>
        <EmptyState title="Can’t open this item" line={state === 'failed' ? 'This item didn’t load' : 'This item is no longer available'}
          action={state === 'failed' ? { id: 'post-retry', label: 'Retry', onPress: () => router.replace(`/item/${id}/post` as Href) } : undefined} />
      </RouteSheet>
    );
  }
  // A sold item has nothing to post: the sheet says so and offers no Post.
  const m = M.momentOf(found.w, found.item);
  if (m === 'sold' || m === 'done') {
    return (
      <RouteSheet flow name="item-post" state="empty" skip={skip('empty').replace('empty: a preview is of an item that exists; ', '')} title="review your listings" onClosed={() => router.back()}>
        <EmptyState title="Sold. Nothing to post" />
      </RouteSheet>
    );
  }
  const p = price && /^\d+$/.test(price) ? Number(price) : null;
  return <Post w={found.w} item={found.item} price={p} flipped={(flip ?? '').split(',').filter(Boolean) as Site[]} offline={state === 'offline'}
    fails={(fail ?? '').split(',').filter(Boolean) as Site[]} recalled={kase === 'recall'} />;
}

type Status = 'ready' | 'working' | 'done' | 'failed';

const openSite = (url: string) => {
  openMarketplace(url).catch(e => log.error('item-post.myself', e));
};

function Post({ w, item, price, flipped, offline, fails, recalled }: {
  w: World; item: Item; price: number | null; flipped: Site[]; offline: boolean; fails: Site[]; recalled: boolean;
}) {
  // The sites the plan posts to, with this item's price on each (the plan's price when it came from the Plan sheet).
  const planned = M.planSites(w, item, price ?? item.listings[0]?.price_cents ?? M.priceFor(item, 'sell') ?? 0, flipped).filter(s => s.can && (s.on || item.listings.some(l => l.site === s.site)));
  const [on, setOn] = useState<Site[]>(planned.filter(s => s.on).map(s => s.site));
  const [status, setStatus] = useState<Status>('ready');
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<Site[]>([]);
  const [blank, setBlank] = useState('');
  const [when, setWhen] = useState<string | null>('now');
  const [later, setLater] = useState<string | undefined>();
  // Post tapped while a site still needs a field, or with no signal: the sheet says what it waits for.
  const [need, setNeed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  // Each site's own words and price, once the person edits them for that site only (ways-out §6.8).
  const [photoSettings, setPhotoSettings] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [own, setOwn] = useState<Partial<Record<Site, { title?: string; price?: number }>>>({});
  const missing = M.fields(item).find(f => f.value === null);
  const priceOn = (site: Site) => own[site]?.price ?? price ?? item.listings.find(l => l.site === site)?.price_cents ?? M.priceFor(item, 'sell') ?? 0;
  const prices = on.map(priceOn);
  const photos = M.photoCount(item);
  const key = item.photos[0]?.key;
  const lookable = !!key && hasStudio(key);
  // A redraw is held to the scan, so it needs a LiDAR measurement of the thing (M.scanned).
  const measured = M.scanned(item);
  const [clean, setClean] = useState(lookable);
  const [ai, setAi] = useState(lookable && measured);
  const look: Look = ai && measured ? 'ai' : clean ? 'clean' : 'original';
  const cover = key ? (lookable ? studio(key, look) : demoPhoto(key)) as PhotoSrc : null;
  // A site whose listing already failed once in the data fails again here, so the failed state is drawn from data.
  const willFail = (s: Site) => fails.includes(s) || item.listings.some(l => l.site === s && l.state === 'postFailed');
  const needing = missing && !blank ? on.length : 0;

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
  // A failed recall check blocks the post and says why (pages §6.8): no Post, only the reason.
  if (recalled) {
    return (
      <RouteSheet flow name="item-post" state="failed" skip={skip('failed')} title="review your listings" onClosed={() => router.back()}>
        <EmptyState title="Can’t post a recalled item" line="The maker recalled this model, and the sites take recalled items down." />
      </RouteSheet>
    );
  }
  const foot = (
    <Approve id="post" does={does} status={on.length ? status : 'ready'} step={`Posting ${Math.min(done + 1, on.length)} of ${on.length}`}
      done={failed.length ? `Posted on ${posted} ${posted === 1 ? 'site' : 'sites'}. One failed.` : `Posted on ${posted} ${posted === 1 ? 'site' : 'sites'}`}
      failed="Nothing was posted. The site didn’t take it."
      onApprove={() => {
        if (!on.length) return;
        // No signal: the post waits and nothing claims to be live (ways-out Everywhere, "I'm on bad signal").
        if (offline) { log.event('ui.show', { screen: 'item-post', state: 'waiting-for-signal', item: item.id, what: 'post' }); setWaiting(true); }
        // A site that still needs a field does not post until it is filled (edge-cases §7 step 7).
        if (needing) { log.event('ui.show', { screen: 'item-post', state: 'needs-field', item: item.id, field: missing?.name }); setNeed(true); return; }
        if (offline) return;
        setDone(0); setFailed([]); setStatus('working');
      }}
      onUndo={() => { setStatus('ready'); setDone(0); setFailed([]); }} />
  );

  return (
    <RouteSheet flow name="item-post" state={offline ? 'offline' : state} skip={skip(state)} title="review your listings" foot={foot} onClosed={() => router.back()}>
      {offline ? <Line><Icon name="refresh" size={12} tone="ink-2" /><Txt role="caption">{waiting ? 'Waiting for signal. It posts when you’re back.' : 'Offline. It posts when you’re back.'}</Txt></Line> : null}
      {need && needing && missing ? <Line><Icon name="alert-02" size={12} tone="brick" /><Txt role="caption">{`Fill in ${missing.name} first. ${needing === 1 ? '1 site needs' : `${needing} sites need`} it.`}</Txt></Line> : null}
      <Stack>
        <Row lead={<Photo src={cover} label={item.title} />}>
          <Txt role="headline" lines={2}>{item.title}</Txt>
          <Txt role="caption">{`${photos} ${photos === 1 ? 'photo' : 'photos'} · ${on.length} ${on.length === 1 ? 'marketplace' : 'marketplaces'}`}</Txt>
        </Row>
        {lookable ? <Line><Pill id="photo-settings" label={photoSettings ? 'Hide photo options' : 'Photo options'} kind="second" onPress={() => setPhotoSettings(x => !x)} /></Line> : null}
      </Stack>
      {lookable && photoSettings ? (
        <Stack>
          <Photo src={cover} label={look === 'original' ? 'Your photo' : look === 'clean' ? 'Your photo, cleaned up' : 'Your photo, enhanced with AI'} fit="fill" />
          <List>
            <Row trail={<Switch id="look-clean" label="Clean up" on={clean} disabled={status === 'working'} onChange={setClean} />}>
              <Txt role="body">Clean up</Txt>
              <Txt role="caption">Light only. The color stays true</Txt>
            </Row>
            <Row trail={<Switch id="look-ai" label="Enhance with AI" on={ai && measured} disabled={!measured || status === 'working'} onChange={setAi} />}>
              <Txt role="body" tone={measured ? 'ink' : 'ink-2'}>Enhance with AI</Txt>
              <Txt role="caption">{measured ? 'Redrawn, then checked against your photos and scan' : 'Scan it with LiDAR first'}</Txt>
            </Row>
          </List>
        </Stack>
      ) : null}
      <Txt role="headline">Where it will go</Txt>
      <Stack gap="cards">
        {planned.map(s => {
          const isOn = on.includes(s.site), form = LISTING_FORMS[s.site];
          const shown = Math.min(photos, form.photos_max);
          return (
            <Stack key={s.site} gap="tight">
              <ListingPreview site={s.site} photo={cover} off={!isOn}
                title={own[s.site]?.title ?? listingTitle(s.site, item.title, item.attributes)} price={priceOn(s.site)} keep={youKeep(s.site, priceOn(s.site))}
                photos={`${shown < photos ? `First ${shown} of ${photos} photos` : `${photos} ${photos === 1 ? 'photo' : 'photos'}`}, ${form.cover === '1:1' ? 'square' : 'cropped taller'}${look === 'ai' ? ', AI cover marked' : ''}${form.title === 'description_line_1' ? '. The name opens the description' : ''}`}
                needs={missing && isOn ? <Line><Blank id={`needs-${s.site}`} name={missing.name} value={blank} onChange={setBlank} look="body" /></Line> : undefined}
                toggle={<Switch id={`post-${s.site}`} label="Post here" on={isOn} disabled={status === 'working'} onChange={o => setOn(x => (o ? [...x, s.site] : x.filter(y => y !== s.site)))} />} />
              {isOn && status === 'ready' ? (
                editing === s.site ? (
                  <Stack gap="tight">
                    <Txt role="caption">Only this site changes</Txt>
                    <Line><Guess id="edit-title" name="Title" look="body" value={own[s.site]?.title ?? listingTitle(s.site, item.title, item.attributes)}
                      onChange={v => { log.event('user.input', { screen: 'item-post', control: 'edit-title', site: s.site, value: v }); setOwn(o => ({ ...o, [s.site]: { ...o[s.site], title: v } })); }} /></Line>
                    <Line><Guess id="edit-price" name="Price" look="body" numeric value={usd(priceOn(s.site))}
                      onChange={v => { const c = Math.round(Number(v.replace(/[^0-9.]/g, '')) * 100); log.event('user.input', { screen: 'item-post', control: 'edit-price', site: s.site, value: v }); if (c > 0) setOwn(o => ({ ...o, [s.site]: { ...o[s.site], price: c } })); }} /></Line>
                    <Line><Pill id="edit-done" label="Done" kind="second" onPress={() => setEditing(null)} /></Line>
                  </Stack>
                ) : <Line><Pill id={`edit-${s.site}`} label="Edit" kind="second" icon="edit-02" onPress={() => setEditing(s.site)} /></Line>
              ) : null}
              {failed.includes(s.site) ? (
                <Stack gap="tight">
                  <Line><Icon name="alert-02" size={12} tone="brick" /><Txt role="caption">{item.listings.find(l => l.site === s.site)?.error ?? 'The site didn’t take it'}</Txt></Line>
                  <Line>
                    <Pill id={`retry-${s.site}`} label="Retry" icon="refresh" onPress={() => setFailed(f => f.filter(x => x !== s.site))} />
                    <Pill id={`skip-${s.site}`} label="Skip this site" kind="second" onPress={() => { setFailed(f => f.filter(x => x !== s.site)); setOn(x => x.filter(y => y !== s.site)); }} />
                  </Line>
                  <List><ActionRow id={`myself-${s.site}`} label="Post it myself"
                    onPress={() => { const url = item.listings.find(l => l.site === s.site)?.url; if (url) openSite(url); }} /></List>
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
