// The four places, under the one tab bar (app/src/ui/parts/chrome.tsx). New is not a place: its button opens /new.
// Switching tabs has no animation: the content swaps (frontend-standard §3).
import { Tabs } from 'expo-router/js-tabs';
import { RouterTabBar } from '@/ui';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'none' }} tabBar={props => <RouterTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="sell" />
      <Tabs.Screen name="buy" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
