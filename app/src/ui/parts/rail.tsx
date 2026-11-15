// Things side by side that scroll across: a shelf of Tiles under an answer, each a third of the row, the width a
// three-column Grid gives a Tile on Sell, 12 apart, the group gap. (The per-source lanes that lived here are gone:
// Nate, words.md 2026-11-15, "this view sucks"; the sources float as logos in ./source-float.)
import { Children, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { space } from '../tokens.generated';
import { useWindow } from '../window';
import { mark } from './mark';

export function Rail({ children }: { children: ReactNode }) {
  const { width } = useWindow(), column = (width - 2 * space.gutter - 2 * space.s3) / 3;
  return (
    <ScrollView {...mark('rail')} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s3 }}>
      {Children.toArray(children).map((child, i) => <View key={i} style={{ width: column }}>{child}</View>)}
    </ScrollView>
  );
}
