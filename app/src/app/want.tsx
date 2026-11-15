// A stub, so every route exists before its builder starts. The page's builder replaces this file (.agents/ui-build/README.md).
import { router } from 'expo-router';
import { Nav, Screen, Txt } from '@/ui';

export default function Want() {
  return (
    <Screen name="want" state="stub" nav={<Nav back={() => router.back()} />}>
      <Txt role="heading">Want</Txt>
    </Screen>
  );
}
