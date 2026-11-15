// A stub, so every route exists before its builder starts. The page's builder replaces this file (.agents/ui-build/README.md).
import { Nav, Screen, Txt } from '@/ui';

export default function You() {
  return (
    <Screen name="you" state="stub" nav={<Nav inbox={{ count: 0 }} />}>
      <Txt role="heading">You</Txt>
    </Screen>
  );
}
