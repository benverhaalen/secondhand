// Why this part: Today's lower tiers ask less than its first, and a long list of them buries the cards that need the person
// now. Ben, 07:12: "this is when you should use the collapsable pile where they are layered and an animation expands them".
// A pile is those cards laid one on another: the top card in full, and under it the edges of the next two, so the shape
// says there is more (research/today/ben/top-of-today-and-stacking.md §2). A tap on the edges, or on Show all in the
// shelf's header, fans them out in place with a spring; Show less folds them back. Only a tier with no deadline under it is
// piled: Today's first tier stays spread, since hiding a deadline breaks its promise (the same research).
// States: one card (no pile, just the card), piled (the top card and up to two edges, a fixed height: the card's and 12
// for each edge, so nothing moves until the person taps), fanned (every card, 16 apart, as Feed lays them, each answered
// card leaving with the gap closing). The edges are drawn as DecisionCard's queue draws them: the surface at 75% then 40%,
// scaled .97 and .93, each 12 lower, with the stack shadow in light and the card edge in dark (Art. 9.2).
// Motion: fanning is a spring of --t-panel that settles on its own and can be interrupted; each card under the top rises out
// of the pile as it fades in. Reduce Motion: the cards are there at once.
// Children must carry a key, the card's own, so the right one stays on top and the right one leaves.
import { Children, isValidElement, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { Press, slop } from '../press';
import { useColors, useScheme } from '../theme';
import { motion, radius, size, space } from '../tokens.generated';

const RATIO = 0.82; // a little give at the end, so the cards land rather than stop

export function Pile({ id, open, onOpen, children }: {
  // Names the pile's tap target ({id}-pile) and data-pile.
  id: string;
  open: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  const c = useColors(), scheme = useScheme();
  const cards = Children.toArray(children);
  const key = (child: ReactNode, i: number) => (isValidElement(child) && child.key != null ? child.key : i);
  const settles = LinearTransition.springify(motion.panel).dampingRatio(RATIO).reduceMotion(ReduceMotion.System);
  const rises = FadeInUp.springify(motion.panel).dampingRatio(RATIO).reduceMotion(ReduceMotion.System);
  const leaves = FadeOut.duration(motion.feedback).reduceMotion(ReduceMotion.System);
  const under = Math.min(2, cards.length - 1);

  if (open || under < 1) {
    return (
      <View {...({ dataSet: { pile: id, open: under < 1 ? 'one' : 'true' } } as object)} style={{ gap: space.s4 }}>
        {cards.map((child, i) => (
          <Animated.View key={key(child, i)} layout={settles} entering={i ? rises : undefined} exiting={leaves}>{child}</Animated.View>
        ))}
      </View>
    );
  }

  const edge = (i: number) => (
    <View key={`edge-${i}`} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: space.s3 * (i + 1), height: size.cardDecisionH, borderRadius: radius.card, borderCurve: 'continuous',
      backgroundColor: c.surface, opacity: i === 0 ? 0.75 : 0.4, transform: [{ scale: i === 0 ? 0.97 : 0.93 }],
      ...(scheme === 'dark' ? { borderWidth: 1, borderColor: c.cardEdge } : { boxShadow: `0 6px 14px ${c.stackShade}` }) }} />
  );
  return (
    <View {...({ dataSet: { pile: id, open: 'false' } } as object)} style={{ paddingBottom: space.s3 * under }}>
      {Array.from({ length: under }, (_, i) => edge(under - 1 - i))}
      <Animated.View key={key(cards[0], 0)} layout={settles} exiting={leaves}>{cards[0]}</Animated.View>
      {/* The edges are the pile's own target: a tap there fans it out. 44 tall, reaching up over the card's lower padding. */}
      <View style={{ position: 'absolute', left: space.s6, right: space.s6, bottom: 0, height: space.s3 * under }}>
        <Press id={`${id}-pile`} label={`Show all ${cards.length}`} onPress={onOpen} round={false} hit={slop(size.controlMin, size.controlMin)}>
          <View style={{ height: space.s3 * under }} />
        </Press>
      </View>
    </View>
  );
}
