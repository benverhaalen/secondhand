// An amount each week with how many made it (Ben 06:19: explain it with visuals and in context, so one big sale reads as
// one sale). One question, one form: a bar per week, because each week is its own amount and a person compares heights.
// A real scale: an axis from zero to `top`, titled, with a hairline at zero, half and the top. Under each week the day it
// starts, the month under the first week of each month, then its count, in the same column: two measures, one axis (dataviz:
// never a second y-scale). One series, so no legend: the section title names it. This week is ink and the rest the second
// ink, so the eye lands on now. No number sits on a bar: the axis gives the scale and each column tells a screen reader its
// amount. A week with nothing has no bar: the axis says zero. Bars are thin (16) with round tops and a flat base, so a small
// week still reads as a bar. Why a part: the kit's WeekBars has no axis and no count, and a screen draws no shapes itself.
import { View } from 'react-native';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, space } from '../tokens.generated';
import { mark, money } from './mark';

const PLOT = space.s9 * 2, HEAD = space.s7, AXIS = 44, BAR = space.s4, HALF = 9;

export function WeekChart({ weeks, top, axis, count }: {
  // label: "Sep 21" for the first week of a month, else the day ("28"). amount in dollars.
  weeks: { label: string; amount: number; n: number; now?: boolean }[];
  // The axis top in dollars: a round number at or over the tallest week.
  top: number;
  // The axis title: what the amount is ("After fees").
  axis: string;
  // The count row: its name and its noun ("Sales", ["sale", "sales"]).
  count: { name: string; one: string; many: string };
}) {
  const c = useColors();
  const ticks = [top, top / 2, 0];
  const at = (amount: number) => Math.round((amount / top) * PLOT);
  const noun = (n: number) => (n === 1 ? count.one : count.many);
  const cell = { flex: 1, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View {...mark('week-chart')} accessibilityLabel={`${count.name} each week, ${axis.toLowerCase()}`} style={{ gap: space.s2 }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: AXIS, height: PLOT + HEAD }}>
          <View style={{ position: 'absolute', left: 0, top: 0, width: AXIS * 3 }}><Txt role="caption" lines={1}>{axis}</Txt></View>
          {ticks.map(t => (
            <View key={t} style={{ position: 'absolute', left: 0, right: space.s2, bottom: at(t) - HALF, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <Txt role="caption" lines={1}>{money(t)}</Txt>
            </View>
          ))}
        </View>
        <View style={{ flex: 1, height: PLOT + HEAD }}>
          {ticks.map(t => <View key={t} style={{ position: 'absolute', left: 0, right: 0, bottom: at(t), height: 1, backgroundColor: c.rule }} />)}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, flexDirection: 'row', alignItems: 'flex-end', gap: space.s2 }}>
            {weeks.map((w, i) => (
              <View key={i} accessibilityLabel={`Week of ${w.label}: ${money(w.amount)} from ${w.n} ${noun(w.n)}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                {w.amount > 0 ? <View style={{ width: BAR, height: Math.max(BAR / 2, at(w.amount)), borderTopLeftRadius: radius.pill, borderTopRightRadius: radius.pill, backgroundColor: w.now ? c.ink : c.ink2 }} /> : null}
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: AXIS }} />
        <View style={{ flex: 1, flexDirection: 'row', gap: space.s2 }}>
          {weeks.map((w, i) => <View key={i} style={cell}><Txt role="caption" tone={w.now ? 'ink' : 'ink-2'} lines={1}>{w.label.split(' ').pop()}</Txt></View>)}
        </View>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: AXIS }} />
        <View style={{ flex: 1, flexDirection: 'row', gap: space.s2 }}>
          {weeks.map((w, i) => <View key={i} style={cell}><Txt role="caption" lines={1}>{w.label.includes(' ') ? w.label.split(' ')[0] : ' '}</Txt></View>)}
        </View>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: AXIS }}><Txt role="caption" lines={1}>{count.name}</Txt></View>
        <View style={{ flex: 1, flexDirection: 'row', gap: space.s2 }}>
          {weeks.map((w, i) => <View key={i} style={cell}><Txt role="caption" tone={w.n ? 'ink' : 'ink-2'} lines={1}>{String(w.n)}</Txt></View>)}
        </View>
      </View>
    </View>
  );
}
