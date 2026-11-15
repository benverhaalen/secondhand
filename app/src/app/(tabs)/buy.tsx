// A stub, so every route exists before its builder starts. The page's builder replaces this file (.agents/ui-build/README.md).
import { Nav, Screen, Txt } from '@/ui';

export default function Buy() {
  return (
    <Screen name="buy" state="stub" nav={<Nav inbox={{ count: 0 }} />}>
      <Txt role="heading">Buy</Txt>
    </Screen>
  );
}
