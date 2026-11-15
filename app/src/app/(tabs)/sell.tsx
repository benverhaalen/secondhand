// A stub, so every route exists before its builder starts. The page's builder replaces this file (.agents/ui-build/README.md).
import { Nav, Screen, Txt } from '@/ui';

export default function Sell() {
  return (
    <Screen name="sell" state="stub" nav={<Nav inbox={{ count: 0 }} />}>
      <Txt role="heading">Sell</Txt>
    </Screen>
  );
}
