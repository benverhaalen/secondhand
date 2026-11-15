// What a product has sold for used, month by month, against its price new (pages §6.15 "price history new against
// used"). Why a part: the product page is the only place a trend is read, and a sentence ("falling since June") hides
// how far. One series, so no legend: thin bars from a zero baseline (a bar's length is its amount), one per month, in
// second ink, the month you look at in ink with its month and amount over it. The price new is one dashed reference line, named where it
// ends, never a second series. A tap on a month shows its amount (the chart's hover layer on a phone); the latest month
// is shown first. The content width by 176, whatever the amounts.
import { useState } from 'react';
import { View } from 'react-native';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, space, type } from '../tokens.generated';
import { FLAT, mark, money } from './mark';

const PLOT = 120, BAR = space.s2;

export function PriceChart({ id, points, reference }: {
  id: string;
  // One per month, oldest first, in the person's currency units: { label: 'Jun', value: 98 }.
  points: { label: string; value: number }[];
  // The price new, drawn as a line: { label: 'New', value: 115 }.
  reference?: { label: string; value: number };
}) {
  const c = useColors();
  const [at, setAt] = useState(points.length - 1);
  const top = Math.max(...points.map(p => p.value), reference?.value ?? 0) * 1.15 || 1;
  const h = (v: number) => Math.round((v / top) * PLOT);
  return (
    <View {...mark('price-chart')} style={{ height: type.t13.lineHeight + space.s1 + PLOT + space.s2 + type.t13.lineHeight, ...FLAT }}>
      <View style={{ height: type.t13.lineHeight + space.s1 + PLOT, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderColor: c.rule }}>
        {reference ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: h(reference.value), borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.ink2 }}>
            <View style={{ position: 'absolute', right: 0, bottom: space.s1 }}><Txt role="caption">{reference.label} {money(reference.value)}</Txt></View>
          </View>
        ) : null}
        {points.map((p, i) => (
          <View key={p.label + i} style={{ flex: 1, alignItems: 'center', gap: space.s1 }}>
            {/* The value sits over the bar, outside its press: the press is the bar, and a bar is a filled shape (U1). */}
            <View style={{ height: type.t13.lineHeight }}>{i === at ? <Txt role="caption" tone="ink">{`${p.label} ${money(p.value)}`}</Txt> : null}</View>
            <Press id={`${id}-${i}`} label={`${p.label}, ${money(p.value)}`} selected={i === at} onPress={() => setAt(i)} round={false}>
              <View style={{ alignItems: 'center', minWidth: space.s8 }}>
                <View style={{ width: BAR, height: h(p.value), borderRadius: radius.pill, backgroundColor: i === at ? c.ink : c.ink2, opacity: i === at ? 1 : 0.35 }} />
              </View>
            </Press>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', paddingTop: space.s2 }}>
        {points.map((p, i) => <View key={p.label + i} style={{ flex: 1, alignItems: 'center' }}><Txt role="caption" tone={i === at ? 'ink' : 'ink-2'}>{p.label}</Txt></View>)}
      </View>
    </View>
  );
}
