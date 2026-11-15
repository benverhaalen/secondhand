// Every pressable thing in the app. It gives way under the finger (scale 0.97, a spring, Art. 11 "Press"), keeps a hit
// area of at least 44 that splits the gap with its neighbours (frontend-standard §5), draws the focus ring, and logs the tap.
// Reduce Motion: an opacity dip in place of the scale (frontend-standard §3).
import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, View, type Insets } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { tap } from './log';
import { useColors } from './theme';
import { motion, radius, size } from './tokens.generated';

export type PressState = { pressed: boolean; hovered: boolean; focused: boolean };

// The focus ring is for the keyboard. On the web a click also focuses, and a ring after every tap would add a box that
// moves nothing but reads as a change (U7). So the ring shows only when the last input was a key.
let byKey = false;
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('keydown', () => { byKey = true; }, true);
  document.addEventListener('pointerdown', () => { byKey = false; }, true);
}

// How far the touch area reaches past the drawn shape: up to 44 in each direction, and no more than half the gap to a
// neighbour, so no point belongs to two targets. `gap` is the space to the nearest neighbour on that axis.
export function slop(w: number, h: number, gap: { x?: number; y?: number } = {}): Insets {
  const grow = (side: number, room?: number) => Math.max(0, Math.min((size.controlMin - side) / 2, room == null ? Infinity : room / 2));
  const x = grow(w, gap.x), y = grow(h, gap.y);
  return { left: x, right: x, top: y, bottom: y };
}

export function Press({ id, label, onPress, disabled = false, selected, expanded, hit, round = true, part, children }: {
  // What the log calls this control: "accept-offer", "tab-sell". Tests find it by this.
  id: string;
  // What a screen reader says, when the words inside do not say it.
  label?: string;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  // A header that folds what is under it: a screen reader says expanded or collapsed.
  expanded?: boolean;
  hit?: Insets;
  // A pill or a circle takes a round focus ring; a card takes its own corner.
  round?: boolean;
  part?: string;
  children: ReactNode | ((s: PressState) => ReactNode);
}) {
  const c = useColors(), screen = usePathname(), reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const look = useAnimatedStyle(() => (reduced ? { opacity: scale.get() < 1 ? 0.7 : 1 } : { transform: [{ scale: scale.get() }] }));
  const spring = (to: number, ms: number) => withSpring(to, { duration: ms, dampingRatio: 1, reduceMotion: ReduceMotion.System });
  return (
    <Pressable
      testID={id}
      {...(part ? ({ dataSet: { part, press: id } } as object) : ({ dataSet: { press: id } } as object))}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected, expanded }}
      disabled={disabled}
      hitSlop={hit}
      pressRetentionOffset={16}
      onPressIn={() => scale.set(spring(0.97, motion.feedback))}
      onPressOut={() => scale.set(spring(1, motion.panel))}
      onPress={() => { tap(id, screen); onPress?.(); }}>
      {(s: unknown) => {
        const st = s as PressState;
        return (
          <Animated.View style={look}>
            {typeof children === 'function' ? children({ pressed: st.pressed, hovered: !!st.hovered, focused: !!st.focused }) : children}
            {st.focused && (byKey || Platform.OS !== 'web') ? (
              // Focus: 2 px ink ring outside a 2 px gap in the page color (Art. 5, Interaction).
              <View pointerEvents="none" style={{ position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: round ? radius.pill : radius.card, borderWidth: 2, borderColor: c.ink }} />
            ) : null}
          </Animated.View>
        );
      }}
    </Pressable>
  );
}
