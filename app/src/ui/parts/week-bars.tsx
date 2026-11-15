// Money kept each week, as bars (research/today/ben/top-of-today-and-stacking.md §1: the chart lives on You, and shows only
// once 3 weeks have a sale, so it always has a shape). Why a part: no part drew a series, and a chart drawn on a screen
// would take its own sizes. A bar chart, not a line: each week is a separate amount, and a person compares heights.
// 350 by 122: bars 96 tall at most with round ends, 8 apart, a 13 date 8 under them. This week is ink; past weeks the second ink, so the
// eye lands on now. A week with nothing kept is a 4 stub on the base line, so a gap reads as zero and not as missing.
// No axis or grid: the total sits above the chart in words, and each bar says its amount to a screen reader.
import { View } from 'react-native';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, space } from '../tokens.generated';
import { FLAT, mark, money } from './mark';

const TALL = space.s9 + space.s7, STUB = space.s1;

export function WeekBars({ weeks }: { weeks: { label: string; amount: number; now?: boolean }[] }) {
  const c = useColors();
  const top = Math.max(...weeks.map(w => w.amount), 0);
  return (
    <View {...mark('week-bars')} style={{ gap: space.s2, ...FLAT }}>
      <View style={{ height: TALL, flexDirection: 'row', alignItems: 'flex-end', gap: space.s2 }}>
        {weeks.map((w, i) => (
          <View key={i} accessibilityLabel={`Week of ${w.label}: ${money(w.amount)}`} style={{ flex: 1, height: top > 0 && w.amount > 0 ? Math.max(STUB, Math.round((w.amount / top) * TALL)) : STUB,
            borderRadius: radius.pill,
            backgroundColor: w.amount > 0 ? (w.now ? c.ink : c.ink2) : c.rule }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.s2 }}>
        {weeks.map((w, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Txt role="caption" tone={w.now ? 'ink' : 'ink-2'} lines={1}>{w.label}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}
