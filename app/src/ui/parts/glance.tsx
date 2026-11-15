// How it is going, at a glance: the one amount at the top of You, its line, and at most two numbers under it (Ben, 10:27:
// "simple ways to visualize and understand intutitively"; "a lot of clutter"). Why a part: You held a money bar, a chart,
// a bar of states and four rows of cells, each a page of its own; this is what stays when they move behind their rows,
// read the way Fitness and Health open a summary: the big number, then a few small ones that each name what they count.
// A stat is its number at 18 in ink over its word at 13 in the second ink, the two 32 apart, so each pair reads as one
// thing (Art. 7.2). No tabular figures: a lone value does not change in place, and the tabular digits read as spaced (Art. 6.7).
// Nothing here is pressed: the rows under it open each subject.
// States: the amount alone; with one stat; with two. More than two is a page, not a glance, so the third is dropped.
// Not marked as a part, as a Message is not: it is as tall as its stats (B31). The amount inside it is the [amount] part.
import { View } from 'react-native';
import { Txt } from '../text';
import { space } from '../tokens.generated';
import { FLAT } from './mark';
import { Amount } from './small';

export type Stat = { value: string; word: string };

export function Glance({ value, what, stats = [] }: { value: number; what: string; stats?: Stat[] }) {
  const shown = stats.slice(0, 2);
  return (
    <View style={{ gap: space.s4, ...FLAT }}>
      <Amount value={value} what={what} />
      {shown.length ? (
        <View style={{ flexDirection: 'row', gap: space.s7 }}>
          {shown.map(s => (
            <View key={s.word} accessibilityLabel={`${s.value} ${s.word}`}>
              <Txt role="headline">{s.value}</Txt>
              <Txt role="caption">{s.word}</Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
