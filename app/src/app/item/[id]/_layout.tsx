// The item's own stack: the page, and its two sheets. Plan and Post preview are routes, so a link or a test can open one,
// and each is drawn over the item page (transparentModal) by RouteSheet, which slides it up from the foot and back down
// itself (so no screen transition of the platform's runs under it). Opening a sheet's address cold still puts the item
// page under it (initialRouteName). Ship and Pickup keep the platform's push until their builder says otherwise.
import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'index' };

export default function ItemLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="plan" options={{ presentation: 'transparentModal', animation: 'none' }} />
      <Stack.Screen name="post" options={{ presentation: 'transparentModal', animation: 'none' }} />
    </Stack>
  );
}
