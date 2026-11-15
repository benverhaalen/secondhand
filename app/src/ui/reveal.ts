import { createContext } from 'react';
import { Platform } from 'react-native';
import { FadeInDown, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { motion, space } from './tokens.generated';

export const ContentOrder = createContext(0);
// On the web, Reanimated 4.7 gives an entering animation with initial values its own keyframe name, and its cleanup then
// pins the element at position absolute on a stale snapshot (layoutReanimation/web/componentUtils.ts, scheduleAnimationCleanup):
// the shop's result rows were drawn over each other (Nate, 2026-11-15). The web takes the preset's own start instead.
const down = (order: number) => FadeInDown.duration(motion.select).delay(order * motion.feedback);
export const arrival = (order = 0) => (Platform.OS === 'web' ? down(order)
  : down(order).withInitialValues({ opacity: 0, transform: [{ translateY: space.s2 }] })).reduceMotion(ReduceMotion.System);
export const departure = FadeOut.duration(motion.feedback).reduceMotion(ReduceMotion.System);
export const reflow = LinearTransition.duration(motion.select).reduceMotion(ReduceMotion.System);
