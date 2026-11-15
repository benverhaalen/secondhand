import Head from 'expo-router/head';
import { SessionProvider, useSession } from '@/account/session';
import { AccountGate } from '@/account/gate';
import { LiveDataProvider } from '@/data/live';
import { crashBoundary } from '@/log/boundary';
// The root: the brand's faces load before anything draws (so nothing reflows when they arrive), then one stack.
// Main screens are the tabs; everything else pushes over them. Every screen draws its own Nav, so no native header.
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { Platform } from 'react-native';
import { useBrandFonts } from '@/ui/fonts';
import { PhoneInsets } from '@/ui/insets';
import { useColors, useScheme } from '@/ui/theme';

export default function RootLayout() {
  return <SessionProvider>{Platform.OS === 'web' && <Head><title>secondhand</title></Head>}<RootNavigator /></SessionProvider>;
}

function RootNavigator() {
  const session = useSession();
  const ready = useBrandFonts(), c = useColors(), dark = useScheme() === 'dark';
  if (!ready) return null;
  // The navigator's own grounds are the page color, so no screen shows its default gray behind it (B7).
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: c.page, card: c.page, border: c.rule, text: c.ink, primary: c.ink } };
  return crashBoundary(
    <PhoneInsets>
    <ThemeProvider value={theme}>
    <LiveDataProvider enabled={session.status === 'ready'} key={session.user?.id ?? 'guest'}><AccountGate>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="new" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
    </AccountGate></LiveDataProvider>
    </ThemeProvider>
    </PhoneInsets>
  );
}
