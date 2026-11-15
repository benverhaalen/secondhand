// Everything being sold, by where it is (Ben 06:19: "I want to know my listings"): one bar cut by count, in the order a thing
// moves (getting ready, live, sold), then a tile per part with its count and word that opens that shelf on Sell. Part to
// whole of a handful of counts is one bar, not a pie: lengths compare, angles don't. Each part wears the fill its state wears on
// Sell (ui/states.ts), with its icon on the tile, so color is never the only sign. Tiles are told apart by tone, not lines
// (research/cross-cutting/ben/taste-evidence.md, reading 1). Why a part: no part drew a share of a whole, and a screen draws
// no shapes itself.
import { View } from 'react-native';
import { Icon, type IconName } from '../icon';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors, useScheme } from '../theme';
import { radius, space } from '../tokens.generated';
import { mark } from './mark';

const BAR = 12, GAP = 4;

export type StatePart = { id: string; word: string; count: number; fill: 'gray' | 'sky' | 'mint' | 'peach' | 'lilac'; icon: IconName; note?: string };

export function StateBar({ parts, onOpen }: { parts: StatePart[]; onOpen: (id: string) => void }) {
  const c = useColors(), dark = useScheme() === 'dark';
  const total = parts.reduce((a, p) => a + p.count, 0);
  // Gray reads as nothing on the dark page, so getting ready takes the pressed gray there.
  const fill = (p: StatePart) => (p.fill === 'gray' && dark ? c.grayPress : c[p.fill]);
  return (
    <View {...mark('state-bar')} style={{ gap: space.s3 }}>
      <View accessibilityLabel={parts.map(p => `${p.count} ${p.word.toLowerCase()}`).join(', ')} style={{ height: BAR, flexDirection: 'row', gap: GAP }}>
        {parts.map(p => <View key={p.id} style={{ flex: p.count / total, borderRadius: radius.pill, backgroundColor: fill(p) }} />)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}>
        {parts.map(p => (
          <View key={p.id} style={{ flexBasis: '48%', flexGrow: 1 }}>
            <Press id={p.id} onPress={() => onOpen(p.id)} round={false}>
              {({ pressed }) => (
                <View style={{ minHeight: 72, borderRadius: radius.photo, padding: space.s4, gap: space.s1, backgroundColor: pressed ? c.grayPress : c.gray }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
                    <View style={{ width: BAR, height: BAR, borderRadius: radius.pill, backgroundColor: fill(p) }} />
                    <Txt role="headline" lines={1}>{String(p.count)}</Txt>
                    <View style={{ flex: 1 }} />
                    <Icon name={p.icon} size={20} tone="ink-2" />
                  </View>
                  <Txt role="caption" lines={1}>{p.note ? `${p.word}, ${p.note}` : p.word}</Txt>
                </View>
              )}
            </Press>
          </View>
        ))}
      </View>
    </View>
  );
}
