import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { api } from '@/api/client';
import { Services } from '@/account/services';
import { accountError, useSession, type Account } from '@/account/session';
import { SignIn } from '@/you/sign-in';
import { FootButton, Nav, Screen, Stack, Txt, log } from '@/ui';

export default function Onboarding() {
  const session = useSession();
  const { setup } = useLocalSearchParams<{ setup?: string }>();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const finish = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await session.finishSetup(); router.replace('/'); }
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
  return <Screen name="onboarding" state={busy ? 'loading' : error ? 'failed' : 'new'} nav={<Nav />}
    foot={<FootButton id="onboarding-next" label="Continue to secondhand" state={busy ? 'working' : 'idle'} step="Saving" onPress={finish} />}>
    <Stack gap="tight"><Txt role="caption">Your account is ready</Txt><Txt role="heading">Connect your services</Txt>
      <Txt role="body" tone="ink-2">Choose the services you use. You can connect the rest later in Settings.</Txt></Stack>
    <Services />
    <Txt role="caption">Finds and account updates appear in Messages.</Txt>
    {error ? <Txt role="body">{error}</Txt> : null}
  </Screen>;
}
