import { crashBoundary } from '@/log/boundary';
// The root: the brand's faces load before anything draws (so nothing reflows when they arrive), then one stack.
// Main screens are the tabs; everything else pushes over them. Every screen draws its own Nav, so no native header.
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useBrandFonts } from '@/ui/fonts';
import { useColors, useScheme } from '@/ui/theme';

export default function RootLayout() {
  const ready = useBrandFonts(), c = useColors(), dark = useScheme() === 'dark';
  if (!ready) return null;
  // The navigator's own grounds are the page color, so no screen shows its default gray behind it (B7).
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: c.page, card: c.page, border: c.rule, text: c.ink, primary: c.ink } };
  return crashBoundary(
    <ThemeProvider value={theme}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="new" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
    </ThemeProvider>
  );
}
