// Where the money is, on one scale (Ben 06:19: "I want to know how much I could earn"): paid out, on its way, and what the
// live listings could still bring, each a length of one bar, so the person sees how much of it is real yet. Colors follow the
// state they belong to everywhere else (ui/states.ts): lime is paid, mint is sold and on its way, sky is live. What could
// still be earned is a range across sites: the sure part is solid sky, and the rest up to the high end is a quieter step of sky. Below
// the bar each part is a row with its swatch, its words and its amount, and opens the page that holds it. Text stays in ink;
// the swatch carries identity, so color is never alone. Why a part: no part drew a share of a whole, and a screen draws no
// shapes itself.
import { View } from 'react-native';
import { Icon } from '../icon';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors, useScheme } from '../theme';
import { radius, space } from '../tokens.generated';
import { mark } from './mark';

export type MoneyPart = { id: string; label: string; detail?: string; value: string; low: number; high?: number; fill: 'lime' | 'mint' | 'sky'; onPress: () => void };
const BAR = 12, GAP = 4, MIN = 4;

export function MoneyBar({ parts }: { parts: MoneyPart[] }) {
  const c = useColors(), dark = useScheme() === 'dark';
  const total = parts.reduce((a, p) => a + (p.high ?? p.low), 0);
  // The unsure part is the quieter step of the same hue: the tint on light, the deep tone on dark (the dark Today Ben praised).
  const tint = dark ? { lime: c.limeDeep, mint: c.mintDeep, sky: c.skyDeep } : { lime: c.limeTint, mint: c.mintTint, sky: c.skyTint };
  return (
    <View {...mark('money-bar')} style={{ gap: space.s3 }}>
      <View accessibilityLabel={parts.map(p => `${p.label}: ${p.value}`).join('. ')} style={{ height: BAR, flexDirection: 'row', gap: GAP }}>
        {parts.map(p => {
          const sure = Math.max(MIN, (p.low / total) * 100), more = p.high && p.high > p.low ? ((p.high - p.low) / total) * 100 : 0;
          return (
            <View key={p.id} style={{ flexBasis: `${sure + more}%`, flexGrow: 0, flexShrink: 1, flexDirection: 'row', borderRadius: radius.pill, borderCurve: 'continuous', overflow: 'hidden' }}>
              <View style={{ flex: sure, backgroundColor: c[p.fill] }} />
              {more ? <View style={{ flex: more, backgroundColor: tint[p.fill] }} /> : null}
            </View>
          );
        })}
      </View>
      <View>
        {parts.map(p => (
          <Press key={p.id} id={p.id} onPress={p.onPress} round={false}>
            {() => (
              <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
                <View style={{ width: BAR, height: BAR, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c[p.fill] }} />
                <View style={{ flex: 1 }}>
                  <Txt role="body" lines={1}>{p.label}</Txt>
                  {p.detail ? <Txt role="caption" lines={1}>{p.detail}</Txt> : null}
                </View>
                <Txt role="body" tone="ink-2" lines={1}>{p.value}</Txt>
                <Icon name="arrow-right-01" size={20} tone="ink-2" />
              </View>
            )}
          </Press>
        ))}
      </View>
    </View>
  );
}
