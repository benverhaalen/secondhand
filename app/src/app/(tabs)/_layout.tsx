// The four places, under the one tab bar (app/src/ui/parts/chrome.tsx). New is not a place: its button opens /new.
import { Tabs } from 'expo-router/js-tabs';
import { useReducedMotion } from 'react-native-reanimated';
import { motion } from '@/ui/tokens.generated';
import { InTabs, RouterTabBar } from '@/ui';

export default function TabsLayout() {
  const reduced = useReducedMotion();
  return (
    <InTabs.Provider value>
      <Tabs screenOptions={{ headerShown: false, animation: reduced ? 'none' : 'shift', transitionSpec: { animation: 'timing', config: { duration: motion.select } } }} tabBar={props => <RouterTabBar {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="sell" />
        <Tabs.Screen name="buy" />
        <Tabs.Screen name="you" />
      </Tabs>
    </InTabs.Provider>
  );
}
