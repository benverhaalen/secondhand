// A plain on or off, the switch every phone's Settings uses (copy.md: borrow what people know). Why a part: Pause selling,
// quiet hours, a rule that runs on its own and Never suggest edits are each one yes or no, and no part said that.
// 52 by 32 (32 and 20 from the space scale), a 24 knob 4 in, in a 44 touch area. On: the ink track with a page knob,
// the way the black pill says "this is set". Off: the gray track with a knob in the second ink, so it reads in both modes.
// disabled: drawn at the second ink, and the row beside it says why (Art. 5: a disabled control says why nearby).
// The knob slides in --t-select with Emil's ease-out when the value changes, and holds still under Reduce Motion.
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MOTIONS } from '../motion';
import { Press, slop } from '../press';
import { useColors } from '../theme';
import { radius, space } from '../tokens.generated';
import { mark } from './mark';

const W = space.s7 + space.s5, H = space.s7, KNOB = space.s6, IN = space.s1, TRAVEL = W - KNOB - IN * 2;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export function Switch({ id, label, on, onChange, disabled = false }: {
  id: string;
  // What it turns on or off, for a screen reader: the row's own label.
  label: string;
  on: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  const x = useSharedValue(on ? TRAVEL : 0);
  const ms = typeof MOTIONS.select.ms === 'number' ? MOTIONS.select.ms : 0;
  useEffect(() => { x.set(withTiming(on ? TRAVEL : 0, { duration: ms, easing: EASE_OUT, reduceMotion: ReduceMotion.System })); }, [on, ms, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <Press id={id} label={label} selected={on} disabled={disabled} onPress={() => onChange?.(!on)} hit={slop(W, H)}>
      <View
        {...mark('switch', { on: on ? 'true' : 'false' })}
        accessibilityRole="switch"
        accessibilityState={{ checked: on, disabled }}
        style={{ width: W, height: H, borderRadius: radius.pill, padding: IN, backgroundColor: on && !disabled ? c.ink : c.gray, opacity: disabled ? 0.5 : 1 }}>
        <Animated.View style={[{ width: KNOB, height: KNOB, borderRadius: radius.pill, backgroundColor: on && !disabled ? c.page : c.ink2 }, knob]} />
      </View>
    </Press>
  );
}
