// First launch, after sign-in (spec/pages.md §6.1; decision: first launch is setup first). The fewest steps to a first listing:
// link where you sell, each site on its own and each skippable, then a photo of the first thing. No carousel of promises.
// Email for sales, pickups and alerts are asked later, the first time each one is needed, so nothing stands between a new
// person and their first listing (Behavior: app/behavior/onboarding.json, decisions).
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { FootButton, Line, List, Nav, Pill, Screen, Section, Stack, Txt } from '@/ui';
import { LinkRow } from '@/you/link-row';
import { changed, SITE_ORDER, plural, useGo, useLinks, useWorld } from '@/you/state';

export default function Onboarding() {
  const w = useWorld('new'), go = useGo();
  const { links, link } = useLinks(w);
  const [step, setStep] = useState<'sites' | 'photo'>('sites');
  const linked = SITE_ORDER.filter(s => links[s].state === 'connected').length;
  const busy = SITE_ORDER.some(s => links[s].state === 'loading');

  const next = () => { changed('onboarding', w.user.id, 'sites_linked', linked ? 'linked' : 'skipped'); setStep('photo'); };
  const finish = (to: '/camera' | '/') => {
    changed('onboarding', w.user.id, to === '/camera' ? 'first_photo' : 'finished');
    router.replace(go.href('/') as Href);
    if (to === '/camera') router.push(go.href('/camera'));
  };

  if (step === 'photo') {
    return (
      <Screen name="onboarding-photo" state="new" nav={<Nav back={() => setStep('sites')} />}
        foot={<FootButton id="onboarding-camera" label="Take a photo" icon="camera-01" onPress={() => finish('/camera')} />}>
        <Stack gap="tight">
          <Txt role="caption">2 of 2</Txt>
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

  return (
    <Screen name="onboarding" state={busy ? 'loading' : SITE_ORDER.some(s => links[s].state === 'error') ? 'failed' : linked ? 'typical' : 'new'} nav={<Nav />}
      foot={<FootButton id="onboarding-next" label={linked ? 'Continue' : 'Skip for now'} kind={linked ? 'primary' : 'second'} onPress={next} />}>
      <Stack gap="tight">
        <Txt role="caption">1 of 2</Txt>
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
