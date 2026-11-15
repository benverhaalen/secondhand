// A stub, so every route exists before its builder starts. The page's builder replaces this file (.agents/ui-build/README.md).
import { router } from 'expo-router';
import { Nav, Screen, Txt } from '@/ui';

export default function ItemPickup() {
  return (
    <Screen name="item-pickup" state="stub" nav={<Nav back={() => router.back()} />}>
      <Txt role="heading">Pickup</Txt>
    </Screen>
  );
}
