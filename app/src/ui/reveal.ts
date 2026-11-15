import { createContext } from 'react';
import { FadeInDown, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { motion, space } from './tokens.generated';

export const ContentOrder = createContext(0);
export const arrival = (order = 0) => FadeInDown.duration(motion.select).delay(order * motion.feedback)
  .withInitialValues({ opacity: 0, transform: [{ translateY: space.s2 }] }).reduceMotion(ReduceMotion.System);
export const departure = FadeOut.duration(motion.feedback).reduceMotion(ReduceMotion.System);
export const reflow = LinearTransition.duration(motion.select).reduceMotion(ReduceMotion.System);
