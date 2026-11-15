// First launch, after sign-in (spec/pages.md §6.1; decision: first launch is setup first). The fewest steps to a first listing:
// link where you sell, each site on its own and each skippable; an optional saved pickup spot, the only pickup step, with no
// hours to set and no calendar read (spec/edge-cases.md §16, Ben 05:24); then a photo of the first thing. No carousel of promises.
// Email for sales and alerts are asked later, the first time each one is needed (Behavior: app/behavior/onboarding.json).
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Blank, FootButton, Line, List, Nav, Pill, Screen, Section, Stack, Txt } from '@/ui';
import { LinkRow } from '@/you/link-row';
import { changed, SITE_ORDER, plural, skips, useGo, useLinks, useWorld } from '@/you/state';

const ONLY_NEW = { empty: 'first launch is only ever drawn for a new person', one: 'first launch is only ever drawn for a new person', dense: 'first launch is only ever drawn for a new person' };

export default function Onboarding() {
  const w = useWorld('new'), go = useGo();
  const { links, link } = useLinks(w);
  const [step, setStep] = useState<'sites' | 'pickup' | 'photo'>('sites');
  const [spot, setSpot] = useState(w.limits.saved_spot?.label ?? '');
  const linked = SITE_ORDER.filter(s => links[s].state === 'connected').length;
  const busy = SITE_ORDER.some(s => links[s].state === 'loading');

  const next = () => { changed('onboarding', w.user.id, 'sites_linked', linked ? 'linked' : 'skipped'); setStep('pickup'); };
  const pickupDone = () => {
    if (spot.trim()) changed('limits', 'saved_spot', 'set');
    else changed('onboarding', w.user.id, 'pickups', 'skipped');
    setStep('photo');
  };
  const finish = (to: '/camera' | '/') => {
    changed('onboarding', w.user.id, to === '/camera' ? 'first_photo' : 'finished');
    router.replace(go.href('/') as Href);
    if (to === '/camera') router.push(go.href('/camera'));
  };

  if (step === 'pickup') {
    return (
      <Screen name="onboarding-pickup" state="new" nav={<Nav back={() => setStep('sites')} />}
        skip={skips('new', { ...ONLY_NEW, typical: 'a saved spot fills the field, and the step looks the same', loading: 'the spot is saved on the phone, with nothing to wait for', failed: 'the spot is saved on the phone, so it cannot fail here', offline: 'the spot is saved on the phone and sent when it is back' })}
        foot={<FootButton id="onboarding-pickup-next" label={spot.trim() ? 'Save spot' : 'Skip'} kind={spot.trim() ? 'primary' : 'second'} onPress={pickupDone} />}>
        <Stack gap="tight">
          <Txt role="caption">2 of 3</Txt>
          <Txt role="heading">Pickup spot</Txt>
        </Stack>
        <Stack>
          <Txt role="body" tone="ink-2">Optional. Where you’d meet a buyer. You pick days and times when one asks, never from your calendar.</Txt>
          <Blank id="onboarding-spot" name="A public place" value={spot} onChange={setSpot} />
          <Txt role="caption">A police station’s safe exchange zone is safest, then a busy, lit store entrance.</Txt>
        </Stack>
      </Screen>
    );
  }

  if (step === 'photo') {
    return (
      <Screen name="onboarding-photo" state="new" nav={<Nav back={() => setStep('pickup')} />}
        skip={skips('new', { ...ONLY_NEW, typical: 'the step is the same for everyone', loading: 'the camera opens on its own screen', failed: 'the camera says what failed on its own screen', offline: 'a photo is taken with no network' })}
        foot={<FootButton id="onboarding-camera" label="Take a photo" icon="camera-01" onPress={() => finish('/camera')} />}>
        <Stack gap="tight">
          <Txt role="caption">3 of 3</Txt>
          <Txt role="heading">First photo</Txt>
        </Stack>
        <Stack>
          <Txt role="body" tone="ink-2">Point the camera at something you want gone. One photo is enough to start the listing.</Txt>
          <Line>
            <Pill id="onboarding-later" kind="second" label="Later" onPress={() => finish('/')} />
          </Line>
        </Stack>
      </Screen>
    );
  }

  const state = busy ? 'loading' : SITE_ORDER.some(s => links[s].state === 'error') ? 'failed' : linked ? 'typical' : 'new';
  return (
    <Screen name="onboarding" state={state} nav={<Nav />}
      skip={skips(state, { ...ONLY_NEW, new: 'drawn before any Link', typical: 'drawn after Link on one site', loading: 'drawn while a site signs in', failed: 'drawn after the first Link on Mercari, which times out', offline: 'each row says its own error when a site can’t be reached' })}
      foot={<FootButton id="onboarding-next" label={linked ? 'Continue' : 'Skip for now'} kind={linked ? 'primary' : 'second'} onPress={next} />}>
      <Stack gap="tight">
        <Txt role="caption">1 of 3</Txt>
        <Txt role="heading">Your sites</Txt>
      </Stack>
      <Section>
        <Txt role="body" tone="ink-2">{linked ? `${plural(linked, 'site', 'sites')} linked. Add the rest now or later.` : 'Link the ones you sell on. Each one is optional.'}</Txt>
        <List>
          {SITE_ORDER.map(s => <LinkRow key={s} site={s} link={links[s]} onLink={() => link(s)} />)}
        </List>
        <Txt role="caption">Your password goes to the site, never to secondhand.</Txt>
      </Section>
    </Screen>
  );
}
