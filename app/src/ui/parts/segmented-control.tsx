import { useEffect, useState } from 'react';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { View } from 'react-native';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { motion, radius, size, space } from '../tokens.generated';
import { mark } from './mark';

export function SegmentedControl({ id, options, value, onChange }: {
  id: string;
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const index = options.findIndex(option => option.id === value);
  const position = useSharedValue(Math.max(0, index));
  const segmentWidth = Math.max(0, width - space.s1 * 2) / Math.max(1, options.length);
  useEffect(() => {
    position.set(withTiming(Math.max(0, index), { duration: motion.select, reduceMotion: ReduceMotion.System }));
  }, [index, position]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() * segmentWidth }] }));
  return (
    <View {...mark('segmented-control')} onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row', padding: space.s1, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.gray }}>
      {index >= 0 && width > 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: space.s1, bottom: space.s1, left: space.s1, width: segmentWidth, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.ink }, indicator]} />
      ) : null}
      {options.map(option => (
        <View key={option.id} style={{ flex: 1 }}>
          <Press id={`${id}-${option.id}`} label={option.label} selected={value === option.id} onPress={() => onChange(option.id)}>
            {({ pressed }) => (
              <View style={{ minHeight: size.controlMin, paddingHorizontal: space.s3, paddingVertical: space.s2, borderRadius: radius.pill, borderCurve: 'continuous',
                alignItems: 'center', justifyContent: 'center', backgroundColor: pressed && value !== option.id ? c.grayPress : 'transparent' }}>
                <Txt role="body" tone={value === option.id ? 'on-ink' : 'ink'}>{option.label}</Txt>
              </View>
            )}
          </Press>
        </View>
      ))}
    </View>
  );
}
