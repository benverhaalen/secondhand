// The two ways a photo can be made better, as two named choices side by side, because one can misstate the item and the
// other cannot (spec/edge-cases.md §6, agent proposal; ways-out §6.5 "Just fix the light, no AI"):
//   Clean up         crop, straighten, exposure, white balance, background blur. No generative model; it only adjusts the
//                    item's pixels. Offered first, one tap, and the same tap resets it to the original.
//   Enhance with AI  redraws light, background and creases, checked against the original before it can be used. Off until
//                    the person picks it, and named for what it is.
// Each is a chip on the camera's bar: a plus when off, a check when on. Its state is its icon, so it reads without color.
import { View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { Icon } from '../icon';
import { Press, slop } from '../press';
import { Txt } from '../text';
import { motion, size, space } from '../tokens.generated';
import { ChipBody } from './camera';
import { mark } from './mark';

const CHIP_H = space.s7;

// disabled: the redraw can't be trusted yet (no measurement to hold its size to); the camera says why beside it.
export function FixChip({ id, label, on, onPress, disabled = false }: { id: string; label: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Animated.View entering={FadeIn.duration(motion.select).reduceMotion(ReduceMotion.System)}>
      <Press id={id} label={label} selected={on} disabled={disabled} onPress={onPress} hit={slop(size.controlMin, CHIP_H)}>
        <ChipBody>
          <View {...mark('fix', { on: String(on), disabled: String(disabled), fit: 'content' })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1 }}>
            <Icon name={on ? 'tick-02' : 'add-01'} size={12} tone={disabled ? 'ink-2' : 'ink'} />
            <Txt role="body" tone={disabled ? 'ink-2' : 'ink'}>{label}</Txt>
          </View>
        </ChipBody>
      </Press>
    </Animated.View>
  );
}
