// How far this month's money kept is toward the goal the person set (spec/features/insights.md, Goals: the bar counts Kept,
// hitting it ends in the amount, no celebration, a missed month is not mentioned). Why a part: progress toward a number
// had no part, and a bar is the pattern every banking and fitness app uses for it.
// The content width by 44: the label and "$132 of $300" on one line, an 8 track 16 under it, pill ends. The fill is ink,
// as money is (C6: an amount stands out by size and ink, never a color). Past the goal the track is full; it never overflows.
import { View } from 'react-native';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, space } from '../tokens.generated';
import { FLAT, mark, money } from './mark';

export function GoalBar({ label, kept, target }: { label: string; kept: number; target: number }) {
  const c = useColors();
  const share = target > 0 ? Math.min(1, Math.max(0, kept / target)) : 0;
  return (
    <View {...mark('goal-bar')} accessibilityLabel={`${label}: ${money(kept)} of ${money(target)}`} style={{ gap: space.s2, ...FLAT }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s3 }}>
        <View style={{ flex: 1 }}><Txt role="body" lines={1}>{label}</Txt></View>
        <Txt role="body" tone="ink-2">{`${money(kept)} of ${money(target)}`}</Txt>
      </View>
      <View style={{ height: space.s2, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.gray, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(share * 1000) / 10}%`, height: '100%', borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.ink }} />
      </View>
    </View>
  );
}
