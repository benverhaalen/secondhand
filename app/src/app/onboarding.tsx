// First launch, after sign-in (spec/pages.md §6.1; decision: first launch is setup first). The fewest steps to a first listing:
// link where you sell, each site on its own and each skippable; an optional saved pickup spot, the only pickup step, with no
// hours to set and no calendar read (spec/edge-cases.md §16, Ben 05:24); then a photo of the first thing. No carousel of promises.
// Email for sales and alerts are asked later, the first time each one is needed (Behavior: app/behavior/onboarding.json).
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Blank, FootButton, Line, List, Nav, Pill, Screen, Section, Stack, Txt } from '@/ui';
import { LinkRow } from '@/you/link-row';
import { SignIn } from '@/you/sign-in';
import { changed, SITE_ORDER, plural, useGo, useLinks, usePage } from '@/you/state';
import { ListRow } from '@/ui/parts/list-row';

// First launch is only ever seen by a person who has nothing yet, so empty, one and dense cannot happen on it.
const ONLY_NEW = 'empty: first launch is only for a new person, who has nothing yet; one: first launch is only for a new person; dense: first launch is only for a new person';

// The first step is signing in, and it cannot be skipped. A signed-in person (?signed=1, or a state that only a signed-in person
// has) goes straight to the sites. TODO: the 6-second hero loop above the choices is left for later (spec/pages.md §6.1).
const SIGNED_STATES = ['typical', 'one', 'dense', 'empty'];
export default function Onboarding() {
  const { asked } = usePage('new'), { signed } = useLocalSearchParams<{ signed?: string }>();
  const [in_, setIn] = useState(signed === '1' || SIGNED_STATES.includes(asked ?? ''));
  return in_ ? <Sites /> : <SignIn asked={asked} onDone={() => setIn(true)} />;
}

function Sites() {
  const { w, asked } = usePage('new'), go = useGo();
  // ?state= starts a row mid-way: typical has one site linked, loading one signing in, failed Mercari's try timed out.
  const { links, link } = useLinks(w, asked === 'typical' ? { ebay: { state: 'connected', note: null } } : asked === 'loading' ? { ebay: { state: 'loading', note: 'Signing in' } }
    : asked === 'failed' ? { mercari: { state: 'error', note: 'The code from your phone timed out', tried: true } } : {});
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
        skip={`${ONLY_NEW}; typical: a saved spot fills the field and the step looks the same; loading: the spot is saved on the phone, with nothing to wait for; failed: the spot is saved on the phone, so it cannot fail here; offline: the spot is saved on the phone and sent when it is back`}
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
        skip={`${ONLY_NEW}; typical: the step is the same for everyone; loading: the camera opens on its own screen; failed: the camera says what failed on its own screen; offline: a photo is taken with no network`}
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

  const state = asked === 'offline' ? 'offline' : busy ? 'loading' : SITE_ORDER.some(s => links[s].state === 'error') ? 'failed' : linked ? 'typical' : 'new';
  return (
    <Screen name="onboarding" state={state} nav={<Nav />}
      skip={ONLY_NEW}
      foot={<FootButton id="onboarding-next" label={linked ? 'Continue' : 'Skip for now'} kind={linked ? 'primary' : 'second'} onPress={next} />}>
      <Stack gap="tight">
        <Txt role="caption">1 of 3</Txt>
        <Txt role="heading">Your sites</Txt>
      </Stack>
      {state === 'offline' ? <ListRow id="onboarding-offline" lead="refresh" label="Waiting for signal" detail="Linking a site needs it. You can skip and link later" /> : null}
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
