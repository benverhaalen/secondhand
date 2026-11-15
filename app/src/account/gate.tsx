import { useEffect, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useGlobalSearchParams, usePathname, useRootNavigationState } from 'expo-router';
import { FootButton, Nav, Screen, Txt } from '@/ui';
import { useSession } from './session';

export function AccountGate({ children }: { children: ReactNode }) {
  const session = useSession(), pathname = usePathname(), navigation = useRootNavigationState();
  const params = useGlobalSearchParams<{ world?: string; state?: string }>();
  const preview = !!params.world || !!params.state;
  const setup = session.status === 'guest' || (session.status === 'ready' && !session.user?.tutorial_seen);
  useEffect(() => {
    if (navigation?.key && !preview && setup && pathname !== '/onboarding') router.replace('/onboarding');
  }, [navigation?.key, pathname, preview, setup]);
  return <>{children}{!preview && (setup || session.status === 'loading' || session.status === 'failed') && pathname !== '/onboarding' ? <View style={StyleSheet.absoluteFill}>
    <Screen name="account-loading" state={session.status === 'failed' ? 'failed' : 'loading'} nav={<Nav />}>
      <Txt role="heading">{session.status === 'failed' ? 'Could not open your account' : 'Opening secondhand'}</Txt>
      {session.error ? <Txt role="body">{session.error}</Txt> : null}
      {session.status === 'failed' ? <FootButton id="session-retry" label="Try again" onPress={session.reload} /> : null}
    </Screen></View> : null}</>;
}
