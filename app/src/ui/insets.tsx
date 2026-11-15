// The phone's insets on the web render. expo-router's web provider hands every screen zero insets, so the checks never saw
// what an iPhone puts over the top 59 (the clock) and the bottom 34 (the home bar), and a cut-off top reached Ben's phone
// (2026-11-15 09:30). scripts/composition.mjs sets globalThis.__phoneInsets before the app loads; a person's browser never does.
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

export function PhoneInsets({ children }: { children: ReactNode }) {
  const set = Platform.OS === 'web' ? (globalThis as { __phoneInsets?: { top: number; bottom: number } }).__phoneInsets : undefined;
  if (!set) return <>{children}</>;
  return <SafeAreaInsetsContext.Provider value={{ top: set.top, bottom: set.bottom, left: 0, right: 0 }}>{children}</SafeAreaInsetsContext.Provider>;
}
