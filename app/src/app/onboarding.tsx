import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { api } from '@/api/client';
import { Services } from '@/account/services';
import { accountError, useSession, type Account } from '@/account/session';
import { SignIn } from '@/you/sign-in';
import { View } from 'react-native';
import { FootButton, Nav, Pill, Press, Screen, Stack, Txt, log } from '@/ui';
import { useColors } from '@/ui/theme';
import { space } from '@/ui/tokens.generated';

// What secondhand is, before the first choice (Nate, 2026-11-15). Skip goes straight to the services.
const SLIDES = [
  { title: 'Welcome to secondhand', body: 'Sell what you own with an assistant that identifies it, prices it from real sales and lists it where it sells.' },
  { title: 'Buy with the whole market in view', body: 'Search every marketplace at once, and ask anything about what you find.' },
  { title: 'One place, with your own assistant', body: 'Connect your services to set up your storefront. Appraise and search work without them; a service you connect also joins your searches.' },
];

export default function Onboarding() {
  const session = useSession();
  const { setup } = useLocalSearchParams<{ setup?: string }>();
  const [step, setStep] = useState<'intro' | 'services' | 'photo'>(setup === '1' ? 'services' : 'intro');
  const [slide, setSlide] = useState(0);
  const colors = useColors();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const finish = async (to: Href) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await session.finishSetup(); router.replace(to); }
    catch (failure) { log.error('onboarding.finish', failure); setError(accountError(failure)); }
    finally { setBusy(false); }
  };
  const signedIn = async () => {
    const user = await api.call<Account>('GET /v1/me');
    await api.call('PATCH /v1/me', { body: { version: user.version, onboarding_step: 'signed_in' } });
    await session.reload();
    if (user.tutorial_seen && setup !== '1') router.replace('/');
  };
  if (session.status === 'guest') return <SignIn asked={null} onDone={signedIn} />;
  if (session.status === 'loading' || session.status === 'failed') return <Screen name="onboarding" state={session.status === 'failed' ? 'failed' : 'loading'} nav={<Nav />}>
    <Txt role="heading">{session.status === 'loading' ? 'Opening your account' : 'Could not open your account'}</Txt>
    {session.error ? <Txt role="body">{session.error}</Txt> : null}
    {session.status === 'failed' ? <FootButton id="account-retry" label="Try again" onPress={session.reload} /> : null}
  </Screen>;
  if (step === 'intro') {
    const last = slide === SLIDES.length - 1, at = SLIDES[slide];
    return <Screen name="onboarding-intro" state="new" nav={<Nav />}
      foot={<FootButton id="intro-next" label={last ? 'Connect services' : 'Next'} onPress={() => last ? setStep('services') : setSlide(slide + 1)} />}>
      <Stack gap="tight"><Txt role="heading">{at.title}</Txt><Txt role="body" tone="ink-2">{at.body}</Txt></Stack>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: space.s2 }}>
        {SLIDES.map((page, index) => <Press key={page.title} id={`intro-dot-${index}`} label={`${index + 1} of ${SLIDES.length}`} onPress={() => setSlide(index)}>
          <View style={{ width: index === slide ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: index === slide ? colors.ink : colors.rule }} />
        </Press>)}
      </View>
      <Pill id="intro-skip" kind="second" label="Skip" onPress={() => setStep('services')} />
    </Screen>;
  }
  if (step === 'photo') return <Screen name="onboarding-photo" state={busy ? 'loading' : error ? 'failed' : 'new'} nav={<Nav back={() => setStep('services')} />}>
    <Stack gap="tight"><Txt role="caption">2 of 2</Txt><Txt role="heading">First photo</Txt>
      <Txt role="body" tone="ink-2">One photo starts the listing.</Txt></Stack>
    <Stack gap="group">
      <FootButton id="onboarding-camera" label="Take a photo" icon="camera-01" state={busy ? 'working' : 'idle'} onPress={() => void finish('/camera?mode=sell')} />
      <Pill id="onboarding-buy" kind="second" label="Start with shopping chat" state={busy ? 'disabled' : 'idle'} onPress={() => void finish('/shop')} />
      <Pill id="onboarding-later" kind="second" label="Not now" state={busy ? 'disabled' : 'idle'} onPress={() => void finish('/')} />
    </Stack>
    {error ? <Txt role="body">{error}</Txt> : null}
  </Screen>;
  return <Screen name="onboarding" state={busy ? 'loading' : error ? 'failed' : 'new'} nav={<Nav back={() => setStep('intro')} />}
    foot={<FootButton id="onboarding-next" label="Continue" onPress={() => setStep('photo')} />}>
    <Stack gap="tight"><Txt role="caption">1 of 2</Txt><Txt role="heading">Connect your services</Txt>
      <Txt role="body" tone="ink-2">Choose the services you use. You can connect the rest later in Settings.</Txt></Stack>
    <Services />
    <Txt role="caption">Finds and account updates appear in Messages.</Txt>
    {error ? <Txt role="body">{error}</Txt> : null}
  </Screen>;
}
