// A group of cards under a quiet label: "Needs you", "New matches" over cards titled at 18 (Art. 7.11, check U10). Why a
// part: Section sets its title at 18 in ink, which is right over tiles and rows titled at 15 and wrong over cards, whose
// titles are 18 in ink too, so the page read as one flat list of equal lines (Ben, 09:44: "it lacks hierarchy"). Here the
// label is a 15 in the second ink, as iOS sets a grouped list's header over its rows, 12 above the first card, while the
// cards keep 16 between them: the label belongs to what it heads (Art. 7.2). The label is marked data-head, so the
// composition check reads it as a header.
// States: with a label; without one (the cards alone, 16 apart).
import { useContext, type ReactNode } from 'react';
import Animated from 'react-native-reanimated';
import { arrival, ContentOrder, reflow } from '../reveal';
import { View } from 'react-native';
import { Txt } from '../text';
import { space } from '../tokens.generated';

export function CardGroup({ label, children }: { label?: string; children: ReactNode }) {
  const order = useContext(ContentOrder);
  return (
    <Animated.View entering={arrival(order)} layout={reflow} style={{ gap: space.s3 }}>
      {label ? <View {...({ dataSet: { head: 'cards' } } as object)}><Txt role="body" tone="ink-2">{label}</Txt></View> : null}
      <View style={{ gap: space.s4 }}>{children}</View>
    </Animated.View>
  );
}
