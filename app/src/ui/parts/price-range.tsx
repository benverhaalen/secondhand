// A price against what the same thing sells for (pages §6.14 "price against the fair range"; Want "the most you'd pay
// with the fair range under it"). Why a part: "Similar ones sold for $65 to $95" says the range, but where this price
// sits in it is seen faster than read (copy.md, Show rather than say). A gray track, the fair range on it in second ink,
// and a dot for this price, in ink, over one line that says the range in words, so the bar never stands alone and no
// amount is left without what it is (Art. 5: color is never the only sign; C6). The content width by 42, whatever the amounts.
// States: with a price (the dot), without one (the range alone).
import { View } from 'react-native';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, space, type } from '../tokens.generated';
import { FLAT, mark, money } from './mark';

const TRACK = space.s2, DOT = space.s4;

export function PriceRange({ low, high, at, words = 'Sold for' }: {
  // The fair range, in the person's currency units (dollars), as every amount a part takes.
  low: number;
  high: number;
  // This price, when there is one.
  at?: number;
  // What the range is, before it: "Sold for" reads "Sold for $65 to $95 lately".
  words?: string;
}) {
  const c = useColors();
  const lo = Math.min(low, at ?? low), hi = Math.max(high, at ?? high), pad = (hi - lo || hi || 1) * 0.15;
  const share = (v: number) => (v - (lo - pad)) / (hi - lo + 2 * pad);
  const pct = (v: number) => `${share(v) * 100}%` as const;
  return (
    <View {...mark('price-range', { dot: at == null ? 'none' : 'shown' })} style={{ gap: space.s1, height: DOT + space.s1 + type.t13.lineHeight, ...FLAT }}>
      <View style={{ height: DOT, justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ height: TRACK, borderRadius: radius.pill, backgroundColor: c.gray }} />
        <View style={{ position: 'absolute', left: pct(low), width: `${(share(high) - share(low)) * 100}%`, height: TRACK, borderRadius: radius.pill, backgroundColor: c.ink2, opacity: 0.5 }} />
        {at != null ? (
          <View style={{ position: 'absolute', left: pct(at), marginLeft: -space.s2, width: DOT, height: DOT, borderRadius: radius.pill, backgroundColor: c.ink, borderWidth: 2, borderColor: c.page }} />
        ) : null}
      </View>
      <Txt role="caption" lines={1}>{`${words} ${money(low)} to ${money(high)} lately`}</Txt>
    </View>
  );
}
