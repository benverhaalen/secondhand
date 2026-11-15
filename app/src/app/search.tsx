// A stub, so every route exists before its builder starts. The page's builder replaces this file (.agents/ui-build/README.md).
import { router } from 'expo-router';
import { Nav, Screen, Txt } from '@/ui';

export default function Search() {
  return (
    <Screen name="search" state="stub" nav={<Nav back={() => router.back()} />}>
      <Txt role="heading">Search</Txt>
    </Screen>
  );
}
