import { Children, isValidElement, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import Animated, { Easing, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { motion, space } from '../tokens.generated';
import { useWindow } from '../window';

export function TodayRail({ id, children }: { id: string; children: ReactNode }) {
  const { width } = useWindow();
  const cardWidth = width - space.gutter * 2 - space.s4;
  const closes = LinearTransition.duration(motion.select).easing(Easing.bezier(0.23, 1, 0.32, 1)).reduceMotion(ReduceMotion.System);
  return (
    <ScrollView horizontal snapToInterval={cardWidth + space.s4} snapToAlignment="start" decelerationRate="fast" disableIntervalMomentum showsHorizontalScrollIndicator={false} accessibilityLabel={id}
      style={{ marginHorizontal: -space.gutter }}
      contentContainerStyle={{ paddingHorizontal: space.gutter, gap: space.s4, alignItems: 'stretch', paddingBottom: space.s2 }}>
      {Children.toArray(children).map((child, i) => (
        <Animated.View key={isValidElement(child) && child.key != null ? child.key : i}
          layout={closes} exiting={FadeOut.duration(motion.feedback).reduceMotion(ReduceMotion.System)}
          style={{ width: cardWidth }}>
          {child}
        </Animated.View>
      ))}
    </ScrollView>
  );
}
