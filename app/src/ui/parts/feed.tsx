// Why this part: Today's cards are answered many times a day, and an answered card has to leave without the rest jumping.
// The card collapses and the cards under it close the gap in --t-select (frontend-standard §3, "Approve a Today card",
// borrowed from Gmail's archive with Undo). Stack holds its children still, so no existing part could do it.
// States: a card stays (nothing moves), a card leaves (it fades in --t-feedback while the ones under it slide up in
// --t-select), a card comes back after Undo (it takes its place again and the ones under it slide down).
// Reduce Motion: the card goes and the gap closes at once.
// Children must carry a key, the card's own, so the right one leaves.
import { Children, isValidElement, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Easing, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { MOTIONS } from '../motion';
import { motion, space } from '../tokens.generated';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Cards one under another, 16 apart (Art. 7.8), like Stack gap="cards", that leave and close the gap when answered.
export function Feed({ children }: { children: ReactNode }) {
  const ms = typeof MOTIONS.select.ms === 'number' ? MOTIONS.select.ms : motion.select;
  const closes = LinearTransition.duration(ms).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
  const leaves = FadeOut.duration(motion.feedback).reduceMotion(ReduceMotion.System);
  return (
    // No data-part: like Stack it is a container whose height is its cards', so it has no one size to hold (B31).
    <View style={{ gap: space.s4 }}>
      {Children.toArray(children).map((child, i) => (
        <Animated.View key={isValidElement(child) && child.key != null ? child.key : i} layout={closes} exiting={leaves}>
          {child}
        </Animated.View>
      ))}
    </View>
  );
}
