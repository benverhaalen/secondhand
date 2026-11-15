// The root: the brand's faces load before anything draws (so nothing reflows when they arrive), then one stack.
// Main screens are the tabs; everything else pushes over them. Every screen draws its own Nav, so no native header.
import { Stack } from 'expo-router';
import { useBrandFonts } from '@/ui/fonts';

export default function RootLayout() {
  const ready = useBrandFonts();
  if (!ready) return null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="new" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
